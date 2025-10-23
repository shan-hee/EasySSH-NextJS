package auditlog

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// Service 审计日志服务接口
type Service interface {
	// Log 记录审计日志
	Log(ctx context.Context, req *CreateAuditLogRequest) error

	// LogSuccess 记录成功操作的快捷方法
	LogSuccess(ctx context.Context, userID uuid.UUID, username string, action ActionType, resource string, details interface{}) error

	// LogFailure 记录失败操作的快捷方法
	LogFailure(ctx context.Context, userID uuid.UUID, username string, action ActionType, resource string, err error) error

	// List 查询审计日志
	List(ctx context.Context, req *ListAuditLogsRequest) ([]*AuditLog, int64, error)

	// GetByID 获取单条日志
	GetByID(ctx context.Context, id uuid.UUID) (*AuditLog, error)

	// GetStatistics 获取统计信息
	GetStatistics(ctx context.Context, userID *uuid.UUID, days int) (*AuditLogStatistics, error)

	// CleanupOldLogs 清理旧日志
	CleanupOldLogs(ctx context.Context, retentionDays int) (int64, error)
}

// service 审计日志服务实现
type service struct {
	repo Repository
}

// NewService 创建审计日志服务
func NewService(repo Repository) Service {
	return &service{
		repo: repo,
	}
}

// Log 记录审计日志
func (s *service) Log(ctx context.Context, req *CreateAuditLogRequest) error {
	log := &AuditLog{
		UserID:    req.UserID,
		Username:  req.Username,
		ServerID:  req.ServerID,
		Action:    req.Action,
		Resource:  req.Resource,
		Status:    req.Status,
		IP:        req.IP,
		UserAgent: req.UserAgent,
		Details:   req.Details,
		ErrorMsg:  req.ErrorMsg,
		Duration:  req.Duration,
	}

	return s.repo.Create(ctx, log)
}

// LogSuccess 记录成功操作
func (s *service) LogSuccess(ctx context.Context, userID uuid.UUID, username string, action ActionType, resource string, details interface{}) error {
	detailsJSON := ""
	if details != nil {
		if data, err := json.Marshal(details); err == nil {
			detailsJSON = string(data)
		}
	}

	req := &CreateAuditLogRequest{
		UserID:   userID,
		Username: username,
		Action:   action,
		Resource: resource,
		Status:   StatusSuccess,
		Details:  detailsJSON,
	}

	return s.Log(ctx, req)
}

// LogFailure 记录失败操作
func (s *service) LogFailure(ctx context.Context, userID uuid.UUID, username string, action ActionType, resource string, err error) error {
	req := &CreateAuditLogRequest{
		UserID:   userID,
		Username: username,
		Action:   action,
		Resource: resource,
		Status:   StatusFailure,
		ErrorMsg: err.Error(),
	}

	return s.Log(ctx, req)
}

// List 查询审计日志
func (s *service) List(ctx context.Context, req *ListAuditLogsRequest) ([]*AuditLog, int64, error) {
	return s.repo.List(ctx, req)
}

// GetByID 获取单条日志
func (s *service) GetByID(ctx context.Context, id uuid.UUID) (*AuditLog, error) {
	return s.repo.GetByID(ctx, id)
}

// GetStatistics 获取统计信息
func (s *service) GetStatistics(ctx context.Context, userID *uuid.UUID, days int) (*AuditLogStatistics, error) {
	if days <= 0 {
		days = 30 // 默认最近 30 天
	}
	if days > 365 {
		days = 365 // 最多查询 1 年
	}

	return s.repo.GetStatistics(ctx, userID, days)
}

// CleanupOldLogs 清理旧日志
func (s *service) CleanupOldLogs(ctx context.Context, retentionDays int) (int64, error) {
	if retentionDays <= 0 {
		retentionDays = 90 // 默认保留 90 天
	}

	before := time.Now().AddDate(0, 0, -retentionDays)
	return s.repo.DeleteOldLogs(ctx, before)
}
