package ttlcache

import (
	"sync"
	"time"
)

type item[T any] struct {
	value     T
	expiresAt time.Time
}

// Cache 是轻量级进程内 TTL 存储，用于单实例部署下的短期状态。
type Cache[T any] struct {
	mu    sync.Mutex
	items map[string]item[T]
}

func New[T any](cleanupInterval time.Duration) *Cache[T] {
	c := &Cache[T]{
		items: make(map[string]item[T]),
	}
	if cleanupInterval <= 0 {
		cleanupInterval = time.Minute
	}
	go c.cleanupLoop(cleanupInterval)
	return c
}

func (c *Cache[T]) Set(key string, value T, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	var expiresAt time.Time
	if ttl > 0 {
		expiresAt = time.Now().Add(ttl)
	}
	c.items[key] = item[T]{
		value:     value,
		expiresAt: expiresAt,
	}
}

func (c *Cache[T]) Get(key string) (T, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.getLocked(key)
}

func (c *Cache[T]) Consume(key string) (T, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	value, ok := c.getLocked(key)
	if ok {
		delete(c.items, key)
	}
	return value, ok
}

func (c *Cache[T]) Delete(keys ...string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	for _, key := range keys {
		delete(c.items, key)
	}
}

func (c *Cache[T]) Exists(key string) bool {
	_, ok := c.Get(key)
	return ok
}

func (c *Cache[T]) getLocked(key string) (T, bool) {
	var zero T
	rec, ok := c.items[key]
	if !ok {
		return zero, false
	}
	if !rec.expiresAt.IsZero() && time.Now().After(rec.expiresAt) {
		delete(c.items, key)
		return zero, false
	}
	return rec.value, true
}

func (c *Cache[T]) cleanupLoop(interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for range ticker.C {
		c.mu.Lock()
		now := time.Now()
		for key, rec := range c.items {
			if !rec.expiresAt.IsZero() && now.After(rec.expiresAt) {
				delete(c.items, key)
			}
		}
		c.mu.Unlock()
	}
}
