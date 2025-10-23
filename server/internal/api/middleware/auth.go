package middleware

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/easyssh/server/internal/domain/auth"
)

// AuthMiddleware JWT 认证中间件
func AuthMiddleware(jwtService auth.JWTService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从请求头获取 Authorization
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "Missing authorization header",
			})
			c.Abort()
			return
		}

		// 解析 Bearer token
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "Invalid authorization header format",
			})
			c.Abort()
			return
		}

		tokenString := parts[1]

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
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.Next()
			return
		}

		tokenString := parts[1]
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
