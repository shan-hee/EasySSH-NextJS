package rest

import (
	"net/http"

	"github.com/easyssh/server/internal/domain/scheduledtask"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ScheduledTaskHandler 定时任务处理器
type ScheduledTaskHandler struct {
	scheduledTaskService scheduledtask.Service
}

// NewScheduledTaskHandler 创建定时任务处理器实例
func NewScheduledTaskHandler(scheduledTaskService scheduledtask.Service) *ScheduledTaskHandler {
	return &ScheduledTaskHandler{
		scheduledTaskService: scheduledTaskService,
	}
}

// Create 创建定时任务
func (h *ScheduledTaskHandler) Create(c *gin.Context) {
	var req scheduledtask.CreateScheduledTaskRequest
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

	task, err := h.scheduledTaskService.CreateScheduledTask(uid, &req)
	if err != nil {
		if err == scheduledtask.ErrInvalidCronExpression {
			RespondError(c, http.StatusBadRequest, "invalid_cron_expression", err.Error())
			return
		}
		RespondError(c, http.StatusInternalServerError, "create_failed", err.Error())
		return
	}

	RespondSuccess(c, task)
}

// List 获取定时任务列表
func (h *ScheduledTaskHandler) List(c *gin.Context) {
	var req scheduledtask.ListScheduledTasksRequest

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

	response, err := h.scheduledTaskService.ListScheduledTasks(uid, &req)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "list_failed", err.Error())
		return
	}

	RespondSuccess(c, response)
}

// GetByID 获取定时任务详情
func (h *ScheduledTaskHandler) GetByID(c *gin.Context) {
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

	task, err := h.scheduledTaskService.GetScheduledTask(uid, id)
	if err != nil {
		if err == scheduledtask.ErrScheduledTaskNotFound {
			RespondError(c, http.StatusNotFound, "not_found", "Scheduled task not found")
			return
		}
		if err == scheduledtask.ErrUnauthorized {
			RespondError(c, http.StatusForbidden, "forbidden", "Access denied")
			return
		}
		RespondError(c, http.StatusInternalServerError, "get_failed", err.Error())
		return
	}

	RespondSuccess(c, task)
}

// Update 更新定时任务
func (h *ScheduledTaskHandler) Update(c *gin.Context) {
	idParam := c.Param("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_id", "Invalid task ID format")
		return
	}

	var req scheduledtask.UpdateScheduledTaskRequest
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

	task, err := h.scheduledTaskService.UpdateScheduledTask(uid, id, &req)
	if err != nil {
		if err == scheduledtask.ErrScheduledTaskNotFound {
			RespondError(c, http.StatusNotFound, "not_found", "Scheduled task not found")
			return
		}
		if err == scheduledtask.ErrUnauthorized {
			RespondError(c, http.StatusForbidden, "forbidden", "Access denied")
			return
		}
		if err == scheduledtask.ErrInvalidCronExpression {
			RespondError(c, http.StatusBadRequest, "invalid_cron_expression", err.Error())
			return
		}
		RespondError(c, http.StatusInternalServerError, "update_failed", err.Error())
		return
	}

	RespondSuccess(c, task)
}

// Delete 删除定时任务
func (h *ScheduledTaskHandler) Delete(c *gin.Context) {
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

	if err := h.scheduledTaskService.DeleteScheduledTask(uid, id); err != nil {
		if err == scheduledtask.ErrScheduledTaskNotFound {
			RespondError(c, http.StatusNotFound, "not_found", "Scheduled task not found")
			return
		}
		if err == scheduledtask.ErrUnauthorized {
			RespondError(c, http.StatusForbidden, "forbidden", "Access denied")
			return
		}
		RespondError(c, http.StatusInternalServerError, "delete_failed", err.Error())
		return
	}

	RespondSuccess(c, gin.H{"message": "Scheduled task deleted successfully"})
}

// GetStatistics 获取定时任务统计信息
func (h *ScheduledTaskHandler) GetStatistics(c *gin.Context) {
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

	stats, err := h.scheduledTaskService.GetStatistics(uid)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "get_statistics_failed", err.Error())
		return
	}

	RespondSuccess(c, stats)
}

// Toggle 启用/禁用定时任务
func (h *ScheduledTaskHandler) Toggle(c *gin.Context) {
	idParam := c.Param("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_id", "Invalid task ID format")
		return
	}

	var req struct {
		Enabled bool `json:"enabled" binding:"required"`
	}
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

	if err := h.scheduledTaskService.ToggleTask(uid, id, req.Enabled); err != nil {
		if err == scheduledtask.ErrScheduledTaskNotFound {
			RespondError(c, http.StatusNotFound, "not_found", "Scheduled task not found")
			return
		}
		if err == scheduledtask.ErrUnauthorized {
			RespondError(c, http.StatusForbidden, "forbidden", "Access denied")
			return
		}
		RespondError(c, http.StatusInternalServerError, "toggle_failed", err.Error())
		return
	}

	RespondSuccess(c, gin.H{"message": "Task toggled successfully"})
}

// Trigger 手动触发定时任务
func (h *ScheduledTaskHandler) Trigger(c *gin.Context) {
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

	if err := h.scheduledTaskService.TriggerTask(uid, id); err != nil {
		if err == scheduledtask.ErrScheduledTaskNotFound {
			RespondError(c, http.StatusNotFound, "not_found", "Scheduled task not found")
			return
		}
		if err == scheduledtask.ErrUnauthorized {
			RespondError(c, http.StatusForbidden, "forbidden", "Access denied")
			return
		}
		RespondError(c, http.StatusInternalServerError, "trigger_failed", err.Error())
		return
	}

	RespondSuccess(c, gin.H{"message": "Task triggered successfully"})
}
