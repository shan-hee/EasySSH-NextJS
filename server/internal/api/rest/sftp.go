package rest

import (
	"fmt"
	"net/http"
	"path/filepath"
	"time"

	"github.com/easyssh/server/internal/api/ws"
	"github.com/easyssh/server/internal/domain/server"
	"github.com/easyssh/server/internal/domain/sftp"
	sshDomain "github.com/easyssh/server/internal/domain/ssh"
	"github.com/easyssh/server/internal/pkg/crypto"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/ssh"
)

// SFTPHandler SFTP 处理器
type SFTPHandler struct {
	serverService     server.Service
	serverRepo        server.Repository
	encryptor         *crypto.Encryptor
	uploadWSHandler   *ws.SFTPUploadHandler
	hostKeyCallback   ssh.HostKeyCallback // SSH主机密钥验证回调
}

// NewSFTPHandler 创建 SFTP 处理器
func NewSFTPHandler(serverService server.Service, serverRepo server.Repository, encryptor *crypto.Encryptor, uploadWSHandler *ws.SFTPUploadHandler, hostKeyCallback ssh.HostKeyCallback) *SFTPHandler {
	return &SFTPHandler{
		serverService:   serverService,
		serverRepo:      serverRepo,
		encryptor:       encryptor,
		uploadWSHandler: uploadWSHandler,
		hostKeyCallback: hostKeyCallback,
	}
}

// createSFTPClient 创建 SFTP 客户端（辅助方法）
func (h *SFTPHandler) createSFTPClient(c *gin.Context, serverID uuid.UUID) (*sftp.Client, *server.Server, error) {
	// 从上下文获取用户 ID
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return nil, nil, err
	}

	// 获取服务器信息
	srv, err := h.serverService.GetByID(c.Request.Context(), userID, serverID)
	if err != nil {
		return nil, nil, err
	}

	// 创建 SSH 客户端（使用主机密钥验证）
	sshClient, err := sshDomain.NewClient(srv, h.encryptor, h.hostKeyCallback)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create SSH client: %w", err)
	}

	// 连接到服务器
	if err := sshClient.Connect(srv.Host, srv.Port); err != nil {
		sshClient.Close() // 确保关闭连接
		return nil, nil, fmt.Errorf("failed to connect: %w", err)
	}

	// 性能优化：仅更新服务器状态和最后连接时间（避免慢查询）
	srv.UpdateStatus(server.StatusOnline)
	if err := h.serverRepo.UpdateStatus(c.Request.Context(), srv.ID, srv.Status, srv.LastConnected); err != nil {
		// 不中断连接，只记录错误
		fmt.Printf("Failed to update server status: %v\n", err)
	}

	// 创建 SFTP 客户端
	sftpClient, err := sftp.NewClient(sshClient, srv)
	if err != nil {
		sshClient.Close()
		return nil, nil, fmt.Errorf("failed to create SFTP client: %w", err)
	}

	return sftpClient, srv, nil
}

// ListDirectory 列出目录
// GET /api/v1/sftp/:server_id/list?path=/path/to/dir
func (h *SFTPHandler) ListDirectory(c *gin.Context) {
	// 解析服务器 ID
	serverID, err := uuid.Parse(c.Param("server_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_server_id", "Invalid server ID")
		return
	}

	// 获取路径参数
	path := c.DefaultQuery("path", "/")

	// 创建 SFTP 客户端
	sftpClient, _, err := h.createSFTPClient(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer sftpClient.Close()

	// 列出目录
	listing, err := sftpClient.ListDirectory(path)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "list_failed", err.Error())
		return
	}

	RespondSuccess(c, listing)
}

// GetFileInfo 获取文件信息
// GET /api/v1/sftp/:server_id/stat?path=/path/to/file
func (h *SFTPHandler) GetFileInfo(c *gin.Context) {
	// 解析服务器 ID
	serverID, err := uuid.Parse(c.Param("server_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_server_id", "Invalid server ID")
		return
	}

	// 获取路径参数
	path := c.Query("path")
	if path == "" {
		RespondError(c, http.StatusBadRequest, "missing_path", "Path parameter is required")
		return
	}

	// 创建 SFTP 客户端
	sftpClient, _, err := h.createSFTPClient(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer sftpClient.Close()

	// 获取文件信息
	fileInfo, err := sftpClient.GetFileInfo(path)
	if err != nil {
		RespondError(c, http.StatusNotFound, "file_not_found", err.Error())
		return
	}

	RespondSuccess(c, fileInfo)
}

// UploadFile 上传文件
// POST /api/v1/sftp/:server_id/upload?ws_task_id=xxx (可选)
func (h *SFTPHandler) UploadFile(c *gin.Context) {
	// 解析服务器 ID
	serverID, err := uuid.Parse(c.Param("server_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_server_id", "Invalid server ID")
		return
	}

	// 获取可选的 WebSocket 任务 ID
	wsTaskID := c.Query("ws_task_id")

	// 获取上传的文件
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_file", "Failed to get file from request")
		return
	}
	defer file.Close()

	// 获取目标路径
	remotePath := c.PostForm("path")
	if remotePath == "" {
		remotePath = "/" + header.Filename
	} else {
		remotePath = filepath.Join(remotePath, header.Filename)
	}

	// 创建 SFTP 客户端
	sftpClient, _, err := h.createSFTPClient(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer sftpClient.Close()

	// 如果提供了 WebSocket 任务 ID，使用带进度跟踪的上传
	if wsTaskID != "" && h.uploadWSHandler != nil {
		// 进度跟踪变量
		var (
			lastProgressTime = time.Now()
			lastLoaded       int64
			totalSize        = header.Size
		)

		// 上传文件并报告进度
		err = sftpClient.UploadFileWithProgress(file, remotePath, func(loaded int64) {
			now := time.Now()
			elapsed := now.Sub(lastProgressTime).Seconds()

			// 计算速度（字节/秒）
			var speedBps int64
			if elapsed > 0 {
				speedBps = int64(float64(loaded-lastLoaded) / elapsed)
			}

			// 发送进度消息
			_ = h.uploadWSHandler.SendProgress(wsTaskID, ws.UploadProgressMessage{
				Type:     "progress",
				TaskID:   wsTaskID,
				Loaded:   loaded,
				Total:    totalSize,
				Stage:    "sftp",
				SpeedBps: speedBps,
			})

			lastProgressTime = now
			lastLoaded = loaded
		})

		if err != nil {
			// 发送错误消息
			_ = h.uploadWSHandler.SendProgress(wsTaskID, ws.UploadProgressMessage{
				Type:    "error",
				TaskID:  wsTaskID,
				Message: err.Error(),
			})
			RespondError(c, http.StatusInternalServerError, "upload_failed", err.Error())
			return
		}

		// 发送完成消息
		_ = h.uploadWSHandler.SendProgress(wsTaskID, ws.UploadProgressMessage{
			Type:    "complete",
			TaskID:  wsTaskID,
			Loaded:  totalSize,
			Total:   totalSize,
			Stage:   "sftp",
			Message: "Upload completed successfully",
		})
	} else {
		// 无 WebSocket，使用普通上传
		if err := sftpClient.UploadFile(file, remotePath); err != nil {
			RespondError(c, http.StatusInternalServerError, "upload_failed", err.Error())
			return
		}
	}

	RespondSuccess(c, gin.H{
		"path":     remotePath,
		"filename": header.Filename,
		"size":     header.Size,
	})
}

// DownloadFile 下载文件
// GET /api/v1/sftp/:server_id/download?path=/path/to/file
func (h *SFTPHandler) DownloadFile(c *gin.Context) {
	// 解析服务器 ID
	serverID, err := uuid.Parse(c.Param("server_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_server_id", "Invalid server ID")
		return
	}

	// 获取路径参数
	path := c.Query("path")
	if path == "" {
		RespondError(c, http.StatusBadRequest, "missing_path", "Path parameter is required")
		return
	}

	// 创建 SFTP 客户端
	sftpClient, _, err := h.createSFTPClient(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer sftpClient.Close()

	// 获取文件信息
	fileInfo, err := sftpClient.GetFileInfo(path)
	if err != nil {
		RespondError(c, http.StatusNotFound, "file_not_found", err.Error())
		return
	}

	// 设置响应头
	filename := filepath.Base(path)
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Header("Content-Type", "application/octet-stream")
	c.Header("Content-Length", fmt.Sprintf("%d", fileInfo.Size))

	// 下载文件
	if err := sftpClient.DownloadFile(path, c.Writer); err != nil {
		// 如果已经开始写入响应，无法返回错误 JSON
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
}

// CreateDirectory 创建目录
// POST /api/v1/sftp/:server_id/mkdir
func (h *SFTPHandler) CreateDirectory(c *gin.Context) {
	// 解析服务器 ID
	serverID, err := uuid.Parse(c.Param("server_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_server_id", "Invalid server ID")
		return
	}

	// 解析请求
	var req struct {
		Path      string `json:"path" binding:"required"`
		Recursive bool   `json:"recursive"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 创建 SFTP 客户端
	sftpClient, _, err := h.createSFTPClient(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer sftpClient.Close()

	// 创建目录
	if req.Recursive {
		err = sftpClient.CreateDirectories(req.Path)
	} else {
		err = sftpClient.CreateDirectory(req.Path)
	}

	if err != nil {
		RespondError(c, http.StatusInternalServerError, "mkdir_failed", err.Error())
		return
	}

	RespondSuccess(c, gin.H{
		"path": req.Path,
	})
}

// Delete 删除文件或目录
// DELETE /api/v1/sftp/:server_id/delete
func (h *SFTPHandler) Delete(c *gin.Context) {
	// 解析服务器 ID
	serverID, err := uuid.Parse(c.Param("server_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_server_id", "Invalid server ID")
		return
	}

	// 解析请求
	var req struct {
		Path string `json:"path" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 记录删除操作开始
	startTime := time.Now()
	fmt.Printf("[SFTP Delete] Starting delete operation: server=%s, path=%s\n", serverID, req.Path)

	// 创建 SFTP 客户端
	sftpClient, _, err := h.createSFTPClient(c, serverID)
	if err != nil {
		fmt.Printf("[SFTP Delete] Failed to create SFTP client: %v\n", err)
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer sftpClient.Close()

	// 获取文件信息以判断类型
	fileInfo, err := sftpClient.GetFileInfo(req.Path)
	if err != nil {
		fmt.Printf("[SFTP Delete] File not found: %s, error: %v\n", req.Path, err)
		RespondError(c, http.StatusNotFound, "file_not_found", err.Error())
		return
	}

	// 删除文件或目录
	if fileInfo.IsDir {
		fmt.Printf("[SFTP Delete] Deleting directory: %s\n", req.Path)
		err = sftpClient.DeleteDirectory(req.Path)
	} else {
		fmt.Printf("[SFTP Delete] Deleting file: %s\n", req.Path)
		err = sftpClient.DeleteFile(req.Path)
	}

	if err != nil {
		elapsed := time.Since(startTime)
		fmt.Printf("[SFTP Delete] Delete failed after %v: %v\n", elapsed, err)
		RespondError(c, http.StatusInternalServerError, "delete_failed", err.Error())
		return
	}

	elapsed := time.Since(startTime)
	fmt.Printf("[SFTP Delete] Delete completed successfully in %v: %s\n", elapsed, req.Path)
	RespondSuccessWithMessage(c, nil, "Deleted successfully")
}

// Rename 重命名文件或目录
// POST /api/v1/sftp/:server_id/rename
func (h *SFTPHandler) Rename(c *gin.Context) {
	// 解析服务器 ID
	serverID, err := uuid.Parse(c.Param("server_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_server_id", "Invalid server ID")
		return
	}

	// 解析请求
	var req struct {
		OldPath string `json:"old_path" binding:"required"`
		NewPath string `json:"new_path" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 创建 SFTP 客户端
	sftpClient, _, err := h.createSFTPClient(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer sftpClient.Close()

	// 重命名
	if err := sftpClient.RenameFile(req.OldPath, req.NewPath); err != nil {
		RespondError(c, http.StatusInternalServerError, "rename_failed", err.Error())
		return
	}

	RespondSuccess(c, gin.H{
		"old_path": req.OldPath,
		"new_path": req.NewPath,
	})
}

// ReadFile 读取文件内容
// GET /api/v1/sftp/:server_id/read?path=/path/to/file
func (h *SFTPHandler) ReadFile(c *gin.Context) {
	// 解析服务器 ID
	serverID, err := uuid.Parse(c.Param("server_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_server_id", "Invalid server ID")
		return
	}

	// 获取路径参数
	path := c.Query("path")
	if path == "" {
		RespondError(c, http.StatusBadRequest, "missing_path", "Path parameter is required")
		return
	}

	// 创建 SFTP 客户端
	sftpClient, _, err := h.createSFTPClient(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer sftpClient.Close()

	// 读取文件
	content, err := sftpClient.ReadFile(path)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "read_failed", err.Error())
		return
	}

	c.Data(http.StatusOK, "text/plain", content)
}

// WriteFile 写入文件内容
// POST /api/v1/sftp/:server_id/write
func (h *SFTPHandler) WriteFile(c *gin.Context) {
	// 解析服务器 ID
	serverID, err := uuid.Parse(c.Param("server_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_server_id", "Invalid server ID")
		return
	}

	// 解析 JSON 请求体
	var req struct {
		Path    string `json:"path" binding:"required"`
		Content string `json:"content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 创建 SFTP 客户端
	sftpClient, _, err := h.createSFTPClient(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer sftpClient.Close()

	// 写入文件
	if err := sftpClient.WriteFile(req.Path, []byte(req.Content), 0644); err != nil {
		RespondError(c, http.StatusInternalServerError, "write_failed", err.Error())
		return
	}

	RespondSuccessWithMessage(c, gin.H{"path": req.Path}, "File written successfully")
}

// GetDiskUsage 获取磁盘使用情况
// GET /api/v1/sftp/:server_id/disk-usage?path=/
func (h *SFTPHandler) GetDiskUsage(c *gin.Context) {
	// 解析服务器 ID
	serverID, err := uuid.Parse(c.Param("server_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_server_id", "Invalid server ID")
		return
	}

	// 获取路径参数
	path := c.DefaultQuery("path", "/")

	// 创建 SFTP 客户端
	sftpClient, _, err := h.createSFTPClient(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer sftpClient.Close()

	// 获取磁盘使用情况
	diskUsage, err := sftpClient.GetDiskUsage(path)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "disk_usage_failed", err.Error())
		return
	}

	RespondSuccess(c, diskUsage)
}
