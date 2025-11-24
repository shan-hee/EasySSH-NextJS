package middleware

import (
	"context"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// RateLimitConfig 速率限制配置（用于类型断言）
type RateLimitConfig struct {
	LoginLimit int
	APILimit   int
}

// 全局限流记录（用于动态限流）
var (
	dynamicLimits   = make(map[string]*clientRequests)
	dynamicLimitsMu sync.RWMutex
)

// checkRateLimit 检查速率限制（动态版本）
func checkRateLimit(key string, limit int, window time.Duration) bool {
	dynamicLimitsMu.Lock()
	defer dynamicLimitsMu.Unlock()

	now := time.Now()
	req, exists := dynamicLimits[key]

	if !exists || now.After(req.resetTime) {
		// 新客户端或时间窗口已过期
		dynamicLimits[key] = &clientRequests{
			count:     1,
			resetTime: now.Add(window),
		}
		return true
	}

	if req.count < limit {
		req.count++
		return true
	}

	return false
}

// RateLimiter 速率限制器接口
type RateLimiter struct {
	requests map[string]*clientRequests
	mu       sync.RWMutex
	limit    int           // 最大请求数
	window   time.Duration // 时间窗口
}

// clientRequests 客户端请求记录
type clientRequests struct {
	count     int
	resetTime time.Time
}

// NewRateLimiter 创建速率限制器
func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		requests: make(map[string]*clientRequests),
		limit:    limit,
		window:   window,
	}

	// 启动清理协程,定期清理过期记录
	go rl.cleanup()

	return rl
}

// cleanup 定期清理过期的请求记录
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

// Allow 检查是否允许请求
func (rl *RateLimiter) Allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	req, exists := rl.requests[key]

	if !exists || now.After(req.resetTime) {
		// 新客户端或时间窗口已过期
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

// RateLimitMiddleware 通用速率限制中间件
func RateLimitMiddleware(limiter *RateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 使用 IP 地址作为限流键
		key := c.ClientIP()

		if !limiter.Allow(key) {
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

// LoginRateLimitMiddleware 登录接口专用速率限制，支持动态配置
// 默认: 5次/分钟/IP
func LoginRateLimitMiddleware(securityService interface{}) gin.HandlerFunc {
	// 使用动态速率限制器
	return func(c *gin.Context) {
		// 默认值
		limit := 5

		// 优先从请求上下文缓存获取配置(避免重复查询数据库)
		if secConfig, ok := GetSecurityConfigFromContext(c); ok {
			limit = secConfig.LoginLimit
		} else {
			// 缓存未命中,降级为查询数据库
			if ss, ok := securityService.(interface {
				GetRateLimitConfig(ctx context.Context) (*RateLimitConfig, error)
			}); ok {
				if config, err := ss.GetRateLimitConfig(c.Request.Context()); err == nil {
					limit = config.LoginLimit
				}
			}
		}

		// 使用 IP 地址作为限流键
		key := "login:" + c.ClientIP()

		// 简化的限流检查（使用内存计数）
		if !checkRateLimit(key, limit, time.Minute) {
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

// APIRateLimitMiddleware API 接口通用速率限制，支持动态配置
// 默认: 100次/分钟/IP
func APIRateLimitMiddleware(securityService interface{}) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 默认值
		limit := 100

		// 优先从请求上下文缓存获取配置(避免重复查询数据库)
		if secConfig, ok := GetSecurityConfigFromContext(c); ok {
			limit = secConfig.APILimit
		} else {
			// 缓存未命中,降级为查询数据库
			if ss, ok := securityService.(interface {
				GetRateLimitConfig(ctx context.Context) (*RateLimitConfig, error)
			}); ok {
				if config, err := ss.GetRateLimitConfig(c.Request.Context()); err == nil {
					limit = config.APILimit
				}
			}
		}

		// 使用 IP 地址作为限流键
		key := "api:" + c.ClientIP()

		// 简化的限流检查（使用内存计数）
		if !checkRateLimit(key, limit, time.Minute) {
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
