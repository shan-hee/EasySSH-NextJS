package operationrecord

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Repository interface {
	Upsert(ctx context.Context, record *OperationRecord) error
	List(ctx context.Context, req *ListRequest) (*ListResponse, error)
	GetByID(ctx context.Context, id uuid.UUID) (*OperationRecord, error)
	GetStatistics(ctx context.Context, req *StatisticsRequest) (*Statistics, error)
	DeleteBySource(ctx context.Context, sourceTable string, sourceID string) error
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) Upsert(ctx context.Context, record *OperationRecord) error {
	if record == nil {
		return nil
	}
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "source_table"}, {Name: "source_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"user_id",
			"username",
			"type",
			"action",
			"status",
			"server_id",
			"server_name",
			"title",
			"resource",
			"source",
			"started_at",
			"finished_at",
			"duration_ms",
			"progress",
			"total_count",
			"success_count",
			"failure_count",
			"bytes_total",
			"bytes_processed",
			"speed_bps",
			"error_message",
			"detail_json",
			"updated_at",
			"deleted_at",
		}),
	}).Create(record).Error
}

func (r *repository) List(ctx context.Context, req *ListRequest) (*ListResponse, error) {
	if req == nil {
		req = &ListRequest{}
	}

	query := r.applyListFilters(r.db.WithContext(ctx).Model(&OperationRecord{}), req)

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	if req.Page < 1 {
		req.Page = 1
	}
	if req.PageSize < 1 {
		req.PageSize = 20
	}
	if req.PageSize > 100 {
		req.PageSize = 100
	}

	var records []*OperationRecord
	err := query.
		Order("created_at DESC").
		Limit(req.PageSize).
		Offset((req.Page - 1) * req.PageSize).
		Find(&records).Error
	if err != nil {
		return nil, err
	}

	totalPages := int(total) / req.PageSize
	if int(total)%req.PageSize > 0 {
		totalPages++
	}

	return &ListResponse{
		Records:    records,
		Total:      total,
		Page:       req.Page,
		PageSize:   req.PageSize,
		TotalPages: totalPages,
	}, nil
}

func (r *repository) GetByID(ctx context.Context, id uuid.UUID) (*OperationRecord, error) {
	var record OperationRecord
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&record).Error; err != nil {
		return nil, err
	}
	return &record, nil
}

func (r *repository) GetStatistics(ctx context.Context, req *StatisticsRequest) (*Statistics, error) {
	stats := &Statistics{
		ByType:   make(map[RecordType]int64),
		ByStatus: make(map[Status]int64),
	}

	if req == nil {
		req = &StatisticsRequest{}
	}
	query := r.statisticsQuery(ctx, req)
	if err := query.Count(&stats.Total).Error; err != nil {
		return nil, err
	}
	if err := r.statisticsQuery(ctx, req).Where("status = ?", StatusSuccess).Count(&stats.SuccessCount).Error; err != nil {
		return nil, err
	}
	if err := r.statisticsQuery(ctx, req).Where("status = ?", StatusFailure).Count(&stats.FailureCount).Error; err != nil {
		return nil, err
	}
	if err := r.statisticsQuery(ctx, req).Where("status = ?", StatusRunning).Count(&stats.RunningCount).Error; err != nil {
		return nil, err
	}

	var typeRows []struct {
		Type  RecordType
		Count int64
	}
	if err := r.statisticsQuery(ctx, req).
		Select("type, count(*) as count").
		Group("type").
		Find(&typeRows).Error; err != nil {
		return nil, err
	}
	for _, row := range typeRows {
		stats.ByType[row.Type] = row.Count
	}

	var statusRows []struct {
		Status Status
		Count  int64
	}
	if err := r.statisticsQuery(ctx, req).
		Select("status, count(*) as count").
		Group("status").
		Find(&statusRows).Error; err != nil {
		return nil, err
	}
	for _, row := range statusRows {
		stats.ByStatus[row.Status] = row.Count
	}

	return stats, nil
}

func (r *repository) DeleteBySource(ctx context.Context, sourceTable string, sourceID string) error {
	return r.db.WithContext(ctx).
		Where("source_table = ? AND source_id = ?", sourceTable, sourceID).
		Delete(&OperationRecord{}).Error
}

func (r *repository) applyListFilters(query *gorm.DB, req *ListRequest) *gorm.DB {
	if req.UserID != nil {
		query = query.Where("user_id = ?", *req.UserID)
	}
	if req.Type != "" {
		query = query.Where("type = ?", req.Type)
	}
	if req.Action != "" {
		query = query.Where("action = ?", req.Action)
	}
	if req.Status != "" {
		query = query.Where("status = ?", req.Status)
	}
	if req.ServerID != nil {
		query = query.Where("server_id = ?", *req.ServerID)
	}
	if req.StartTime != nil {
		query = query.Where("created_at >= ?", *req.StartTime)
	}
	if req.EndTime != nil {
		query = query.Where("created_at <= ?", *req.EndTime)
	}
	return query
}

func (r *repository) statisticsQuery(ctx context.Context, req *StatisticsRequest) *gorm.DB {
	query := r.db.WithContext(ctx).Model(&OperationRecord{})
	if req.UserID != nil {
		query = query.Where("user_id = ?", *req.UserID)
	}
	if req.Type != "" {
		query = query.Where("type = ?", req.Type)
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
