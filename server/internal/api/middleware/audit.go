package middleware

import (
	"time"

	"github.com/easyssh/server/internal/domain/auditlog"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AuditLogMiddleware 审计日志中间件
func AuditLogMiddleware(auditService auditlog.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 记录开始时间
		startTime := time.Now()

		// 处理请求
		c.Next()

		// 请求完成后记录日志
		duration := time.Since(startTime).Milliseconds()

		// 获取用户信息
		userIDStr, exists := c.Get("user_id")
		if !exists {
			return // 未认证请求不记录
		}

		userID, err := uuid.Parse(userIDStr.(string))
		if err != nil {
			return
		}

		username, _ := c.Get("username")
		usernameStr := ""
		if username != nil {
			usernameStr = username.(string)
		}

		// 根据路径和方法确定操作类型
		action := determineAction(c.Request.Method, c.FullPath())
		if action == "" {
			return // 不需要记录的操作
		}

		// 确定状态
		status := auditlog.StatusSuccess
		errorMsg := ""
		if c.Writer.Status() >= 400 {
			status = auditlog.StatusFailure
			if len(c.Errors) > 0 {
				errorMsg = c.Errors.String()
			}
		}

		// 获取资源信息
		resource := c.Param("server_id")
		if resource == "" {
			resource = c.Request.URL.Path
		}

		// 创建日志请求
		req := &auditlog.CreateAuditLogRequest{
			UserID:    userID,
			Username:  usernameStr,
			Action:    action,
			Resource:  resource,
			Status:    status,
			IP:        c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
			ErrorMsg:  errorMsg,
			Duration:  duration,
		}

		// 异步记录日志（不阻塞请求）
		go func() {
			_ = auditService.Log(c.Request.Context(), req)
		}()
	}
}

// determineAction 根据请求方法和路径确定操作类型
func determineAction(method, path string) auditlog.ActionType {
	// 认证相关
	if path == "/api/v1/auth/login" {
		return auditlog.ActionLogin
	}
	if path == "/api/v1/auth/logout" {
		return auditlog.ActionLogout
	}

	// 服务器管理
	if method == "POST" && path == "/api/v1/servers" {
		return auditlog.ActionServerCreate
	}
	if method == "PUT" && path == "/api/v1/servers/:id" {
		return auditlog.ActionServerUpdate
	}
	if method == "DELETE" && path == "/api/v1/servers/:id" {
		return auditlog.ActionServerDelete
	}
	if method == "POST" && path == "/api/v1/servers/:id/test" {
		return auditlog.ActionServerTest
	}

	// SSH 连接
	if path == "/ws/terminal/:server_id" {
		return auditlog.ActionSSHConnect
	}

	// SFTP 操作
	if method == "POST" && path == "/api/v1/sftp/:server_id/upload" {
		return auditlog.ActionSFTPUpload
	}
	if method == "GET" && path == "/api/v1/sftp/:server_id/download" {
		return auditlog.ActionSFTPDownload
	}
	if method == "DELETE" && path == "/api/v1/sftp/:server_id/delete" {
		return auditlog.ActionSFTPDelete
	}
	if method == "POST" && path == "/api/v1/sftp/:server_id/rename" {
		return auditlog.ActionSFTPRename
	}
	if method == "POST" && path == "/api/v1/sftp/:server_id/mkdir" {
		return auditlog.ActionSFTPMkdir
	}

	// 监控查询
	if method == "GET" && (path == "/api/v1/monitoring/:server_id/system" ||
		path == "/api/v1/monitoring/:server_id/cpu" ||
		path == "/api/v1/monitoring/:server_id/memory" ||
		path == "/api/v1/monitoring/:server_id/disk" ||
		path == "/api/v1/monitoring/:server_id/network") {
		return auditlog.ActionMonitoringQuery
	}

	// 其他操作不记录
	return ""
}
