package monitor

import (
	"log"
	"sync"
	"time"

	pb "github.com/easyssh/server/internal/proto"
)

// MetricsSubscriber 指标订阅者接口
type MetricsSubscriber interface {
	// OnMetrics 收到新指标时调用
	OnMetrics(metrics *pb.SystemMetrics)
	// ID 返回订阅者唯一标识
	ID() string
}

// SharedCollector 共享采集器（同一 serverID 的所有连接共享）
type SharedCollector struct {
	serverID    string
	collector   *Collector
	subscribers map[string]MetricsSubscriber
	interval    time.Duration
	lastMetrics *pb.SystemMetrics
	stopCh      chan struct{}
	mu          sync.RWMutex
	running     bool
}

// newSharedCollector 创建共享采集器
func newSharedCollector(serverID string, collector *Collector, interval time.Duration) *SharedCollector {
	return &SharedCollector{
		serverID:    serverID,
		collector:   collector,
		subscribers: make(map[string]MetricsSubscriber),
		interval:    interval,
		stopCh:      make(chan struct{}),
	}
}

// Subscribe 添加订阅者
func (sc *SharedCollector) Subscribe(sub MetricsSubscriber) {
	subID := sub.ID()

	sc.mu.Lock()
	sc.subscribers[subID] = sub
	lastMetrics := sc.lastMetrics
	total := len(sc.subscribers)
	sc.mu.Unlock()

	log.Printf("[SharedCollector] 添加订阅者: serverID=%s, subID=%s, total=%d", sc.serverID, subID, total)

	if lastMetrics != nil {
		go sub.OnMetrics(lastMetrics)
	}
}

// Unsubscribe 移除订阅者
func (sc *SharedCollector) Unsubscribe(subID string) {
	sc.mu.Lock()
	defer sc.mu.Unlock()
	delete(sc.subscribers, subID)
	log.Printf("[SharedCollector] 移除订阅者: serverID=%s, subID=%s, remaining=%d", sc.serverID, subID, len(sc.subscribers))
}

// SubscriberCount 获取订阅者数量
func (sc *SharedCollector) SubscriberCount() int {
	sc.mu.RLock()
	defer sc.mu.RUnlock()
	return len(sc.subscribers)
}

// Start 启动采集循环
func (sc *SharedCollector) Start() {
	sc.mu.Lock()
	if sc.running {
		sc.mu.Unlock()
		return
	}
	sc.running = true
	sc.mu.Unlock()

	log.Printf("[SharedCollector] 启动采集循环: serverID=%s, interval=%v", sc.serverID, sc.interval)

	go func() {
		// 立即采集一次
		sc.collectAndBroadcast()

		ticker := time.NewTicker(sc.interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				sc.collectAndBroadcast()
			case <-sc.stopCh:
				log.Printf("[SharedCollector] 停止采集循环: serverID=%s", sc.serverID)
				return
			}
		}
	}()
}

// Stop 停止采集循环
func (sc *SharedCollector) Stop() {
	sc.mu.Lock()
	if !sc.running {
		sc.mu.Unlock()
		return
	}
	sc.running = false
	sc.mu.Unlock()

	close(sc.stopCh)
}

// collectAndBroadcast 采集并广播数据
func (sc *SharedCollector) collectAndBroadcast() {
	metrics, err := sc.collector.Collect()
	if err != nil {
		log.Printf("[SharedCollector] 采集失败: serverID=%s, err=%v", sc.serverID, err)
		return
	}

	sc.mu.Lock()
	sc.lastMetrics = metrics
	subscribers := make([]MetricsSubscriber, 0, len(sc.subscribers))
	for _, sub := range sc.subscribers {
		subscribers = append(subscribers, sub)
	}
	sc.mu.Unlock()

	// 广播给所有订阅者
	for _, sub := range subscribers {
		sub.OnMetrics(metrics)
	}
}

// SharedCollectorManager 共享采集器管理器
type SharedCollectorManager struct {
	collectors map[string]*SharedCollector // key: serverID
	mu         sync.RWMutex
}

// NewSharedCollectorManager 创建共享采集器管理器
func NewSharedCollectorManager() *SharedCollectorManager {
	return &SharedCollectorManager{
		collectors: make(map[string]*SharedCollector),
	}
}

// CollectorFactory 采集器工厂函数类型
type CollectorFactory func() *Collector

// GetOrCreate 获取或创建共享采集器，并添加订阅者
// collectorFactory 仅在需要创建新采集器时才会被调用，避免不必要的 Collector 实例创建
func (m *SharedCollectorManager) GetOrCreate(
	serverID string,
	collectorFactory CollectorFactory,
	interval time.Duration,
	subscriber MetricsSubscriber,
) *SharedCollector {
	m.mu.Lock()
	defer m.mu.Unlock()

	sc, exists := m.collectors[serverID]
	if !exists {
		// 仅在需要时才调用工厂函数创建 Collector
		collector := collectorFactory()
		sc = newSharedCollector(serverID, collector, interval)
		m.collectors[serverID] = sc
		sc.Subscribe(subscriber)
		sc.Start()
		log.Printf("[SharedCollectorManager] 创建共享采集器: serverID=%s", serverID)
		return sc
	}

	sc.Subscribe(subscriber)
	return sc
}

// Unsubscribe 取消订阅，如果没有订阅者则停止并移除采集器
func (m *SharedCollectorManager) Unsubscribe(serverID string, subID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	sc, exists := m.collectors[serverID]
	if !exists {
		return
	}

	sc.Unsubscribe(subID)

	// 没有订阅者时停止并移除采集器
	if sc.SubscriberCount() == 0 {
		sc.Stop()
		delete(m.collectors, serverID)
		log.Printf("[SharedCollectorManager] 移除共享采集器: serverID=%s", serverID)
	}
}

// GetStats 获取统计信息
func (m *SharedCollectorManager) GetStats() map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	collectors := make([]map[string]interface{}, 0, len(m.collectors))
	for serverID, sc := range m.collectors {
		collectors = append(collectors, map[string]interface{}{
			"server_id":        serverID,
			"subscriber_count": sc.SubscriberCount(),
		})
	}

	return map[string]interface{}{
		"total_collectors": len(m.collectors),
		"collectors":       collectors,
	}
}

// Close 关闭所有采集器
func (m *SharedCollectorManager) Close() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for serverID, sc := range m.collectors {
		sc.Stop()
		log.Printf("[SharedCollectorManager] 关闭采集器: serverID=%s", serverID)
	}

	m.collectors = make(map[string]*SharedCollector)
}
