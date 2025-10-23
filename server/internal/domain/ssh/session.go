package ssh

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/ssh"
)

var (
	ErrSessionNotFound = errors.New("session not found")
	ErrSessionClosed   = errors.New("session already closed")
)

// SessionStatus 会话状态
type SessionStatus string

const (
	SessionStatusActive SessionStatus = "active"
	SessionStatusClosed SessionStatus = "closed"
)

// Session SSH 会话
type Session struct {
	ID        string        `json:"id"`
	UserID    string        `json:"user_id"`
	ServerID  string        `json:"server_id"`
	Client    *Client       `json:"-"`
	SSHSession *ssh.Session `json:"-"`
	Status    SessionStatus `json:"status"`
	CreatedAt time.Time     `json:"created_at"`
	ClosedAt  *time.Time    `json:"closed_at,omitempty"`

	// 终端相关
	Cols int `json:"cols"`
	Rows int `json:"rows"`

	mu sync.RWMutex
}

// NewSession 创建新会话
func NewSession(userID, serverID string, client *Client, cols, rows int) *Session {
	return &Session{
		ID:        uuid.New().String(),
		UserID:    userID,
		ServerID:  serverID,
		Client:    client,
		Status:    SessionStatusActive,
		CreatedAt: time.Now(),
		Cols:      cols,
		Rows:      rows,
	}
}

// Close 关闭会话
func (s *Session) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.Status == SessionStatusClosed {
		return ErrSessionClosed
	}

	// 关闭 SSH 会话
	if s.SSHSession != nil {
		s.SSHSession.Close()
	}

	// 关闭客户端
	if s.Client != nil {
		s.Client.Close()
	}

	s.Status = SessionStatusClosed
	now := time.Now()
	s.ClosedAt = &now

	return nil
}

// IsActive 检查会话是否活跃
func (s *Session) IsActive() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.Status == SessionStatusActive
}

// GetUptime 获取会话持续时间
func (s *Session) GetUptime() time.Duration {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.ClosedAt != nil {
		return s.ClosedAt.Sub(s.CreatedAt)
	}
	return time.Since(s.CreatedAt)
}

// ResizeTerminal 调整终端大小
func (s *Session) ResizeTerminal(cols, rows int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.Status == SessionStatusClosed {
		return ErrSessionClosed
	}

	if s.SSHSession == nil {
		return errors.New("SSH session not initialized")
	}

	// 更新终端尺寸
	if err := s.SSHSession.WindowChange(rows, cols); err != nil {
		return err
	}

	s.Cols = cols
	s.Rows = rows
	return nil
}

// SessionManager 会话管理器
type SessionManager struct {
	sessions map[string]*Session
	mu       sync.RWMutex
}

// NewSessionManager 创建会话管理器
func NewSessionManager() *SessionManager {
	return &SessionManager{
		sessions: make(map[string]*Session),
	}
}

// Add 添加会话
func (m *SessionManager) Add(session *Session) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sessions[session.ID] = session
}

// Get 获取会话
func (m *SessionManager) Get(sessionID string) (*Session, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	session, exists := m.sessions[sessionID]
	if !exists {
		return nil, ErrSessionNotFound
	}

	return session, nil
}

// GetByUserID 获取用户的所有会话
func (m *SessionManager) GetByUserID(userID string) []*Session {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var sessions []*Session
	for _, session := range m.sessions {
		if session.UserID == userID {
			sessions = append(sessions, session)
		}
	}

	return sessions
}

// GetByServerID 获取服务器的所有会话
func (m *SessionManager) GetByServerID(serverID string) []*Session {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var sessions []*Session
	for _, session := range m.sessions {
		if session.ServerID == serverID {
			sessions = append(sessions, session)
		}
	}

	return sessions
}

// Remove 移除会话
func (m *SessionManager) Remove(sessionID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	session, exists := m.sessions[sessionID]
	if !exists {
		return ErrSessionNotFound
	}

	// 关闭会话
	if session.IsActive() {
		session.Close()
	}

	delete(m.sessions, sessionID)
	return nil
}

// RemoveByServerID 移除服务器的所有会话
func (m *SessionManager) RemoveByServerID(serverID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for id, session := range m.sessions {
		if session.ServerID == serverID {
			session.Close()
			delete(m.sessions, id)
		}
	}
}

// GetAll 获取所有会话
func (m *SessionManager) GetAll() []*Session {
	m.mu.RLock()
	defer m.mu.RUnlock()

	sessions := make([]*Session, 0, len(m.sessions))
	for _, session := range m.sessions {
		sessions = append(sessions, session)
	}

	return sessions
}

// Count 获取会话总数
func (m *SessionManager) Count() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.sessions)
}

// CountByUserID 获取用户的会话数
func (m *SessionManager) CountByUserID(userID string) int {
	m.mu.RLock()
	defer m.mu.RUnlock()

	count := 0
	for _, session := range m.sessions {
		if session.UserID == userID {
			count++
		}
	}

	return count
}

// CleanupInactive 清理不活跃的会话
func (m *SessionManager) CleanupInactive(ctx context.Context, maxAge time.Duration) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			m.cleanupOldSessions(maxAge)
		}
	}
}

func (m *SessionManager) cleanupOldSessions(maxAge time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	for id, session := range m.sessions {
		if session.IsActive() && now.Sub(session.CreatedAt) > maxAge {
			session.Close()
			delete(m.sessions, id)
		}
	}
}

// ToPublic 转换为公开信息
func (s *Session) ToPublic() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := map[string]interface{}{
		"id":         s.ID,
		"user_id":    s.UserID,
		"server_id":  s.ServerID,
		"status":     s.Status,
		"cols":       s.Cols,
		"rows":       s.Rows,
		"created_at": s.CreatedAt,
		"uptime":     s.GetUptime().Seconds(),
	}

	if s.ClosedAt != nil {
		result["closed_at"] = s.ClosedAt
	}

	return result
}
