package sftp

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/easyssh/server/internal/domain/server"
	sshDomain "github.com/easyssh/server/internal/domain/ssh"
	"github.com/easyssh/server/internal/pkg/crypto"
	"github.com/easyssh/server/internal/pkg/logger"
	"github.com/google/uuid"
	"golang.org/x/crypto/ssh"
)

// PooledClient 单次请求的 SFTP 客户端（底层 SSH 来自池）
type PooledClient struct {
	*Client
	pool     *Pool
	key      string
	userID   uuid.UUID
	serverID uuid.UUID
	sshConn  *pooledSSHConn

	permitAcquired bool
	releaseOnce    sync.Once
}

// Release 释放本次 SFTP 会话，并归还 SSH 引用
func (pc *PooledClient) Release() {
	pc.releaseOnce.Do(func() {
		if pc.Client != nil {
			_ = pc.Client.CloseSFTP()
		}
		if pc.pool != nil && pc.permitAcquired {
			pc.pool.releasePermit(pc.key)
		}
		if pc.pool != nil && pc.sshConn != nil {
			pc.pool.releaseSSH(pc.key, pc.sshConn)
		}
	})
}

// Close 强制关闭底层 SSH 并从池中移除
func (pc *PooledClient) Close() error {
	pc.Release()
	if pc.pool != nil && pc.sshConn != nil {
		pc.pool.forceRemoveSSH(pc.key, pc.sshConn)
	}
	return nil
}

// IsHealthy 检查底层 SSH 是否健康
func (pc *PooledClient) IsHealthy() bool {
	if pc.sshConn == nil {
		return false
	}
	return pc.sshConn.IsHealthy()
}

// DeleteDirectory 直接删除目录
func (pc *PooledClient) DeleteDirectory(path string) error {
	if pc.Client == nil {
		return fmt.Errorf("sftp client not initialized")
	}
	return pc.Client.DeleteDirectory(path)
}

// DeleteFile 直接删除文件
func (pc *PooledClient) DeleteFile(path string) error {
	if pc.Client == nil {
		return fmt.Errorf("sftp client not initialized")
	}
	return pc.Client.DeleteFile(path)
}

// pooledSSHConn 池化的 SSH 连接
type pooledSSHConn struct {
	Client     *sshDomain.Client
	refCount   int
	createdAt  time.Time
	lastUsedAt time.Time
	closing    bool
	lifeWarned bool
	mu         sync.RWMutex
}

func (sc *pooledSSHConn) IncRef() {
	sc.mu.Lock()
	defer sc.mu.Unlock()
	sc.refCount++
	sc.lastUsedAt = time.Now()
}

func (sc *pooledSSHConn) DecRef() int {
	sc.mu.Lock()
	defer sc.mu.Unlock()
	sc.refCount--
	if sc.refCount < 0 {
		sc.refCount = 0
	}
	sc.lastUsedAt = time.Now()
	return sc.refCount
}

func (sc *pooledSSHConn) GetRefCount() int {
	sc.mu.RLock()
	defer sc.mu.RUnlock()
	return sc.refCount
}

func (sc *pooledSSHConn) IsHealthy() bool {
	sc.mu.RLock()
	defer sc.mu.RUnlock()
	return !sc.closing && sc.Client != nil && sc.Client.IsConnected()
}

func (sc *pooledSSHConn) MarkClosing() {
	sc.mu.Lock()
	defer sc.mu.Unlock()
	sc.closing = true
}

func (sc *pooledSSHConn) IsClosing() bool {
	sc.mu.RLock()
	defer sc.mu.RUnlock()
	return sc.closing
}

// Pool SFTP 连接池（引用计数模式）
type Pool struct {
	mu              sync.RWMutex
	connections     map[string]*pooledSSHConn // key -> SSH 连接
	encryptor       *crypto.Encryptor
	hostKeyCallback ssh.HostKeyCallback
	serverService   server.Service
	serverRepo      server.Repository
	connTimeout     time.Duration // 连接超时时间
	log             *logger.Logger

	maxIdleTime     time.Duration
	cleanupInterval time.Duration
	maxLifeTime     time.Duration
	maxSftpSessions int
	semaphores      map[string]chan struct{}

	stopCh   chan struct{}
	stopped  chan struct{}
	stopOnce sync.Once
}

// NewPool 创建新的连接池
func NewPool(
	config *PoolConfig,
	encryptor *crypto.Encryptor,
	hostKeyCallback ssh.HostKeyCallback,
	serverService server.Service,
	serverRepo server.Repository,
) *Pool {
	if config == nil {
		config = DefaultPoolConfig()
	}

	maxIdle := config.MaxIdleTime
	if maxIdle <= 0 {
		maxIdle = 2 * time.Minute
	}
	cleanupInterval := config.CleanupInterval
	if cleanupInterval <= 0 {
		cleanupInterval = 30 * time.Second
	}
	connTimeout := config.ConnTimeout
	if connTimeout <= 0 {
		connTimeout = 10 * time.Second
	}
	maxSftpSessions := config.MaxSFTPSessionsPerConn
	if maxSftpSessions < 0 {
		maxSftpSessions = 0
	}

	p := &Pool{
		connections:     make(map[string]*pooledSSHConn),
		encryptor:       encryptor,
		hostKeyCallback: hostKeyCallback,
		serverService:   serverService,
		serverRepo:      serverRepo,
		connTimeout:     connTimeout,
		log:             logger.NewModule("SFTP Pool"),
		maxIdleTime:     maxIdle,
		cleanupInterval: cleanupInterval,
		maxLifeTime:     config.MaxLifeTime,
		maxSftpSessions: maxSftpSessions,
		semaphores:      make(map[string]chan struct{}),
		stopCh:          make(chan struct{}),
		stopped:         make(chan struct{}),
	}

	go p.cleanupLoop()
	return p
}

// PoolConfig 连接池配置
type PoolConfig struct {
	MaxIdleTime            time.Duration
	CleanupInterval        time.Duration
	MaxLifeTime            time.Duration // 连接最大寿命（可选）
	ConnTimeout            time.Duration // SSH 连接超时（可选）
	MaxSFTPSessionsPerConn int           // 单条 SSH 上最大并发 SFTP 会话数（0 表示不限制）
}

// DefaultPoolConfig 返回默认配置
func DefaultPoolConfig() *PoolConfig {
	return &PoolConfig{
		MaxIdleTime:            2 * time.Minute,
		CleanupInterval:        30 * time.Second,
		ConnTimeout:            10 * time.Second,
		MaxSFTPSessionsPerConn: 8,
	}
}

// makeKey 生成连接唯一标识
func makeKey(userID, serverID uuid.UUID) string {
	return fmt.Sprintf("%s:%s", userID.String(), serverID.String())
}

// Get 获取一次 SFTP 会话（底层 SSH 复用），并限制每条 SSH 的并发 SFTP 会话数
func (p *Pool) Get(ctx context.Context, userID, serverID uuid.UUID) (client *PooledClient, err error) {
	key := makeKey(userID, serverID)

	if ctx == nil {
		ctx = context.Background()
	}

	permitAcquired, err := p.acquirePermit(ctx, key)
	if err != nil {
		return nil, err
	}
	// 出错时归还 permit
	defer func() {
		if err != nil && permitAcquired {
			p.releasePermit(key)
		}
	}()

	// 尝试复用 SSH 连接（在池锁内完成存在性检查 + IncRef，避免竞态）
	p.mu.Lock()
	sshConn, exists := p.connections[key]
	if exists && sshConn.IsHealthy() {
		sshConn.IncRef()
		p.mu.Unlock()

		// 为本次请求创建新的 SFTP 客户端（锁外）
		sftpClient, createErr := NewClient(sshConn.Client, &server.Server{ID: serverID})
		if createErr != nil {
			p.log.Warn("基于现有 SSH 创建 SFTP 失败，摘除并尝试重建",
				logger.String("key", key),
				logger.Err(createErr))
			p.invalidateSSHConn(key, sshConn)

			newSSH, newErr := p.createNewSSH(ctx, userID, serverID)
			if newErr != nil {
				err = createErr
				return nil, err
			}
			newSFTP, newErr := NewClient(newSSH.Client, &server.Server{ID: serverID})
			if newErr != nil {
				p.invalidateSSHConn(key, newSSH)
				err = newErr
				return nil, err
			}

			client = &PooledClient{
				Client:         newSFTP,
				pool:           p,
				key:            key,
				userID:         userID,
				serverID:       serverID,
				sshConn:        newSSH,
				permitAcquired: permitAcquired,
			}
			return client, nil
		}

		p.log.Debug("复用现有 SSH 连接",
			logger.String("key", key),
			logger.Int("refCount", sshConn.GetRefCount()))
		client = &PooledClient{
			Client:         sftpClient,
			pool:           p,
			key:            key,
			userID:         userID,
			serverID:       serverID,
			sshConn:        sshConn,
			permitAcquired: permitAcquired,
		}
		return client, nil
	}

	if exists {
		delete(p.connections, key)
	}
	p.mu.Unlock()

	if exists && sshConn != nil {
		p.log.Debug("SSH 连接不健康或关闭中，移除",
			logger.String("key", key))
		p.markClosingAndMaybeClose(sshConn)
	}

	// 创建新 SSH 连接
	newSSH, err := p.createNewSSH(ctx, userID, serverID)
	if err != nil {
		return nil, err
	}

	sftpClient, err := NewClient(newSSH.Client, &server.Server{ID: serverID})
	if err != nil {
		p.invalidateSSHConn(key, newSSH)
		return nil, err
	}

	client = &PooledClient{
		Client:         sftpClient,
		pool:           p,
		key:            key,
		userID:         userID,
		serverID:       serverID,
		sshConn:        newSSH,
		permitAcquired: permitAcquired,
	}
	return client, nil
}

// createNewSSH 创建新的 SSH 连接并加入池
func (p *Pool) createNewSSH(ctx context.Context, userID, serverID uuid.UUID) (*pooledSSHConn, error) {
	key := makeKey(userID, serverID)

	// 双重检查（持有写锁）
	p.mu.Lock()
	if existing, exists := p.connections[key]; exists && existing.IsHealthy() {
		p.mu.Unlock()
		existing.IncRef()
		p.log.Debug("复用刚创建的 SSH 连接",
			logger.String("key", key),
			logger.Int("refCount", existing.GetRefCount()))
		return existing, nil
	}
	p.mu.Unlock()

	if ctx == nil {
		ctx = context.Background()
	}

	// 如果调用方没有设置 deadline，则用池的连接超时兜底
	ctxToUse := ctx
	if _, ok := ctx.Deadline(); !ok {
		var cancel context.CancelFunc
		ctxToUse, cancel = context.WithTimeout(ctx, p.connTimeout)
		defer cancel()
	}

	// 获取服务器信息（不持有锁）
	srv, err := p.serverService.GetByID(ctxToUse, userID, serverID)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	// 创建 SSH 客户端并使用 ctx 建连（可取消）
	sshClient, err := sshDomain.NewClient(srv, p.encryptor, p.hostKeyCallback)
	if err != nil {
		return nil, fmt.Errorf("failed to create SSH client: %w", err)
	}

	if err := sshClient.ConnectContext(ctxToUse, srv.Host, srv.Port); err != nil {
		_ = sshClient.Close()
		return nil, fmt.Errorf("failed to connect: %w", err)
	}

	// 更新服务器状态
	srv.UpdateStatus(server.StatusOnline)
	if p.serverRepo != nil {
		if err := p.serverRepo.UpdateStatus(ctxToUse, srv.ID, srv.Status, srv.LastConnected); err != nil {
			p.log.Warn("Failed to update server status", logger.Err(err))
		}
	}

	newConn := &pooledSSHConn{
		Client:     sshClient,
		refCount:   1,
		createdAt:  time.Now(),
		lastUsedAt: time.Now(),
	}

	// 加入连接池（持有写锁）
	p.mu.Lock()
	if existing, exists := p.connections[key]; exists && existing.IsHealthy() {
		p.mu.Unlock()
		go newConn.Client.Close()
		existing.IncRef()
		p.log.Debug("复用其他 goroutine 创建的 SSH 连接",
			logger.String("key", key),
			logger.Int("refCount", existing.GetRefCount()))
		return existing, nil
	}
	p.connections[key] = newConn
	p.mu.Unlock()

	p.log.Debug("创建新 SSH 连接",
		logger.String("key", key),
		logger.String("serverHost", fmt.Sprintf("%s:%d", srv.Host, srv.Port)))
	return newConn, nil
}

// releaseSSH 释放 SSH 引用计数
func (p *Pool) releaseSSH(key string, conn *pooledSSHConn) {
	if conn == nil {
		return
	}

	// 判断该连接是否仍为池内当前连接
	p.mu.RLock()
	current, exists := p.connections[key]
	isCurrent := exists && current == conn
	p.mu.RUnlock()

	newRefCount := conn.DecRef()
	p.log.Debug("释放 SSH 连接",
		logger.String("key", key),
		logger.Int("refCount", newRefCount))

	if newRefCount == 0 {
		// 若不是当前池内连接或已标记关闭中，则立即关闭
		if !isCurrent || conn.IsClosing() {
			if conn.Client != nil {
				_ = conn.Client.Close()
			}
			return
		}
		p.log.Debug("SSH 引用计数归零，进入空闲",
			logger.String("key", key))
	}
}

// forceRemoveSSH 强制从池中移除 SSH 连接（无视引用计数）
func (p *Pool) forceRemoveSSH(key string, conn *pooledSSHConn) {
	p.mu.Lock()
	current, exists := p.connections[key]
	if exists && current == conn {
		delete(p.connections, key)
	}
	p.mu.Unlock()

	if exists && conn != nil && conn.Client != nil {
		_ = conn.Client.Close()
		p.log.Debug("强制移除 SSH 连接",
			logger.String("key", key))
	}
}

// CloseByKey 关闭特定 key 的连接（用于用户主动关闭 SFTP 面板）
func (p *Pool) CloseByKey(userID, serverID uuid.UUID) {
	key := makeKey(userID, serverID)

	p.mu.Lock()
	conn, exists := p.connections[key]
	if exists {
		delete(p.connections, key)
	}
	p.mu.Unlock()

	// 不要直接 Close，避免误伤并发中的请求；标记 closing 并在 refCount 归零后关闭
	if exists && conn != nil {
		p.markClosingAndMaybeClose(conn)
		p.log.Debug("主动关闭 SSH 连接(延迟到空闲)",
			logger.String("key", key))
	}
}

// CloseAll 关闭所有连接（用于服务器关闭时）
func (p *Pool) CloseAll() {
	p.log.Info("关闭所有连接")

	// 停止清理协程
	p.stopOnce.Do(func() {
		close(p.stopCh)
		<-p.stopped
	})

	p.mu.Lock()
	allClients := make([]*pooledSSHConn, 0, len(p.connections))
	for _, client := range p.connections {
		allClients = append(allClients, client)
	}
	p.connections = make(map[string]*pooledSSHConn)
	p.mu.Unlock()

	// 关闭所有连接
	for _, client := range allClients {
		if client != nil && client.Client != nil {
			client.Client.Close()
		}
	}

	p.log.Info("已关闭所有连接", logger.Int("count", len(allClients)))
}

// cleanupLoop 后台清理空闲连接
func (p *Pool) cleanupLoop() {
	ticker := time.NewTicker(p.cleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			p.cleanupOnce()
		case <-p.stopCh:
			close(p.stopped)
			return
		}
	}
}

// cleanupOnce 按空闲时间/最大寿命清理连接
func (p *Pool) cleanupOnce() {
	now := time.Now()
	var toClose []*pooledSSHConn
	var toProbe []struct {
		key  string
		conn *pooledSSHConn
	}

	p.mu.Lock()
	for key, conn := range p.connections {
		refCount := conn.GetRefCount()
		if refCount > 0 {
			// 仍在使用，仅记录可能的寿命超限（限频一次）
			if p.maxLifeTime > 0 && now.Sub(conn.createdAt) > p.maxLifeTime {
				conn.mu.Lock()
				if !conn.lifeWarned {
					conn.lifeWarned = true
					p.log.Warn("连接寿命超限但仍在使用",
						logger.String("key", key),
						logger.Duration("age", now.Sub(conn.createdAt)),
						logger.Int("refCount", refCount))
				}
				conn.mu.Unlock()
			}
			continue
		}

		// 若连接已标记 closing，空闲后立即回收
		if conn.IsClosing() {
			delete(p.connections, key)
			toClose = append(toClose, conn)
			continue
		}

		idleDuration := now.Sub(conn.lastUsedAt)
		ageDuration := now.Sub(conn.createdAt)
		if idleDuration > p.maxIdleTime || (p.maxLifeTime > 0 && ageDuration > p.maxLifeTime) {
			delete(p.connections, key)
			toClose = append(toClose, conn)
			continue
		}

		// 仍为空闲但未超时的连接，做一次 keepalive 探测
		if conn.Client != nil {
			toProbe = append(toProbe, struct {
				key  string
				conn *pooledSSHConn
			}{key: key, conn: conn})
		}
	}
	p.mu.Unlock()

	// 锁外做 keepalive，失败则摘除连接
	for _, item := range toProbe {
		if !p.keepAlive(item.conn) {
			p.log.Warn("空闲 keepalive 失败，驱逐连接", logger.String("key", item.key))
			p.evictSSHConn(item.key, item.conn)
		}
	}

	for _, conn := range toClose {
		if conn != nil && conn.Client != nil {
			_ = conn.Client.Close()
		}
	}

	if len(toClose) > 0 {
		p.log.Info("清理空闲连接", logger.Int("count", len(toClose)))
	}
}

// invalidateSSHConn 将不健康 SSH 连接移除并关闭（可在锁外调用）
func (p *Pool) invalidateSSHConn(key string, conn *pooledSSHConn) {
	if conn == nil {
		return
	}

	// 从池中摘除，避免后续复用
	p.mu.Lock()
	current, ok := p.connections[key]
	if ok && current == conn {
		delete(p.connections, key)
	}
	p.mu.Unlock()

	// 回滚一次引用（当前调用场景都已为本次请求 IncRef）
	newRef := conn.DecRef()
	conn.MarkClosing()

	// 只有在无人使用时才真正关闭，避免误伤并发请求
	if newRef == 0 && conn.Client != nil {
		_ = conn.Client.Close()
	}
}

// markClosingAndMaybeClose 标记连接关闭中，并在空闲时关闭（不回滚引用）
func (p *Pool) markClosingAndMaybeClose(conn *pooledSSHConn) {
	if conn == nil {
		return
	}
	conn.MarkClosing()
	if conn.GetRefCount() == 0 && conn.Client != nil {
		go conn.Client.Close()
	}
}

// acquirePermit 为指定 key 获取一个 SFTP 会话许可
func (p *Pool) acquirePermit(ctx context.Context, key string) (bool, error) {
	if p.maxSftpSessions <= 0 {
		return false, nil
	}

	p.mu.Lock()
	sem, ok := p.semaphores[key]
	if !ok {
		sem = make(chan struct{}, p.maxSftpSessions)
		p.semaphores[key] = sem
	}
	p.mu.Unlock()

	select {
	case sem <- struct{}{}:
		return true, nil
	case <-ctx.Done():
		return false, ctx.Err()
	}
}

// releasePermit 归还一个 SFTP 会话许可
func (p *Pool) releasePermit(key string) {
	if p.maxSftpSessions <= 0 {
		return
	}
	p.mu.RLock()
	sem := p.semaphores[key]
	p.mu.RUnlock()
	if sem == nil {
		return
	}
	select {
	case <-sem:
	default:
	}
}

// evictSSHConn 摘除 SSH 连接并在空闲时关闭（不回滚引用）
func (p *Pool) evictSSHConn(key string, conn *pooledSSHConn) {
	if conn == nil {
		return
	}

	p.mu.Lock()
	current, ok := p.connections[key]
	if ok && current == conn {
		delete(p.connections, key)
	}
	p.mu.Unlock()

	conn.MarkClosing()
	if conn.GetRefCount() == 0 && conn.Client != nil {
		_ = conn.Client.Close()
	}
}

// keepAlive 对空闲 SSH 发送一次 keepalive 探测
func (p *Pool) keepAlive(conn *pooledSSHConn) bool {
	if conn == nil || conn.Client == nil {
		return false
	}
	raw := conn.Client.GetRawConnection()
	if raw == nil {
		return false
	}

	done := make(chan error, 1)
	go func() {
		_, _, err := raw.SendRequest("keepalive@openssh.com", true, nil)
		done <- err
	}()

	timeout := 2 * time.Second
	if p.connTimeout < timeout {
		timeout = p.connTimeout
	}

	select {
	case err := <-done:
		return err == nil
	case <-time.After(timeout):
		return false
	}
}

// Stats 返回连接池统计信息
func (p *Pool) Stats() map[string]interface{} {
	p.mu.RLock()
	defer p.mu.RUnlock()

	totalConnections := len(p.connections)
	activeConnections := 0
	idleConnections := 0

	connectionDetails := make([]map[string]interface{}, 0, len(p.connections))

	for key, conn := range p.connections {
		refCount := conn.GetRefCount()
		if refCount > 0 {
			activeConnections++
		} else {
			idleConnections++
		}

		connectionDetails = append(connectionDetails, map[string]interface{}{
			"key":        key,
			"refCount":   refCount,
			"createdAt":  conn.createdAt,
			"lastUsedAt": conn.lastUsedAt,
			"isHealthy":  conn.IsHealthy(),
		})
	}

	return map[string]interface{}{
		"totalConnections":  totalConnections,
		"activeConnections": activeConnections,
		"idleConnections":   idleConnections,
		"connections":       connectionDetails,
	}
}
