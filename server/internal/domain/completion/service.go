package completion

import (
	"log"
	"strings"
	"sync"
	"time"

	"github.com/easyssh/server/internal/domain/script"
	"github.com/google/uuid"
	"golang.org/x/crypto/ssh"
)

const (
	defaultCacheTTLMinutes = 5
	defaultMaxCacheSize    = 1000
	defaultHistoryLimit    = 500
)

// ScriptItem 脚本项（用于补全）
type ScriptItem struct {
	Name        string   `json:"name"`    // 脚本名称（用于显示）
	Content     string   `json:"content"` // 脚本内容（实际命令，用于补全匹配）
	Description string   `json:"description"`
	Executions  int      `json:"executions"`
	Tags        []string `json:"tags"`
}

// CompletionData 补全数据
type CompletionData struct {
	History   []string     `json:"history"`
	Scripts   []ScriptItem `json:"scripts"`
	Timestamp int64        `json:"timestamp"`
}

// FetchOptions 拉取补全数据选项
type FetchOptions struct {
	HistoryLimit   int
	IncludeHistory bool
	IncludeScripts bool
}

// Service 补全服务接口
type Service interface {
	FetchCompletionData(client *ssh.Client, userID uuid.UUID, serverID uuid.UUID, opts FetchOptions) (*CompletionData, error)
	UpdateCacheConfig(cacheTTLMinutes int, maxCacheSize int)
	AppendHistoryCommand(userID uuid.UUID, serverID uuid.UUID, command string)
	ClearCache(userID uuid.UUID, serverID uuid.UUID)
	ClearUserCache(userID uuid.UUID)
	ClearAllCache()
}

// cacheKey 缓存键（用户ID + 服务器ID）
type cacheKey struct {
	userID         uuid.UUID
	serverID       uuid.UUID
	historyLimit   int
	includeHistory bool
	includeScripts bool
}

// cacheEntry 缓存条目
type cacheEntry struct {
	data      *CompletionData
	timestamp time.Time
	lastUsed  time.Time // 最后使用时间（用于LRU淘汰）
}

type service struct {
	scriptRepo   script.Repository
	cache        map[cacheKey]*cacheEntry // 按 (userID, serverID, fetch options) 缓存
	cacheMutex   sync.RWMutex
	cacheTTL     time.Duration
	maxCacheSize int // 最大缓存条目数
}

// NewService 创建补全服务
// cacheTTLMinutes: 缓存TTL（分钟），0表示使用默认值5分钟
// maxCacheSize: 最大缓存条目数，0表示使用默认值1000
func NewService(scriptRepo script.Repository, cacheTTLMinutes int, maxCacheSize int) Service {
	// 使用默认值
	if cacheTTLMinutes <= 0 {
		cacheTTLMinutes = defaultCacheTTLMinutes
	}
	if maxCacheSize <= 0 {
		maxCacheSize = defaultMaxCacheSize
	}

	s := &service{
		scriptRepo:   scriptRepo,
		cache:        make(map[cacheKey]*cacheEntry),
		cacheTTL:     time.Duration(cacheTTLMinutes) * time.Minute,
		maxCacheSize: maxCacheSize,
	}

	// 启动缓存清理goroutine
	go s.cleanupCache()

	log.Printf("Completion service initialized with cache TTL: %d minutes, max size: %d", cacheTTLMinutes, maxCacheSize)

	return s
}

// cleanupCache 定期清理过期缓存
func (s *service) cleanupCache() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		s.cacheMutex.Lock()
		now := time.Now()
		expiredCount := 0
		for key, entry := range s.cache {
			if now.Sub(entry.timestamp) > s.cacheTTL {
				delete(s.cache, key)
				expiredCount++
			}
		}
		if expiredCount > 0 {
			log.Printf("Cleaned up %d expired cache entries (current size: %d/%d)", expiredCount, len(s.cache), s.maxCacheSize)
		}
		s.cacheMutex.Unlock()
	}
}

// FetchCompletionData 获取补全数据
func normalizeFetchOptions(opts FetchOptions) FetchOptions {
	if opts.IncludeHistory && opts.HistoryLimit <= 0 {
		opts.HistoryLimit = defaultHistoryLimit
	}
	if !opts.IncludeHistory {
		opts.HistoryLimit = 0
	}
	return opts
}

// UpdateCacheConfig 运行时更新缓存配置
func (s *service) UpdateCacheConfig(cacheTTLMinutes int, maxCacheSize int) {
	if cacheTTLMinutes <= 0 {
		cacheTTLMinutes = defaultCacheTTLMinutes
	}
	if maxCacheSize <= 0 {
		maxCacheSize = defaultMaxCacheSize
	}

	newTTL := time.Duration(cacheTTLMinutes) * time.Minute

	s.cacheMutex.Lock()
	defer s.cacheMutex.Unlock()

	changed := false
	if s.cacheTTL != newTTL {
		s.cacheTTL = newTTL
		changed = true
	}
	if s.maxCacheSize != maxCacheSize {
		s.maxCacheSize = maxCacheSize
		changed = true
	}

	// 若最大容量变小，立即执行 LRU 淘汰
	for len(s.cache) > s.maxCacheSize {
		var oldestKey cacheKey
		var oldestTime time.Time
		first := true

		for k, entry := range s.cache {
			if first || entry.lastUsed.Before(oldestTime) {
				oldestKey = k
				oldestTime = entry.lastUsed
				first = false
			}
		}

		if first {
			break
		}
		delete(s.cache, oldestKey)
	}

	if changed {
		log.Printf("Updated completion cache config: ttl=%dmin, max_size=%d (current cache size: %d)",
			cacheTTLMinutes, maxCacheSize, len(s.cache))
	}
}

func (s *service) FetchCompletionData(client *ssh.Client, userID uuid.UUID, serverID uuid.UUID, opts FetchOptions) (*CompletionData, error) {
	opts = normalizeFetchOptions(opts)

	// 1. 尝试从缓存获取
	key := cacheKey{
		userID:         userID,
		serverID:       serverID,
		historyLimit:   opts.HistoryLimit,
		includeHistory: opts.IncludeHistory,
		includeScripts: opts.IncludeScripts,
	}

	s.cacheMutex.Lock()
	if entry, exists := s.cache[key]; exists {
		if time.Since(entry.timestamp) < s.cacheTTL {
			// 更新最后使用时间（LRU）
			entry.lastUsed = time.Now()
			s.cacheMutex.Unlock()
			log.Printf("Cache hit for user: %s, server: %s (age: %v)", userID, serverID, time.Since(entry.timestamp))
			return entry.data, nil
		}
	}
	s.cacheMutex.Unlock()

	log.Printf("Cache miss for user: %s, server: %s, fetching fresh data", userID, serverID)

	history := []string{}
	if opts.IncludeHistory {
		// 2. 检测Shell类型
		shellType, err := DetectShellType(client)
		if err != nil {
			log.Printf("Failed to detect shell type: %v", err)
			shellType = ShellBash // 默认bash
		}

		log.Printf("Detected shell type: %s", shellType)

		// 3. 获取历史命令
		history, err = FetchHistory(client, shellType, opts.HistoryLimit)
		if err != nil {
			log.Printf("Failed to fetch history: %v", err)
			history = []string{} // 失败时返回空数组
		}

		log.Printf("Fetched %d history commands", len(history))
	}

	// 4. 获取脚本库
	scripts := []ScriptItem{}
	if opts.IncludeScripts {
		scriptList, _, err := s.scriptRepo.List(userID, &script.ListScriptsRequest{
			Page:      1,
			Limit:     100,  // 最多获取100个脚本
			SkipCount: true, // 补全场景不需要统计总数
		})
		if err != nil {
			log.Printf("Failed to fetch scripts: %v", err)
		} else {
			for _, sc := range scriptList {
				scripts = append(scripts, ScriptItem{
					Name:        sc.Name,
					Content:     sc.Content, // 使用 content 字段作为补全匹配文本
					Description: sc.Description,
					Executions:  sc.Executions,
					Tags:        sc.Tags,
				})
			}
		}

		log.Printf("Fetched %d scripts", len(scripts))
	}

	// 5. 构建补全数据
	data := &CompletionData{
		History:   history,
		Scripts:   scripts,
		Timestamp: 0, // 时间戳由调用方设置
	}

	// 6. 写入缓存
	s.cacheMutex.Lock()

	// 检查是否超过最大缓存大小
	if len(s.cache) >= s.maxCacheSize {
		// 执行LRU淘汰：找到最久未使用的条目
		var oldestKey cacheKey
		var oldestTime time.Time
		first := true

		for k, entry := range s.cache {
			if first || entry.lastUsed.Before(oldestTime) {
				oldestKey = k
				oldestTime = entry.lastUsed
				first = false
			}
		}

		// 删除最久未使用的条目
		delete(s.cache, oldestKey)
		log.Printf("Cache full, evicted LRU entry for user: %s, server: %s (last used: %v ago)",
			oldestKey.userID, oldestKey.serverID, time.Since(oldestTime))
	}

	now := time.Now()
	s.cache[key] = &cacheEntry{
		data:      data,
		timestamp: now,
		lastUsed:  now,
	}
	s.cacheMutex.Unlock()

	log.Printf("Cached completion data for user: %s, server: %s (cache size: %d/%d)",
		userID, serverID, len(s.cache), s.maxCacheSize)

	return data, nil
}

// AppendHistoryCommand 增量更新指定用户/服务器的历史命令缓存
func (s *service) AppendHistoryCommand(userID uuid.UUID, serverID uuid.UUID, command string) {
	trimmed := strings.TrimSpace(command)
	if trimmed == "" {
		return
	}

	s.cacheMutex.Lock()
	defer s.cacheMutex.Unlock()

	updated := 0
	now := time.Now()

	for key, entry := range s.cache {
		if key.userID != userID || key.serverID != serverID || !key.includeHistory || entry.data == nil {
			continue
		}

		// 去重后将最新命令置顶，保证远端历史在补全中的时效性
		nextHistory := make([]string, 0, len(entry.data.History)+1)
		nextHistory = append(nextHistory, trimmed)
		for _, existing := range entry.data.History {
			if existing == trimmed {
				continue
			}
			nextHistory = append(nextHistory, existing)
		}

		if key.historyLimit > 0 && len(nextHistory) > key.historyLimit {
			nextHistory = nextHistory[:key.historyLimit]
		}

		entry.data.History = nextHistory
		entry.timestamp = now
		entry.lastUsed = now
		updated++
	}

	if updated > 0 {
		log.Printf("Applied completion history update for user: %s, server: %s (updated cache entries: %d)", userID, serverID, updated)
	}
}

// ClearCache 清除指定用户和服务器的缓存
func (s *service) ClearCache(userID uuid.UUID, serverID uuid.UUID) {
	s.cacheMutex.Lock()
	defer s.cacheMutex.Unlock()
	count := 0
	for key := range s.cache {
		if key.userID == userID && key.serverID == serverID {
			delete(s.cache, key)
			count++
		}
	}
	log.Printf("Cleared %d cache entries for user: %s, server: %s", count, userID, serverID)
}

// ClearUserCache 清除指定用户的所有缓存
func (s *service) ClearUserCache(userID uuid.UUID) {
	s.cacheMutex.Lock()
	defer s.cacheMutex.Unlock()
	count := 0
	for key := range s.cache {
		if key.userID == userID {
			delete(s.cache, key)
			count++
		}
	}
	log.Printf("Cleared %d cache entries for user: %s", count, userID)
}

// ClearAllCache 清除所有缓存
func (s *service) ClearAllCache() {
	s.cacheMutex.Lock()
	defer s.cacheMutex.Unlock()
	s.cache = make(map[cacheKey]*cacheEntry)
	log.Printf("Cleared all completion cache")
}
