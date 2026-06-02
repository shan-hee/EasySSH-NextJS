package rest

import (
	"net/http"
	"strconv"
	"time"

	"github.com/easyssh/server/internal/domain/auditlog"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AuditLogHandler 审计日志处理器
type AuditLogHandler struct {
	auditService auditlog.Service
}

// NewAuditLogHandler 创建审计日志处理器
func NewAuditLogHandler(auditService auditlog.Service) *AuditLogHandler {
	return &AuditLogHandler{
		auditService: auditService,
	}
}

// List 查询安全审计列表（管理员）
// GET /api/v1/audit-logs?page=1&page_size=20&action=login&status=success
func (h *AuditLogHandler) List(c *gin.Context) {
	if !requireAdmin(c) {
		return
	}

	req, ok := parseAuditLogListRequest(c, true)
	if !ok {
		return
	}
	req.Category = auditlog.CategoryAudit

	logs, total, err := h.auditService.List(c.Request.Context(), req)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "query_failed", err.Error())
		return
	}

	respondLogList(c, logs, total, req)
}

// GetByID 获取单条安全审计日志（管理员）
// GET /api/v1/audit-logs/:id
func (h *AuditLogHandler) GetByID(c *gin.Context) {
	if !requireAdmin(c) {
		return
	}

	log, ok := h.getLogByID(c)
	if !ok {
		return
	}
	if log.Category != auditlog.CategoryAudit {
		RespondError(c, http.StatusNotFound, "log_not_found", "Audit log not found")
		return
	}

	RespondSuccess(c, log)
}

// GetStatistics 获取安全审计统计（管理员）
// GET /api/v1/audit-logs/statistics?days=30
func (h *AuditLogHandler) GetStatistics(c *gin.Context) {
	if !requireAdmin(c) {
		return
	}

	req, ok := parseAuditLogStatisticsRequest(c, true)
	if !ok {
		return
	}
	req.Category = auditlog.CategoryAudit

	stats, err := h.auditService.GetStatistics(c.Request.Context(), req)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "statistics_failed", err.Error())
		return
	}

	RespondSuccess(c, stats)
}

// CleanupOldLogs 清理旧日志（管理员）
// DELETE /api/v1/audit-logs/cleanup?retention_days=90
func (h *AuditLogHandler) CleanupOldLogs(c *gin.Context) {
	if !requireAdmin(c) {
		return
	}

	retentionStr := c.DefaultQuery("retention_days", "90")
	retentionDays, err := strconv.Atoi(retentionStr)
	if err != nil || retentionDays <= 0 {
		retentionDays = 90
	}
	if retentionDays > 3650 {
		RespondError(c, http.StatusBadRequest, "invalid_retention_days", "Retention days must be between 1 and 3650")
		return
	}

	deletedCount, err := h.auditService.CleanupOldLogs(c.Request.Context(), retentionDays)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "cleanup_failed", err.Error())
		return
	}

	RespondSuccessWithMessage(c, gin.H{
		"deleted_count":  deletedCount,
		"retention_days": retentionDays,
	}, "Old logs cleaned up successfully")
}

// ListMyActivity 获取当前用户活动记录
// GET /api/v1/activity-logs/me?page=1&page_size=20
func (h *AuditLogHandler) ListMyActivity(c *gin.Context) {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	req, ok := parseAuditLogListRequest(c, false)
	if !ok {
		return
	}
	req.UserID = &userID
	req.Category = auditlog.CategoryActivity

	logs, total, err := h.auditService.List(c.Request.Context(), req)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "query_failed", err.Error())
		return
	}

	respondLogList(c, logs, total, req)
}

// GetMyActivityByID 获取当前用户单条活动记录
// GET /api/v1/activity-logs/me/items/:id
func (h *AuditLogHandler) GetMyActivityByID(c *gin.Context) {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	log, ok := h.getLogByID(c)
	if !ok {
		return
	}
	if log.Category != auditlog.CategoryActivity || log.UserID != userID {
		RespondError(c, http.StatusNotFound, "log_not_found", "Activity log not found")
		return
	}

	RespondSuccess(c, log)
}

// GetMyActivityStatistics 获取当前用户活动统计
// GET /api/v1/activity-logs/me/statistics?days=30
func (h *AuditLogHandler) GetMyActivityStatistics(c *gin.Context) {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	req, ok := parseAuditLogStatisticsRequest(c, false)
	if !ok {
		return
	}
	req.UserID = &userID
	req.Category = auditlog.CategoryActivity

	stats, err := h.auditService.GetStatistics(c.Request.Context(), req)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "statistics_failed", err.Error())
		return
	}

	RespondSuccess(c, stats)
}

func (h *AuditLogHandler) getLogByID(c *gin.Context) (*auditlog.AuditLog, bool) {
	logID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_id", "Invalid log ID")
		return nil, false
	}

	log, err := h.auditService.GetByID(c.Request.Context(), logID)
	if err != nil {
		RespondError(c, http.StatusNotFound, "log_not_found", "Log not found")
		return nil, false
	}

	return log, true
}

func parseAuditLogListRequest(c *gin.Context, allowUserID bool) (*auditlog.ListAuditLogsRequest, bool) {
	req := &auditlog.ListAuditLogsRequest{}

	if userIDStr := c.Query("user_id"); allowUserID && userIDStr != "" {
		userID, err := uuid.Parse(userIDStr)
		if err != nil {
			RespondError(c, http.StatusBadRequest, "invalid_user_id", "Invalid user_id")
			return nil, false
		}
		req.UserID = &userID
	}

	if serverIDStr := c.Query("server_id"); serverIDStr != "" {
		serverID, err := uuid.Parse(serverIDStr)
		if err != nil {
			RespondError(c, http.StatusBadRequest, "invalid_server_id", "Invalid server_id")
			return nil, false
		}
		req.ServerID = &serverID
	}

	if action := c.Query("action"); action != "" {
		req.Action = auditlog.ActionType(action)
	}
	if status := c.Query("status"); status != "" {
		req.Status = auditlog.Status(status)
	}

	if startTime, ok := parseQueryTime(c, "start_date", false); !ok {
		return nil, false
	} else {
		req.StartTime = startTime
	}
	if endTime, ok := parseQueryTime(c, "end_date", true); !ok {
		return nil, false
	} else {
		req.EndTime = endTime
	}

	if pageStr := c.DefaultQuery("page", "1"); pageStr != "" {
		if page, err := strconv.Atoi(pageStr); err == nil {
			req.Page = page
		}
	}
	if pageSizeStr := c.DefaultQuery("page_size", "20"); pageSizeStr != "" {
		if pageSize, err := strconv.Atoi(pageSizeStr); err == nil {
			req.PageSize = pageSize
		}
	}

	return req, true
}

func parseAuditLogStatisticsRequest(c *gin.Context, allowUserID bool) (*auditlog.AuditLogStatisticsRequest, bool) {
	req := &auditlog.AuditLogStatisticsRequest{}

	if userIDStr := c.Query("user_id"); allowUserID && userIDStr != "" {
		userID, err := uuid.Parse(userIDStr)
		if err != nil {
			RespondError(c, http.StatusBadRequest, "invalid_user_id", "Invalid user_id")
			return nil, false
		}
		req.UserID = &userID
	}

	daysStr := c.DefaultQuery("days", "30")
	if days, err := strconv.Atoi(daysStr); err == nil {
		req.Days = days
	}

	if startTime, ok := parseQueryTime(c, "start_date", false); !ok {
		return nil, false
	} else {
		req.StartTime = startTime
	}
	if endTime, ok := parseQueryTime(c, "end_date", true); !ok {
		return nil, false
	} else {
		req.EndTime = endTime
	}

	return req, true
}

func parseQueryTime(c *gin.Context, key string, endOfDay bool) (*time.Time, bool) {
	value := c.Query(key)
	if value == "" {
		return nil, true
	}

	if parsed, err := time.Parse(time.RFC3339, value); err == nil {
		return &parsed, true
	}

	parsed, err := time.Parse("2006-01-02", value)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_"+key, "Invalid "+key)
		return nil, false
	}
	if endOfDay {
		parsed = parsed.AddDate(0, 0, 1).Add(-time.Nanosecond)
	}
	return &parsed, true
}

func respondLogList(c *gin.Context, logs []*auditlog.AuditLog, total int64, req *auditlog.ListAuditLogsRequest) {
	totalPages := int(total) / req.PageSize
	if int(total)%req.PageSize > 0 {
		totalPages++
	}

	RespondSuccess(c, gin.H{
		"logs":        logs,
		"total":       total,
		"page":        req.Page,
		"page_size":   req.PageSize,
		"total_pages": totalPages,
	})
}

func requireAdmin(c *gin.Context) bool {
	role, exists := c.Get("role")
	if !exists {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "User role not found")
		return false
	}
	if role != "admin" {
		RespondError(c, http.StatusForbidden, "forbidden", "Admin permission required")
		return false
	}
	return true
}
