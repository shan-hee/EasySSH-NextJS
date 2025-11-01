package rest

import (
	"net/http"

	"github.com/easyssh/server/internal/domain/filetransfer"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// FileTransferHandler 文件传输处理器
type FileTransferHandler struct {
	fileTransferService filetransfer.Service
}

// NewFileTransferHandler 创建文件传输处理器实例
func NewFileTransferHandler(fileTransferService filetransfer.Service) *FileTransferHandler {
	return &FileTransferHandler{
		fileTransferService: fileTransferService,
	}
}

// List 获取文件传输列表
// GET /api/v1/file-transfers
func (h *FileTransferHandler) List(c *gin.Context) {
	var req filetransfer.ListFileTransfersRequest

	// 解析查询参数
	if err := c.ShouldBindQuery(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "user_id not found")
		return
	}

	uid, err := uuid.Parse(userID.(string))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_user_id", err.Error())
		return
	}

	response, err := h.fileTransferService.ListFileTransfers(uid, &req)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "list_failed", err.Error())
		return
	}

	RespondSuccess(c, response)
}

// GetByID 获取文件传输详情
// GET /api/v1/file-transfers/:id
func (h *FileTransferHandler) GetByID(c *gin.Context) {
	idParam := c.Param("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_id", "Invalid file transfer ID format")
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "user_id not found")
		return
	}

	uid, err := uuid.Parse(userID.(string))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_user_id", err.Error())
		return
	}

	transfer, err := h.fileTransferService.GetFileTransfer(uid, id)
	if err != nil {
		if err == filetransfer.ErrFileTransferNotFound {
			RespondError(c, http.StatusNotFound, "not_found", "File transfer not found")
			return
		}
		if err == filetransfer.ErrUnauthorized {
			RespondError(c, http.StatusForbidden, "forbidden", "Access denied")
			return
		}
		RespondError(c, http.StatusInternalServerError, "get_failed", err.Error())
		return
	}

	RespondSuccess(c, transfer)
}

// Delete 删除文件传输记录
// DELETE /api/v1/file-transfers/:id
func (h *FileTransferHandler) Delete(c *gin.Context) {
	idParam := c.Param("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_id", "Invalid file transfer ID format")
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "user_id not found")
		return
	}

	uid, err := uuid.Parse(userID.(string))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_user_id", err.Error())
		return
	}

	err = h.fileTransferService.DeleteFileTransfer(uid, id)
	if err != nil {
		if err == filetransfer.ErrFileTransferNotFound {
			RespondError(c, http.StatusNotFound, "not_found", "File transfer not found")
			return
		}
		if err == filetransfer.ErrUnauthorized {
			RespondError(c, http.StatusForbidden, "forbidden", "Access denied")
			return
		}
		RespondError(c, http.StatusInternalServerError, "delete_failed", err.Error())
		return
	}

	RespondSuccess(c, gin.H{"message": "File transfer deleted successfully"})
}

// GetStatistics 获取文件传输统计信息
// GET /api/v1/file-transfers/stats
func (h *FileTransferHandler) GetStatistics(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "user_id not found")
		return
	}

	uid, err := uuid.Parse(userID.(string))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_user_id", err.Error())
		return
	}

	stats, err := h.fileTransferService.GetStatistics(uid)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "stats_failed", err.Error())
		return
	}

	RespondSuccess(c, stats)
}

// Create 创建文件传输记录
// POST /api/v1/file-transfers
func (h *FileTransferHandler) Create(c *gin.Context) {
	var req filetransfer.CreateFileTransferRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "user_id not found")
		return
	}

	uid, err := uuid.Parse(userID.(string))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_user_id", err.Error())
		return
	}

	// 设置用户ID
	req.UserID = uid

	transfer, err := h.fileTransferService.CreateFileTransfer(&req)
	if err != nil {
		if err == filetransfer.ErrInvalidFileTransferData {
			RespondError(c, http.StatusBadRequest, "invalid_data", err.Error())
			return
		}
		RespondError(c, http.StatusInternalServerError, "create_failed", err.Error())
		return
	}

	RespondSuccess(c, transfer)
}

// Update 更新文件传输记录
// PUT /api/v1/file-transfers/:id
func (h *FileTransferHandler) Update(c *gin.Context) {
	idParam := c.Param("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_id", "Invalid file transfer ID format")
		return
	}

	var req filetransfer.UpdateFileTransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "user_id not found")
		return
	}

	uid, err := uuid.Parse(userID.(string))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_user_id", err.Error())
		return
	}

	transfer, err := h.fileTransferService.UpdateFileTransfer(uid, id, &req)
	if err != nil {
		if err == filetransfer.ErrFileTransferNotFound {
			RespondError(c, http.StatusNotFound, "not_found", "File transfer not found")
			return
		}
		if err == filetransfer.ErrUnauthorized {
			RespondError(c, http.StatusForbidden, "forbidden", "Access denied")
			return
		}
		RespondError(c, http.StatusInternalServerError, "update_failed", err.Error())
		return
	}

	RespondSuccess(c, transfer)
}
