package monitor

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/easyssh/server/internal/domain/server"
	sshDomain "github.com/easyssh/server/internal/domain/ssh"
	"github.com/easyssh/server/internal/pkg/crypto"
	"github.com/google/uuid"
)

// PooledConnection 池化的监控连接
type PooledConnection struct {
	Client       *sshDomain.Client // SSH 客户端
	RefCount     int               // 引用计数（多少个监控 WebSocket 在使用）
	ServerID     string            // 服务器 ID
	UserID       string            // 用户 ID
	CreatedAt    time.Time         // 创建时间
	LastUsedAt   time.Time         // 最后使用时间
	mu           sync.RWMutex      // 连接级别的锁
}

// IncRef 增加引用计数
func (pc *PooledConnection) IncRef() {
	pc.mu.Lock()
	defer pc.mu.Unlock()
	pc.RefCount++
	pc.LastUsedAt = time.Now()
}

// DecRef 减少引用计数，返回新的引用计数
func (pc *PooledConnection) DecRef() int {
	pc.mu.Lock()
	defer pc.mu.Unlock()
	pc.RefCount--
	if pc.RefCount < 0 {
		pc.RefCount = 0
	}
	pc.LastUsedAt = time.Now()
	return pc.RefCount
}

// GetRefCount 获取当前引用计数
func (pc *PooledConnection) GetRefCount() int {
	pc.mu.RLock()
	defer pc.mu.RUnlock()
	return pc.RefCount
}

// IsHealthy 检查连接是否健康
func (pc *PooledConnection) IsHealthy() bool {
	pc.mu.RLock()
	defer pc.mu.RUnlock()

	if pc.Client == nil {
		return false
	}

	// 检查连接是否活跃
	return pc.Client.IsConnected()
}

// ConnectionPool 监控专用连接池
type ConnectionPool struct {
	connections        map[string]*PooledConnection // key: userID:serverID
	mu                 sync.RWMutex
	serverService      server.Service // 服务器服务，用于获取服务器配置
	encryptor          *crypto.Encryptor
	connectionTimeout  time.Duration  // 连接超时时间
}

// NewConnectionPool 创建监控连接池
func NewConnectionPool(serverService server.Service, encryptor *crypto.Encryptor) *ConnectionPool {
	return &ConnectionPool{
		connections:       make(map[string]*PooledConnection),
		serverService:     serverService,
		encryptor:         encryptor,
		connectionTimeout: 30 * time.Second, // 默认30秒超时
	}
}

// SetConnectionTimeout 设置连接超时时间
func (p *ConnectionPool) SetConnectionTimeout(timeout time.Duration) {
	p.connectionTimeout = timeout
}

// getKey 生成连接池键
func (p *ConnectionPool) getKey(userID, serverID string) string {
	return fmt.Sprintf("%s:%s", userID, serverID)
}

// GetOrCreate 获取或创建连接（增加引用计数）
func (p *ConnectionPool) GetOrCreate(userID, serverID string) (*PooledConnection, error) {
	key := p.getKey(userID, serverID)

	// 先尝试获取已存在的连接
	p.mu.RLock()
	if conn, exists := p.connections[key]; exists {
		p.mu.RUnlock()

		// 检查连接是否健康
		if conn.IsHealthy() {
			conn.IncRef()
			log.Printf("[ConnectionPool] 复用现有连接: key=%s, refCount=%d", key, conn.GetRefCount())
			return conn, nil
		}

		// 连接不健康，需要移除并重新创建
		log.Printf("[ConnectionPool] 连接不健康，移除: key=%s", key)
		p.mu.Lock()
		delete(p.connections, key)
		p.mu.Unlock()
	} else {
		p.mu.RUnlock()
	}

	// 创建新连接（需要写锁）
	p.mu.Lock()
	defer p.mu.Unlock()

	// 双重检查（可能在等待锁期间已被其他 goroutine 创建）
	if conn, exists := p.connections[key]; exists {
		if conn.IsHealthy() {
			conn.IncRef()
			log.Printf("[ConnectionPool] 复用刚创建的连接: key=%s, refCount=%d", key, conn.GetRefCount())
			return conn, nil
		}
		delete(p.connections, key)
	}

	// 从数据库获取服务器配置
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user id: %w", err)
	}

	serverUUID, err := uuid.Parse(serverID)
	if err != nil {
		return nil, fmt.Errorf("invalid server id: %w", err)
	}

	srv, err := p.serverService.GetByID(nil, userUUID, serverUUID)
	if err != nil {
		return nil, fmt.Errorf("failed to get server config: %w", err)
	}

	// 使用带超时的上下文创建连接
	ctx, cancel := context.WithTimeout(context.Background(), p.connectionTimeout)
	defer cancel()

	// 在 goroutine 中执行连接操作
	type result struct {
		conn *PooledConnection
		err  error
	}
	resultChan := make(chan result, 1)

	go func() {
		// 创建 SSH 客户端（连接池使用不安全模式以避免阻塞）
		client, err := sshDomain.NewClient(srv, p.encryptor, nil)
		if err != nil {
			resultChan <- result{nil, fmt.Errorf("failed to create ssh client: %w", err)}
			return
		}

		// 连接到服务器
		if err := client.Connect(srv.Host, srv.Port); err != nil {
			resultChan <- result{nil, fmt.Errorf("failed to connect to server: %w", err)}
			return
		}

		// 创建池化连接
		pooledConn := &PooledConnection{
			Client:     client,
			RefCount:   1, // 初始引用计数为 1
			ServerID:   serverID,
			UserID:     userID,
			CreatedAt:  time.Now(),
			LastUsedAt: time.Now(),
		}

		resultChan <- result{pooledConn, nil}
	}()

	// 等待连接完成或超时
	select {
	case <-ctx.Done():
		log.Printf("[ConnectionPool] 连接超时: key=%s, timeout=%v", key, p.connectionTimeout)
		return nil, fmt.Errorf("connection timeout after %v", p.connectionTimeout)
	case res := <-resultChan:
		if res.err != nil {
			return nil, res.err
		}

		p.connections[key] = res.conn
		log.Printf("[ConnectionPool] 创建新连接: key=%s, serverHost=%s:%d", key, srv.Host, srv.Port)
		return res.conn, nil
	}
}

// Release 释放连接（减少引用计数，归零时立即关闭）
func (p *ConnectionPool) Release(userID, serverID string) {
	key := p.getKey(userID, serverID)

	p.mu.Lock()
	defer p.mu.Unlock()

	conn, exists := p.connections[key]
	if !exists {
		log.Printf("[ConnectionPool] 释放连接失败，连接不存在: key=%s", key)
		return
	}

	newRefCount := conn.DecRef()
	log.Printf("[ConnectionPool] 释放连接: key=%s, refCount=%d", key, newRefCount)

	// 引用计数归零，立即关闭连接
	if newRefCount == 0 {
		log.Printf("[ConnectionPool] 引用计数归零，立即关闭连接: key=%s", key)
		if conn.Client != nil {
			conn.Client.Close()
		}
		delete(p.connections, key)
	}
}

// ForceClose 强制关闭连接（无视引用计数）
func (p *ConnectionPool) ForceClose(userID, serverID string) error {
	key := p.getKey(userID, serverID)

	p.mu.Lock()
	defer p.mu.Unlock()

	conn, exists := p.connections[key]
	if !exists {
		return fmt.Errorf("connection not found: %s", key)
	}

	// 关闭 SSH 连接
	if conn.Client != nil {
		conn.Client.Close()
	}

	delete(p.connections, key)
	log.Printf("[ConnectionPool] 强制关闭连接: key=%s", key)

	return nil
}

// GetStats 获取连接池统计信息
func (p *ConnectionPool) GetStats() map[string]interface{} {
	p.mu.RLock()
	defer p.mu.RUnlock()

	totalConnections := len(p.connections)
	activeConnections := 0
	idleConnections := 0

	for _, conn := range p.connections {
		if conn.GetRefCount() > 0 {
			activeConnections++
		} else {
			idleConnections++
		}
	}

	return map[string]interface{}{
		"total_connections":  totalConnections,
		"active_connections": activeConnections,
		"idle_connections":   idleConnections,
	}
}

// GetAllConnections 获取所有连接信息（用于调试）
func (p *ConnectionPool) GetAllConnections() []map[string]interface{} {
	p.mu.RLock()
	defer p.mu.RUnlock()

	result := make([]map[string]interface{}, 0, len(p.connections))
	for key, conn := range p.connections {
		result = append(result, map[string]interface{}{
			"key":           key,
			"server_id":     conn.ServerID,
			"user_id":       conn.UserID,
			"ref_count":     conn.GetRefCount(),
			"created_at":    conn.CreatedAt,
			"last_used_at":  conn.LastUsedAt,
			"is_healthy":    conn.IsHealthy(),
		})
	}

	return result
}

// Close 关闭连接池（关闭所有连接）
func (p *ConnectionPool) Close() {
	log.Println("[ConnectionPool] 关闭连接池")

	p.mu.Lock()
	defer p.mu.Unlock()

	// 关闭所有连接
	for key, conn := range p.connections {
		log.Printf("[ConnectionPool] 关闭连接: key=%s", key)
		if conn.Client != nil {
			conn.Client.Close()
		}
	}

	// 清空连接池
	p.connections = make(map[string]*PooledConnection)
}
