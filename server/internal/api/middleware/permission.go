package middleware

import (
	"context"
	"net/http"

	"github.com/easyssh/server/internal/domain/auth"
	"github.com/gin-gonic/gin"
)

// PermissionService 用于权限校验的最小接口（避免引入具体实现依赖）
type PermissionService interface {
	RoleHasPermission(ctx context.Context, role auth.UserRole, code string) (bool, error)
}

// RequirePermission 需要具备指定权限（按角色映射）
func RequirePermission(permissionService PermissionService, code string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if permissionService == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error":   "permission_service_unavailable",
				"message": "Permission service not available",
			})
			c.Abort()
			return
		}

		roleValue, exists := c.Get("role")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "User role not found",
			})
			c.Abort()
			return
		}

		roleStr, ok := roleValue.(string)
		if !ok {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "Invalid user role",
			})
			c.Abort()
			return
		}

		allowed, err := permissionService.RoleHasPermission(c.Request.Context(), auth.UserRole(roleStr), code)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "permission_check_failed",
				"message": err.Error(),
			})
			c.Abort()
			return
		}

		if !allowed {
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
