package middleware

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/easyssh/server/internal/domain/auth"
)

// Cookie 名称常量
const (
	AccessTokenCookieName = "easyssh_access_token"
)

// AuthMiddleware JWT 认证中间件
func AuthMiddleware(jwtService auth.JWTService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var tokenString string

		// 1. 从 HttpOnly Cookie 获取 token（推荐）
		if cookie, err := c.Cookie(AccessTokenCookieName); err == nil && cookie != "" {
			tokenString = cookie
		}

		// 2. 如果 Cookie 中没有，尝试从 Query 参数获取（用于 WebSocket）
		if tokenString == "" {
			tokenString = c.Query("token")
		}

		// 如果都没有，返回未授权
		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "Missing authorization token",
			})
			c.Abort()
			return
		}

		// 验证 token
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

		// 将用户信息存入上下文
		c.Set("user_id", claims.UserID.String())
		c.Set("username", claims.Username)
		c.Set("email", claims.Email)
		c.Set("role", string(claims.Role))

		c.Next()
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
func OptionalAuth(jwtService auth.JWTService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var tokenString string

		// 1. 从 Cookie 获取
		if cookie, err := c.Cookie(AccessTokenCookieName); err == nil && cookie != "" {
			tokenString = cookie
		}

		// 如果没有 token，直接继续（可选认证）
		if tokenString == "" {
			c.Next()
			return
		}

		// 验证 token
		claims, err := jwtService.ValidateToken(tokenString)
		if err != nil {
			c.Next()
			return
		}

		// 将用户信息存入上下文
		c.Set("user_id", claims.UserID.String())
		c.Set("username", claims.Username)
		c.Set("email", claims.Email)
		c.Set("role", string(claims.Role))

		c.Next()
	}
}
