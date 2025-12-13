package middleware

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/easyssh/server/internal/domain/security"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// RateLimitConfig 速率限制配置（用于类型断言）
type RateLimitConfig struct {
	LoginLimit int
	APILimit   int
}

// DistributedRateLimiter 分布式速率限制器（基于 Redis）
type DistributedRateLimiter struct {
	redisClient *redis.Client
	keyPrefix   string        // Redis key 前缀
	limit       int           // 最大请求数
	window      time.Duration // 时间窗口
}

// NewDistributedRateLimiter 创建分布式速率限制器
func NewDistributedRateLimiter(redisClient *redis.Client, keyPrefix string, limit int, window time.Duration) *DistributedRateLimiter {
	return &DistributedRateLimiter{
		redisClient: redisClient,
		keyPrefix:   keyPrefix,
		limit:       limit,
		window:      window,
	}
}

// Allow 检查是否允许请求（使用 Redis INCR + EXPIRE 实现）
func (rl *DistributedRateLimiter) Allow(ctx context.Context, identifier string) (bool, error) {
	key := fmt.Sprintf("ratelimit:%s:%s", rl.keyPrefix, identifier)

	// 使用 Lua 脚本实现原子性的 INCR + EXPIRE
	// 这确保了在高并发下计数和过期时间设置的原子性
	luaScript := redis.NewScript(`
		local key = KEYS[1]
		local limit = tonumber(ARGV[1])
		local window = tonumber(ARGV[2])

		local current = redis.call('INCR', key)

		-- 如果是第一次请求，设置过期时间
		if current == 1 then
			redis.call('EXPIRE', key, window)
		end

		-- 返回当前计数和是否允许
		if current <= limit then
			return {1, current, redis.call('TTL', key)}
		else
			return {0, current, redis.call('TTL', key)}
		end
	`)

	result, err := luaScript.Run(ctx, rl.redisClient, []string{key}, rl.limit, int(rl.window.Seconds())).Slice()
	if err != nil {
		// Redis 不可用时，降级到允许请求（避免影响正常业务）
		return true, err
	}

	allowed := result[0].(int64) == 1
	return allowed, nil
}

// GetRemainingRequests 获取剩余请求数
func (rl *DistributedRateLimiter) GetRemainingRequests(ctx context.Context, identifier string) (remaining int, resetIn time.Duration, err error) {
	key := fmt.Sprintf("ratelimit:%s:%s", rl.keyPrefix, identifier)

	pipe := rl.redisClient.Pipeline()
	getCmd := pipe.Get(ctx, key)
	ttlCmd := pipe.TTL(ctx, key)
	_, err = pipe.Exec(ctx)

	if err != nil && err != redis.Nil {
		return rl.limit, rl.window, err
	}

	current := 0
	if err != redis.Nil {
		if val, parseErr := getCmd.Int(); parseErr == nil {
			current = val
		}
	}

	remaining = rl.limit - current
	if remaining < 0 {
		remaining = 0
	}

	ttl := ttlCmd.Val()
	if ttl < 0 {
		resetIn = rl.window
	} else {
		resetIn = ttl
	}

	return remaining, resetIn, nil
}

// =========================================================================
// 内存限流器（作为 Redis 不可用时的降级方案）
// =========================================================================

var (
	memoryLimits   = make(map[string]*memoryLimitRecord)
	memoryLimitsMu sync.RWMutex
)

type memoryLimitRecord struct {
	count     int
	resetTime time.Time
}

// checkMemoryRateLimit 内存限流检查（降级方案）
func checkMemoryRateLimit(key string, limit int, window time.Duration) bool {
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

// cleanupMemoryLimits 清理过期的内存限流记录
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

// =========================================================================
// 中间件工厂函数
// =========================================================================

// checkRateLimitWithRedis 使用 Redis 检查速率限制，失败时降级到内存
func checkRateLimitWithRedis(ctx context.Context, redisClient *redis.Client, key string, limit int, window time.Duration) bool {
	if redisClient == nil {
		// Redis 未配置，使用内存限流
		return checkMemoryRateLimit(key, limit, window)
	}

	limiter := &DistributedRateLimiter{
		redisClient: redisClient,
		keyPrefix:   "",
		limit:       limit,
		window:      window,
	}

	// 直接使用完整 key
	fullKey := fmt.Sprintf("ratelimit:%s", key)

	luaScript := redis.NewScript(`
		local key = KEYS[1]
		local limit = tonumber(ARGV[1])
		local window = tonumber(ARGV[2])

		local current = redis.call('INCR', key)

		if current == 1 then
			redis.call('EXPIRE', key, window)
		end

		if current <= limit then
			return 1
		else
			return 0
		end
	`)

	result, err := luaScript.Run(ctx, limiter.redisClient, []string{fullKey}, limit, int(window.Seconds())).Int()
	if err != nil {
		// Redis 出错时降级到内存限流
		return checkMemoryRateLimit(key, limit, window)
	}

	return result == 1
}

// LoginRateLimitMiddleware 登录接口专用速率限制，支持动态配置
// 默认: 5次/分钟/IP，使用 Redis 分布式限流
func LoginRateLimitMiddleware(securityService security.Service, redisClient *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 默认值
		limit := 5

		// 优先从请求上下文缓存获取配置(避免重复查询数据库)
		if secConfig, ok := GetSecurityConfigFromContext(c); ok {
			limit = secConfig.LoginLimit
		} else if securityService != nil {
			// 缓存未命中,降级为查询数据库
			if config, err := securityService.GetRateLimitConfig(c.Request.Context()); err == nil {
				limit = config.LoginLimit
			}
		}

		// 使用 IP 地址作为限流键
		key := "login:" + c.ClientIP()

		// 使用 Redis 分布式限流（失败时自动降级到内存）
		if !checkRateLimitWithRedis(c.Request.Context(), redisClient, key, limit, time.Minute) {
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

// TwoFARateLimitMiddleware 2FA 验证接口专用速率限制
// 默认: 5次/分钟/IP，防止暴力破解 TOTP 码，使用 Redis 分布式限流
func TwoFARateLimitMiddleware(securityService security.Service, redisClient *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 默认值: 5次/分钟
		limit := 5

		// 优先从请求上下文缓存获取配置
		if secConfig, ok := GetSecurityConfigFromContext(c); ok && secConfig.TwoFALimit > 0 {
			limit = secConfig.TwoFALimit
		} else if securityService != nil {
			// 缓存未命中，降级为查询数据库
			if config, err := securityService.GetRateLimitConfig(c.Request.Context()); err == nil && config.TwoFALimit > 0 {
				limit = config.TwoFALimit
			}
		}

		// 使用 IP 地址作为限流键
		key := "2fa:" + c.ClientIP()

		// 使用 Redis 分布式限流（失败时自动降级到内存）
		if !checkRateLimitWithRedis(c.Request.Context(), redisClient, key, limit, time.Minute) {
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

// APIRateLimitMiddleware API 接口通用速率限制，支持动态配置
// 默认: 100次/分钟/IP，使用 Redis 分布式限流
func APIRateLimitMiddleware(securityService security.Service, redisClient *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 默认值
		limit := 100

		// 优先从请求上下文缓存获取配置(避免重复查询数据库)
		if secConfig, ok := GetSecurityConfigFromContext(c); ok {
			limit = secConfig.APILimit
		} else if securityService != nil {
			// 缓存未命中,降级为查询数据库
			if config, err := securityService.GetRateLimitConfig(c.Request.Context()); err == nil {
				limit = config.APILimit
			}
		}

		// 使用 IP 地址作为限流键
		key := "api:" + c.ClientIP()

		// 使用 Redis 分布式限流（失败时自动降级到内存）
		if !checkRateLimitWithRedis(c.Request.Context(), redisClient, key, limit, time.Minute) {
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

// =========================================================================
// 兼容旧接口（用于不需要 Redis 的场景）
// =========================================================================

// RateLimiter 内存速率限制器（保留用于兼容）
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

// NewRateLimiter 创建内存速率限制器
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

// Allow 检查是否允许请求
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

// RateLimitMiddleware 通用速率限制中间件（内存版本）
func RateLimitMiddleware(limiter *RateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
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
