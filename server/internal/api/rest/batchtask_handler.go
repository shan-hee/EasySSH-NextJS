package rest

import (
	"net/http"

	"github.com/easyssh/server/internal/domain/batchtask"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// BatchTaskHandler 批量任务处理器
type BatchTaskHandler struct {
	batchTaskService batchtask.Service
}

// NewBatchTaskHandler 创建批量任务处理器实例
func NewBatchTaskHandler(batchTaskService batchtask.Service) *BatchTaskHandler {
	return &BatchTaskHandler{
		batchTaskService: batchTaskService,
	}
}

// Create 创建批量任务
func (h *BatchTaskHandler) Create(c *gin.Context) {
	var req batchtask.CreateBatchTaskRequest
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

	task, err := h.batchTaskService.CreateBatchTask(uid, &req)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "create_failed", err.Error())
		return
	}

	RespondSuccess(c, task)
}

// List 获取批量任务列表
func (h *BatchTaskHandler) List(c *gin.Context) {
	var req batchtask.ListBatchTasksRequest

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

	response, err := h.batchTaskService.ListBatchTasks(uid, &req)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "list_failed", err.Error())
		return
	}

	RespondSuccess(c, response)
}

// GetByID 获取批量任务详情
func (h *BatchTaskHandler) GetByID(c *gin.Context) {
	idParam := c.Param("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_id", "Invalid task ID format")
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

	task, err := h.batchTaskService.GetBatchTask(uid, id)
	if err != nil {
		if err == batchtask.ErrBatchTaskNotFound {
			RespondError(c, http.StatusNotFound, "not_found", "Batch task not found")
			return
		}
		if err == batchtask.ErrUnauthorized {
			RespondError(c, http.StatusForbidden, "forbidden", "Access denied")
			return
		}
		RespondError(c, http.StatusInternalServerError, "get_failed", err.Error())
		return
	}

	RespondSuccess(c, task)
}

// Update 更新批量任务
func (h *BatchTaskHandler) Update(c *gin.Context) {
	idParam := c.Param("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_id", "Invalid task ID format")
		return
	}

	var req batchtask.UpdateBatchTaskRequest
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

	task, err := h.batchTaskService.UpdateBatchTask(uid, id, &req)
	if err != nil {
		if err == batchtask.ErrBatchTaskNotFound {
			RespondError(c, http.StatusNotFound, "not_found", "Batch task not found")
			return
		}
		if err == batchtask.ErrUnauthorized {
			RespondError(c, http.StatusForbidden, "forbidden", "Access denied")
			return
		}
		RespondError(c, http.StatusInternalServerError, "update_failed", err.Error())
		return
	}

	RespondSuccess(c, task)
}

// Delete 删除批量任务
func (h *BatchTaskHandler) Delete(c *gin.Context) {
	idParam := c.Param("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_id", "Invalid task ID format")
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

	if err := h.batchTaskService.DeleteBatchTask(uid, id); err != nil {
		if err == batchtask.ErrBatchTaskNotFound {
			RespondError(c, http.StatusNotFound, "not_found", "Batch task not found")
			return
		}
		if err == batchtask.ErrUnauthorized {
			RespondError(c, http.StatusForbidden, "forbidden", "Access denied")
			return
		}
		RespondError(c, http.StatusInternalServerError, "delete_failed", err.Error())
		return
	}

	RespondSuccess(c, gin.H{"message": "Batch task deleted successfully"})
}

// GetStatistics 获取批量任务统计信息
func (h *BatchTaskHandler) GetStatistics(c *gin.Context) {
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

	stats, err := h.batchTaskService.GetStatistics(uid)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "get_statistics_failed", err.Error())
		return
	}

	RespondSuccess(c, stats)
}

// Start 启动批量任务
func (h *BatchTaskHandler) Start(c *gin.Context) {
	idParam := c.Param("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_id", "Invalid task ID format")
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

	if err := h.batchTaskService.StartBatchTask(uid, id); err != nil {
		if err == batchtask.ErrBatchTaskNotFound {
			RespondError(c, http.StatusNotFound, "not_found", "Batch task not found")
			return
		}
		if err == batchtask.ErrUnauthorized {
			RespondError(c, http.StatusForbidden, "forbidden", "Access denied")
			return
		}
		RespondError(c, http.StatusInternalServerError, "start_failed", err.Error())
		return
	}

	RespondSuccess(c, gin.H{"message": "Batch task started successfully"})
}
