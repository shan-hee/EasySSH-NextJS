package middleware

import (
	"errors"
	"net/http"
	"strings"

	"github.com/easyssh/server/internal/domain/auth"
	"github.com/gin-gonic/gin"
)

// 从 Authorization 头或查询参数中提取 Bearer Token
func extractBearerToken(c *gin.Context) string {
	// 优先从 Authorization 头读取：Authorization: Bearer <token>
	authHeader := c.GetHeader("Authorization")
	if authHeader != "" {
		parts := strings.Fields(authHeader)
		if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
			return strings.TrimSpace(parts[1])
		}
	}

	// 对于 WebSocket 等场景，允许通过 query 参数传递 token
	if token := strings.TrimSpace(c.Query("token")); token != "" {
		return token
	}

	return ""
}

// AuthMiddleware JWT 认证中间件（仅接受 Bearer Token，不再从 Cookie 读取）
func AuthMiddleware(jwtService auth.JWTService) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := extractBearerToken(c)

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
		tokenString := extractBearerToken(c)

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
