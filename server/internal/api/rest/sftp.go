package rest

import (
	"fmt"
	"io"
	"net/http"
	"path/filepath"

	"github.com/easyssh/server/internal/domain/server"
	"github.com/easyssh/server/internal/domain/sftp"
	sshDomain "github.com/easyssh/server/internal/domain/ssh"
	"github.com/easyssh/server/internal/pkg/crypto"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// SFTPHandler SFTP 处理器
type SFTPHandler struct {
	serverService server.Service
	encryptor     *crypto.Encryptor
}

// NewSFTPHandler 创建 SFTP 处理器
func NewSFTPHandler(serverService server.Service, encryptor *crypto.Encryptor) *SFTPHandler {
	return &SFTPHandler{
		serverService: serverService,
		encryptor:     encryptor,
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

	// 创建 SSH 客户端
	sshClient, err := sshDomain.NewClient(srv, h.encryptor)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create SSH client: %w", err)
	}

	// 连接到服务器
	if err := sshClient.Connect(srv.Host, srv.Port); err != nil {
		return nil, nil, fmt.Errorf("failed to connect: %w", err)
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
// POST /api/v1/sftp/:server_id/upload
func (h *SFTPHandler) UploadFile(c *gin.Context) {
	// 解析服务器 ID
	serverID, err := uuid.Parse(c.Param("server_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_server_id", "Invalid server ID")
		return
	}

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

	// 上传文件
	if err := sftpClient.UploadFile(file, remotePath); err != nil {
		RespondError(c, http.StatusInternalServerError, "upload_failed", err.Error())
		return
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

	// 创建 SFTP 客户端
	sftpClient, _, err := h.createSFTPClient(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "sftp_error", err.Error())
		return
	}
	defer sftpClient.Close()

	// 获取文件信息以判断类型
	fileInfo, err := sftpClient.GetFileInfo(req.Path)
	if err != nil {
		RespondError(c, http.StatusNotFound, "file_not_found", err.Error())
		return
	}

	// 删除文件或目录
	if fileInfo.IsDir {
		err = sftpClient.DeleteDirectory(req.Path)
	} else {
		err = sftpClient.DeleteFile(req.Path)
	}

	if err != nil {
		RespondError(c, http.StatusInternalServerError, "delete_failed", err.Error())
		return
	}

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

// Move 移动文件或目录
// POST /api/v1/sftp/:server_id/move
func (h *SFTPHandler) Move(c *gin.Context) {
	// 移动操作与重命名类似
	h.Rename(c)
}

// Copy 复制文件
// POST /api/v1/sftp/:server_id/copy
func (h *SFTPHandler) Copy(c *gin.Context) {
	// 解析服务器 ID
	serverID, err := uuid.Parse(c.Param("server_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_server_id", "Invalid server ID")
		return
	}

	// 解析请求
	var req struct {
		SrcPath string `json:"src_path" binding:"required"`
		DstPath string `json:"dst_path" binding:"required"`
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

	// 复制文件
	if err := sftpClient.CopyFile(req.SrcPath, req.DstPath); err != nil {
		RespondError(c, http.StatusInternalServerError, "copy_failed", err.Error())
		return
	}

	RespondSuccess(c, gin.H{
		"src_path": req.SrcPath,
		"dst_path": req.DstPath,
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

	// 读取请求体
	content, err := io.ReadAll(c.Request.Body)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_content", "Failed to read content")
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

	// 写入文件
	if err := sftpClient.WriteFile(path, content, 0644); err != nil {
		RespondError(c, http.StatusInternalServerError, "write_failed", err.Error())
		return
	}

	RespondSuccessWithMessage(c, gin.H{"path": path}, "File written successfully")
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
