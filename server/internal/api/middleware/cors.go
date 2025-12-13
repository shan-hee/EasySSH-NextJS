package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"github.com/easyssh/server/internal/domain/security"
	"github.com/easyssh/server/internal/infra/config"
	"github.com/gin-gonic/gin"
)

// CORS 跨域中间件 - 使用白名单机制，支持动态配置
// 策略：
// - 默认始终允许 localhost + 前端端口（开发和生产环境通用）
// - Web UI 配置的源追加到默认值后面（开发和生产环境统一策略）
func CORS(cfg *config.Config, securityService security.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var allowedOrigins []string
		var allowedMethods []string
		var allowedHeaders []string

		// 默认始终允许 localhost + 前端端口（开发和生产环境通用）
		allowedOrigins = []string{
			fmt.Sprintf("http://localhost:%d", cfg.Server.WebDevPort),
		}
		allowedMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"}
		// 默认允许常用头 + Authorization（Bearer）+ CSRF 头（Cookie 鉴权）
		allowedHeaders = []string{"Content-Type", "Authorization", "X-CSRF-Token"}

		// 尝试从请求上下文缓存读取配置，避免重复查询数据库
		var corsConfig *security.CORSConfig
		var configLoadFailed bool
		if secConfig, ok := GetSecurityConfigFromContext(c); ok {
			// 从缓存的配置中解析CORS配置
			if secConfig.CORSConfig != "" {
				var cors security.CORSConfig
				if err := json.Unmarshal([]byte(secConfig.CORSConfig), &cors); err != nil {
					log.Printf("[CORS] 警告: 解析缓存的CORS配置失败: %v", err)
					configLoadFailed = true
				} else {
					corsConfig = &cors
				}
			}
		} else {
			// 缓存未命中,从数据库读取
			var err error
			corsConfig, err = securityService.GetCORSConfig(context.Background())
			if err != nil {
				log.Printf("[CORS] 警告: 从数据库加载CORS配置失败: %v，使用默认配置", err)
				configLoadFailed = true
			}
		}

		if configLoadFailed {
			log.Printf("[CORS] 使用默认CORS配置: origins=%v", allowedOrigins)
		}

		if corsConfig != nil && len(corsConfig.AllowedOrigins) > 0 {
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
		} else if origin != "" {
			// 记录被拒绝的跨域请求（仅当有Origin头时）
			log.Printf("[CORS] 拒绝跨域请求: origin=%s, path=%s, allowedOrigins=%v", origin, c.Request.URL.Path, allowedOrigins)
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
