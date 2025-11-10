package settings

import (
	"context"
	"sync"
	"time"
)

// ConfigManager 配置管理器，提供带缓存的配置读取功能
type ConfigManager struct {
	service   Service
	cache     map[string]*cacheEntry
	cacheMu   sync.RWMutex
	cacheTTL  time.Duration
}

// SetService 设置 service（用于解决循环依赖）
func (m *ConfigManager) SetService(service Service) {
	m.service = service
}

// cacheEntry 缓存条目
type cacheEntry struct {
	value      interface{}
	expireTime time.Time
}

// NewConfigManager 创建配置管理器
func NewConfigManager(service Service, cacheTTL time.Duration) *ConfigManager {
	if cacheTTL == 0 {
		cacheTTL = 5 * time.Minute // 默认缓存 5 分钟
	}

	return &ConfigManager{
		service:  service,
		cache:    make(map[string]*cacheEntry),
		cacheTTL: cacheTTL,
	}
}

// getFromCache 从缓存获取配置
func (m *ConfigManager) getFromCache(key string) (interface{}, bool) {
	m.cacheMu.RLock()
	defer m.cacheMu.RUnlock()

	entry, exists := m.cache[key]
	if !exists {
		return nil, false
	}

	// 检查是否过期
	if time.Now().After(entry.expireTime) {
		return nil, false
	}

	return entry.value, true
}

// setToCache 设置缓存
func (m *ConfigManager) setToCache(key string, value interface{}) {
	m.cacheMu.Lock()
	defer m.cacheMu.Unlock()

	m.cache[key] = &cacheEntry{
		value:      value,
		expireTime: time.Now().Add(m.cacheTTL),
	}
}

// InvalidateCache 清除指定配置的缓存
func (m *ConfigManager) InvalidateCache(key string) {
	m.cacheMu.Lock()
	defer m.cacheMu.Unlock()

	delete(m.cache, key)
}

// InvalidateAllCache 清除所有缓存
func (m *ConfigManager) InvalidateAllCache() {
	m.cacheMu.Lock()
	defer m.cacheMu.Unlock()

	m.cache = make(map[string]*cacheEntry)
}

// GetCORSConfig 获取 CORS 配置（带缓存）
func (m *ConfigManager) GetCORSConfig(ctx context.Context) (*CORSConfig, error) {
	const cacheKey = "cors_config"

	if cached, found := m.getFromCache(cacheKey); found {
		return cached.(*CORSConfig), nil
	}

	config, err := m.service.GetCORSConfig(ctx)
	if err != nil {
		return nil, err
	}

	m.setToCache(cacheKey, config)
	return config, nil
}

// GetRateLimitConfig 获取速率限制配置（带缓存）
func (m *ConfigManager) GetRateLimitConfig(ctx context.Context) (*RateLimitConfig, error) {
	const cacheKey = "rate_limit_config"

	if cached, found := m.getFromCache(cacheKey); found {
		return cached.(*RateLimitConfig), nil
	}

	config, err := m.service.GetRateLimitConfig(ctx)
	if err != nil {
		return nil, err
	}

	m.setToCache(cacheKey, config)
	return config, nil
}

// GetCookieConfig 获取 Cookie 配置（带缓存）
func (m *ConfigManager) GetCookieConfig(ctx context.Context) (*CookieConfig, error) {
	const cacheKey = "cookie_config"

	if cached, found := m.getFromCache(cacheKey); found {
		return cached.(*CookieConfig), nil
	}

	config, err := m.service.GetCookieConfig(ctx)
	if err != nil {
		return nil, err
	}

	m.setToCache(cacheKey, config)
	return config, nil
}
