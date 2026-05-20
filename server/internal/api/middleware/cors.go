package middleware

import (
	"fmt"
	"strings"
	"time"

	"github.com/easyssh/server/internal/domain/security"
	"github.com/easyssh/server/internal/infra/config"
	gincors "github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// CORS 跨域中间件 - 使用白名单机制，支持动态配置。
func CORS(cfg *config.Config, securityService security.Service) gin.HandlerFunc {
	defaultOrigins := []string{
		fmt.Sprintf("http://localhost:%d", cfg.Server.WebDevPort),
	}

	return gincors.New(gincors.Config{
		AllowOriginFunc: func(origin string) bool {
			if strings.TrimSpace(origin) == "" {
				return false
			}
			return IsConfiguredOriginAllowed(origin, securityService, cfg.Server.WebDevPort)
		},
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"},
		AllowHeaders: []string{
			"Content-Type",
			"Authorization",
			"X-CSRF-Token",
			"X-Requested-With",
		},
		ExposeHeaders: []string{
			"X-CSRF-Token",
			"X-RateLimit-Limit",
			"X-RateLimit-Remaining",
			"X-RateLimit-Reset",
		},
		AllowCredentials: true,
		AllowWebSockets:  true,
		MaxAge:           24 * time.Hour,
		AllowOrigins:     defaultOrigins,
	})
}
