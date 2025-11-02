package sshsession

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrSSHSessionNotFound    = errors.New("ssh session not found")
	ErrInvalidSSHSessionData = errors.New("invalid ssh session data")
	ErrUnauthorized          = errors.New("unauthorized access to ssh session")
)

// Service SSH会话业务逻辑接口
type Service interface {
	CreateSSHSession(req *CreateSSHSessionRequest) (*SSHSession, error)
	UpdateSSHSession(userID uuid.UUID, id uuid.UUID, req *UpdateSSHSessionRequest) (*SSHSession, error)
	DeleteSSHSession(userID uuid.UUID, id uuid.UUID) error
	GetSSHSession(userID uuid.UUID, id uuid.UUID) (*SSHSession, error)
	GetSSHSessionBySessionID(sessionID string) (*SSHSession, error)
	ListSSHSessions(userID uuid.UUID, req *ListSSHSessionsRequest) (*ListSSHSessionsResponse, error)
	GetStatistics(userID uuid.UUID) (*SSHSessionStatistics, error)
	CloseSession(userID uuid.UUID, id uuid.UUID) error
	UpdateSessionMetrics(sessionID string, bytesSent, bytesReceived int64) error
}

type service struct {
	repo Repository
}

// NewService 创建SSH会话服务实例
func NewService(repo Repository) Service {
	return &service{repo: repo}
}

// CreateSSHSession 创建SSH会话记录
func (s *service) CreateSSHSession(req *CreateSSHSessionRequest) (*SSHSession, error) {
	// 验证必填字段
	if req.UserID == uuid.Nil || req.ServerID == uuid.Nil || req.SessionID == "" {
		return nil, ErrInvalidSSHSessionData
	}

	// 构建SSH会话记录
	session := &SSHSession{
		UserID:       req.UserID,
		ServerID:     req.ServerID,
		SessionID:    req.SessionID,
		ClientIP:     req.ClientIP,
		ClientPort:   req.ClientPort,
		TerminalType: req.TerminalType,
		Status:       "active",
		ConnectedAt:  time.Now(),
		BytesSent:    0,
		BytesReceived: 0,
	}

	if err := s.repo.Create(session); err != nil {
		return nil, err
	}

	return session, nil
}

// UpdateSSHSession 更新SSH会话记录
func (s *service) UpdateSSHSession(userID uuid.UUID, id uuid.UUID, req *UpdateSSHSessionRequest) (*SSHSession, error) {
	// 获取现有会话
	existingSession, err := s.repo.GetByID(id)
	if err != nil {
		return nil, ErrSSHSessionNotFound
	}

	// 验证所有权
	if existingSession.UserID != userID {
		return nil, ErrUnauthorized
	}

	// 构建更新字段
	updates := make(map[string]interface{})

	if req.Status != "" {
		validStatuses := map[string]bool{"active": true, "closed": true, "timeout": true}
		if !validStatuses[req.Status] {
			return nil, errors.New("invalid status")
		}
		updates["status"] = req.Status

		if req.Status == "closed" || req.Status == "timeout" {
			now := time.Now()
			updates["disconnected_at"] = now
			duration := int(now.Sub(existingSession.ConnectedAt).Seconds())
			updates["duration"] = duration
		}
	}

	if req.BytesSent != nil {
		updates["bytes_sent"] = *req.BytesSent
	}

	if req.BytesReceived != nil {
		updates["bytes_received"] = *req.BytesReceived
	}

	if req.ErrorMessage != "" {
		updates["error_message"] = req.ErrorMessage
	}

	if len(updates) == 0 {
		return existingSession, nil
	}

	// 执行更新
	if err := s.repo.Update(id, updates); err != nil {
		return nil, err
	}

	// 返回更新后的会话
	return s.repo.GetByID(id)
}

// DeleteSSHSession 删除SSH会话记录
func (s *service) DeleteSSHSession(userID uuid.UUID, id uuid.UUID) error {
	// 获取现有会话
	existingSession, err := s.repo.GetByID(id)
	if err != nil {
		return ErrSSHSessionNotFound
	}

	// 验证所有权
	if existingSession.UserID != userID {
		return ErrUnauthorized
	}

	return s.repo.Delete(id)
}

// GetSSHSession 获取SSH会话详情
func (s *service) GetSSHSession(userID uuid.UUID, id uuid.UUID) (*SSHSession, error) {
	session, err := s.repo.GetByID(id)
	if err != nil {
		return nil, ErrSSHSessionNotFound
	}

	// 验证所有权
	if session.UserID != userID {
		return nil, ErrUnauthorized
	}

	return session, nil
}

// GetSSHSessionBySessionID 根据SessionID获取SSH会话
func (s *service) GetSSHSessionBySessionID(sessionID string) (*SSHSession, error) {
	return s.repo.GetBySessionID(sessionID)
}

// ListSSHSessions 获取SSH会话列表
func (s *service) ListSSHSessions(userID uuid.UUID, req *ListSSHSessionsRequest) (*ListSSHSessionsResponse, error) {
	// 设置默认值
	if req.Page < 1 {
		req.Page = 1
	}
	if req.Limit < 1 {
		req.Limit = 20
	}

	sessions, total, err := s.repo.List(userID, req)
	if err != nil {
		return nil, err
	}

	// 计算总页数
	totalPages := int(total) / req.Limit
	if int(total)%req.Limit > 0 {
		totalPages++
	}

	return &ListSSHSessionsResponse{
		Data:       sessions,
		Total:      total,
		Page:       req.Page,
		PageSize:   req.Limit,
		TotalPages: totalPages,
	}, nil
}

// GetStatistics 获取SSH会话统计信息
func (s *service) GetStatistics(userID uuid.UUID) (*SSHSessionStatistics, error) {
	return s.repo.GetStatistics(userID)
}

// CloseSession 关闭SSH会话
func (s *service) CloseSession(userID uuid.UUID, id uuid.UUID) error {
	// 获取会话
	session, err := s.repo.GetByID(id)
	if err != nil {
		return ErrSSHSessionNotFound
	}

	// 验证所有权
	if session.UserID != userID {
		return ErrUnauthorized
	}

	// 验证状态
	if session.Status != "active" {
		return errors.New("session is not active")
	}

	return s.repo.CloseSession(id)
}

// UpdateSessionMetrics 更新会话指标（由SSH服务调用）
func (s *service) UpdateSessionMetrics(sessionID string, bytesSent, bytesReceived int64) error {
	session, err := s.repo.GetBySessionID(sessionID)
	if err != nil {
		return err
	}

	updates := map[string]interface{}{
		"bytes_sent":     bytesSent,
		"bytes_received": bytesReceived,
	}

	return s.repo.Update(session.ID, updates)
}
