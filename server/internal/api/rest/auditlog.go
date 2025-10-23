package rest

import (
	"net/http"
	"strconv"

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

// List 查询审计日志列表
// GET /api/v1/audit-logs?page=1&page_size=20&action=login&status=success
func (h *AuditLogHandler) List(c *gin.Context) {
	// 解析查询参数
	var req auditlog.ListAuditLogsRequest

	if userIDStr := c.Query("user_id"); userIDStr != "" {
		if userID, err := uuid.Parse(userIDStr); err == nil {
			req.UserID = &userID
		}
	}

	if serverIDStr := c.Query("server_id"); serverIDStr != "" {
		if serverID, err := uuid.Parse(serverIDStr); err == nil {
			req.ServerID = &serverID
		}
	}

	if action := c.Query("action"); action != "" {
		req.Action = auditlog.ActionType(action)
	}

	if status := c.Query("status"); status != "" {
		req.Status = auditlog.Status(status)
	}

	// 分页参数
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

	// 获取当前用户角色
	role, exists := c.Get("user_role")
	if !exists {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "User role not found")
		return
	}

	// 非管理员只能查看自己的日志
	if role != "admin" {
		userID, err := getUserIDFromContext(c)
		if err != nil {
			RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
			return
		}
		req.UserID = &userID
	}

	// 查询日志
	logs, total, err := h.auditService.List(c.Request.Context(), &req)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "query_failed", err.Error())
		return
	}

	// 计算分页信息
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

// GetByID 获取单条审计日志
// GET /api/v1/audit-logs/:id
func (h *AuditLogHandler) GetByID(c *gin.Context) {
	// 解析日志 ID
	logID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_id", "Invalid log ID")
		return
	}

	// 获取日志
	log, err := h.auditService.GetByID(c.Request.Context(), logID)
	if err != nil {
		RespondError(c, http.StatusNotFound, "log_not_found", "Audit log not found")
		return
	}

	// 检查权限：非管理员只能查看自己的日志
	role, _ := c.Get("user_role")
	if role != "admin" {
		userID, err := getUserIDFromContext(c)
		if err != nil {
			RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
			return
		}
		if log.UserID != userID {
			RespondError(c, http.StatusForbidden, "forbidden", "No permission to view this log")
			return
		}
	}

	RespondSuccess(c, log)
}

// GetStatistics 获取审计日志统计
// GET /api/v1/audit-logs/statistics?days=30
func (h *AuditLogHandler) GetStatistics(c *gin.Context) {
	// 获取天数参数
	daysStr := c.DefaultQuery("days", "30")
	days, err := strconv.Atoi(daysStr)
	if err != nil || days <= 0 {
		days = 30
	}

	// 获取当前用户
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	// 检查角色：管理员可以查看全局统计，普通用户只能查看自己的
	role, _ := c.Get("user_role")
	var userIDPtr *uuid.UUID
	if role != "admin" {
		userIDPtr = &userID
	}

	// 获取统计信息
	stats, err := h.auditService.GetStatistics(c.Request.Context(), userIDPtr, days)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "statistics_failed", err.Error())
		return
	}

	RespondSuccess(c, stats)
}

// CleanupOldLogs 清理旧日志（管理员功能）
// DELETE /api/v1/audit-logs/cleanup?retention_days=90
func (h *AuditLogHandler) CleanupOldLogs(c *gin.Context) {
	// 检查管理员权限
	role, _ := c.Get("user_role")
	if role != "admin" {
		RespondError(c, http.StatusForbidden, "forbidden", "Admin permission required")
		return
	}

	// 获取保留天数参数
	retentionStr := c.DefaultQuery("retention_days", "90")
	retentionDays, err := strconv.Atoi(retentionStr)
	if err != nil || retentionDays <= 0 {
		retentionDays = 90
	}

	// 清理旧日志
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

// GetMyLogs 获取当前用户的日志（快捷接口）
// GET /api/v1/audit-logs/me?page=1&page_size=20
func (h *AuditLogHandler) GetMyLogs(c *gin.Context) {
	// 获取当前用户 ID
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	// 构建请求
	req := &auditlog.ListAuditLogsRequest{
		UserID: &userID,
	}

	// 分页参数
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

	// 查询日志
	logs, total, err := h.auditService.List(c.Request.Context(), req)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "query_failed", err.Error())
		return
	}

	// 计算分页信息
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
