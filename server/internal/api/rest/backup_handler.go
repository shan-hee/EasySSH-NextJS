package rest

import (
	"archive/zip"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/easyssh/server/internal/domain/aiconfig"
	"github.com/easyssh/server/internal/domain/notificationconfig"
	"github.com/easyssh/server/internal/domain/security"
	"github.com/easyssh/server/internal/domain/systemconfig"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// BackupHandler 简化的备份处理器
type BackupHandler struct {
	db         *gorm.DB
	backupDir  string
	dbHost     string
	dbPort     string
	dbName     string
	dbUser     string
	dbPassword string
}

// NewBackupHandler 创建备份处理器
func NewBackupHandler(db *gorm.DB, dbHost, dbPort, dbName, dbUser, dbPassword string) *BackupHandler {
	backupDir := strings.TrimSpace(os.Getenv("BACKUP_DIR"))
	if backupDir == "" {
		backupDir = "./backups"
	}

	h := &BackupHandler{
		db:         db,
		backupDir:  backupDir,
		dbHost:     dbHost,
		dbPort:     dbPort,
		dbName:     dbName,
		dbUser:     dbUser,
		dbPassword: dbPassword,
	}

	if err := h.ensureBackupDir(); err != nil {
		fallbackDir := filepath.Join(os.TempDir(), "easyssh-backups")
		fmt.Printf("Backup directory %q is unavailable: %v. Falling back to %q\n", h.backupDir, err, fallbackDir)
		h.backupDir = fallbackDir
		if fallbackErr := h.ensureBackupDir(); fallbackErr != nil {
			fmt.Printf("Backup fallback directory %q is unavailable: %v\n", h.backupDir, fallbackErr)
		}
	}

	// 启动时清理旧的临时文件
	h.cleanupOldTempFiles()

	return h
}

// ensureBackupDir 确认备份临时目录存在且当前进程可写。
func (h *BackupHandler) ensureBackupDir() error {
	if err := os.MkdirAll(h.backupDir, 0750); err != nil {
		return err
	}

	testFile := filepath.Join(h.backupDir, ".write-test")
	file, err := os.OpenFile(testFile, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0600)
	if err != nil {
		return err
	}

	if err := file.Close(); err != nil {
		_ = os.Remove(testFile)
		return err
	}

	if err := os.Remove(testFile); err != nil && !os.IsNotExist(err) {
		return err
	}

	return nil
}

// cleanupOldTempFiles 清理旧的临时文件
func (h *BackupHandler) cleanupOldTempFiles() {
	files, err := os.ReadDir(h.backupDir)
	if err != nil {
		return
	}

	now := time.Now()
	for _, file := range files {
		// 只清理备份恢复流程产生的临时文件
		if !isBackupTempFile(file.Name()) {
			continue
		}

		filePath := filepath.Join(h.backupDir, file.Name())
		info, err := os.Stat(filePath)
		if err != nil {
			continue
		}

		// 删除超过 1 小时的临时文件
		if now.Sub(info.ModTime()) > time.Hour {
			if err := os.Remove(filePath); err == nil {
				fmt.Printf("Cleaned up old temp file: %s\n", file.Name())
			}
		}
	}
}

func isBackupTempFile(name string) bool {
	return name == ".write-test" ||
		strings.HasPrefix(name, "import_") ||
		strings.HasPrefix(name, "temp_") ||
		strings.HasPrefix(name, "database_") ||
		strings.HasPrefix(name, "extracted_")
}

// scheduleFileCleanup 计划删除文件
func (h *BackupHandler) scheduleFileCleanup(filePath string, delay time.Duration) {
	time.Sleep(delay)
	if err := os.Remove(filePath); err != nil {
		// 记录错误但不中断
		fmt.Printf("Failed to cleanup file %s: %v\n", filePath, err)
	} else {
		fmt.Printf("Successfully cleaned up file: %s\n", filePath)
	}
}

// ExportConfig 导出配置文件
// @Summary 导出配置文件
// @Tags 备份恢复
// @Produce json
// @Success 200 {file} binary
// @Router /api/v1/backup/export-config [get]
func (h *BackupHandler) ExportConfig(c *gin.Context) {
	// 导出所有配置
	config, err := h.exportAllConfigs()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Failed to export config",
			"detail": err.Error(),
		})
		return
	}

	// 序列化为 JSON
	jsonData, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Failed to serialize config",
			"detail": err.Error(),
		})
		return
	}

	// 生成文件名
	timestamp := time.Now().Format("20060102_150405")
	filename := fmt.Sprintf("config_%s.json", timestamp)

	// 返回文件下载
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Data(http.StatusOK, "application/json", jsonData)
}

// ImportConfig 导入配置文件
// @Summary 导入配置文件
// @Tags 备份恢复
// @Accept multipart/form-data
// @Param file formData file true "配置文件"
// @Success 200 {object} map[string]string
// @Router /api/v1/backup/import-config [post]
func (h *BackupHandler) ImportConfig(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	// 打开上传的文件
	uploadedFile, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open uploaded file"})
		return
	}
	defer uploadedFile.Close()

	// 读取文件内容
	var config AllConfigs
	if err := json.NewDecoder(uploadedFile).Decode(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":  "Invalid config file format",
			"detail": err.Error(),
		})
		return
	}

	// 导入配置
	if err := h.importAllConfigs(&config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Failed to import config",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Config imported successfully",
	})
}

// ExportDatabase 导出数据库
// @Summary 导出数据库
// @Tags 备份恢复
// @Produce application/octet-stream
// @Success 200 {file} binary
// @Router /api/v1/backup/export-database [get]
func (h *BackupHandler) ExportDatabase(c *gin.Context) {
	if err := h.ensureBackupDir(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Failed to prepare backup directory",
			"detail": err.Error(),
		})
		return
	}

	timestamp := time.Now().Format("20060102_150405")
	filename := fmt.Sprintf("database_%s.sql", timestamp)
	filepath := filepath.Join(h.backupDir, filename)

	// 尝试使用 pg_dump 导出数据库
	cmd := exec.Command("pg_dump",
		"-h", h.dbHost,
		"-p", h.dbPort,
		"-U", h.dbUser,
		"-d", h.dbName,
		"-f", filepath,
		"--no-owner",
		"--no-acl",
		"--clean",
		"--if-exists",
	)

	// 设置密码环境变量
	cmd.Env = append(os.Environ(), fmt.Sprintf("PGPASSWORD=%s", h.dbPassword))

	output, dumpErr := cmd.CombinedOutput()

	// 如果 pg_dump 失败（版本不匹配或不存在），使用纯 Go 实现
	if dumpErr != nil {
		// 使用纯 Go 实现导出
		sqlContent, nativeErr := h.ExportDatabaseNative()
		if nativeErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":         "Failed to export database",
				"pg_dump_error": strings.TrimSpace(fmt.Sprintf("%v\n%s", dumpErr, output)),
				"native_error":  nativeErr.Error(),
			})
			return
		}

		// 写入文件
		if err := os.WriteFile(filepath, []byte(sqlContent), 0644); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":         "Failed to write backup file",
				"detail":        err.Error(),
				"pg_dump_error": strings.TrimSpace(fmt.Sprintf("%v\n%s", dumpErr, output)),
			})
			return
		}
	}

	// 返回文件下载
	c.FileAttachment(filepath, filename)

	// 异步删除临时文件（5分钟后）
	go h.scheduleFileCleanup(filepath, 5*time.Minute)
}

// ImportDatabase 导入数据库
// @Summary 导入数据库
// @Tags 备份恢复
// @Accept multipart/form-data
// @Param file formData file true "数据库文件（支持 .sql, .sql.gz, .zip）"
// @Success 200 {object} map[string]string
// @Router /api/v1/backup/import-database [post]
func (h *BackupHandler) ImportDatabase(c *gin.Context) {
	if err := h.ensureBackupDir(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Failed to prepare backup directory",
			"detail": err.Error(),
		})
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	// 保存上传的文件
	timestamp := time.Now().Format("20060102_150405")
	tempFile := filepath.Join(h.backupDir, fmt.Sprintf("import_%s_%s", timestamp, filepath.Base(file.Filename)))

	if err := c.SaveUploadedFile(file, tempFile); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save uploaded file"})
		return
	}
	defer os.Remove(tempFile) // 确保清理临时文件

	// 解压文件（如果需要）
	sqlFile, err := h.decompressIfNeeded(tempFile)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Failed to decompress file",
			"detail": err.Error(),
		})
		return
	}
	if sqlFile != tempFile {
		defer os.Remove(sqlFile) // 清理解压后的文件
	}

	// 尝试使用 psql 导入数据库
	cmd := exec.Command("psql",
		"-v", "ON_ERROR_STOP=1",
		"--single-transaction",
		"-h", h.dbHost,
		"-p", h.dbPort,
		"-U", h.dbUser,
		"-d", h.dbName,
		"-f", sqlFile,
	)

	// 设置密码环境变量
	cmd.Env = append(os.Environ(), fmt.Sprintf("PGPASSWORD=%s", h.dbPassword))

	output, err := cmd.CombinedOutput()

	// 如果 psql 失败，尝试使用纯 Go 实现
	if err != nil {
		// 读取 SQL 文件内容
		sqlContent, readErr := os.ReadFile(sqlFile)
		if readErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":      "Failed to import database",
				"psql_error": string(output),
				"read_error": readErr.Error(),
			})
			return
		}

		// 使用纯 Go 执行 SQL
		if execErr := h.ImportDatabaseNative(string(sqlContent)); execErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":        "Failed to import database",
				"psql_error":   string(output),
				"native_error": execErr.Error(),
			})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Database imported successfully",
	})
}

// decompressIfNeeded 根据文件扩展名解压文件
// 支持 .sql（不解压）、.sql.gz（gzip）、.zip（zip）
// 返回解压后的 SQL 文件路径
func (h *BackupHandler) decompressIfNeeded(filePath string) (string, error) {
	// 检查文件扩展名
	if strings.HasSuffix(filePath, ".sql") {
		// 纯 SQL 文件，不需要解压
		return filePath, nil
	}

	if strings.HasSuffix(filePath, ".gz") || strings.HasSuffix(filePath, ".sql.gz") {
		// Gzip 压缩文件
		return h.decompressGzip(filePath)
	}

	if strings.HasSuffix(filePath, ".zip") {
		// ZIP 压缩文件
		return h.decompressZip(filePath)
	}

	// 未知格式，尝试直接使用
	return filePath, nil
}

// decompressGzip 解压 gzip 文件
func (h *BackupHandler) decompressGzip(gzipPath string) (string, error) {
	// 打开 gzip 文件
	gzipFile, err := os.Open(gzipPath)
	if err != nil {
		return "", fmt.Errorf("failed to open gzip file: %w", err)
	}
	defer gzipFile.Close()

	// 创建 gzip reader
	gzipReader, err := gzip.NewReader(gzipFile)
	if err != nil {
		return "", fmt.Errorf("failed to create gzip reader: %w", err)
	}
	defer gzipReader.Close()

	// 创建输出文件
	outputPath := strings.TrimSuffix(gzipPath, ".gz")
	if !strings.HasSuffix(outputPath, ".sql") {
		outputPath += ".sql"
	}

	outputFile, err := os.Create(outputPath)
	if err != nil {
		return "", fmt.Errorf("failed to create output file: %w", err)
	}
	defer outputFile.Close()

	// 解压数据
	if _, err := io.Copy(outputFile, gzipReader); err != nil {
		os.Remove(outputPath)
		return "", fmt.Errorf("failed to decompress gzip: %w", err)
	}

	return outputPath, nil
}

// decompressZip 解压 zip 文件（提取第一个 .sql 文件）
func (h *BackupHandler) decompressZip(zipPath string) (string, error) {
	// 打开 zip 文件
	zipReader, err := zip.OpenReader(zipPath)
	if err != nil {
		return "", fmt.Errorf("failed to open zip file: %w", err)
	}
	defer zipReader.Close()

	// 查找第一个 .sql 文件
	for _, file := range zipReader.File {
		if strings.HasSuffix(file.Name, ".sql") {
			// 打开 zip 中的文件
			rc, err := file.Open()
			if err != nil {
				return "", fmt.Errorf("failed to open file in zip: %w", err)
			}
			defer rc.Close()

			// 创建输出文件
			outputPath := filepath.Join(h.backupDir, fmt.Sprintf("extracted_%s", filepath.Base(file.Name)))
			outputFile, err := os.Create(outputPath)
			if err != nil {
				return "", fmt.Errorf("failed to create output file: %w", err)
			}
			defer outputFile.Close()

			// 解压数据
			if _, err := io.Copy(outputFile, rc); err != nil {
				os.Remove(outputPath)
				return "", fmt.Errorf("failed to extract file: %w", err)
			}

			return outputPath, nil
		}
	}

	return "", fmt.Errorf("no .sql file found in zip archive")
}

// AllConfigs 所有配置的集合
type AllConfigs struct {
	Version            string                                 `json:"version"`             // 配置文件版本
	ExportTime         string                                 `json:"export_time"`         // 导出时间
	SystemConfig       *systemconfig.SystemConfig             `json:"system_config"`       // 系统配置
	SecurityConfig     *security.SecurityConfig               `json:"security_config"`     // 安全配置
	NotificationConfig *notificationconfig.NotificationConfig `json:"notification_config"` // 通知配置
	AIConfig           *aiconfig.AIConfig                     `json:"ai_config"`           // AI配置
}

// exportAllConfigs 导出所有配置
func (h *BackupHandler) exportAllConfigs() (*AllConfigs, error) {
	config := &AllConfigs{
		Version:    "1.0",
		ExportTime: time.Now().Format(time.RFC3339),
	}

	// 导出系统配置
	var systemConfig systemconfig.SystemConfig
	if err := h.db.First(&systemConfig).Error; err != nil && err != gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("failed to export system config: %w", err)
	}
	if systemConfig.ID != 0 {
		config.SystemConfig = &systemConfig
	}

	// 导出安全配置
	var securityConfig security.SecurityConfig
	if err := h.db.First(&securityConfig).Error; err != nil && err != gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("failed to export security config: %w", err)
	}
	if securityConfig.ID != 0 {
		config.SecurityConfig = &securityConfig
	}

	// 导出通知配置
	var notificationConfig notificationconfig.NotificationConfig
	if err := h.db.First(&notificationConfig).Error; err != nil && err != gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("failed to export notification config: %w", err)
	}
	if notificationConfig.ID != 0 {
		config.NotificationConfig = &notificationConfig
	}

	// 导出AI配置
	var aiConfig aiconfig.AIConfig
	if err := h.db.First(&aiConfig).Error; err != nil && err != gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("failed to export ai config: %w", err)
	}
	if aiConfig.ID != 0 {
		config.AIConfig = &aiConfig
	}

	return config, nil
}

// importAllConfigs 导入所有配置
func (h *BackupHandler) importAllConfigs(config *AllConfigs) error {
	return h.db.Transaction(func(tx *gorm.DB) error {
		// 导入系统配置
		if config.SystemConfig != nil {
			// 清除主键和时间戳字段
			config.SystemConfig.ID = 0
			config.SystemConfig.CreatedAt = time.Time{}
			config.SystemConfig.UpdatedAt = time.Time{}
			config.SystemConfig.DeletedAt = gorm.DeletedAt{}

			// 删除现有配置
			if err := tx.Exec("DELETE FROM system_config").Error; err != nil {
				return fmt.Errorf("failed to clear system config: %w", err)
			}
			// 创建新配置
			if err := tx.Create(config.SystemConfig).Error; err != nil {
				return fmt.Errorf("failed to import system config: %w", err)
			}
		}

		// 导入安全配置
		if config.SecurityConfig != nil {
			config.SecurityConfig.ID = 0
			config.SecurityConfig.CreatedAt = time.Time{}
			config.SecurityConfig.UpdatedAt = time.Time{}
			config.SecurityConfig.DeletedAt = gorm.DeletedAt{}

			if err := tx.Exec("DELETE FROM security_config").Error; err != nil {
				return fmt.Errorf("failed to clear security config: %w", err)
			}
			if err := tx.Create(config.SecurityConfig).Error; err != nil {
				return fmt.Errorf("failed to import security config: %w", err)
			}
		}

		// 导入通知配置
		if config.NotificationConfig != nil {
			config.NotificationConfig.ID = 0
			config.NotificationConfig.CreatedAt = time.Time{}
			config.NotificationConfig.UpdatedAt = time.Time{}
			config.NotificationConfig.DeletedAt = gorm.DeletedAt{}

			if err := tx.Exec("DELETE FROM notification_config").Error; err != nil {
				return fmt.Errorf("failed to clear notification config: %w", err)
			}
			if err := tx.Create(config.NotificationConfig).Error; err != nil {
				return fmt.Errorf("failed to import notification config: %w", err)
			}
		}

		// 导入AI配置
		if config.AIConfig != nil {
			config.AIConfig.ID = 0
			config.AIConfig.CreatedAt = time.Time{}
			config.AIConfig.UpdatedAt = time.Time{}
			config.AIConfig.DeletedAt = gorm.DeletedAt{}

			if err := tx.Exec("DELETE FROM ai_config").Error; err != nil {
				return fmt.Errorf("failed to clear ai config: %w", err)
			}
			if err := tx.Create(config.AIConfig).Error; err != nil {
				return fmt.Errorf("failed to import ai config: %w", err)
			}
		}

		return nil
	})
}
