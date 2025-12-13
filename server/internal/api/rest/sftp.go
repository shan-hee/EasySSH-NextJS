package rest

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/easyssh/server/internal/api/ws"
	"github.com/easyssh/server/internal/domain/server"
	"github.com/easyssh/server/internal/domain/sftp"
	sshDomain "github.com/easyssh/server/internal/domain/ssh"
	"github.com/easyssh/server/internal/pkg/crypto"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	sftpPkg "github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

const (
	maxTextReadBytes  = 5 << 20 // 5MB
	maxTextWriteBytes = 5 << 20 // 5MB
)

type ctxReader struct {
	ctx    context.Context
	reader io.Reader
}

func (r *ctxReader) Read(p []byte) (int, error) {
	select {
	case <-r.ctx.Done():
		return 0, r.ctx.Err()
	default:
	}
	return r.reader.Read(p)
}

// SFTPHandler SFTP 处理器
type SFTPHandler struct {
	serverService     server.Service
	serverRepo        server.Repository
	encryptor         *crypto.Encryptor
	uploadWSHandler   *ws.SFTPUploadHandler
	transferHandler   *ws.SFTPTransferHandler // 跨服务器直连传输处理器
	hostKeyCallback   ssh.HostKeyCallback     // SSH主机密钥验证回调
	pool              *sftp.Pool              // SFTP 连接池
	trashItemRepo     sftp.TrashItemRepository
	trashSettingsRepo sftp.TrashSettingsRepository
}

// NewSFTPHandler 创建 SFTP 处理器
func NewSFTPHandler(serverService server.Service, serverRepo server.Repository, encryptor *crypto.Encryptor, uploadWSHandler *ws.SFTPUploadHandler, hostKeyCallback ssh.HostKeyCallback, poolConfig *sftp.PoolConfig) *SFTPHandler {
	// 创建连接池
	pool := sftp.NewPool(
		poolConfig,
		encryptor,
		hostKeyCallback,
		serverService,
		serverRepo,
	)

	return &SFTPHandler{
		serverService:   serverService,
		serverRepo:      serverRepo,
		encryptor:       encryptor,
		uploadWSHandler: uploadWSHandler,
		hostKeyCallback: hostKeyCallback,
		pool:            pool,
	}
}

// SetTransferHandler 设置跨服务器传输处理器
func (h *SFTPHandler) SetTransferHandler(handler *ws.SFTPTransferHandler) {
	h.transferHandler = handler
}

func (h *SFTPHandler) SetTrashItemRepository(repo sftp.TrashItemRepository) {
	h.trashItemRepo = repo
}

func (h *SFTPHandler) SetTrashSettingsRepository(repo sftp.TrashSettingsRepository) {
	h.trashSettingsRepo = repo
}

// GetPool 获取连接池（用于外部访问）
func (h *SFTPHandler) GetPool() *sftp.Pool {
	return h.pool
}

// Close 关闭 SFTP 处理器（关闭连接池）
func (h *SFTPHandler) Close() {
	if h.pool != nil {
		h.pool.CloseAll()
	}
}

// CreateUploadTask 创建一个服务端上传任务 ID（用于上传进度 WebSocket）
// POST /api/v1/sftp/upload/task
func (h *SFTPHandler) CreateUploadTask(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "Missing user")
		return
	}
	if h.uploadWSHandler == nil {
		RespondError(c, http.StatusServiceUnavailable, "ws_not_available", "Upload WebSocket not available")
		return
	}

	taskID := h.uploadWSHandler.CreateTask(userIDStr.(string))
	RespondSuccess(c, gin.H{"task_id": taskID})
}

// getPooledClient 从连接池获取 SFTP 客户端
// 调用者需要在操作完成后调用 client.Release() 释放连接
func (h *SFTPHandler) getPooledClient(c *gin.Context, serverID uuid.UUID) (*sftp.PooledClient, error) {
	// 从上下文获取用户 ID
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return nil, err
	}

	// 从连接池获取连接（继承请求 ctx）
	return h.pool.Get(c.Request.Context(), userID, serverID)
}

// createSFTPClient 创建 SFTP 客户端（辅助方法）
// 注意：此方法创建的是非池化连接，用于需要独立连接的场景（如跨服务器传输）
// 对于普通的文件操作，应使用 getPooledClient
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

	// 连接到服务器（继承请求 ctx，可取消）
	if err := sshClient.ConnectContext(c.Request.Context(), srv.Host, srv.Port); err != nil {
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

	// 从连接池获取 SFTP 客户端
	sftpClient, err := h.getPooledClient(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer sftpClient.Release() // 释放回连接池，而不是关闭

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

	// 从连接池获取 SFTP 客户端
	sftpClient, err := h.getPooledClient(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer sftpClient.Release()

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
		remotePath = path.Join(remotePath, header.Filename)
	}

	// 从连接池获取 SFTP 客户端
	sftpClient, err := h.getPooledClient(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer sftpClient.Release()

	// 如果提供了 WebSocket 任务 ID，使用带进度跟踪的上传
	if wsTaskID != "" && h.uploadWSHandler != nil {
		// 校验任务归属
		userIDStr, exists := c.Get("user_id")
		if !exists || !h.uploadWSHandler.ValidateTaskOwnership(userIDStr.(string), wsTaskID) {
			RespondError(c, http.StatusForbidden, "forbidden", "Invalid upload task")
			return
		}

		// 创建可取消的上下文，并注册到 WebSocket 处理器
		ctx, cancel := context.WithCancel(c.Request.Context())
		defer cancel()
		h.uploadWSHandler.RegisterCancelFunc(wsTaskID, cancel)
		defer h.uploadWSHandler.UnregisterCancelFunc(wsTaskID)

		// 进度跟踪变量
		var (
			lastProgressTime = time.Now()
			totalSize        = header.Size
			startTime        = time.Now()
		)

		// 上传文件并报告进度
		err = sftpClient.UploadFileWithProgressWithContext(ctx, file, remotePath, func(loaded int64) {
			now := time.Now()

			// 每 500ms 或完成时发送进度（与跨服务器传输保持一致）
			if now.Sub(lastProgressTime) < 500*time.Millisecond && loaded < totalSize {
				return
			}

			elapsed := now.Sub(startTime).Seconds()

			// 计算速度（字节/秒）
			var speedBps int64
			if elapsed > 0 {
				speedBps = int64(float64(loaded) / elapsed)
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
		})

		if err != nil {
			// 取消导致的错误单独处理
			if errors.Is(err, context.Canceled) {
				_ = h.uploadWSHandler.SendProgress(wsTaskID, ws.UploadProgressMessage{
					Type:    "cancelled",
					TaskID:  wsTaskID,
					Message: "upload cancelled",
				})
				RespondError(c, http.StatusRequestTimeout, "upload_cancelled", "upload cancelled by client")
				return
			}

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

	// 上传完成后,返回新文件的详细信息,便于前端进行差异更新
	fileInfo, err := sftpClient.GetFileInfo(remotePath)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "stat_failed", err.Error())
		return
	}

	RespondSuccess(c, fileInfo)
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
	remotePath := c.Query("path")
	if remotePath == "" {
		RespondError(c, http.StatusBadRequest, "missing_path", "Path parameter is required")
		return
	}

	// 从连接池获取 SFTP 客户端
	sftpClient, err := h.getPooledClient(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer sftpClient.Release()

	// 获取文件信息
	fileInfo, err := sftpClient.GetFileInfo(remotePath)
	if err != nil {
		RespondError(c, http.StatusNotFound, "file_not_found", err.Error())
		return
	}

	// 设置响应头
	filename := path.Base(remotePath)
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Header("Content-Type", "application/octet-stream")
	c.Header("Content-Length", fmt.Sprintf("%d", fileInfo.Size))

	// 下载文件
	if err := sftpClient.DownloadFile(remotePath, c.Writer); err != nil {
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

	// 从连接池获取 SFTP 客户端
	sftpClient, err := h.getPooledClient(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer sftpClient.Release()

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

	// 返回新建目录的 FileInfo,用于前端差异更新
	fileInfo, err := sftpClient.GetFileInfo(req.Path)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "stat_failed", err.Error())
		return
	}

	RespondSuccess(c, fileInfo)
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
	if containsDotDotSegment(req.Path) {
		RespondError(c, http.StatusBadRequest, "invalid_path", "Path must not contain '..'")
		return
	}

	// 记录删除操作开始
	startTime := time.Now()
	fmt.Printf("[SFTP Delete] Starting delete operation: server=%s, path=%s\n", serverID, req.Path)

	// 从连接池获取 SFTP 客户端
	sftpClient, err := h.getPooledClient(c, serverID)
	if err != nil {
		fmt.Printf("[SFTP Delete] Failed to get SFTP client: %v\n", err)
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer sftpClient.Release()

	// 获取文件信息以判断类型,同时用于删除成功后的差异更新响应
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
		if errors.Is(err, sftp.ErrTrashPathNotAllowed) {
			RespondError(c, http.StatusBadRequest, "invalid_path", err.Error())
			return
		}
		elapsed := time.Since(startTime)
		fmt.Printf("[SFTP Delete] Delete failed after %v: %v\n", elapsed, err)
		RespondError(c, http.StatusInternalServerError, "delete_failed", err.Error())
		return
	}

	elapsed := time.Since(startTime)
	fmt.Printf("[SFTP Delete] Delete completed successfully in %v: %s\n", elapsed, req.Path)

	// 返回被删除文件的信息,便于前端做差异更新（实际语义：移动到 .trash）
	RespondSuccessWithMessage(c, fileInfo, "Moved to trash")
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

	// 从连接池获取 SFTP 客户端
	sftpClient, err := h.getPooledClient(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer sftpClient.Release()

	// 重命名
	if err := sftpClient.RenameFile(req.OldPath, req.NewPath); err != nil {
		RespondError(c, http.StatusInternalServerError, "rename_failed", err.Error())
		return
	}

	// 返回重命名后的文件信息,用于前端差异更新
	fileInfo, err := sftpClient.GetFileInfo(req.NewPath)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "stat_failed", err.Error())
		return
	}

	RespondSuccess(c, fileInfo)
}

// Chmod 修改文件或目录权限
// POST /api/v1/sftp/:server_id/chmod
func (h *SFTPHandler) Chmod(c *gin.Context) {
	// 解析服务器 ID
	serverID, err := uuid.Parse(c.Param("server_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_server_id", "Invalid server ID")
		return
	}

	// 解析请求
	var req struct {
		Path string `json:"path" binding:"required"`
		Mode string `json:"mode" binding:"required"` // 八进制字符串，如 "0755"
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 解析权限模式（八进制字符串转为 os.FileMode）
	var mode uint32
	_, err = fmt.Sscanf(req.Mode, "%o", &mode)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_mode", "Invalid permission mode format")
		return
	}

	// 从连接池获取 SFTP 客户端
	sftpClient, err := h.getPooledClient(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer sftpClient.Release()

	// 修改权限
	if err := sftpClient.Chmod(req.Path, os.FileMode(mode)); err != nil {
		RespondError(c, http.StatusInternalServerError, "chmod_failed", err.Error())
		return
	}

	RespondSuccess(c, gin.H{
		"path": req.Path,
		"mode": req.Mode,
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

	// 从连接池获取 SFTP 客户端
	sftpClient, err := h.getPooledClient(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer sftpClient.Release()

	// 读取前先做 size 限制与类型校验，避免 io.ReadAll 造成内存压力
	fi, err := sftpClient.GetFileInfo(path)
	if err != nil {
		RespondError(c, http.StatusNotFound, "file_not_found", err.Error())
		return
	}
	if fi.IsDir {
		RespondError(c, http.StatusBadRequest, "not_a_file", "Path is a directory")
		return
	}
	if fi.Size > maxTextReadBytes {
		RespondError(c, http.StatusRequestEntityTooLarge, "file_too_large", fmt.Sprintf("File exceeds max size (%d bytes)", maxTextReadBytes))
		return
	}

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
	if len(req.Content) > maxTextWriteBytes {
		RespondError(c, http.StatusRequestEntityTooLarge, "content_too_large", fmt.Sprintf("Content exceeds max size (%d bytes)", maxTextWriteBytes))
		return
	}

	// 从连接池获取 SFTP 客户端
	sftpClient, err := h.getPooledClient(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer sftpClient.Release()

	// 写入文件
	if err := sftpClient.WriteFile(req.Path, []byte(req.Content), 0644); err != nil {
		RespondError(c, http.StatusInternalServerError, "write_failed", err.Error())
		return
	}

	// 返回最新的文件信息,便于前端更新大小/修改时间等
	fileInfo, err := sftpClient.GetFileInfo(req.Path)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "stat_failed", err.Error())
		return
	}

	RespondSuccessWithMessage(c, fileInfo, "File written successfully")
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

	// 从连接池获取 SFTP 客户端
	sftpClient, err := h.getPooledClient(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer sftpClient.Release()

	// 获取磁盘使用情况
	diskUsage, err := sftpClient.GetDiskUsage(path)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "disk_usage_failed", err.Error())
		return
	}

	RespondSuccess(c, diskUsage)
}

// BatchOperationError 批量操作错误信息
type BatchOperationError struct {
	Path    string `json:"path"`
	Error   string `json:"error"`
	Message string `json:"message"`
}

// BatchDeleteRequest 批量删除请求
type BatchDeleteRequest struct {
	Paths []string `json:"paths" binding:"required,min=1,max=100"`
}

// BatchDeleteResponse 批量删除响应
type BatchDeleteResponse struct {
	Success []string              `json:"success"`
	Failed  []BatchOperationError `json:"failed"`
	Total   int                   `json:"total"`
}

// BatchDelete 批量删除文件或目录
// DELETE /api/v1/sftp/:server_id/batch-delete
func (h *SFTPHandler) BatchDelete(c *gin.Context) {
	// 解析服务器 ID
	serverID, err := uuid.Parse(c.Param("server_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_server_id", "Invalid server ID")
		return
	}

	// 解析请求
	var req BatchDeleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 记录批量删除操作开始
	startTime := time.Now()
	fmt.Printf("[SFTP BatchDelete] Starting batch delete operation: server=%s, count=%d\n", serverID, len(req.Paths))

	// 从连接池获取 SFTP 客户端
	sftpClient, err := h.getPooledClient(c, serverID)
	if err != nil {
		fmt.Printf("[SFTP BatchDelete] Failed to get SFTP client: %v\n", err)
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer sftpClient.Release()

	// 批量删除
	success := []string{}
	failed := []BatchOperationError{}

	for _, path := range req.Paths {
		select {
		case <-c.Request.Context().Done():
			RespondError(c, http.StatusRequestTimeout, "request_cancelled", "request cancelled")
			return
		default:
		}

		if containsDotDotSegment(path) {
			failed = append(failed, BatchOperationError{
				Path:    path,
				Error:   "invalid_path",
				Message: "Path must not contain '..'",
			})
			continue
		}

		// 获取文件信息以判断类型
		fileInfo, err := sftpClient.GetFileInfo(path)
		if err != nil {
			fmt.Printf("[SFTP BatchDelete] File not found: %s, error: %v\n", path, err)
			failed = append(failed, BatchOperationError{
				Path:    path,
				Error:   "file_not_found",
				Message: err.Error(),
			})
			continue
		}

		// 删除文件或目录
		var deleteErr error
		if fileInfo.IsDir {
			fmt.Printf("[SFTP BatchDelete] Deleting directory: %s\n", path)
			deleteErr = sftpClient.DeleteDirectory(path)
		} else {
			fmt.Printf("[SFTP BatchDelete] Deleting file: %s\n", path)
			deleteErr = sftpClient.DeleteFile(path)
		}

		if deleteErr != nil {
			fmt.Printf("[SFTP BatchDelete] Delete failed: %s, error: %v\n", path, deleteErr)
			if errors.Is(deleteErr, sftp.ErrTrashPathNotAllowed) {
				failed = append(failed, BatchOperationError{
					Path:    path,
					Error:   "invalid_path",
					Message: deleteErr.Error(),
				})
				continue
			}
			failed = append(failed, BatchOperationError{
				Path:    path,
				Error:   "delete_failed",
				Message: deleteErr.Error(),
			})
		} else {
			success = append(success, path)
		}
	}

	elapsed := time.Since(startTime)
	fmt.Printf("[SFTP BatchDelete] Batch delete completed in %v: success=%d, failed=%d\n", elapsed, len(success), len(failed))

	RespondSuccess(c, BatchDeleteResponse{
		Success: success,
		Failed:  failed,
		Total:   len(req.Paths),
	})
}

// BatchDownloadRequest 批量下载请求
type BatchDownloadRequest struct {
	Paths           []string `json:"paths" binding:"required,min=1,max=100"`
	Mode            string   `json:"mode"`            // "fast" 或 "compatible"，默认 "compatible"
	ExcludePatterns []string `json:"excludePatterns"` // 排除的目录名称列表
}

// BatchDownload 批量下载文件（打包为 ZIP）
// POST /api/v1/sftp/:server_id/batch-download
func (h *SFTPHandler) BatchDownload(c *gin.Context) {
	// 解析服务器 ID
	serverID, err := uuid.Parse(c.Param("server_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_server_id", "Invalid server ID")
		return
	}

	// 解析请求：支持 JSON 与原生表单提交（用于浏览器流式下载）
	var req BatchDownloadRequest
	if strings.Contains(strings.ToLower(c.GetHeader("Content-Type")), "application/json") {
		if err := c.ShouldBindJSON(&req); err != nil {
			RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
			return
		}
	} else {
		req.Paths = c.PostFormArray("paths")
		req.Mode = c.PostForm("mode")
		req.ExcludePatterns = c.PostFormArray("excludePatterns")
		if len(req.Paths) == 0 {
			RespondError(c, http.StatusBadRequest, "validation_error", "paths is required")
			return
		}
	}

	// 设置默认值
	if req.Mode == "" {
		req.Mode = "compatible"
	}

	// 设置默认排除规则（如果未提供）
	if len(req.ExcludePatterns) == 0 {
		req.ExcludePatterns = []string{
			"node_modules",
			".git",
			".svn",
			".hg",
			"__pycache__",
			".pytest_cache",
			".next",
			".nuxt",
			"dist",
			"build",
			"target",
			"vendor",
			".cache",
			".DS_Store",
			"thumbs.db",
		}
	}

	// 记录批量下载操作开始
	startTime := time.Now()
	fmt.Printf("[SFTP BatchDownload] Starting batch download: server=%s, mode=%s, count=%d, excludes=%v\n",
		serverID, req.Mode, len(req.Paths), req.ExcludePatterns)

	// 根据模式选择下载方法
	if req.Mode == "fast" {
		h.fastDownload(c, serverID, req)
	} else {
		h.compatibleDownload(c, serverID, req)
	}

	elapsed := time.Since(startTime)
	fmt.Printf("[SFTP BatchDownload] Download completed in %v, mode=%s\n", elapsed, req.Mode)
}

// compatibleDownload 兼容下载模式（SFTP + ZIP，支持排除目录）
func (h *SFTPHandler) compatibleDownload(c *gin.Context, serverID uuid.UUID, req BatchDownloadRequest) {
	// 从连接池获取 SFTP 客户端
	sftpClient, err := h.getPooledClient(c, serverID)
	if err != nil {
		fmt.Printf("[SFTP CompatibleDownload] Failed to get SFTP client: %v\n", err)
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer sftpClient.Release()

	// 设置响应头
	timestamp := time.Now().Format("20060102-150405")
	filename := fmt.Sprintf("files-%s.zip", timestamp)
	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Header("Transfer-Encoding", "chunked")

	// 创建 ZIP 写入器（直接写入响应）
	zipWriter := zip.NewWriter(c.Writer)
	defer zipWriter.Close()

	// 遍历文件列表
	successCount := 0
	failedCount := 0
	excludedCount := 0

	for _, path := range req.Paths {
		select {
		case <-c.Request.Context().Done():
			return
		default:
		}

		// 获取文件信息
		fileInfo, err := sftpClient.GetFileInfo(path)
		if err != nil {
			fmt.Printf("[SFTP CompatibleDownload] File not found: %s, error: %v\n", path, err)
			failedCount++
			continue
		}

		if fileInfo.IsDir {
			// 递归添加目录（带排除逻辑）
			excluded, err := h.addDirToZipWithExcludesPooled(sftpClient, zipWriter, path, filepath.Base(path), req.ExcludePatterns)
			excludedCount += excluded
			if err != nil {
				fmt.Printf("[SFTP CompatibleDownload] Failed to add directory: %s, error: %v\n", path, err)
				failedCount++
			} else {
				successCount++
			}
		} else {
			// 添加单个文件
			if err := h.addFileToZipPooled(sftpClient, zipWriter, path, filepath.Base(path)); err != nil {
				fmt.Printf("[SFTP CompatibleDownload] Failed to add file: %s, error: %v\n", path, err)
				failedCount++
			} else {
				successCount++
			}
		}
	}

	fmt.Printf("[SFTP CompatibleDownload] Completed: success=%d, failed=%d, excluded=%d\n",
		successCount, failedCount, excludedCount)
}

// fastDownload 快速下载模式（使用远程 tar 压缩）
func (h *SFTPHandler) fastDownload(c *gin.Context, serverID uuid.UUID, req BatchDownloadRequest) {
	// 从上下文获取用户 ID
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	// 获取服务器信息
	srv, err := h.serverService.GetByID(c.Request.Context(), userID, serverID)
	if err != nil {
		fmt.Printf("[SFTP FastDownload] Failed to get server: %v\n", err)
		RespondError(c, http.StatusInternalServerError, "server_error", err.Error())
		return
	}

	// 创建 SSH 客户端
	sshClient, err := sshDomain.NewClient(srv, h.encryptor, h.hostKeyCallback)
	if err != nil {
		fmt.Printf("[SFTP FastDownload] Failed to create SSH client: %v\n", err)
		RespondError(c, http.StatusInternalServerError, "ssh_error", err.Error())
		return
	}
	defer sshClient.Close()

	// 连接到服务器（继承请求 ctx，可取消）
	if err := sshClient.ConnectContext(c.Request.Context(), srv.Host, srv.Port); err != nil {
		fmt.Printf("[SFTP FastDownload] Failed to connect: %v\n", err)
		RespondError(c, http.StatusInternalServerError, "connection_error", err.Error())
		return
	}

	// 构建 tar 命令
	// 策略: 对每个路径,切换到其父目录(-C),然后打包目录名(去掉路径前缀)
	// 这样打包出来的文件不会包含完整路径,解压时直接是目录/文件名
	//
	// 例如:
	// 输入: /root/EasySSH-vue
	// 命令: tar -czf - -C /root --exclude='...' EasySSH-vue
	// 输出: EasySSH-vue/... (而不是 root/EasySSH-vue/...)
	var tarCmdParts []string
	tarCmdParts = append(tarCmdParts, "tar -czf -")

	// 添加排除规则(使用安全的单引号转义)
	for _, pattern := range req.ExcludePatterns {
		tarCmdParts = append(tarCmdParts, " --exclude="+shSingleQuote(pattern))
	}

	// 对每个路径,添加 -C parent_dir base_name
	for _, path := range req.Paths {
		// 分离父目录和文件/目录名
		lastSlash := strings.LastIndex(path, "/")
		var parentDir, baseName string

		if lastSlash == -1 {
			// 没有斜杠,相对路径
			parentDir = "."
			baseName = path
		} else if lastSlash == 0 {
			// 根目录下的文件/目录,如 /etc
			parentDir = "/"
			baseName = path[1:]
		} else {
			// 正常路径,如 /root/EasySSH-vue
			parentDir = path[:lastSlash]
			baseName = path[lastSlash+1:]
		}

		// 使用单引号转义,避免路径中包含空格/特殊字符导致命令被截断或注入
		tarCmdParts = append(tarCmdParts, fmt.Sprintf(" -C %s %s", shSingleQuote(parentDir), shSingleQuote(baseName)))
	}

	tarCmd := strings.Join(tarCmdParts, "")
	fmt.Printf("[SFTP FastDownload] Executing tar command: %s\n", tarCmd)

	// 创建 SSH 会话
	session, err := sshClient.NewSession()
	if err != nil {
		fmt.Printf("[SFTP FastDownload] Failed to create session: %v\n", err)
		RespondError(c, http.StatusInternalServerError, "ssh_error", fmt.Sprintf("Failed to create session: %v", err))
		return
	}
	defer session.Close()

	// 设置响应头
	timestamp := time.Now().Format("20060102-150405")
	filename := fmt.Sprintf("files-%s.tar.gz", timestamp)
	c.Header("Content-Type", "application/gzip")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Header("Transfer-Encoding", "chunked")

	// 将 session 的 stdout 直接连接到响应
	session.Stdout = c.Writer

	// 捕获 stderr 用于错误日志
	var stderrBuf bytes.Buffer
	session.Stderr = &stderrBuf

	// 执行命令
	if err := session.Run(tarCmd); err != nil {
		stderrOutput := stderrBuf.String()
		fmt.Printf("[SFTP FastDownload] Tar command failed: %v, stderr: %s\n", err, stderrOutput)

		// 如果 tar 不存在，提示用户
		if strings.Contains(stderrOutput, "command not found") || strings.Contains(stderrOutput, "not found") {
			RespondError(c, http.StatusBadRequest, "tar_not_found", "服务器未安装 tar 工具，请使用兼容下载模式")
		} else {
			RespondError(c, http.StatusInternalServerError, "tar_error", fmt.Sprintf("Tar command failed: %v", err))
		}
		return
	}

	fmt.Printf("[SFTP FastDownload] Tar completed successfully\n")
}

// shSingleQuote 将字符串按 POSIX 单引号安全包裹: ' -> '\”
// 用于构造通过 shell 执行的命令参数,防止因为特殊字符导致命令注入或解析错误。
func shSingleQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "'\\''") + "'"
}

// shouldExcludeDir 检查目录是否应该被排除
func (h *SFTPHandler) shouldExcludeDir(dirName string, excludePatterns []string) bool {
	for _, pattern := range excludePatterns {
		if dirName == pattern {
			return true
		}
	}
	return false
}

// addDirToZipWithExcludes 递归添加目录到 ZIP（支持排除规则）
func (h *SFTPHandler) addDirToZipWithExcludes(sftpClient *sftp.Client, zipWriter *zip.Writer, remotePath, baseDir string, excludePatterns []string) (int, error) {
	excludedCount := 0

	// 列出目录内容
	listing, err := sftpClient.ListDirectory(remotePath)
	if err != nil {
		return excludedCount, fmt.Errorf("failed to list directory: %w", err)
	}

	for _, file := range listing.Files {
		// 跳过 . 和 ..
		if file.Name == "." || file.Name == ".." {
			continue
		}

		// 跳过符号链接
		if file.Mode&os.ModeSymlink != 0 {
			fmt.Printf("[SFTP CompatibleDownload] Skip symlink: %s\n", file.Path)
			continue
		}

		// 检查是否应该排除此目录
		if file.IsDir && h.shouldExcludeDir(file.Name, excludePatterns) {
			fmt.Printf("[SFTP CompatibleDownload] Excluded directory: %s\n", file.Path)
			excludedCount++

			// 在 ZIP 中创建占位文件说明
			placeholderPath := filepath.Join(baseDir, file.Name, ".excluded")
			writer, err := zipWriter.Create(placeholderPath)
			if err == nil {
				fmt.Fprintf(writer, "此目录已被排除：%s\n原因：匹配排除规则\n", file.Name)
			}
			continue
		}

		zipPath := filepath.Join(baseDir, file.Name)

		if file.IsDir {
			// 递归处理子目录
			subExcluded, err := h.addDirToZipWithExcludes(sftpClient, zipWriter, file.Path, zipPath, excludePatterns)
			excludedCount += subExcluded
			if err != nil {
				fmt.Printf("[SFTP CompatibleDownload] Failed to add subdirectory: %s, error: %v\n", file.Path, err)
			}
		} else {
			// 添加文件
			if err := h.addFileToZip(sftpClient, zipWriter, file.Path, zipPath); err != nil {
				fmt.Printf("[SFTP CompatibleDownload] Failed to add file: %s, error: %v\n", file.Path, err)
			}
		}
	}

	return excludedCount, nil
}

// addFileToZip 添加单个文件到 ZIP
func (h *SFTPHandler) addFileToZip(sftpClient *sftp.Client, zipWriter *zip.Writer, remotePath, zipPath string) error {
	// 创建 ZIP 条目
	writer, err := zipWriter.Create(zipPath)
	if err != nil {
		return fmt.Errorf("failed to create ZIP entry: %w", err)
	}

	// 下载文件并写入 ZIP
	if err := sftpClient.DownloadFile(remotePath, writer); err != nil {
		return fmt.Errorf("failed to download file: %w", err)
	}

	return nil
}

// addDirToZip 递归添加目录到 ZIP
func (h *SFTPHandler) addDirToZip(sftpClient *sftp.Client, zipWriter *zip.Writer, remotePath, baseDir string) error {
	// 列出目录内容
	listing, err := sftpClient.ListDirectory(remotePath)
	if err != nil {
		return fmt.Errorf("failed to list directory: %w", err)
	}

	// 遍历目录中的文件
	for _, file := range listing.Files {
		// 跳过 . 和 ..
		if file.Name == "." || file.Name == ".." {
			continue
		}

		// 跳过符号链接(尤其是 pnpm 等包管理器在 node_modules 中创建的大量目录/文件链接),
		// 这些链接的目标可能是目录或不存在的路径,通过 SFTP 直接 DownloadFile 往往返回 SSH_FX_FAILURE。
		if file.Mode&os.ModeSymlink != 0 {
			fmt.Printf("[SFTP BatchDownload] Skip symlink: %s\n", file.Path)
			continue
		}

		zipPath := filepath.Join(baseDir, file.Name)

		if file.IsDir {
			// 递归添加子目录
			if err := h.addDirToZip(sftpClient, zipWriter, file.Path, zipPath); err != nil {
				fmt.Printf("[SFTP BatchDownload] Failed to add subdirectory: %s, error: %v\n", file.Path, err)
				// 继续处理其他文件，不中断整个操作
			}
		} else {
			// 添加文件
			if err := h.addFileToZip(sftpClient, zipWriter, file.Path, zipPath); err != nil {
				fmt.Printf("[SFTP BatchDownload] Failed to add file: %s, error: %v\n", file.Path, err)
				// 继续处理其他文件，不中断整个操作
			}
		}
	}

	return nil
}

// ======================================
// PooledClient 辅助方法（支持连接池）
// ======================================

// addDirToZipWithExcludesPooled 递归添加目录到 ZIP（支持排除规则，使用池化连接）
func (h *SFTPHandler) addDirToZipWithExcludesPooled(sftpClient *sftp.PooledClient, zipWriter *zip.Writer, remotePath, baseDir string, excludePatterns []string) (int, error) {
	excludedCount := 0

	// 列出目录内容
	listing, err := sftpClient.ListDirectory(remotePath)
	if err != nil {
		return excludedCount, fmt.Errorf("failed to list directory: %w", err)
	}

	for _, file := range listing.Files {
		// 跳过 . 和 ..
		if file.Name == "." || file.Name == ".." {
			continue
		}

		// 跳过符号链接
		if file.Mode&os.ModeSymlink != 0 {
			fmt.Printf("[SFTP CompatibleDownload] Skip symlink: %s\n", file.Path)
			continue
		}

		// 检查是否应该排除此目录
		if file.IsDir && h.shouldExcludeDir(file.Name, excludePatterns) {
			fmt.Printf("[SFTP CompatibleDownload] Excluded directory: %s\n", file.Path)
			excludedCount++

			// 在 ZIP 中创建占位文件说明
			placeholderPath := filepath.Join(baseDir, file.Name, ".excluded")
			writer, err := zipWriter.Create(placeholderPath)
			if err == nil {
				fmt.Fprintf(writer, "此目录已被排除：%s\n原因：匹配排除规则\n", file.Name)
			}
			continue
		}

		zipPath := filepath.Join(baseDir, file.Name)

		if file.IsDir {
			// 递归处理子目录
			subExcluded, err := h.addDirToZipWithExcludesPooled(sftpClient, zipWriter, file.Path, zipPath, excludePatterns)
			excludedCount += subExcluded
			if err != nil {
				fmt.Printf("[SFTP CompatibleDownload] Failed to add subdirectory: %s, error: %v\n", file.Path, err)
			}
		} else {
			// 添加文件
			if err := h.addFileToZipPooled(sftpClient, zipWriter, file.Path, zipPath); err != nil {
				fmt.Printf("[SFTP CompatibleDownload] Failed to add file: %s, error: %v\n", file.Path, err)
			}
		}
	}

	return excludedCount, nil
}

// addFileToZipPooled 添加单个文件到 ZIP（使用池化连接）
func (h *SFTPHandler) addFileToZipPooled(sftpClient *sftp.PooledClient, zipWriter *zip.Writer, remotePath, zipPath string) error {
	// 创建 ZIP 条目
	writer, err := zipWriter.Create(zipPath)
	if err != nil {
		return fmt.Errorf("failed to create ZIP entry: %w", err)
	}

	// 下载文件并写入 ZIP
	if err := sftpClient.DownloadFile(remotePath, writer); err != nil {
		return fmt.Errorf("failed to download file: %w", err)
	}

	return nil
}

// ======================================
// 跨服务器文件传输 API
// ======================================

// TransferRequest 跨服务器传输请求
type TransferRequest struct {
	SourceServerID string `json:"source_server_id" binding:"required"`
	SourcePath     string `json:"source_path" binding:"required"`
	TargetServerID string `json:"target_server_id" binding:"required"`
	TargetPath     string `json:"target_path" binding:"required"`
}

// TransferResponse 跨服务器传输响应
type TransferResponse struct {
	Success     bool   `json:"success"`
	Message     string `json:"message"`
	BytesCopied int64  `json:"bytes_copied"`
	FileName    string `json:"file_name"`
}

// Transfer 跨服务器文件传输（流式中转）
// POST /api/v1/sftp/transfer
func (h *SFTPHandler) Transfer(c *gin.Context) {
	// 解析请求
	var req TransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 解析服务器 ID
	sourceServerID, err := uuid.Parse(req.SourceServerID)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_source_server_id", "Invalid source server ID")
		return
	}

	targetServerID, err := uuid.Parse(req.TargetServerID)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_target_server_id", "Invalid target server ID")
		return
	}

	// 不允许同一服务器内传输（应使用 rename/copy）
	if sourceServerID == targetServerID {
		RespondError(c, http.StatusBadRequest, "same_server", "Cannot transfer between the same server, use rename instead")
		return
	}

	startTime := time.Now()
	fmt.Printf("[SFTP Transfer] Starting transfer: source=%s:%s -> target=%s:%s\n",
		req.SourceServerID, req.SourcePath, req.TargetServerID, req.TargetPath)

	// 创建源服务器 SFTP 客户端
	sourceClient, _, err := h.createSFTPClient(c, sourceServerID)
	if err != nil {
		fmt.Printf("[SFTP Transfer] Failed to connect to source server: %v\n", err)
		RespondError(c, http.StatusInternalServerError, "source_connection_failed", fmt.Sprintf("Failed to connect to source server: %v", err))
		return
	}
	defer sourceClient.Close()

	// 创建目标服务器 SFTP 客户端
	targetClient, _, err := h.createSFTPClient(c, targetServerID)
	if err != nil {
		fmt.Printf("[SFTP Transfer] Failed to connect to target server: %v\n", err)
		RespondError(c, http.StatusInternalServerError, "target_connection_failed", fmt.Sprintf("Failed to connect to target server: %v", err))
		return
	}
	defer targetClient.Close()

	// 获取源文件信息
	sourceInfo, err := sourceClient.GetFileInfo(req.SourcePath)
	if err != nil {
		fmt.Printf("[SFTP Transfer] Source file not found: %s, error: %v\n", req.SourcePath, err)
		RespondError(c, http.StatusNotFound, "source_not_found", fmt.Sprintf("Source file not found: %v", err))
		return
	}

	// 计算目标路径（如果目标是目录，则追加源文件名）
	targetPath := req.TargetPath
	targetInfo, err := targetClient.GetFileInfo(targetPath)
	if err == nil && targetInfo.IsDir {
		// 目标是已存在的目录，追加源文件名
		targetPath = path.Join(targetPath, sourceInfo.Name)
	}

	var bytesCopied int64

	if sourceInfo.IsDir {
		// 目录传输：递归复制
		bytesCopied, err = h.transferDirectory(c.Request.Context(), sourceClient, targetClient, req.SourcePath, targetPath)
	} else {
		// 单文件传输：流式复制
		bytesCopied, err = h.transferFile(c.Request.Context(), sourceClient, targetClient, req.SourcePath, targetPath)
	}

	if err != nil {
		fmt.Printf("[SFTP Transfer] Transfer failed: %v\n", err)
		RespondError(c, http.StatusInternalServerError, "transfer_failed", err.Error())
		return
	}

	elapsed := time.Since(startTime)
	fmt.Printf("[SFTP Transfer] Transfer completed in %v: %d bytes copied\n", elapsed, bytesCopied)

	RespondSuccess(c, TransferResponse{
		Success:     true,
		Message:     fmt.Sprintf("Transfer completed in %v", elapsed),
		BytesCopied: bytesCopied,
		FileName:    sourceInfo.Name,
	})
}

// transferFile 流式传输单个文件（源 -> 目标），支持 ctx 取消，并在取消/失败时清理半文件
func (h *SFTPHandler) transferFile(ctx context.Context, sourceClient, targetClient *sftp.Client, sourcePath, targetPath string) (int64, error) {
	// 打开源文件进行读取
	reader, err := sourceClient.OpenFile(sourcePath)
	if err != nil {
		return 0, fmt.Errorf("failed to open source file: %w", err)
	}
	defer reader.Close()

	// 在目标服务器创建文件
	writer, err := targetClient.CreateFile(targetPath)
	if err != nil {
		return 0, fmt.Errorf("failed to create target file: %w", err)
	}
	defer writer.Close()

	// 流式复制（使用 32KB 缓冲区）
	buf := make([]byte, 32*1024)
	totalCopied, copyErr := io.CopyBuffer(writer, &ctxReader{ctx: ctx, reader: reader}, buf)
	if copyErr != nil {
		// 尝试清理半文件
		_ = writer.Close()
		_ = targetClient.RemoveFile(targetPath)
		return totalCopied, copyErr
	}
	return totalCopied, nil
}

// transferDirectory 递归传输目录
func (h *SFTPHandler) transferDirectory(ctx context.Context, sourceClient, targetClient *sftp.Client, sourcePath, targetPath string) (int64, error) {
	var totalCopied int64

	// 在目标服务器创建目录
	if err := targetClient.CreateDirectories(targetPath); err != nil {
		return 0, fmt.Errorf("failed to create target directory: %w", err)
	}

	// 列出源目录内容
	listing, err := sourceClient.ListDirectory(sourcePath)
	if err != nil {
		return 0, fmt.Errorf("failed to list source directory: %w", err)
	}

	for _, file := range listing.Files {
		select {
		case <-ctx.Done():
			return totalCopied, ctx.Err()
		default:
		}

		// 跳过 . 和 ..
		if file.Name == "." || file.Name == ".." {
			continue
		}

		// 跳过符号链接
		if file.Mode&os.ModeSymlink != 0 {
			fmt.Printf("[SFTP Transfer] Skip symlink: %s\n", file.Path)
			continue
		}

		srcPath := path.Join(sourcePath, file.Name)
		dstPath := path.Join(targetPath, file.Name)

		if file.IsDir {
			// 递归传输子目录
			copied, err := h.transferDirectory(ctx, sourceClient, targetClient, srcPath, dstPath)
			if err != nil {
				fmt.Printf("[SFTP Transfer] Failed to transfer subdirectory %s: %v\n", srcPath, err)
				// 继续处理其他文件
			} else {
				totalCopied += copied
			}
		} else {
			// 传输文件
			copied, err := h.transferFile(ctx, sourceClient, targetClient, srcPath, dstPath)
			if err != nil {
				fmt.Printf("[SFTP Transfer] Failed to transfer file %s: %v\n", srcPath, err)
				// 继续处理其他文件
			} else {
				totalCopied += copied
			}
		}
	}

	return totalCopied, nil
}

// ======================================
// 跨服务器直连传输 API (SCP/rsync)
// ======================================

// DirectTransferRequest 直连传输请求
type DirectTransferRequest struct {
	SourceServerID string `json:"source_server_id" binding:"required"`
	SourcePath     string `json:"source_path" binding:"required"`
	TargetServerID string `json:"target_server_id" binding:"required"`
	TargetPath     string `json:"target_path" binding:"required"`
}

// DirectTransferResponse 直连传输响应
type DirectTransferResponse struct {
	Success bool   `json:"success"`
	TaskID  string `json:"task_id"`
	Message string `json:"message"`
}

// DirectTransfer 跨服务器直连传输（使用 rsync/scp）
// POST /api/v1/sftp/transfer/direct
// 此方法启动后台传输任务，通过 WebSocket 推送进度
func (h *SFTPHandler) DirectTransfer(c *gin.Context) {
	// 检查 transferHandler 是否已设置
	if h.transferHandler == nil {
		RespondError(c, http.StatusServiceUnavailable, "transfer_not_available", "Direct transfer service not available")
		return
	}

	// 解析请求
	var req DirectTransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 解析用户ID
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "Invalid user session")
		return
	}

	// 解析服务器 ID
	sourceServerID, err := uuid.Parse(req.SourceServerID)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_source_server_id", "Invalid source server ID")
		return
	}

	targetServerID, err := uuid.Parse(req.TargetServerID)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_target_server_id", "Invalid target server ID")
		return
	}

	// 不允许同一服务器内传输
	if sourceServerID == targetServerID {
		RespondError(c, http.StatusBadRequest, "same_server", "Cannot transfer between the same server")
		return
	}

	// 服务端生成任务ID（避免客户端自带 task_id 造成撞库/窃听）
	taskID := uuid.New().String()

	fmt.Printf("[SFTP DirectTransfer] Starting direct transfer: taskID=%s, source=%s:%s -> target=%s:%s\n",
		taskID, req.SourceServerID, req.SourcePath, req.TargetServerID, req.TargetPath)

	// 启动后台传输任务
	err = h.transferHandler.StartDirectTransfer(
		context.Background(),
		taskID,
		userID,
		sourceServerID,
		req.SourcePath,
		targetServerID,
		req.TargetPath,
	)

	if err != nil {
		fmt.Printf("[SFTP DirectTransfer] Failed to start transfer: %v\n", err)
		RespondError(c, http.StatusInternalServerError, "transfer_start_failed", err.Error())
		return
	}

	RespondSuccess(c, DirectTransferResponse{
		Success: true,
		TaskID:  taskID,
		Message: "Transfer started, connect to WebSocket for progress updates",
	})
}

// CancelTransfer 取消传输任务
// POST /api/v1/sftp/transfer/:task_id/cancel
func (h *SFTPHandler) CancelTransfer(c *gin.Context) {
	if h.transferHandler == nil {
		RespondError(c, http.StatusServiceUnavailable, "transfer_not_available", "Direct transfer service not available")
		return
	}

	taskID := c.Param("task_id")
	if taskID == "" {
		RespondError(c, http.StatusBadRequest, "task_id_required", "Task ID is required")
		return
	}

	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	if ok := h.transferHandler.CancelTaskForUser(userID, taskID); !ok {
		RespondError(c, http.StatusForbidden, "forbidden", "Task not owned by user")
		return
	}

	RespondSuccess(c, gin.H{
		"success": true,
		"message": "Cancel request sent",
	})
}

// ======================================
// 连接池管理 API
// ======================================

// CloseConnection 关闭指定服务器的 SFTP 连接
// POST /api/v1/sftp/:server_id/close
// 当用户关闭 SFTP 面板时调用此接口释放连接
func (h *SFTPHandler) CloseConnection(c *gin.Context) {
	// 解析服务器 ID
	serverID, err := uuid.Parse(c.Param("server_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_server_id", "Invalid server ID")
		return
	}

	// 从上下文获取用户 ID
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	// 关闭该用户对该服务器的所有连接
	h.pool.CloseByKey(userID, serverID)

	fmt.Printf("[SFTP Pool] User %s closed connections for server %s\n", userID, serverID)

	RespondSuccess(c, gin.H{
		"success": true,
		"message": "Connection closed",
	})
}

// GetPoolStats 获取连接池统计信息
// GET /api/v1/sftp/pool/stats
func (h *SFTPHandler) GetPoolStats(c *gin.Context) {
	stats := h.pool.Stats()
	RespondSuccess(c, stats)
}

// ======================================
// 回收站（.trash）API
// ======================================

// ListTrash 列出指定目录同级 .trash 下的条目
// GET /api/v1/sftp/:server_id/trash/list?path=/path/to/dir
func (h *SFTPHandler) ListTrash(c *gin.Context) {
	serverID, err := uuid.Parse(c.Param("server_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_server_id", "Invalid server ID")
		return
	}

	parentDir := c.DefaultQuery("path", "/")
	if containsDotDotSegment(parentDir) {
		RespondError(c, http.StatusBadRequest, "invalid_path", "Path must not contain '..'")
		return
	}
	parentDir = path.Clean(parentDir)
	trashDir := path.Join(parentDir, ".trash")

	sftpClient, err := h.getPooledClient(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer sftpClient.Release()

	listing, err := sftpClient.ListDirectory(trashDir)
	if err != nil {
		// .trash 不存在视为“空”，其他错误透出
		if isSFTPNoSuchFile(err) {
			RespondSuccess(c, sftp.TrashListing{
				ParentDir: parentDir,
				TrashDir:  trashDir,
				Items:     []sftp.TrashEntry{},
				Total:     0,
			})
			return
		}
		RespondError(c, http.StatusInternalServerError, "trash_list_failed", err.Error())
		return
	}

	items := make([]sftp.TrashEntry, 0, len(listing.Files))
	for _, fi := range listing.Files {
		if fi == nil || fi.Name == "." || fi.Name == ".." {
			continue
		}

		originalName, _ := parseOriginalNameFromTrashName(fi.Name)
		restorePath := path.Join(parentDir, originalName)

		items = append(items, sftp.TrashEntry{
			TrashName:    fi.Name,
			TrashPath:    fi.Path,
			OriginalName: originalName,
			RestorePath:  restorePath,
			Size:         fi.Size,
			Mode:         fi.Mode,
			IsDir:        fi.IsDir,
			IsLink:       fi.IsLink,
			ModTime:      fi.ModTime,
			Permission:   fi.Permission,
		})
	}

	// 默认按“删除时间（mtime）倒序”展示
	sort.Slice(items, func(i, j int) bool {
		return items[i].ModTime.After(items[j].ModTime)
	})

	RespondSuccess(c, sftp.TrashListing{
		ParentDir: parentDir,
		TrashDir:  trashDir,
		Items:     items,
		Total:     len(items),
	})
}

type restoreTrashRequest struct {
	TrashPath         string `json:"trash_path" binding:"required"`
	RenameIfExists    bool   `json:"rename_if_exists"`
	CustomRestorePath string `json:"custom_restore_path"` // 用户指定的恢复路径（可选）
}

// RestoreTrash 将回收站条目恢复到同级目录
// POST /api/v1/sftp/:server_id/trash/restore
//
// 冲突处理策略：
// 1. 默认：如果目标路径已存在，返回 409 Conflict 并附带冲突详情和建议路径
// 2. rename_if_exists=true：自动重命名为 {name}.restored-{uuid}
// 3. custom_restore_path：恢复到用户指定的路径
//
// 使用乐观锁防止与清理器的竞态条件（当存在索引记录时）
func (h *SFTPHandler) RestoreTrash(c *gin.Context) {
	serverID, err := uuid.Parse(c.Param("server_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_server_id", "Invalid server ID")
		return
	}

	var req restoreTrashRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}
	if containsDotDotSegment(req.TrashPath) {
		RespondError(c, http.StatusBadRequest, "invalid_trash_path", "trash_path must not contain '..'")
		return
	}
	trashPath := path.Clean(req.TrashPath)
	if !isTrashEntryPath(trashPath) {
		RespondError(c, http.StatusBadRequest, "invalid_trash_path", "trash_path must point to an entry under .trash")
		return
	}

	// 验证自定义恢复路径
	if req.CustomRestorePath != "" {
		if containsDotDotSegment(req.CustomRestorePath) {
			RespondError(c, http.StatusBadRequest, "invalid_restore_path", "restore path must not contain '..'")
			return
		}
	}

	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	sftpClient, err := h.getPooledClient(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer sftpClient.Release()

	trashName := path.Base(trashPath)
	originalName, _ := parseOriginalNameFromTrashName(trashName)
	parentDir := path.Dir(path.Dir(trashPath)) // .../<parent>/.trash/<entry>

	// 确定恢复路径
	restorePath := path.Join(parentDir, originalName)
	if req.CustomRestorePath != "" {
		restorePath = path.Clean(req.CustomRestorePath)
	}

	// 生成建议的备选路径
	suggestPath := path.Join(parentDir, fmt.Sprintf("%s.restored-%s", originalName, uuid.NewString()[:8]))

	// 检查目标路径是否存在冲突
	existingFile, err := sftpClient.GetFileInfo(restorePath)
	if err == nil {
		// 目标路径已存在
		if !req.RenameIfExists && req.CustomRestorePath == "" {
			// 返回详细的冲突信息，帮助用户决策
			RespondErrorWithDetails(c, http.StatusConflict, "restore_conflict", "restore path already exists", gin.H{
				"restore_path":  restorePath,
				"suggest_path":  suggestPath,
				"existing_file": existingFile,
				"options": []string{
					"Set rename_if_exists=true to auto-rename",
					"Set custom_restore_path to specify a different path",
				},
			})
			return
		}
		// 自动重命名
		if req.RenameIfExists && req.CustomRestorePath == "" {
			restorePath = suggestPath
		}
		// 如果 custom_restore_path 指定的路径也存在冲突，报错
		if req.CustomRestorePath != "" {
			RespondErrorWithDetails(c, http.StatusConflict, "restore_conflict", "custom restore path already exists", gin.H{
				"restore_path":  restorePath,
				"suggest_path":  suggestPath,
				"existing_file": existingFile,
			})
			return
		}
	}

	// 尝试获取索引记录以使用乐观锁
	var indexItem *sftp.TrashItem
	if h.trashItemRepo != nil {
		indexItem, _ = h.trashItemRepo.GetByTrashPath(c.Request.Context(), userID, serverID, trashPath)
	}

	if indexItem != nil {
		// 存在索引记录，使用乐观锁机制

		// 阶段1：使用乐观锁标记为 restoring 状态（获取锁）
		affected, lockErr := h.trashItemRepo.TryMarkRestoringByTrashPath(c.Request.Context(), userID, serverID, trashPath, indexItem.Version)
		if lockErr != nil {
			RespondError(c, http.StatusInternalServerError, "db_error", lockErr.Error())
			return
		}
		if affected == 0 {
			// 版本不匹配或状态已变更（可能正在被清理）
			RespondError(c, http.StatusConflict, "concurrent_modification", "Trash item was modified by another operation (possibly being purged), please refresh and try again")
			return
		}

		// 阶段2：执行物理恢复（重命名）
		if err := sftpClient.RenameFile(trashPath, restorePath); err != nil {
			// 恢复失败，回滚数据库状态到 active
			if rollbackErr := h.trashItemRepo.RollbackRestoringByTrashPath(c.Request.Context(), userID, serverID, trashPath); rollbackErr != nil {
				log.Printf("[SFTP Trash] WARN: rollback restoring failed: trashPath=%s, err=%v", trashPath, rollbackErr)
			}
			RespondError(c, http.StatusInternalServerError, "restore_failed", err.Error())
			return
		}

		// 阶段3：完成恢复，更新为 restored 状态
		now := time.Now()
		if err := h.trashItemRepo.FinishRestoreByTrashPath(c.Request.Context(), userID, serverID, trashPath, now, restorePath); err != nil {
			// 物理操作已成功，但数据库更新失败，记录警告
			log.Printf("[SFTP Trash] WARN: finish restore db update failed (physical restore succeeded): trashPath=%s, restorePath=%s, err=%v", trashPath, restorePath, err)
		}
	} else {
		// 无索引记录，直接执行恢复（兼容无索引的旧文件）
		if err := sftpClient.RenameFile(trashPath, restorePath); err != nil {
			RespondError(c, http.StatusInternalServerError, "restore_failed", err.Error())
			return
		}

		// 尝试回写索引（如果 trashItemRepo 可用）
		if h.trashItemRepo != nil {
			now := time.Now()
			if markErr := h.trashItemRepo.MarkRestoredByTrashPath(c.Request.Context(), userID, serverID, trashPath, now, restorePath); markErr != nil {
				log.Printf("[SFTP Trash] WARN: mark restored failed (no index): trashPath=%s, err=%v", trashPath, markErr)
			}
		}
	}

	info, _ := sftpClient.GetFileInfo(restorePath)
	RespondSuccess(c, gin.H{
		"success":       true,
		"trash_path":    trashPath,
		"restore_path":  restorePath,
		"original_name": originalName,
		"file":          info,
	})
}

type purgeTrashRequest struct {
	TrashPath string `json:"trash_path" binding:"required"`
}

// PurgeTrash 永久删除回收站条目（不会再次进入 .trash）
// DELETE /api/v1/sftp/:server_id/trash/purge
func (h *SFTPHandler) PurgeTrash(c *gin.Context) {
	serverID, err := uuid.Parse(c.Param("server_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_server_id", "Invalid server ID")
		return
	}

	var req purgeTrashRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}
	if containsDotDotSegment(req.TrashPath) {
		RespondError(c, http.StatusBadRequest, "invalid_trash_path", "trash_path must not contain '..'")
		return
	}
	trashPath := path.Clean(req.TrashPath)
	if !isTrashEntryPath(trashPath) {
		RespondError(c, http.StatusBadRequest, "invalid_trash_path", "trash_path must point to an entry under .trash")
		return
	}

	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	sftpClient, err := h.getPooledClient(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer sftpClient.Release()

	fi, err := sftpClient.GetFileInfo(trashPath)
	if err != nil {
		if h.trashItemRepo != nil {
			now := time.Now()
			_ = h.trashItemRepo.MarkPurgedByTrashPath(c.Request.Context(), userID, serverID, trashPath, now, sftp.TrashItemStatusMissing)
		}
		RespondError(c, http.StatusNotFound, "not_found", err.Error())
		return
	}

	if fi.IsDir {
		if err := sftpClient.RemoveAll(trashPath); err != nil {
			RespondError(c, http.StatusInternalServerError, "purge_failed", err.Error())
			return
		}
	} else {
		if err := sftpClient.RemoveFile(trashPath); err != nil {
			RespondError(c, http.StatusInternalServerError, "purge_failed", err.Error())
			return
		}
	}

	if h.trashItemRepo != nil {
		now := time.Now()
		_ = h.trashItemRepo.MarkPurgedByTrashPath(c.Request.Context(), userID, serverID, trashPath, now, sftp.TrashItemStatusPurged)
	}

	RespondSuccess(c, gin.H{
		"success":    true,
		"trash_path": trashPath,
	})
}

type emptyTrashRequest struct {
	Path           string `json:"path" binding:"required"`
	MaxDeletes     int    `json:"max_deletes"`
	OlderThanHours int    `json:"older_than_hours"`
}

// EmptyTrash 清空指定目录同级 .trash（可选仅清理超过一定时间的条目）
// POST /api/v1/sftp/:server_id/trash/empty
func (h *SFTPHandler) EmptyTrash(c *gin.Context) {
	serverID, err := uuid.Parse(c.Param("server_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_server_id", "Invalid server ID")
		return
	}

	var req emptyTrashRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}
	if containsDotDotSegment(req.Path) {
		RespondError(c, http.StatusBadRequest, "invalid_path", "Path must not contain '..'")
		return
	}
	parentDir := path.Clean(req.Path)
	trashDir := path.Join(parentDir, ".trash")

	maxDeletes := req.MaxDeletes
	if maxDeletes <= 0 {
		maxDeletes = 500
	}

	cutoff := time.Time{}
	if req.OlderThanHours > 0 {
		cutoff = time.Now().Add(-time.Duration(req.OlderThanHours) * time.Hour)
	}

	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	sftpClient, err := h.getPooledClient(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer sftpClient.Release()

	listing, err := sftpClient.ListDirectory(trashDir)
	if err != nil {
		if isSFTPNoSuchFile(err) {
			RespondSuccess(c, gin.H{
				"success": true,
				"deleted": 0,
				"failed":  []interface{}{},
			})
			return
		}
		RespondError(c, http.StatusInternalServerError, "trash_empty_failed", err.Error())
		return
	}

	deleted := 0
	var failed []map[string]string

	for _, fi := range listing.Files {
		if fi == nil || fi.Name == "." || fi.Name == ".." {
			continue
		}
		if deleted >= maxDeletes {
			break
		}
		if !cutoff.IsZero() && !fi.ModTime.IsZero() && fi.ModTime.After(cutoff) {
			continue
		}

		select {
		case <-c.Request.Context().Done():
			RespondError(c, http.StatusRequestTimeout, "cancelled", "request cancelled")
			return
		default:
		}

		if !isTrashEntryPath(fi.Path) {
			continue
		}

		if fi.IsDir {
			if err := sftpClient.RemoveAll(fi.Path); err != nil {
				failed = append(failed, map[string]string{"path": fi.Path, "error": err.Error()})
				continue
			}
		} else {
			if err := sftpClient.RemoveFile(fi.Path); err != nil {
				failed = append(failed, map[string]string{"path": fi.Path, "error": err.Error()})
				continue
			}
		}
		deleted++

		if h.trashItemRepo != nil {
			now := time.Now()
			_ = h.trashItemRepo.MarkPurgedByTrashPath(c.Request.Context(), userID, serverID, fi.Path, now, sftp.TrashItemStatusPurged)
		}
	}

	RespondSuccess(c, gin.H{
		"success":   true,
		"trash_dir": trashDir,
		"deleted":   deleted,
		"failed":    failed,
	})
}

// ======================================
// 全局回收站（索引表）
// ======================================

// ListTrashItems 列出该用户的回收站索引条目（不需要遍历目录）
// GET /api/v1/sftp/trash/items?status=active&server_id=...&parent_dir=...&limit=50&offset=0
func (h *SFTPHandler) ListTrashItems(c *gin.Context) {
	if h.trashItemRepo == nil {
		RespondError(c, http.StatusServiceUnavailable, "trash_not_available", "trash index not available")
		return
	}

	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	limit := 50
	offset := 0
	if v := c.Query("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			if n > 0 && n <= 200 {
				limit = n
			}
		}
	}
	if v := c.Query("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			if n >= 0 {
				offset = n
			}
		}
	}

	var filters sftp.TrashItemFilters

	if v := c.Query("server_id"); v != "" {
		if sid, err := uuid.Parse(v); err == nil {
			filters.ServerID = &sid
		}
	}
	if v := c.Query("parent_dir"); v != "" {
		parent := path.Clean(v)
		filters.ParentDir = &parent
	}
	if v := c.Query("status"); v != "" {
		if !isValidTrashItemStatus(v) {
			RespondError(c, http.StatusBadRequest, "invalid_status", "Invalid status")
			return
		}
		status := sftp.TrashItemStatus(v)
		filters.Status = &status
	}

	rows, total, err := h.trashItemRepo.List(c.Request.Context(), userID, filters, limit, offset)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "trash_list_failed", err.Error())
		return
	}

	// 获取统计信息
	stats, err := h.trashItemRepo.GetStatistics(c.Request.Context(), userID, filters)
	if err != nil {
		// 统计失败不阻塞列表返回，使用默认值
		stats = &sftp.TrashStatistics{}
	}

	RespondSuccess(c, gin.H{
		"items":  rows,
		"total":  total,
		"limit":  limit,
		"offset": offset,
		"statistics": gin.H{
			"total_items":   stats.TotalItems,
			"total_size":    stats.TotalSize,
			"file_count":    stats.FileCount,
			"folder_count":  stats.FolderCount,
			"active_items":  stats.ActiveItems,
			"active_size":   stats.ActiveSize,
		},
	})
}

type restoreTrashItemRequest struct {
	RenameIfExists    bool   `json:"rename_if_exists"`
	CustomRestorePath string `json:"custom_restore_path"` // 用户指定的恢复路径（可选）
}

// RestoreTrashItem 从索引条目恢复（按 item_id）
// POST /api/v1/sftp/trash/items/:item_id/restore
//
// 冲突处理策略：
// 1. 默认：如果目标路径已存在，返回 409 Conflict 并附带冲突详情和建议路径
// 2. rename_if_exists=true：自动重命名为 {name}.restored-{uuid}
// 3. custom_restore_path：恢复到用户指定的路径
//
// 使用乐观锁防止与清理器的竞态条件
func (h *SFTPHandler) RestoreTrashItem(c *gin.Context) {
	if h.trashItemRepo == nil {
		RespondError(c, http.StatusServiceUnavailable, "trash_not_available", "trash index not available")
		return
	}

	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	itemID, err := uuid.Parse(c.Param("item_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_item_id", "Invalid item ID")
		return
	}

	item, err := h.trashItemRepo.GetByIDForUser(c.Request.Context(), userID, itemID)
	if err != nil {
		RespondError(c, http.StatusNotFound, "not_found", "Trash item not found")
		return
	}

	if item.Status != sftp.TrashItemStatusActive {
		// 如果正在被清理，给出明确提示
		if item.Status == sftp.TrashItemStatusPurging {
			RespondError(c, http.StatusConflict, "item_being_purged", "Trash item is being purged by cleaner, please try again later")
			return
		}
		// 如果正在被恢复（另一个请求），给出明确提示
		if item.Status == sftp.TrashItemStatusRestoring {
			RespondError(c, http.StatusConflict, "item_being_restored", "Trash item is being restored by another operation, please try again later")
			return
		}
		RespondError(c, http.StatusBadRequest, "invalid_status", fmt.Sprintf("Trash item is not active (status: %s)", item.Status))
		return
	}

	var req restoreTrashItemRequest
	_ = c.ShouldBindJSON(&req)

	// 验证自定义恢复路径
	if req.CustomRestorePath != "" {
		if containsDotDotSegment(req.CustomRestorePath) {
			RespondError(c, http.StatusBadRequest, "invalid_restore_path", "restore path must not contain '..'")
			return
		}
	}

	pooled, err := h.pool.Get(c.Request.Context(), userID, item.ServerID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer pooled.Release()

	// 确定恢复路径
	restorePath := item.OriginalPath
	if req.CustomRestorePath != "" {
		restorePath = path.Clean(req.CustomRestorePath)
	}

	// 生成建议的备选路径
	suggestPath := path.Join(item.ParentDir, fmt.Sprintf("%s.restored-%s", item.OriginalName, uuid.NewString()[:8]))

	// 检查目标路径是否存在冲突
	existingFile, err := pooled.GetFileInfo(restorePath)
	if err == nil {
		// 目标路径已存在
		if !req.RenameIfExists && req.CustomRestorePath == "" {
			// 返回详细的冲突信息，帮助用户决策
			RespondErrorWithDetails(c, http.StatusConflict, "restore_conflict", "restore path already exists", gin.H{
				"restore_path":  restorePath,
				"suggest_path":  suggestPath,
				"existing_file": existingFile,
				"options": []string{
					"Set rename_if_exists=true to auto-rename",
					"Set custom_restore_path to specify a different path",
				},
			})
			return
		}
		// 自动重命名
		if req.RenameIfExists && req.CustomRestorePath == "" {
			restorePath = suggestPath
		}
		// 如果 custom_restore_path 指定的路径也存在冲突，报错
		if req.CustomRestorePath != "" {
			RespondErrorWithDetails(c, http.StatusConflict, "restore_conflict", "custom restore path already exists", gin.H{
				"restore_path":  restorePath,
				"suggest_path":  suggestPath,
				"existing_file": existingFile,
			})
			return
		}
	}

	// 阶段1：使用乐观锁标记为 restoring 状态（获取锁）
	affected, err := h.trashItemRepo.TryMarkRestoring(c.Request.Context(), userID, itemID, item.Version)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	if affected == 0 {
		// 版本不匹配或状态已变更（可能正在被清理）
		RespondError(c, http.StatusConflict, "concurrent_modification", "Trash item was modified by another operation (possibly being purged), please refresh and try again")
		return
	}

	// 阶段2：执行物理恢复（重命名）
	if err := pooled.RenameFile(item.TrashPath, restorePath); err != nil {
		// 恢复失败，回滚数据库状态到 active
		if rollbackErr := h.trashItemRepo.RollbackRestoring(c.Request.Context(), userID, itemID); rollbackErr != nil {
			// 记录回滚失败，但仍然返回原始错误
			log.Printf("[SFTP Trash] WARN: rollback restoring failed: itemID=%s, err=%v", itemID, rollbackErr)
		}
		RespondError(c, http.StatusInternalServerError, "restore_failed", err.Error())
		return
	}

	// 阶段3：完成恢复，更新为 restored 状态
	now := time.Now()
	if err := h.trashItemRepo.FinishRestore(c.Request.Context(), userID, itemID, now, restorePath); err != nil {
		// 物理操作已成功，但数据库更新失败，记录警告
		log.Printf("[SFTP Trash] WARN: finish restore db update failed (physical restore succeeded): itemID=%s, restorePath=%s, err=%v", itemID, restorePath, err)
	}

	info, _ := pooled.GetFileInfo(restorePath)
	RespondSuccess(c, gin.H{
		"success":       true,
		"item_id":       itemID,
		"restore_path":  restorePath,
		"original_path": item.OriginalPath,
		"file":          info,
	})
}

// PurgeTrashItem 永久删除索引条目对应的回收站文件（按 item_id）
// DELETE /api/v1/sftp/trash/items/:item_id
//
// 使用乐观锁防止与清理器的竞态条件
func (h *SFTPHandler) PurgeTrashItem(c *gin.Context) {
	if h.trashItemRepo == nil {
		RespondError(c, http.StatusServiceUnavailable, "trash_not_available", "trash index not available")
		return
	}

	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	itemID, err := uuid.Parse(c.Param("item_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_item_id", "Invalid item ID")
		return
	}

	item, err := h.trashItemRepo.GetByIDForUser(c.Request.Context(), userID, itemID)
	if err != nil {
		RespondError(c, http.StatusNotFound, "not_found", "Trash item not found")
		return
	}

	if item.Status != sftp.TrashItemStatusActive {
		// 如果正在被清理，给出明确提示
		if item.Status == sftp.TrashItemStatusPurging {
			RespondError(c, http.StatusConflict, "item_being_purged", "Trash item is being purged by cleaner, please try again later")
			return
		}
		// 如果正在被恢复，给出明确提示
		if item.Status == sftp.TrashItemStatusRestoring {
			RespondError(c, http.StatusConflict, "item_being_restored", "Trash item is being restored by another operation")
			return
		}
		RespondError(c, http.StatusBadRequest, "invalid_status", fmt.Sprintf("Trash item is not active (status: %s)", item.Status))
		return
	}

	pooled, err := h.pool.Get(c.Request.Context(), userID, item.ServerID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer pooled.Release()

	// 检查文件是否存在
	fi, err := pooled.GetFileInfo(item.TrashPath)
	if err != nil {
		now := time.Now()
		if markErr := h.trashItemRepo.MarkPurgedByTrashPath(c.Request.Context(), userID, item.ServerID, item.TrashPath, now, sftp.TrashItemStatusMissing); markErr != nil {
			log.Printf("[SFTP Trash] WARN: mark missing failed: itemID=%s, err=%v", itemID, markErr)
		}
		RespondSuccess(c, gin.H{"success": true, "status": "missing"})
		return
	}

	// 阶段1：使用乐观锁标记为 purging 状态（获取锁）
	affected, err := h.trashItemRepo.TryMarkPurging(c.Request.Context(), userID, item.ServerID, item.TrashPath, item.Version)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	if affected == 0 {
		// 版本不匹配或状态已变更（可能正在被清理器处理或被恢复）
		RespondError(c, http.StatusConflict, "concurrent_modification", "Trash item was modified by another operation, please refresh and try again")
		return
	}

	// 阶段2：执行物理删除
	var purgeErr error
	if fi.IsDir {
		purgeErr = pooled.RemoveAll(item.TrashPath)
	} else {
		purgeErr = pooled.RemoveFile(item.TrashPath)
	}

	// 阶段3：根据删除结果更新索引状态
	if purgeErr != nil {
		// 删除失败，回滚状态到 active
		if rollbackErr := h.trashItemRepo.RollbackPurging(c.Request.Context(), userID, item.ServerID, item.TrashPath); rollbackErr != nil {
			log.Printf("[SFTP Trash] WARN: rollback purging failed: itemID=%s, err=%v", itemID, rollbackErr)
		}
		RespondError(c, http.StatusInternalServerError, "purge_failed", purgeErr.Error())
		return
	}

	// 删除成功，完成清理
	now := time.Now()
	if err := h.trashItemRepo.FinishPurge(c.Request.Context(), userID, item.ServerID, item.TrashPath, now); err != nil {
		// 物理操作已成功，但数据库更新失败，记录警告
		log.Printf("[SFTP Trash] WARN: finish purge db update failed (physical purge succeeded): itemID=%s, trashPath=%s, err=%v", itemID, item.TrashPath, err)
	}
	RespondSuccess(c, gin.H{"success": true})
}

// BatchRestoreTrashItems 批量恢复回收站项目
// POST /api/v1/sftp/trash/items/batch-restore
func (h *SFTPHandler) BatchRestoreTrashItems(c *gin.Context) {
	if h.trashItemRepo == nil {
		RespondError(c, http.StatusServiceUnavailable, "trash_not_available", "trash index not available")
		return
	}

	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	var req struct {
		ItemIDs        []string `json:"item_ids" binding:"required"`
		RenameIfExists bool     `json:"rename_if_exists"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	if len(req.ItemIDs) == 0 {
		RespondError(c, http.StatusBadRequest, "no_items", "No items to restore")
		return
	}
	if len(req.ItemIDs) > 100 {
		RespondError(c, http.StatusBadRequest, "too_many_items", "Maximum 100 items per batch")
		return
	}

	// 解析 UUID
	ids := make([]uuid.UUID, 0, len(req.ItemIDs))
	for _, idStr := range req.ItemIDs {
		id, err := uuid.Parse(idStr)
		if err != nil {
			continue // 跳过无效的 ID
		}
		ids = append(ids, id)
	}

	// 批量获取项目
	items, err := h.trashItemRepo.GetByIDs(c.Request.Context(), userID, ids)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	results := make([]sftp.BatchOperationResult, 0, len(items))
	successCount := 0

	for _, item := range items {
		select {
		case <-c.Request.Context().Done():
			RespondError(c, http.StatusRequestTimeout, "cancelled", "request cancelled")
			return
		default:
		}

		result := sftp.BatchOperationResult{ItemID: item.ID.String()}

		// 检查状态
		if item.Status != sftp.TrashItemStatusActive {
			result.Success = false
			result.Error = fmt.Sprintf("invalid status: %s", item.Status)
			results = append(results, result)
			continue
		}

		// 获取连接
		pooled, err := h.pool.Get(c.Request.Context(), userID, item.ServerID)
		if err != nil {
			result.Success = false
			result.Error = err.Error()
			results = append(results, result)
			continue
		}

		// 确定恢复路径
		restorePath := item.OriginalPath
		if req.RenameIfExists {
			// 检查是否存在冲突
			if _, err := pooled.GetFileInfo(restorePath); err == nil {
				// 存在冲突，使用备选名称
				restorePath = path.Join(item.ParentDir, fmt.Sprintf("%s.restored-%s", item.OriginalName, uuid.NewString()[:8]))
			}
		}

		// 尝试获取锁
		affected, lockErr := h.trashItemRepo.TryMarkRestoring(c.Request.Context(), userID, item.ID, item.Version)
		if lockErr != nil || affected == 0 {
			pooled.Release()
			result.Success = false
			result.Error = "concurrent modification"
			results = append(results, result)
			continue
		}

		// 执行恢复
		if err := pooled.RenameFile(item.TrashPath, restorePath); err != nil {
			_ = h.trashItemRepo.RollbackRestoring(c.Request.Context(), userID, item.ID)
			pooled.Release()
			result.Success = false
			result.Error = err.Error()
			results = append(results, result)
			continue
		}

		// 完成恢复
		now := time.Now()
		_ = h.trashItemRepo.FinishRestore(c.Request.Context(), userID, item.ID, now, restorePath)
		pooled.Release()

		result.Success = true
		results = append(results, result)
		successCount++
	}

	RespondSuccess(c, gin.H{
		"success":       true,
		"total":         len(items),
		"success_count": successCount,
		"failed_count":  len(items) - successCount,
		"results":       results,
	})
}

// BatchPurgeTrashItems 批量永久删除回收站项目
// POST /api/v1/sftp/trash/items/batch-purge
func (h *SFTPHandler) BatchPurgeTrashItems(c *gin.Context) {
	if h.trashItemRepo == nil {
		RespondError(c, http.StatusServiceUnavailable, "trash_not_available", "trash index not available")
		return
	}

	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	var req struct {
		ItemIDs []string `json:"item_ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	if len(req.ItemIDs) == 0 {
		RespondError(c, http.StatusBadRequest, "no_items", "No items to purge")
		return
	}
	if len(req.ItemIDs) > 100 {
		RespondError(c, http.StatusBadRequest, "too_many_items", "Maximum 100 items per batch")
		return
	}

	// 解析 UUID
	ids := make([]uuid.UUID, 0, len(req.ItemIDs))
	for _, idStr := range req.ItemIDs {
		id, err := uuid.Parse(idStr)
		if err != nil {
			continue
		}
		ids = append(ids, id)
	}

	// 批量获取项目
	items, err := h.trashItemRepo.GetByIDs(c.Request.Context(), userID, ids)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	results := make([]sftp.BatchOperationResult, 0, len(items))
	successCount := 0

	for _, item := range items {
		select {
		case <-c.Request.Context().Done():
			RespondError(c, http.StatusRequestTimeout, "cancelled", "request cancelled")
			return
		default:
		}

		result := sftp.BatchOperationResult{ItemID: item.ID.String()}

		// 检查状态
		if item.Status != sftp.TrashItemStatusActive {
			result.Success = false
			result.Error = fmt.Sprintf("invalid status: %s", item.Status)
			results = append(results, result)
			continue
		}

		// 获取连接
		pooled, err := h.pool.Get(c.Request.Context(), userID, item.ServerID)
		if err != nil {
			result.Success = false
			result.Error = err.Error()
			results = append(results, result)
			continue
		}

		// 检查文件是否存在
		fi, statErr := pooled.GetFileInfo(item.TrashPath)
		if statErr != nil {
			// 文件不存在，标记为 missing
			now := time.Now()
			_ = h.trashItemRepo.MarkPurgedByTrashPath(c.Request.Context(), userID, item.ServerID, item.TrashPath, now, sftp.TrashItemStatusMissing)
			pooled.Release()
			result.Success = true
			results = append(results, result)
			successCount++
			continue
		}

		// 尝试获取锁
		affected, lockErr := h.trashItemRepo.TryMarkPurging(c.Request.Context(), userID, item.ServerID, item.TrashPath, item.Version)
		if lockErr != nil || affected == 0 {
			pooled.Release()
			result.Success = false
			result.Error = "concurrent modification"
			results = append(results, result)
			continue
		}

		// 执行删除
		var purgeErr error
		if fi.IsDir {
			purgeErr = pooled.RemoveAll(item.TrashPath)
		} else {
			purgeErr = pooled.RemoveFile(item.TrashPath)
		}

		if purgeErr != nil {
			_ = h.trashItemRepo.RollbackPurging(c.Request.Context(), userID, item.ServerID, item.TrashPath)
			pooled.Release()
			result.Success = false
			result.Error = purgeErr.Error()
			results = append(results, result)
			continue
		}

		// 完成清理
		now := time.Now()
		_ = h.trashItemRepo.FinishPurge(c.Request.Context(), userID, item.ServerID, item.TrashPath, now)
		pooled.Release()

		result.Success = true
		results = append(results, result)
		successCount++
	}

	RespondSuccess(c, gin.H{
		"success":       true,
		"total":         len(items),
		"success_count": successCount,
		"failed_count":  len(items) - successCount,
		"results":       results,
	})
}

type emptyTrashItemsRequest struct {
	ServerID       string `json:"server_id"`
	ParentDir      string `json:"parent_dir"`
	OlderThanHours int    `json:"older_than_hours"`
	MaxDeletes     int    `json:"max_deletes"`
}

// EmptyTrashItems 按索引批量清空（默认仅 active）
// POST /api/v1/sftp/trash/items/empty
//
// 使用乐观锁防止与清理器的竞态条件
func (h *SFTPHandler) EmptyTrashItems(c *gin.Context) {
	if h.trashItemRepo == nil {
		RespondError(c, http.StatusServiceUnavailable, "trash_not_available", "trash index not available")
		return
	}

	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	var req emptyTrashItemsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	maxDeletes := req.MaxDeletes
	if maxDeletes <= 0 {
		maxDeletes = 500
	}

	var filters sftp.TrashItemFilters
	status := sftp.TrashItemStatusActive
	filters.Status = &status

	if req.ServerID != "" {
		if sid, err := uuid.Parse(req.ServerID); err == nil {
			filters.ServerID = &sid
		}
	}
	if req.ParentDir != "" {
		parent := path.Clean(req.ParentDir)
		filters.ParentDir = &parent
	}
	if req.OlderThanHours > 0 {
		cutoff := time.Now().Add(-time.Duration(req.OlderThanHours) * time.Hour)
		filters.DeletedBefore = &cutoff
	}

	items, _, err := h.trashItemRepo.List(c.Request.Context(), userID, filters, maxDeletes, 0)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "trash_list_failed", err.Error())
		return
	}

	deleted := 0
	skipped := 0
	var failed []map[string]string
	for _, item := range items {
		select {
		case <-c.Request.Context().Done():
			RespondError(c, http.StatusRequestTimeout, "cancelled", "request cancelled")
			return
		default:
		}

		pooled, err := h.pool.Get(c.Request.Context(), userID, item.ServerID)
		if err != nil {
			failed = append(failed, map[string]string{"item_id": item.ID.String(), "error": err.Error()})
			continue
		}

		// 检查文件是否存在
		fi, statErr := pooled.GetFileInfo(item.TrashPath)
		if statErr != nil {
			now := time.Now()
			if markErr := h.trashItemRepo.MarkPurgedByTrashPath(c.Request.Context(), userID, item.ServerID, item.TrashPath, now, sftp.TrashItemStatusMissing); markErr != nil {
				log.Printf("[SFTP Trash] WARN: mark missing failed in batch: itemID=%s, err=%v", item.ID, markErr)
			}
			pooled.Release()
			deleted++
			continue
		}

		// 阶段1：使用乐观锁标记为 purging 状态（获取锁）
		affected, lockErr := h.trashItemRepo.TryMarkPurging(c.Request.Context(), userID, item.ServerID, item.TrashPath, item.Version)
		if lockErr != nil {
			pooled.Release()
			failed = append(failed, map[string]string{"item_id": item.ID.String(), "error": lockErr.Error()})
			continue
		}
		if affected == 0 {
			// 版本不匹配或状态已变更，跳过此项
			pooled.Release()
			skipped++
			continue
		}

		// 阶段2：执行物理删除
		var purgeErr error
		if fi.IsDir {
			purgeErr = pooled.RemoveAll(item.TrashPath)
		} else {
			purgeErr = pooled.RemoveFile(item.TrashPath)
		}
		pooled.Release()

		// 阶段3：根据删除结果更新索引状态
		if purgeErr != nil {
			// 删除失败，回滚状态到 active
			if rollbackErr := h.trashItemRepo.RollbackPurging(c.Request.Context(), userID, item.ServerID, item.TrashPath); rollbackErr != nil {
				log.Printf("[SFTP Trash] WARN: rollback purging failed in batch: itemID=%s, err=%v", item.ID, rollbackErr)
			}
			failed = append(failed, map[string]string{"item_id": item.ID.String(), "error": purgeErr.Error()})
			continue
		}

		// 删除成功，完成清理
		now := time.Now()
		if err := h.trashItemRepo.FinishPurge(c.Request.Context(), userID, item.ServerID, item.TrashPath, now); err != nil {
			log.Printf("[SFTP Trash] WARN: finish purge db update failed in batch: itemID=%s, err=%v", item.ID, err)
		}
		deleted++
	}

	RespondSuccess(c, gin.H{
		"success": true,
		"deleted": deleted,
		"skipped": skipped,
		"failed":  failed,
	})
}

func isTrashEntryPath(p string) bool {
	p = path.Clean(p)
	if strings.HasSuffix(p, "/.trash") || p == ".trash" {
		return false
	}
	// 只允许操作 .trash 下的直接或间接子路径（SFTP 统一使用 /）
	return strings.Contains(p, "/.trash/")
}

func containsDotDotSegment(p string) bool {
	p = filepath.ToSlash(p)
	for _, part := range strings.Split(p, "/") {
		if part == ".." {
			return true
		}
	}
	return false
}

func isSFTPNoSuchFile(err error) bool {
	var se *sftpPkg.StatusError
	if errors.As(err, &se) {
		return se.FxCode() == sftpPkg.ErrSSHFxNoSuchFile
	}
	return false
}

func isValidTrashItemStatus(v string) bool {
	switch v {
	case string(sftp.TrashItemStatusActive),
		string(sftp.TrashItemStatusRestored),
		string(sftp.TrashItemStatusPurged),
		string(sftp.TrashItemStatusMissing),
		string(sftp.TrashItemStatusPurging),
		string(sftp.TrashItemStatusRestoring):
		return true
	default:
		return false
	}
}

// parseOriginalNameFromTrashName 将 MoveToTrash 生成的 name 解析回原始文件名
// 当前命名格式：<base>-<YYYYMMDD>-<HHMMSS>-<uuid8>
func parseOriginalNameFromTrashName(trashName string) (string, bool) {
	parts := strings.Split(trashName, "-")
	if len(parts) < 4 {
		return trashName, false
	}
	// 从尾部提取 uuid8 / HHMMSS / YYYYMMDD
	uuidPart := parts[len(parts)-1]
	timePart := parts[len(parts)-2]
	datePart := parts[len(parts)-3]
	if len(uuidPart) != 8 || len(timePart) != 6 || len(datePart) != 8 {
		return trashName, false
	}
	if !isAllDigits(datePart) || !isAllDigits(timePart) || !isHexLower(uuidPart) {
		return trashName, false
	}
	base := strings.Join(parts[:len(parts)-3], "-")
	if base == "" {
		base = trashName
		return base, false
	}
	return base, true
}

func isAllDigits(s string) bool {
	if s == "" {
		return false
	}
	for i := 0; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	return true
}

func isHexLower(s string) bool {
	if s == "" {
		return false
	}
	for i := 0; i < len(s); i++ {
		b := s[i]
		if (b >= '0' && b <= '9') || (b >= 'a' && b <= 'f') {
			continue
		}
		return false
	}
	return true
}

// ============= 回收站设置 API =============

// GetTrashSettings 获取用户回收站设置
// GET /api/v1/sftp/trash/settings
func (h *SFTPHandler) GetTrashSettings(c *gin.Context) {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "Invalid user")
		return
	}

	if h.trashSettingsRepo == nil {
		// 返回默认值
		RespondSuccess(c, gin.H{
			"retention_hours":      24,
			"max_entries_per_dir":  5000,
			"max_bytes_per_dir_mb": 2048,
			"auto_clean_enabled":   true,
			"is_default":           true,
		})
		return
	}

	settings, err := h.trashSettingsRepo.GetByUserID(c.Request.Context(), userID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	if settings == nil {
		// 未配置，返回系统默认值
		RespondSuccess(c, gin.H{
			"retention_hours":      24,
			"max_entries_per_dir":  5000,
			"max_bytes_per_dir_mb": 2048,
			"auto_clean_enabled":   true,
			"is_default":           true,
		})
		return
	}

	autoClean := settings.AutoCleanEnabled

	RespondSuccess(c, gin.H{
		"id":                   settings.ID,
		"retention_hours":      settings.RetentionHours,
		"max_entries_per_dir":  settings.MaxEntriesPerDir,
		"max_bytes_per_dir_mb": settings.MaxBytesPerDirMB,
		"auto_clean_enabled":   autoClean,
		"is_default":           false,
	})
}

// UpdateTrashSettings 更新用户回收站设置
// PUT /api/v1/sftp/trash/settings
func (h *SFTPHandler) UpdateTrashSettings(c *gin.Context) {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "Invalid user")
		return
	}

	if h.trashSettingsRepo == nil {
		RespondError(c, http.StatusServiceUnavailable, "not_available", "Trash settings not available")
		return
	}

	var req struct {
		RetentionHours   int  `json:"retention_hours"`
		MaxEntriesPerDir int  `json:"max_entries_per_dir"`
		MaxBytesPerDirMB int  `json:"max_bytes_per_dir_mb"`
		AutoCleanEnabled bool `json:"auto_clean_enabled"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}

	// 校验参数范围
	if req.RetentionHours < 0 || req.RetentionHours > 8760 { // 最多 1 年
		RespondError(c, http.StatusBadRequest, "invalid_retention", "Retention hours must be between 0 and 8760")
		return
	}
	if req.MaxEntriesPerDir < 0 || req.MaxEntriesPerDir > 100000 {
		RespondError(c, http.StatusBadRequest, "invalid_max_entries", "Max entries per dir must be between 0 and 100000")
		return
	}
	if req.MaxBytesPerDirMB < 0 || req.MaxBytesPerDirMB > 102400 { // 最多 100GB
		RespondError(c, http.StatusBadRequest, "invalid_max_bytes", "Max bytes per dir must be between 0 and 102400 MB")
		return
	}

	settings := sftp.TrashSettings{
		UserID:           userID,
		RetentionHours:   req.RetentionHours,
		MaxEntriesPerDir: req.MaxEntriesPerDir,
		MaxBytesPerDirMB: req.MaxBytesPerDirMB,
		AutoCleanEnabled: req.AutoCleanEnabled,
	}

	if err := h.trashSettingsRepo.Upsert(c.Request.Context(), settings); err != nil {
		RespondError(c, http.StatusInternalServerError, "save_failed", err.Error())
		return
	}

	RespondSuccess(c, gin.H{
		"message": "Settings saved successfully",
	})
}

// ResetTrashSettings 重置用户回收站设置为默认值
// DELETE /api/v1/sftp/trash/settings
func (h *SFTPHandler) ResetTrashSettings(c *gin.Context) {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "Invalid user")
		return
	}

	if h.trashSettingsRepo == nil {
		RespondSuccess(c, gin.H{"message": "Settings reset to default"})
		return
	}

	// 重置为系统默认值（设置所有字段为 0，表示使用默认值）
	settings := sftp.TrashSettings{
		UserID:           userID,
		RetentionHours:   0,
		MaxEntriesPerDir: 0,
		MaxBytesPerDirMB: 0,
		AutoCleanEnabled: true,
	}

	if err := h.trashSettingsRepo.Upsert(c.Request.Context(), settings); err != nil {
		RespondError(c, http.StatusInternalServerError, "reset_failed", err.Error())
		return
	}

	RespondSuccess(c, gin.H{
		"message":              "Settings reset to default",
		"retention_hours":      24,
		"max_entries_per_dir":  5000,
		"max_bytes_per_dir_mb": 2048,
		"auto_clean_enabled":   true,
		"is_default":           true,
	})
}
