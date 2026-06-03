package ws

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"sync"
	"time"

	"github.com/easyssh/server/internal/api/middleware"
	"github.com/easyssh/server/internal/domain/operationrecord"
	"github.com/easyssh/server/internal/domain/security"
	"github.com/easyssh/server/internal/domain/server"
	sshDomain "github.com/easyssh/server/internal/domain/ssh"
	"github.com/easyssh/server/internal/pkg/crypto"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

// TransferProgressMessage 跨服务器传输进度消息
type TransferProgressMessage struct {
	Type           string  `json:"type"`            // "progress", "complete", "error", "cancelled", "started"
	TaskID         string  `json:"task_id"`         // 任务ID
	BytesTotal     int64   `json:"bytes_total"`     // 总字节数
	BytesCopied    int64   `json:"bytes_copied"`    // 已传输字节数
	Progress       float64 `json:"progress"`        // 进度百分比 (0-100)
	SpeedBps       int64   `json:"speed_bps"`       // 传输速度(字节/秒)
	ETA            string  `json:"eta"`             // 预计剩余时间
	CurrentFile    string  `json:"current_file"`    // 当前传输的文件
	FilesTotal     int     `json:"files_total"`     // 总文件数
	FilesCompleted int     `json:"files_completed"` // 已完成文件数
	Message        string  `json:"message"`         // 状态消息
	Method         string  `json:"method"`          // 传输方式: "rsync", "scp", "sftp"
}

// TransferTask 传输任务
type TransferTask struct {
	ID               string
	SourceServerID   uuid.UUID
	SourceServerName string
	SourcePath       string
	TargetServerID   uuid.UUID
	TargetServerName string
	TargetPath       string
	UserID           uuid.UUID
	StartTime        time.Time
	CancelFunc       context.CancelFunc
	Status           string // "pending", "running", "completed", "failed", "cancelled"
}

// SFTPTransferHandler 跨服务器传输 WebSocket 处理器
type SFTPTransferHandler struct {
	// 存储活跃的 WebSocket 连接，key 是 taskID
	connections map[string]*websocket.Conn
	// 存储传输任务
	tasks map[string]*TransferTask
	// 存储任务最新进度，用于 WS 迟到/重连补发
	lastProgress map[string]TransferProgressMessage
	mu           sync.RWMutex

	serverService    server.Service
	serverRepo       server.Repository
	encryptor        *crypto.Encryptor
	securityService  security.Service
	webDevPort       int
	hostKeyCallback  ssh.HostKeyCallback
	defaultTaskTTL   time.Duration
	operationRecords operationrecord.Service
}

// NewSFTPTransferHandler 创建跨服务器传输处理器
func NewSFTPTransferHandler(
	serverService server.Service,
	serverRepo server.Repository,
	encryptor *crypto.Encryptor,
	securityService security.Service,
	webDevPort int,
	hostKeyCallback ssh.HostKeyCallback,
	operationRecords operationrecord.Service,
) *SFTPTransferHandler {
	if webDevPort <= 0 {
		webDevPort = 3000
	}
	return &SFTPTransferHandler{
		connections:      make(map[string]*websocket.Conn),
		tasks:            make(map[string]*TransferTask),
		lastProgress:     make(map[string]TransferProgressMessage),
		serverService:    serverService,
		serverRepo:       serverRepo,
		encryptor:        encryptor,
		securityService:  securityService,
		webDevPort:       webDevPort,
		hostKeyCallback:  hostKeyCallback,
		defaultTaskTTL:   30 * time.Minute,
		operationRecords: operationRecords,
	}
}

// getUpgrader 创建 WebSocket upgrader
func (h *SFTPTransferHandler) getUpgrader() websocket.Upgrader {
	return websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			return middleware.IsAllowedOrigin(r, h.securityService, h.webDevPort)
		},
	}
}

// HandleTransferWebSocket 处理跨服务器传输 WebSocket 连接
// WS /api/v1/sftp/transfer/ws/:task_id
func (h *SFTPTransferHandler) HandleTransferWebSocket(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user_id"})
		return
	}

	taskID := c.Param("task_id")
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "task_id required"})
		return
	}

	log.Printf("[SFTPTransferWS] 连接请求: userID=%s, taskID=%s", userID, taskID)

	// 强校验任务归属（防止猜测 task_id 窃听/取消他人任务）
	h.mu.RLock()
	task, ok := h.tasks[taskID]
	last, hasLast := h.lastProgress[taskID]
	h.mu.RUnlock()
	if !ok || task.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden", "message": "task not owned by user"})
		return
	}

	upgrader := h.getUpgrader()
	wsConn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("[SFTPTransferWS] 升级失败: %v", err)
		return
	}

	h.mu.Lock()
	h.connections[taskID] = wsConn
	h.mu.Unlock()

	log.Printf("[SFTPTransferWS] 连接已建立: taskID=%s", taskID)

	// 补发最后一条进度（支持客户端晚连接/重连）
	if hasLast {
		_ = h.SendProgress(taskID, last)
	}

	_ = wsConn.SetReadDeadline(time.Now().Add(wsPongWait))
	wsConn.SetReadLimit(4 << 10) // 4KB
	wsConn.SetPongHandler(func(appData string) error {
		return wsConn.SetReadDeadline(time.Now().Add(wsPongWait))
	})

	stopHeartbeat := make(chan struct{})
	go h.heartbeat(wsConn, taskID, stopHeartbeat)

	// 等待客户端消息
	for {
		msgType, data, err := wsConn.ReadMessage()
		if err != nil {
			if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				log.Printf("[SFTPTransferWS] 客户端正常关闭: taskID=%s", taskID)
			} else {
				log.Printf("[SFTPTransferWS] 读取错误: taskID=%s, error=%v", taskID, err)
			}
			break
		}

		if msgType == websocket.TextMessage {
			var ctrl struct {
				Type   string `json:"type"`
				TaskID string `json:"task_id"`
			}
			if err := json.Unmarshal(data, &ctrl); err != nil {
				continue
			}

			if ctrl.Type == "cancel" {
				log.Printf("[SFTPTransferWS] 收到取消指令: taskID=%s", taskID)
				h.CancelTaskForUser(userID, taskID)
			}
		}
	}

	close(stopHeartbeat)
	h.mu.Lock()
	delete(h.connections, taskID)
	h.mu.Unlock()
	wsConn.Close()

	log.Printf("[SFTPTransferWS] 连接已关闭: taskID=%s", taskID)
}

// heartbeat 发送心跳
func (h *SFTPTransferHandler) heartbeat(wsConn *websocket.Conn, taskID string, stop chan struct{}) {
	ticker := time.NewTicker(wsPingEvery)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if err := wsConn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(wsWriteWait)); err != nil {
				return
			}
		case <-stop:
			return
		}
	}
}

// SendProgress 发送进度消息
func (h *SFTPTransferHandler) SendProgress(taskID string, msg TransferProgressMessage) error {
	h.mu.Lock()
	h.lastProgress[taskID] = msg
	wsConn, exists := h.connections[taskID]
	h.mu.Unlock()

	if !exists {
		return nil
	}

	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	if err := wsConn.SetWriteDeadline(time.Now().Add(wsWriteWait)); err != nil {
		return err
	}

	if err := wsConn.WriteMessage(websocket.TextMessage, data); err != nil {
		h.mu.Lock()
		delete(h.connections, taskID)
		h.mu.Unlock()
		wsConn.Close()
		return err
	}

	return nil
}

// StartDirectTransfer 启动直连传输（使用 rsync 或 scp）
func (h *SFTPTransferHandler) StartDirectTransfer(
	ctx context.Context,
	taskID string,
	userID uuid.UUID,
	sourceServerID uuid.UUID,
	sourcePath string,
	targetServerID uuid.UUID,
	targetPath string,
) error {
	// 获取源服务器和目标服务器信息
	sourceServer, err := h.serverService.GetByID(ctx, userID, sourceServerID)
	if err != nil {
		return fmt.Errorf("failed to get source server: %w", err)
	}

	targetServer, err := h.serverService.GetByID(ctx, userID, targetServerID)
	if err != nil {
		return fmt.Errorf("failed to get target server: %w", err)
	}

	// 创建传输上下文：支持手动取消 + 自动 TTL
	ttl := h.defaultTaskTTL
	if ttl <= 0 {
		ttl = 30 * time.Minute
	}
	transferCtx, cancel := context.WithTimeout(ctx, ttl)

	// 注册任务
	task := &TransferTask{
		ID:               taskID,
		SourceServerID:   sourceServerID,
		SourceServerName: sourceServer.Name,
		SourcePath:       sourcePath,
		TargetServerID:   targetServerID,
		TargetServerName: targetServer.Name,
		TargetPath:       targetPath,
		UserID:           userID,
		StartTime:        time.Now(),
		CancelFunc:       cancel,
		Status:           "running",
	}

	h.mu.Lock()
	h.tasks[taskID] = task
	h.mu.Unlock()
	h.upsertTransferOperationRecord(task, operationrecord.StatusRunning, "", nil)

	// 发送开始消息
	_ = h.SendProgress(taskID, TransferProgressMessage{
		Type:    "started",
		TaskID:  taskID,
		Message: "开始传输...",
	})

	// 在后台执行传输（使用 SFTP 中转，通过后端中转数据）
	go func() {
		defer cancel()
		defer func() {
			h.mu.Lock()
			delete(h.tasks, taskID)
			delete(h.lastProgress, taskID)
			h.mu.Unlock()
		}()

		log.Printf("[SFTPTransferWS] 开始 SFTP 中转传输: taskID=%s", taskID)
		transferErr := h.executeSftpRelayTransfer(transferCtx, taskID, sourceServer, sourcePath, targetServer, targetPath)
		finishedAt := time.Now()

		if transferErr != nil {
			if transferCtx.Err() == context.Canceled {
				task.Status = "cancelled"
				_ = h.SendProgress(taskID, TransferProgressMessage{
					Type:    "cancelled",
					TaskID:  taskID,
					Message: "传输已取消",
					Method:  "sftp",
				})
				h.upsertTransferOperationRecord(task, operationrecord.StatusCanceled, "传输已取消", &finishedAt)
			} else {
				task.Status = "failed"
				log.Printf("[SFTPTransferWS] 传输失败: taskID=%s, error=%v", taskID, transferErr)
				_ = h.SendProgress(taskID, TransferProgressMessage{
					Type:    "error",
					TaskID:  taskID,
					Message: transferErr.Error(),
					Method:  "sftp",
				})
				h.upsertTransferOperationRecord(task, operationrecord.StatusFailure, transferErr.Error(), &finishedAt)
			}
		} else {
			task.Status = "completed"
			h.upsertTransferOperationRecord(task, operationrecord.StatusSuccess, "", &finishedAt)
		}
	}()

	return nil
}

func (h *SFTPTransferHandler) upsertTransferOperationRecord(task *TransferTask, status operationrecord.Status, errorMessage string, finishedAt *time.Time) {
	if h.operationRecords == nil || task == nil || task.UserID == uuid.Nil || task.SourceServerID == uuid.Nil || task.ID == "" {
		return
	}

	h.mu.RLock()
	last := h.lastProgress[task.ID]
	h.mu.RUnlock()

	detail, _ := json.Marshal(map[string]interface{}{
		"source_server_id":   task.SourceServerID,
		"source_server_name": task.SourceServerName,
		"target_server_id":   task.TargetServerID,
		"target_server_name": task.TargetServerName,
		"source_path":        task.SourcePath,
		"dest_path":          task.TargetPath,
		"file_name":          filepath.Base(task.SourcePath),
		"method":             "sftp",
		"task_status":        task.Status,
	})

	progress := int(last.Progress)
	if status == operationrecord.StatusSuccess {
		progress = 100
	}

	var durationMs int64
	if finishedAt != nil {
		durationMs = finishedAt.Sub(task.StartTime).Milliseconds()
	}

	successCount := 0
	failureCount := 0
	if status == operationrecord.StatusSuccess {
		successCount = 1
	} else if status == operationrecord.StatusFailure || status == operationrecord.StatusCanceled || status == operationrecord.StatusTimeout {
		failureCount = 1
	}

	now := time.Now()
	record := &operationrecord.OperationRecord{
		UserID:         task.UserID,
		Type:           operationrecord.TypeTransfer,
		Action:         "transfer",
		Status:         status,
		ServerID:       &task.SourceServerID,
		ServerName:     task.SourceServerName,
		Title:          filepath.Base(task.SourcePath),
		Resource:       fmt.Sprintf("%s -> %s", task.SourcePath, task.TargetPath),
		Source:         "sftp",
		StartedAt:      &task.StartTime,
		FinishedAt:     finishedAt,
		DurationMs:     durationMs,
		Progress:       progress,
		SuccessCount:   successCount,
		FailureCount:   failureCount,
		BytesTotal:     last.BytesTotal,
		BytesProcessed: last.BytesCopied,
		SpeedBps:       last.SpeedBps,
		ErrorMessage:   errorMessage,
		DetailJSON:     string(detail),
		SourceTable:    "sftp_direct_transfers",
		SourceID:       task.ID,
		CreatedAt:      task.StartTime,
		UpdatedAt:      now,
	}

	_ = h.operationRecords.Upsert(context.Background(), record)
}

// CancelTaskForUser 取消传输任务（强校验 userID）
func (h *SFTPTransferHandler) CancelTaskForUser(userID uuid.UUID, taskID string) bool {
	h.mu.RLock()
	task, exists := h.tasks[taskID]
	h.mu.RUnlock()

	if !exists || task.UserID != userID {
		return false
	}
	if task.CancelFunc != nil {
		task.CancelFunc()
		log.Printf("[SFTPTransferWS] 任务已取消: taskID=%s, userID=%s", taskID, userID)
		return true
	}
	return false
}

// executeSftpRelayTransfer 使用 SFTP 中转传输（通过后端中转，不依赖源服务器命令）
func (h *SFTPTransferHandler) executeSftpRelayTransfer(
	ctx context.Context,
	taskID string,
	sourceServer *server.Server,
	sourcePath string,
	targetServer *server.Server,
	targetPath string,
) error {
	log.Printf("[SFTPTransferWS] 开始 SFTP 中转传输: taskID=%s, source=%s:%s -> target=%s:%s",
		taskID, sourceServer.Host, sourcePath, targetServer.Host, targetPath)

	// 连接源服务器
	sourceSSHClient, err := sshDomain.NewClient(sourceServer, h.encryptor, h.hostKeyCallback)
	if err != nil {
		return fmt.Errorf("failed to create source SSH client: %w", err)
	}
	defer sourceSSHClient.Close()

	if err := sourceSSHClient.ConnectContext(ctx, sourceServer.Host, sourceServer.Port); err != nil {
		return fmt.Errorf("failed to connect to source server: %w", err)
	}

	// 创建源 SFTP 客户端
	sourceSFTP, err := sftp.NewClient(sourceSSHClient.GetRawConnection())
	if err != nil {
		return fmt.Errorf("failed to create source SFTP client: %w", err)
	}
	defer sourceSFTP.Close()

	// 连接目标服务器
	targetSSHClient, err := sshDomain.NewClient(targetServer, h.encryptor, h.hostKeyCallback)
	if err != nil {
		return fmt.Errorf("failed to create target SSH client: %w", err)
	}
	defer targetSSHClient.Close()

	if err := targetSSHClient.ConnectContext(ctx, targetServer.Host, targetServer.Port); err != nil {
		return fmt.Errorf("failed to connect to target server: %w", err)
	}

	// 创建目标 SFTP 客户端
	targetSFTP, err := sftp.NewClient(targetSSHClient.GetRawConnection())
	if err != nil {
		return fmt.Errorf("failed to create target SFTP client: %w", err)
	}
	defer targetSFTP.Close()

	// 获取源文件信息
	sourceInfo, err := sourceSFTP.Stat(sourcePath)
	if err != nil {
		return fmt.Errorf("failed to stat source path: %w", err)
	}

	// 如果是目录，递归传输
	if sourceInfo.IsDir() {
		return h.transferDirectory(ctx, taskID, sourceSFTP, targetSFTP, sourcePath, targetPath, sourceInfo.Name())
	}

	// 单文件传输
	return h.transferSingleFile(ctx, taskID, sourceSFTP, targetSFTP, sourcePath, targetPath, sourceInfo.Size())
}

// transferSingleFile 传输单个文件
func (h *SFTPTransferHandler) transferSingleFile(
	ctx context.Context,
	taskID string,
	sourceSFTP *sftp.Client,
	targetSFTP *sftp.Client,
	sourcePath string,
	targetPath string,
	fileSize int64,
) error {
	// 打开源文件
	sourceFile, err := sourceSFTP.Open(sourcePath)
	if err != nil {
		return fmt.Errorf("failed to open source file: %w", err)
	}
	defer sourceFile.Close()

	// 确定目标文件路径
	targetFilePath := targetPath
	if targetInfo, err := targetSFTP.Stat(targetPath); err == nil && targetInfo.IsDir() {
		// 目标是目录，在其下创建同名文件
		targetFilePath = filepath.Join(targetPath, filepath.Base(sourcePath))
	}

	// 创建目标文件
	targetFile, err := targetSFTP.Create(targetFilePath)
	if err != nil {
		return fmt.Errorf("failed to create target file: %w", err)
	}
	defer targetFile.Close()

	// 带进度的复制
	const bufferSize = 32 * 1024 // 32KB 缓冲区
	buffer := make([]byte, bufferSize)
	var totalCopied int64
	startTime := time.Now()
	lastProgressTime := startTime

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		n, readErr := sourceFile.Read(buffer)
		if n > 0 {
			_, writeErr := targetFile.Write(buffer[:n])
			if writeErr != nil {
				return fmt.Errorf("failed to write to target: %w", writeErr)
			}
			totalCopied += int64(n)

			// 每 500ms 或完成时发送进度
			now := time.Now()
			if now.Sub(lastProgressTime) >= 500*time.Millisecond || readErr != nil {
				lastProgressTime = now
				elapsed := now.Sub(startTime).Seconds()
				var speedBps int64
				var eta string
				if elapsed > 0 {
					speedBps = int64(float64(totalCopied) / elapsed)
					if speedBps > 0 {
						remaining := float64(fileSize-totalCopied) / float64(speedBps)
						eta = formatETA(remaining)
					}
				}

				progress := float64(0)
				if fileSize > 0 {
					progress = float64(totalCopied) / float64(fileSize) * 100
				}

				_ = h.SendProgress(taskID, TransferProgressMessage{
					Type:        "progress",
					TaskID:      taskID,
					BytesTotal:  fileSize,
					BytesCopied: totalCopied,
					Progress:    progress,
					SpeedBps:    speedBps,
					ETA:         eta,
					CurrentFile: filepath.Base(sourcePath),
					Method:      "sftp",
				})
			}
		}

		if readErr != nil {
			if readErr == io.EOF {
				break
			}
			return fmt.Errorf("failed to read source: %w", readErr)
		}
	}

	// 发送完成消息
	_ = h.SendProgress(taskID, TransferProgressMessage{
		Type:        "complete",
		TaskID:      taskID,
		BytesTotal:  fileSize,
		BytesCopied: totalCopied,
		Progress:    100,
		Message:     "传输完成",
		Method:      "sftp",
	})

	return nil
}

// transferDirectory 递归传输目录
func (h *SFTPTransferHandler) transferDirectory(
	ctx context.Context,
	taskID string,
	sourceSFTP *sftp.Client,
	targetSFTP *sftp.Client,
	sourcePath string,
	targetPath string,
	dirName string,
) error {
	// 在目标位置创建目录
	targetDirPath := filepath.Join(targetPath, dirName)
	if err := targetSFTP.MkdirAll(targetDirPath); err != nil {
		return fmt.Errorf("failed to create target directory: %w", err)
	}

	// 列出源目录内容
	entries, err := sourceSFTP.ReadDir(sourcePath)
	if err != nil {
		return fmt.Errorf("failed to read source directory: %w", err)
	}

	// 统计总大小和文件数
	var totalSize int64
	var totalFiles int
	for _, entry := range entries {
		if !entry.IsDir() {
			totalSize += entry.Size()
			totalFiles++
		}
	}

	var completedFiles int
	var copiedBytes int64
	startTime := time.Now()

	for _, entry := range entries {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		entrySourcePath := filepath.Join(sourcePath, entry.Name())

		if entry.IsDir() {
			// 递归传输子目录
			if err := h.transferDirectory(ctx, taskID, sourceSFTP, targetSFTP, entrySourcePath, targetDirPath, entry.Name()); err != nil {
				return err
			}
		} else {
			// 传输文件（不发送单独的完成消息）
			if err := h.transferFileInDirectory(ctx, sourceSFTP, targetSFTP, entrySourcePath, targetDirPath, entry.Size()); err != nil {
				return err
			}
			completedFiles++
			copiedBytes += entry.Size()

			// 发送整体进度
			elapsed := time.Since(startTime).Seconds()
			var speedBps int64
			var eta string
			if elapsed > 0 {
				speedBps = int64(float64(copiedBytes) / elapsed)
				if speedBps > 0 && totalSize > 0 {
					remaining := float64(totalSize-copiedBytes) / float64(speedBps)
					eta = formatETA(remaining)
				}
			}

			progress := float64(0)
			if totalSize > 0 {
				progress = float64(copiedBytes) / float64(totalSize) * 100
			}

			_ = h.SendProgress(taskID, TransferProgressMessage{
				Type:           "progress",
				TaskID:         taskID,
				BytesTotal:     totalSize,
				BytesCopied:    copiedBytes,
				Progress:       progress,
				SpeedBps:       speedBps,
				ETA:            eta,
				CurrentFile:    entry.Name(),
				FilesTotal:     totalFiles,
				FilesCompleted: completedFiles,
				Method:         "sftp",
			})
		}
	}

	// 发送完成消息
	_ = h.SendProgress(taskID, TransferProgressMessage{
		Type:           "complete",
		TaskID:         taskID,
		BytesTotal:     totalSize,
		BytesCopied:    copiedBytes,
		Progress:       100,
		FilesTotal:     totalFiles,
		FilesCompleted: completedFiles,
		Message:        "传输完成",
		Method:         "sftp",
	})

	return nil
}

// transferFileInDirectory 在目录传输中传输单个文件（不发送完成消息）
func (h *SFTPTransferHandler) transferFileInDirectory(
	ctx context.Context,
	sourceSFTP *sftp.Client,
	targetSFTP *sftp.Client,
	sourcePath string,
	targetDir string,
	fileSize int64,
) error {
	sourceFile, err := sourceSFTP.Open(sourcePath)
	if err != nil {
		return fmt.Errorf("failed to open source file: %w", err)
	}
	defer sourceFile.Close()

	targetFilePath := filepath.Join(targetDir, filepath.Base(sourcePath))
	targetFile, err := targetSFTP.Create(targetFilePath)
	if err != nil {
		return fmt.Errorf("failed to create target file: %w", err)
	}
	defer targetFile.Close()

	const bufferSize = 32 * 1024
	buffer := make([]byte, bufferSize)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		n, readErr := sourceFile.Read(buffer)
		if n > 0 {
			if _, writeErr := targetFile.Write(buffer[:n]); writeErr != nil {
				return fmt.Errorf("failed to write to target: %w", writeErr)
			}
		}
		if readErr != nil {
			if readErr == io.EOF {
				break
			}
			return fmt.Errorf("failed to read source: %w", readErr)
		}
	}

	return nil
}

// formatETA 格式化预计剩余时间
func formatETA(seconds float64) string {
	if seconds < 0 || seconds > 86400*365 { // 超过一年视为无效
		return "--:--"
	}

	hours := int(seconds) / 3600
	minutes := (int(seconds) % 3600) / 60
	secs := int(seconds) % 60

	if hours > 0 {
		return fmt.Sprintf("%d:%02d:%02d", hours, minutes, secs)
	}
	return fmt.Sprintf("%02d:%02d", minutes, secs)
}
