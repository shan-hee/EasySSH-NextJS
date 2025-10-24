package sshsession

import (
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Repository SSH会话数据访问接口
type Repository interface {
	Create(session *SSHSession) error
	Update(id uuid.UUID, updates map[string]interface{}) error
	Delete(id uuid.UUID) error
	GetByID(id uuid.UUID) (*SSHSession, error)
	GetBySessionID(sessionID string) (*SSHSession, error)
	List(userID uuid.UUID, req *ListSSHSessionsRequest) ([]SSHSession, int64, error)
	GetStatistics(userID uuid.UUID) (*SSHSessionStatistics, error)
	CloseSession(id uuid.UUID) error
	GetActiveSessions() ([]SSHSession, error)
}

type repository struct {
	db *gorm.DB
}

// NewRepository 创建SSH会话仓储实例
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// Create 创建SSH会话记录
func (r *repository) Create(session *SSHSession) error {
	return r.db.Create(session).Error
}

// Update 更新SSH会话记录
func (r *repository) Update(id uuid.UUID, updates map[string]interface{}) error {
	return r.db.Model(&SSHSession{}).Where("id = ?", id).Updates(updates).Error
}

// Delete 删除SSH会话记录（软删除）
func (r *repository) Delete(id uuid.UUID) error {
	return r.db.Where("id = ?", id).Delete(&SSHSession{}).Error
}

// GetByID 根据ID获取SSH会话记录
func (r *repository) GetByID(id uuid.UUID) (*SSHSession, error) {
	var session SSHSession
	err := r.db.Where("id = ?", id).First(&session).Error
	if err != nil {
		return nil, err
	}
	return &session, nil
}

// GetBySessionID 根据SessionID获取SSH会话记录
func (r *repository) GetBySessionID(sessionID string) (*SSHSession, error) {
	var session SSHSession
	err := r.db.Where("session_id = ?", sessionID).First(&session).Error
	if err != nil {
		return nil, err
	}
	return &session, nil
}

// List 获取SSH会话列表
func (r *repository) List(userID uuid.UUID, req *ListSSHSessionsRequest) ([]SSHSession, int64, error) {
	var sessions []SSHSession
	var total int64

	query := r.db.Model(&SSHSession{}).Where("user_id = ?", userID)

	// 筛选条件
	if req.Status != "" {
		query = query.Where("status = ?", req.Status)
	}

	if req.ServerID != "" {
		serverID, err := uuid.Parse(req.ServerID)
		if err == nil {
			query = query.Where("server_id = ?", serverID)
		}
	}

	if req.UserID != "" {
		uid, err := uuid.Parse(req.UserID)
		if err == nil {
			query = query.Where("user_id = ?", uid)
		}
	}

	// 计算总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页
	offset := (req.Page - 1) * req.Limit
	if err := query.Order("connected_at DESC").
		Offset(offset).
		Limit(req.Limit).
		Find(&sessions).Error; err != nil {
		return nil, 0, err
	}

	return sessions, total, nil
}

// GetStatistics 获取SSH会话统计信息
func (r *repository) GetStatistics(userID uuid.UUID) (*SSHSessionStatistics, error) {
	stats := &SSHSessionStatistics{
		ByServer: make(map[string]int),
	}

	// 总会话数
	r.db.Model(&SSHSession{}).Where("user_id = ?", userID).Count(&stats.TotalSessions)

	// 活跃会话数
	r.db.Model(&SSHSession{}).Where("user_id = ? AND status = ?", userID, "active").Count(&stats.ActiveSessions)

	// 已关闭会话数
	r.db.Model(&SSHSession{}).Where("user_id = ? AND status = ?", userID, "closed").Count(&stats.ClosedSessions)

	// 总时长
	r.db.Model(&SSHSession{}).
		Where("user_id = ?", userID).
		Select("COALESCE(SUM(duration), 0)").
		Scan(&stats.TotalDuration)

	// 总发送字节数
	r.db.Model(&SSHSession{}).
		Where("user_id = ?", userID).
		Select("COALESCE(SUM(bytes_sent), 0)").
		Scan(&stats.TotalBytesSent)

	// 总接收字节数
	r.db.Model(&SSHSession{}).
		Where("user_id = ?", userID).
		Select("COALESCE(SUM(bytes_received), 0)").
		Scan(&stats.TotalBytesReceived)

	// 按服务器统计
	var serverStats []struct {
		ServerID string
		Count    int
	}
	r.db.Model(&SSHSession{}).
		Select("server_id, count(*) as count").
		Where("user_id = ?", userID).
		Group("server_id").
		Scan(&serverStats)

	for _, stat := range serverStats {
		stats.ByServer[stat.ServerID] = stat.Count
	}

	return stats, nil
}

// CloseSession 关闭SSH会话
func (r *repository) CloseSession(id uuid.UUID) error {
	// 获取会话信息计算时长
	var session SSHSession
	if err := r.db.Where("id = ?", id).First(&session).Error; err != nil {
		return err
	}

	duration := int(session.UpdatedAt.Sub(session.ConnectedAt).Seconds())

	updates := map[string]interface{}{
		"status":          "closed",
		"disconnected_at": session.UpdatedAt,
		"duration":        duration,
	}

	return r.db.Model(&SSHSession{}).Where("id = ?", id).Updates(updates).Error
}

// GetActiveSessions 获取所有活跃会话
func (r *repository) GetActiveSessions() ([]SSHSession, error) {
	var sessions []SSHSession
	err := r.db.Where("status = ?", "active").Find(&sessions).Error
	return sessions, err
}
