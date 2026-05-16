package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/easyssh/server/internal/domain/security"
	"github.com/gin-gonic/gin"
)

var (
	memoryLimits   = make(map[string]*memoryLimitRecord)
	memoryLimitsMu sync.RWMutex
)

type memoryLimitRecord struct {
	count     int
	resetTime time.Time
}

func checkMemoryRateLimit(key string, limit int, window time.Duration) bool {
	if limit <= 0 {
		return true
	}

	memoryLimitsMu.Lock()
	defer memoryLimitsMu.Unlock()

	now := time.Now()
	record, exists := memoryLimits[key]
	if !exists || now.After(record.resetTime) {
		memoryLimits[key] = &memoryLimitRecord{
			count:     1,
			resetTime: now.Add(window),
		}
		return true
	}

	if record.count < limit {
		record.count++
		return true
	}

	return false
}

func init() {
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			memoryLimitsMu.Lock()
			now := time.Now()
			for key, record := range memoryLimits {
				if now.After(record.resetTime) {
					delete(memoryLimits, key)
				}
			}
			memoryLimitsMu.Unlock()
		}
	}()
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
		if !checkMemoryRateLimit(key, limit, time.Minute) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":   "rate_limit_exceeded",
				"message": "Too many login attempts, please try again later",
			})
			c.Abort()
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
		if !checkMemoryRateLimit(key, limit, time.Minute) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":   "rate_limit_exceeded",
				"message": "Too many 2FA verification attempts, please try again later",
			})
			c.Abort()
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
		if !checkMemoryRateLimit(key, limit, time.Minute) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":   "rate_limit_exceeded",
				"message": "Too many requests, please try again later",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RateLimiter 内存速率限制器（保留用于简单自定义中间件）。
type RateLimiter struct {
	requests map[string]*clientRequests
	mu       sync.RWMutex
	limit    int
	window   time.Duration
}

type clientRequests struct {
	count     int
	resetTime time.Time
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		requests: make(map[string]*clientRequests),
		limit:    limit,
		window:   window,
	}
	go rl.cleanup()
	return rl
}

func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for key, req := range rl.requests {
			if now.After(req.resetTime) {
				delete(rl.requests, key)
			}
		}
		rl.mu.Unlock()
	}
}

func (rl *RateLimiter) Allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	req, exists := rl.requests[key]
	if !exists || now.After(req.resetTime) {
		rl.requests[key] = &clientRequests{
			count:     1,
			resetTime: now.Add(rl.window),
		}
		return true
	}

	if req.count < rl.limit {
		req.count++
		return true
	}

	return false
}
