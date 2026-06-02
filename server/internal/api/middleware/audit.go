package middleware

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/easyssh/server/internal/domain/auditlog"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AuditConfig 审计日志配置
type AuditConfig struct {
	// 是否启用调试日志 (生产环境应设置为 false)
	EnableDebugLog bool
	// 异步日志记录超时时间
	AsyncTimeout time.Duration
}

// DefaultAuditConfig 默认审计配置
func DefaultAuditConfig() *AuditConfig {
	// 根据环境变量判断是否启用调试日志
	env := os.Getenv("ENV")
	enableDebug := env == "development" || env == "dev"

	return &AuditConfig{
		EnableDebugLog: enableDebug,
		AsyncTimeout:   3 * time.Second,
	}
}

// AuditLogMiddleware 审计日志中间件（优化版）
// 特性:
// - 支持配置调试日志开关
// - 添加超时控制防止 goroutine 泄漏
// - 改进类型安全检查
// - 更好的错误处理
func AuditLogMiddleware(auditService auditlog.Service, cfg *AuditConfig) gin.HandlerFunc {
	// 使用默认配置
	if cfg == nil {
		cfg = DefaultAuditConfig()
	}

	return func(c *gin.Context) {
		// 记录开始时间
		startTime := time.Now()

		// 处理请求
		c.Next()

		// 请求完成后记录日志
		duration := time.Since(startTime).Milliseconds()

		// 根据路径和方法确定操作类型
		action := determineAction(c.Request.Method, c.FullPath())
		if action == "" {
			return // 不需要记录的操作
		}

		// 获取用户信息（带类型安全检查）
		var userID uuid.UUID
		var usernameStr string

		userIDStr, exists := c.Get("user_id")

		// 对于登录/登出操作,即使未认证也需要记录
		isAuthAction := action == auditlog.ActionLogin || action == auditlog.ActionLogout

		if exists {
			// 类型安全检查
			if uidStr, ok := userIDStr.(string); ok {
				var err error
				userID, err = uuid.Parse(uidStr)
				if err != nil {
					log.Printf("⚠️ Invalid user_id format in context: %v", err)
					return
				}
			} else {
				log.Printf("⚠️ user_id in context is not a string")
				return
			}

			// 获取用户名（类型安全检查）
			if username, ok := c.Get("username"); ok {
				if uname, ok := username.(string); ok {
					usernameStr = uname
				}
			}
		} else {
			// 未认证且非登录/登出操作不记录
			if !isAuthAction {
				return
			}

			// 登录/登出操作：用户名由登录处理器在 c.Set("username") 设置
			userID = uuid.Nil
			if username, ok := c.Get("username"); ok {
				if uname, ok := username.(string); ok {
					usernameStr = uname
				}
			}
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
		resource := getResource(c)

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

		// 调试日志（仅开发环境）
		if cfg.EnableDebugLog {
			log.Printf("📝 Audit: action=%s, user=%s, status=%s, ip=%s",
				action, usernameStr, status, c.ClientIP())
		}

		// 异步记录日志（带超时控制）
		ctx, cancel := context.WithTimeout(context.Background(), cfg.AsyncTimeout)
		go func() {
			defer cancel()
			if err := auditService.Log(ctx, req); err != nil {
				log.Printf("❌ Failed to log audit: %v (action=%s, user=%s)",
					err, req.Action, req.Username)
			} else if cfg.EnableDebugLog {
				log.Printf("✅ Audit saved: action=%s, user=%s", req.Action, req.Username)
			}
		}()
	}
}

// getResource 获取资源信息
func getResource(c *gin.Context) string {
	// 尝试从 URL 参数获取资源标识
	if resource := c.Param("server_id"); resource != "" {
		return resource
	}
	if resource := c.Param("id"); resource != "" {
		return resource
	}
	// 默认使用请求路径
	return c.Request.URL.Path
}

// determineAction 根据请求方法和路径确定操作类型
func determineAction(method, path string) auditlog.ActionType {
	// 认证相关
	// 登录：现在通过 OAuth 2.0 Authorization Code + PKCE 完成，
	// 前端调用 /api/v1/oauth/authorize + /api/v1/oauth/token 完成登录流程。
	// 这里将 authorize 端点视为登录操作入口，用于审计记录。
	if method == "POST" && (path == "/oauth/authorize" || path == "/api/v1/oauth/authorize") {
		return auditlog.ActionLogin
	}
	if method == "POST" && (path == "/api/v1/oauth/logout" || path == "/api/v1/auth/logout") {
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
	if method == "POST" && (path == "/api/v1/servers/:id/test" || path == "/api/v1/servers/test") {
		return auditlog.ActionServerTest
	}

	// SSH 连接
	if path == "/ws/terminal/:server_id" {
		return auditlog.ActionSSHConnect
	}

	// SFTP 操作
	if method == "POST" && (path == "/api/v1/sftp/:server_id/upload" || path == "/api/v1/sftp/:server_id/upload/stream") {
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
