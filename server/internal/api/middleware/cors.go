package middleware

import (
	"context"
	"fmt"
	"strings"

	"github.com/easyssh/server/internal/domain/settings"
	"github.com/easyssh/server/internal/infra/config"
	"github.com/gin-gonic/gin"
)

// CORS 跨域中间件 - 使用白名单机制，支持动态配置
// 策略：
// - 默认始终允许 localhost + 前端端口（开发和生产环境通用）
// - Web UI 配置的源追加到默认值后面（开发和生产环境统一策略）
func CORS(cfg *config.Config, configManager *settings.ConfigManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		var allowedOrigins []string
		var allowedMethods []string
		var allowedHeaders []string

		// 默认始终允许 localhost + 前端端口（开发和生产环境通用）
		allowedOrigins = []string{
			"http://localhost:3000",
			fmt.Sprintf("http://localhost:%d", cfg.Server.WebDevPort),
		}
		allowedMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"}
		allowedHeaders = []string{"Content-Type", "Authorization"}

		// 尝试从数据库读取 CORS 配置（带缓存），追加到默认值后面
		corsConfig, err := configManager.GetCORSConfig(context.Background())
		if err == nil && corsConfig != nil && len(corsConfig.AllowedOrigins) > 0 {
			// 将 Web UI 配置的源追加到默认值后面（开发和生产环境统一策略）
			allowedOrigins = append(allowedOrigins, corsConfig.AllowedOrigins...)

			// 合并 methods 和 headers（去重）
			if len(corsConfig.AllowedMethods) > 0 {
				methodSet := make(map[string]bool)
				for _, m := range allowedMethods {
					methodSet[m] = true
				}
				for _, m := range corsConfig.AllowedMethods {
					if !methodSet[m] {
						allowedMethods = append(allowedMethods, m)
					}
				}
			}
			if len(corsConfig.AllowedHeaders) > 0 {
				headerSet := make(map[string]bool)
				for _, h := range allowedHeaders {
					headerSet[h] = true
				}
				for _, h := range corsConfig.AllowedHeaders {
					if !headerSet[h] {
						allowedHeaders = append(allowedHeaders, h)
					}
				}
			}
		}

		origin := c.Request.Header.Get("Origin")

		// 检查 origin 是否在白名单中
		allowed := false
		for _, allowedOrigin := range allowedOrigins {
			if origin == allowedOrigin {
				allowed = true
				break
			}
		}

		// 仅对白名单内的源设置 CORS 头
		if allowed {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
			c.Writer.Header().Set("Access-Control-Allow-Headers", strings.Join(allowedHeaders, ", "))
			c.Writer.Header().Set("Access-Control-Allow-Methods", strings.Join(allowedMethods, ", "))
			c.Writer.Header().Set("Access-Control-Max-Age", "86400")
		}

		// OPTIONS 预检请求直接返回 204
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		// 如果不在白名单且不是 OPTIONS，继续处理但不设置 CORS 头
		// 浏览器会阻止跨域请求
		c.Next()
	}
}
