package middleware

import (
	"context"
	"strings"

	"github.com/easyssh/server/internal/domain/settings"
	"github.com/gin-gonic/gin"
)

// CORS 跨域中间件 - 使用白名单机制，支持动态配置
func CORS(configManager *settings.ConfigManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从配置管理器读取 CORS 配置（带缓存）
		corsConfig, err := configManager.GetCORSConfig(context.Background())
		if err != nil {
			// 配置读取失败，使用默认配置
			corsConfig = &settings.CORSConfig{
				AllowedOrigins: []string{"http://localhost:3000"},
				AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
				AllowedHeaders: []string{"Content-Type", "Authorization"},
			}
		}

		origin := c.Request.Header.Get("Origin")

		// 检查 origin 是否在白名单中
		allowed := false
		for _, allowedOrigin := range corsConfig.AllowedOrigins {
			if origin == allowedOrigin {
				allowed = true
				break
			}
		}

		// 仅对白名单内的源设置 CORS 头
		if allowed {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
			c.Writer.Header().Set("Access-Control-Allow-Headers", strings.Join(corsConfig.AllowedHeaders, ", "))
			c.Writer.Header().Set("Access-Control-Allow-Methods", strings.Join(corsConfig.AllowedMethods, ", "))
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
