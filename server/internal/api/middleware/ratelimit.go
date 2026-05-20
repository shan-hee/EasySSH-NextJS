package middleware

import (
	"fmt"
	"net/http"
	"time"

	"github.com/easyssh/server/internal/domain/security"
	"github.com/gin-gonic/gin"
	"github.com/ulule/limiter/v3"
	"github.com/ulule/limiter/v3/drivers/store/memory"
)

var rateLimitStore = memory.NewStore()

func checkRateLimit(c *gin.Context, key string, limit int, window time.Duration) (bool, limiter.Context, error) {
	if limit <= 0 {
		return true, limiter.Context{}, nil
	}

	l := limiter.New(rateLimitStore, limiter.Rate{
		Period: window,
		Limit:  int64(limit),
	})

	limitContext, err := l.Get(c.Request.Context(), key)
	if err != nil {
		return true, limiter.Context{}, err
	}

	return !limitContext.Reached, limitContext, nil
}

func respondRateLimited(c *gin.Context, limitContext limiter.Context, message string) {
	if limitContext.Limit > 0 {
		c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", limitContext.Limit))
		c.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", limitContext.Remaining))
		c.Header("X-RateLimit-Reset", fmt.Sprintf("%d", limitContext.Reset))
	}

	c.JSON(http.StatusTooManyRequests, gin.H{
		"error":   "rate_limit_exceeded",
		"message": message,
	})
	c.Abort()
}

// LoginRateLimitMiddleware 登录接口专用速率限制，支持动态配置。
func LoginRateLimitMiddleware(securityService security.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 5
		if secConfig, ok := GetSecurityConfigFromContext(c); ok {
			limit = secConfig.LoginLimit
		} else if securityService != nil {
			if config, err := securityService.GetRateLimitConfig(c.Request.Context()); err == nil {
				limit = config.LoginLimit
			}
		}

		key := "login:" + c.ClientIP()
		allowed, limitContext, err := checkRateLimit(c, key, limit, time.Minute)
		if err != nil {
			_ = c.Error(err)
		}
		if !allowed {
			respondRateLimited(c, limitContext, "Too many login attempts, please try again later")
			return
		}

		c.Next()
	}
}

// TwoFARateLimitMiddleware 2FA 验证接口专用速率限制。
func TwoFARateLimitMiddleware(securityService security.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 5
		if secConfig, ok := GetSecurityConfigFromContext(c); ok && secConfig.TwoFALimit > 0 {
			limit = secConfig.TwoFALimit
		} else if securityService != nil {
			if config, err := securityService.GetRateLimitConfig(c.Request.Context()); err == nil && config.TwoFALimit > 0 {
				limit = config.TwoFALimit
			}
		}

		key := "2fa:" + c.ClientIP()
		allowed, limitContext, err := checkRateLimit(c, key, limit, time.Minute)
		if err != nil {
			_ = c.Error(err)
		}
		if !allowed {
			respondRateLimited(c, limitContext, "Too many 2FA verification attempts, please try again later")
			return
		}

		c.Next()
	}
}

// APIRateLimitMiddleware API 接口通用速率限制，支持动态配置。
func APIRateLimitMiddleware(securityService security.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 100
		if secConfig, ok := GetSecurityConfigFromContext(c); ok {
			limit = secConfig.APILimit
		} else if securityService != nil {
			if config, err := securityService.GetRateLimitConfig(c.Request.Context()); err == nil {
				limit = config.APILimit
			}
		}

		key := "api:" + c.ClientIP()
		allowed, limitContext, err := checkRateLimit(c, key, limit, time.Minute)
		if err != nil {
			_ = c.Error(err)
		}
		if !allowed {
			respondRateLimited(c, limitContext, "Too many requests, please try again later")
			return
		}

		c.Next()
	}
}
