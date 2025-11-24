package middleware

import (
	"context"

	"github.com/easyssh/server/internal/domain/security"
	"github.com/gin-gonic/gin"
)

// 上下文key类型(避免冲突)
type contextKey string

const (
	securityConfigKey contextKey = "security_config"
)

// SecurityConfigCache 请求级别的安全配置缓存中间件
// 在请求开始时一次性获取所有配置,避免后续中间件重复查询数据库
func SecurityConfigCache(securityService security.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 一次性获取所有配置
		ctx := c.Request.Context()
		config, err := securityService.Get(ctx)
		if err == nil && config != nil {
			// 将配置存入上下文
			c.Set(string(securityConfigKey), config)
		}

		c.Next()
	}
}

// GetSecurityConfigFromContext 从上下文中获取缓存的安全配置
func GetSecurityConfigFromContext(c *gin.Context) (*security.SecurityConfig, bool) {
	if config, exists := c.Get(string(securityConfigKey)); exists {
		if secConfig, ok := config.(*security.SecurityConfig); ok {
			return secConfig, true
		}
	}
	return nil, false
}

// GetCORSConfigFromCache 从缓存中获取CORS配置
func GetCORSConfigFromCache(c *gin.Context, securityService security.Service) (*security.CORSConfig, error) {
	// 尝试从缓存获取
	if config, ok := GetSecurityConfigFromContext(c); ok {
		if config.CORSConfig != "" {
			return securityService.GetCORSConfig(context.Background())
		}
	}

	// 缓存未命中,走正常流程
	return securityService.GetCORSConfig(c.Request.Context())
}
