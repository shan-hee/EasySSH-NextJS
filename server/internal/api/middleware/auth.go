package middleware

import (
	"errors"
	"net/http"
	"strings"

	"github.com/easyssh/server/internal/domain/auth"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	ticketQueryName  = "ticket"
	ticketContextKey = "auth_ticket"
)

// 从 Authorization 头提取 Bearer Token
func extractBearerToken(c *gin.Context) string {
	authHeader := c.GetHeader("Authorization")
	if authHeader != "" {
		parts := strings.Fields(authHeader)
		if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
			return strings.TrimSpace(parts[1])
		}
	}

	return ""
}

func extractTicket(c *gin.Context) string {
	if t := strings.TrimSpace(c.Query(ticketQueryName)); t != "" {
		return t
	}
	return ""
}

func ticketExpectationForRequest(c *gin.Context) (auth.TicketExpectation, bool) {
	switch c.FullPath() {
	case "/api/v1/ssh/terminal/:server_id":
		return auth.TicketExpectation{Type: auth.TicketTypeWSTerminal, Ref: c.Param("server_id")}, true
	case "/api/v1/monitor/server/:server_id":
		return auth.TicketExpectation{Type: auth.TicketTypeWSMonitor, Ref: c.Param("server_id")}, true
	case "/api/v1/sftp/upload/ws/:task_id":
		return auth.TicketExpectation{Type: auth.TicketTypeWSSFTPUpload, Ref: c.Param("task_id")}, true
	case "/api/v1/sftp/transfer/ws/:task_id":
		return auth.TicketExpectation{Type: auth.TicketTypeWSSFTPTransfer, Ref: c.Param("task_id")}, true
	case "/api/v1/sftp/:server_id/download":
		return auth.TicketExpectation{Type: auth.TicketTypeSFTPDownload, Ref: c.Param("server_id")}, true
	case "/api/v1/sftp/:server_id/batch-download":
		return auth.TicketExpectation{Type: auth.TicketTypeSFTPBatchDownload, Ref: c.Param("server_id")}, true
	default:
		return auth.TicketExpectation{}, false
	}
}

func applyClaimsToContext(c *gin.Context, claims *auth.Claims) {
	c.Set("user_id", claims.UserID.String())
	c.Set("username", claims.Username)
	c.Set("email", claims.Email)
	c.Set("role", string(claims.Role))

	if claims.SessionID != (uuid.UUID{}) {
		c.Set("session_id", claims.SessionID.String())
	}
}

func applyTicketToContext(c *gin.Context, t *auth.Ticket) {
	c.Set("user_id", t.UserID.String())
	c.Set("username", t.Username)
	c.Set("email", t.Email)
	c.Set("role", string(t.Role))
	if t.SessionID != (uuid.UUID{}) {
		c.Set("session_id", t.SessionID.String())
	}
	c.Set(ticketContextKey, t)
}

// AuthMiddleware 认证中间件（支持 Authorization Bearer / 一次性 Ticket）
func AuthMiddleware(jwtService auth.JWTService, ticketService auth.TicketService, userRepo auth.Repository) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1) 优先 Bearer（用于常规 API 调用）
		tokenString := extractBearerToken(c)
		if tokenString != "" {
			claims, err := jwtService.ValidateToken(tokenString)
			if err != nil {
				if errors.Is(err, auth.ErrExpiredToken) {
					c.JSON(http.StatusUnauthorized, gin.H{
						"error":   "token_expired",
						"message": "Token has expired",
					})
				} else if errors.Is(err, auth.ErrTokenBlacklisted) {
					c.JSON(http.StatusUnauthorized, gin.H{
						"error":   "token_blacklisted",
						"message": "Token has been revoked",
					})
				} else {
					c.JSON(http.StatusUnauthorized, gin.H{
						"error":   "invalid_token",
						"message": "Invalid token",
					})
				}
				c.Abort()
				return
			}

			// 检查用户是否被锁定
			if userRepo != nil {
				user, err := userRepo.FindByID(c.Request.Context(), claims.UserID)
				if err != nil {
					c.JSON(http.StatusUnauthorized, gin.H{
						"error":   "user_not_found",
						"message": "User not found",
					})
					c.Abort()
					return
				}
				if user.IsLocked() {
					c.JSON(http.StatusForbidden, gin.H{
						"error":     "account_locked",
						"message":   "Account is locked. Please contact administrator.",
						"unlock_at": user.LockedUntil,
					})
					c.Abort()
					return
				}
			}

			applyClaimsToContext(c, claims)
			c.Next()
			return
		}

		// 2) Ticket（用于 WebSocket 握手 / 原生下载等无法设置 Header 的场景）
		if ticketService != nil {
			ticket := extractTicket(c)
			if ticket != "" {
				expect, ok := ticketExpectationForRequest(c)
				if !ok {
					c.JSON(http.StatusUnauthorized, gin.H{
						"error":   "invalid_ticket",
						"message": "Ticket not allowed for this endpoint",
					})
					c.Abort()
					return
				}
				t, err := ticketService.Consume(ticket, expect)
				if err != nil {
					code := "invalid_ticket"
					msg := "Invalid ticket"
					if errors.Is(err, auth.ErrExpiredTicket) {
						code = "ticket_expired"
						msg = "Ticket has expired"
					} else if errors.Is(err, auth.ErrTicketUsed) {
						code = "ticket_used"
						msg = "Ticket has been used"
					}
					c.JSON(http.StatusUnauthorized, gin.H{
						"error":   code,
						"message": msg,
					})
					c.Abort()
					return
				}

				applyTicketToContext(c, t)
				c.Next()
				return
			}
		}

		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "Missing authorization token",
		})
		c.Abort()
		return
	}
}

// RequireRole 角色权限中间件
func RequireRole(roles ...auth.UserRole) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 获取用户角色
		roleValue, exists := c.Get("role")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "User role not found",
			})
			c.Abort()
			return
		}

		userRole := auth.UserRole(roleValue.(string))

		// 检查角色是否匹配
		hasRole := false
		for _, role := range roles {
			if userRole == role {
				hasRole = true
				break
			}
		}

		if !hasRole {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "Insufficient permissions",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RequireAdmin 管理员权限中间件
func RequireAdmin() gin.HandlerFunc {
	return RequireRole(auth.RoleAdmin)
}

// OptionalAuth 可选认证中间件（不强制要求认证）
func OptionalAuth(jwtService auth.JWTService, ticketService auth.TicketService, userRepo auth.Repository) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := extractBearerToken(c)

		// 如果没有 token，直接继续（可选认证）
		if tokenString == "" {
			// 可选：允许 ticket（主要用于复用中间件形态，默认不会在此类端点使用）
			if ticketService != nil {
				if ticket := extractTicket(c); ticket != "" {
					if expect, ok := ticketExpectationForRequest(c); ok {
						if t, err := ticketService.Consume(ticket, expect); err == nil {
							applyTicketToContext(c, t)
						}
					}
				}
			}
			c.Next()
			return
		}

		// 验证 token
		claims, err := jwtService.ValidateToken(tokenString)
		if err != nil {
			c.Next()
			return
		}

		// 检查用户是否被锁定（可选认证时，锁定用户视为未认证，但设置锁定标记）
		if userRepo != nil {
			user, err := userRepo.FindByID(c.Request.Context(), claims.UserID)
			if err != nil {
				c.Next()
				return
			}
			if user.IsLocked() {
				// 设置锁定标记，供后续处理使用
				c.Set("account_locked", true)
				c.Set("locked_until", user.LockedUntil)
				c.Set("lock_reason", user.LockReason)
				c.Next()
				return
			}
		}

		applyClaimsToContext(c, claims)

		c.Next()
	}
}
