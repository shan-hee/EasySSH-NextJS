package middleware

import (
	"net/http"

	"github.com/easyssh/server/internal/platform"
	"github.com/gin-gonic/gin"
)

// RequireCapability gates routes by runtime capabilities. It is a product-shape
// guard, separate from user permissions.
func RequireCapability(runtimeInfo platform.RuntimeInfo, capability platform.Capability) gin.HandlerFunc {
	return func(c *gin.Context) {
		if runtimeInfo.Capabilities[capability] {
			c.Next()
			return
		}

		c.JSON(http.StatusNotFound, gin.H{
			"error":      "capability_unavailable",
			"message":    "This capability is not available in the current runtime profile",
			"capability": string(capability),
			"profile":    string(runtimeInfo.Profile),
		})
		c.Abort()
	}
}

func AttachRuntimePrincipal(runtimeInfo platform.RuntimeInfo) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("runtime_profile", runtimeInfo.Profile)

		userID, ok := c.Get("user_id")
		if !ok {
			c.Next()
			return
		}

		userIDString, ok := userID.(string)
		if !ok || userIDString == "" {
			c.Next()
			return
		}

		if runtimeInfo.Profile == platform.RuntimeProfileDesktop {
			c.Set("principal", platform.NewDesktopLocalOwner(userIDString))
			c.Next()
			return
		}

		c.Set("principal", platform.NewPrincipal(
			userIDString,
			platform.PrincipalKindUser,
			platform.PrincipalRoleUser,
			runtimeInfo.Profile,
		))
		c.Next()
	}
}
