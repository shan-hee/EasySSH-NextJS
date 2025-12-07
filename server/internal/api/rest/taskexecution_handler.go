package rest

import (
	"net/http"
	"strconv"

	"github.com/easyssh/server/internal/domain/taskexecution"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// TaskExecutionHandler 任务执行历史处理器
type TaskExecutionHandler struct {
	taskExecutionService taskexecution.Service
}

// NewTaskExecutionHandler 创建任务执行历史处理器实例
func NewTaskExecutionHandler(taskExecutionService taskexecution.Service) *TaskExecutionHandler {
	return &TaskExecutionHandler{
		taskExecutionService: taskExecutionService,
	}
}

// List 获取执行历史列表
func (h *TaskExecutionHandler) List(c *gin.Context) {
	var req taskexecution.ListExecutionsRequest
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

	response, err := h.taskExecutionService.ListExecutions(uid, &req)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "list_failed", err.Error())
		return
	}

	RespondSuccess(c, response)
}

// GetByID 获取执行详情
func (h *TaskExecutionHandler) GetByID(c *gin.Context) {
	idParam := c.Param("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_id", "Invalid execution ID")
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

	execution, err := h.taskExecutionService.GetExecutionWithResults(uid, id)
	if err != nil {
		if err == taskexecution.ErrNotFound {
			RespondError(c, http.StatusNotFound, "not_found", "Execution not found")
			return
		}
		if err == taskexecution.ErrUnauthorized {
			RespondError(c, http.StatusForbidden, "forbidden", "Access denied")
			return
		}
		RespondError(c, http.StatusInternalServerError, "get_failed", err.Error())
		return
	}

	RespondSuccess(c, execution)
}

// GetResults 获取服务器执行结果
func (h *TaskExecutionHandler) GetResults(c *gin.Context) {
	idParam := c.Param("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_id", "Invalid execution ID")
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

	results, err := h.taskExecutionService.GetServerResults(uid, id)
	if err != nil {
		if err == taskexecution.ErrNotFound {
			RespondError(c, http.StatusNotFound, "not_found", "Execution not found")
			return
		}
		if err == taskexecution.ErrUnauthorized {
			RespondError(c, http.StatusForbidden, "forbidden", "Access denied")
			return
		}
		RespondError(c, http.StatusInternalServerError, "get_results_failed", err.Error())
		return
	}

	RespondSuccess(c, results)
}

// GetStatistics 获取执行统计
func (h *TaskExecutionHandler) GetStatistics(c *gin.Context) {
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

	days := 30 // 默认30天
	if d := c.Query("days"); d != "" {
		if parsed, err := strconv.Atoi(d); err == nil && parsed > 0 {
			days = parsed
		}
	}

	stats, err := h.taskExecutionService.GetStatistics(uid, days)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "get_statistics_failed", err.Error())
		return
	}

	RespondSuccess(c, stats)
}
