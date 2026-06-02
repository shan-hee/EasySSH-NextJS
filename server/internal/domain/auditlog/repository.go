package auditlog

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Repository 审计日志仓储接口
type Repository interface {
	// Create 创建审计日志
	Create(ctx context.Context, log *AuditLog) error

	// List 查询审计日志列表
	List(ctx context.Context, req *ListAuditLogsRequest) ([]*AuditLog, int64, error)

	// GetByID 根据 ID 获取审计日志
	GetByID(ctx context.Context, id uuid.UUID) (*AuditLog, error)

	// GetStatistics 获取统计信息
	GetStatistics(ctx context.Context, req *AuditLogStatisticsRequest) (*AuditLogStatistics, error)

	// DeleteOldLogs 删除旧日志（数据清理）
	DeleteOldLogs(ctx context.Context, before time.Time, category LogCategory) (int64, error)
}

// repository 审计日志仓储实现
type repository struct {
	db *gorm.DB
}

// NewRepository 创建审计日志仓储
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// Create 创建审计日志
func (r *repository) Create(ctx context.Context, log *AuditLog) error {
	return r.db.WithContext(ctx).Create(log).Error
}

// List 查询审计日志列表
func (r *repository) List(ctx context.Context, req *ListAuditLogsRequest) ([]*AuditLog, int64, error) {
	query := r.db.WithContext(ctx).Model(&AuditLog{})

	// 应用过滤条件
	if req.UserID != nil {
		query = query.Where("user_id = ?", *req.UserID)
	}
	if req.ServerID != nil {
		query = query.Where("server_id = ?", *req.ServerID)
	}
	if req.Action != "" {
		query = query.Where("action = ?", req.Action)
	}
	if req.Category != "" {
		query = query.Where("category = ?", req.Category)
	}
	if req.Status != "" {
		query = query.Where("status = ?", req.Status)
	}
	if req.StartTime != nil {
		query = query.Where("created_at >= ?", *req.StartTime)
	}
	if req.EndTime != nil {
		query = query.Where("created_at <= ?", *req.EndTime)
	}

	// 获取总数
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页
	if req.Page < 1 {
		req.Page = 1
	}
	if req.PageSize < 1 {
		req.PageSize = 20
	}
	if req.PageSize > 100 {
		req.PageSize = 100
	}

	offset := (req.Page - 1) * req.PageSize

	// 查询数据
	var logs []*AuditLog
	err := query.Order("created_at DESC").
		Limit(req.PageSize).
		Offset(offset).
		Find(&logs).Error

	return logs, total, err
}

// GetByID 根据 ID 获取审计日志
func (r *repository) GetByID(ctx context.Context, id uuid.UUID) (*AuditLog, error) {
	var log AuditLog
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&log).Error
	if err != nil {
		return nil, err
	}
	return &log, nil
}

// GetStatistics 获取统计信息
func (r *repository) GetStatistics(ctx context.Context, req *AuditLogStatisticsRequest) (*AuditLogStatistics, error) {
	stats := &AuditLogStatistics{
		ActionStats: make(map[ActionType]int64),
	}

	query := r.statisticsQuery(ctx, req)

	// 总日志数
	if err := query.Count(&stats.TotalLogs).Error; err != nil {
		return nil, err
	}

	// 成功和失败统计
	if err := r.statisticsQuery(ctx, req).
		Where("status = ?", StatusSuccess).
		Count(&stats.SuccessCount).Error; err != nil {
		return nil, err
	}

	if err := r.statisticsQuery(ctx, req).
		Where("status = ?", StatusFailure).
		Count(&stats.FailureCount).Error; err != nil {
		return nil, err
	}

	// 按操作类型统计
	var actionResults []struct {
		Action ActionType
		Count  int64
	}
	if err := r.statisticsQuery(ctx, req).
		Select("action, count(*) as count").
		Group("action").
		Find(&actionResults).Error; err != nil {
		return nil, err
	}

	for _, result := range actionResults {
		stats.ActionStats[result.Action] = result.Count
	}

	// 最近失败的操作（最多 10 条）
	if err := r.statisticsQuery(ctx, req).
		Where("status = ?", StatusFailure).
		Order("created_at DESC").
		Limit(10).
		Find(&stats.RecentFailures).Error; err != nil {
		return nil, err
	}

	// 操作最多的用户（前 5 名）
	var userResults []struct {
		UserID   uuid.UUID
		Username string
		Count    int64
	}
	if err := r.statisticsQuery(ctx, req).
		Select("user_id, username, count(*) as count").
		Group("user_id, username").
		Order("count DESC").
		Limit(5).
		Find(&userResults).Error; err != nil {
		return nil, err
	}

	stats.TopUsers = make([]UserActionCount, len(userResults))
	for i, result := range userResults {
		stats.TopUsers[i] = UserActionCount{
			UserID:   result.UserID,
			Username: result.Username,
			Count:    result.Count,
		}
	}

	return stats, nil
}

func (r *repository) statisticsQuery(ctx context.Context, req *AuditLogStatisticsRequest) *gorm.DB {
	query := r.db.WithContext(ctx).Model(&AuditLog{})
	if req == nil {
		return query
	}
	if req.UserID != nil {
		query = query.Where("user_id = ?", *req.UserID)
	}
	if req.Category != "" {
		query = query.Where("category = ?", req.Category)
	}
	if req.StartTime != nil {
		query = query.Where("created_at >= ?", *req.StartTime)
	} else if req.Days > 0 {
		query = query.Where("created_at >= ?", time.Now().AddDate(0, 0, -req.Days))
	}
	if req.EndTime != nil {
		query = query.Where("created_at <= ?", *req.EndTime)
	}
	return query
}

// DeleteOldLogs 删除旧日志
func (r *repository) DeleteOldLogs(ctx context.Context, before time.Time, category LogCategory) (int64, error) {
	query := r.db.WithContext(ctx).Where("created_at < ?", before)
	if category != "" {
		query = query.Where("category = ?", category)
	}

	result := query.Delete(&AuditLog{})

	return result.RowsAffected, result.Error
}
