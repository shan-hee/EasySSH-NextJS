package sftp

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type TrashDirRepository interface {
	UpsertSeen(ctx context.Context, userID, serverID uuid.UUID, trashDir string, now time.Time) error
	ListDue(ctx context.Context, now time.Time, limit int) ([]TrashDir, error)
	MarkSuccess(ctx context.Context, id uuid.UUID, now, nextAttemptAt time.Time) error
	MarkFailure(ctx context.Context, id uuid.UUID, failCount int, nextAttemptAt time.Time, lastError string) error
	// MarkSkipped 用于“未执行清理但需要推迟下次尝试”的场景（例如用户关闭自动清理）
	MarkSkipped(ctx context.Context, id uuid.UUID, nextAttemptAt time.Time, reason string) error
}

type gormTrashDirRepository struct {
	db *gorm.DB
}

func NewTrashDirRepository(db *gorm.DB) TrashDirRepository {
	return &gormTrashDirRepository{db: db}
}

func (r *gormTrashDirRepository) UpsertSeen(ctx context.Context, userID, serverID uuid.UUID, trashDir string, now time.Time) error {
	rec := TrashDir{
		UserID:        userID,
		ServerID:      serverID,
		Path:          trashDir,
		PathHash:      hashText(trashDir),
		LastSeen:      now,
		NextAttemptAt: now,
	}

	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "user_id"},
			{Name: "server_id"},
			{Name: "path_hash"},
		},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"last_seen":       now,
			"next_attempt_at": now,
		}),
	}).Create(&rec).Error
}

func (r *gormTrashDirRepository) ListDue(ctx context.Context, now time.Time, limit int) ([]TrashDir, error) {
	if limit <= 0 {
		limit = 200
	}
	var rows []TrashDir
	err := r.db.WithContext(ctx).
		Where("next_attempt_at <= ?", now).
		Order("next_attempt_at ASC").
		Limit(limit).
		Find(&rows).Error
	return rows, err
}

func (r *gormTrashDirRepository) MarkSuccess(ctx context.Context, id uuid.UUID, now, nextAttemptAt time.Time) error {
	return r.db.WithContext(ctx).Model(&TrashDir{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"last_cleaned_at": now,
			"fail_count":      0,
			"last_error":      "",
			"next_attempt_at": nextAttemptAt,
		}).Error
}

func (r *gormTrashDirRepository) MarkFailure(ctx context.Context, id uuid.UUID, failCount int, nextAttemptAt time.Time, lastError string) error {
	return r.db.WithContext(ctx).Model(&TrashDir{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"fail_count":      failCount,
			"last_error":      lastError,
			"next_attempt_at": nextAttemptAt,
		}).Error
}

func (r *gormTrashDirRepository) MarkSkipped(ctx context.Context, id uuid.UUID, nextAttemptAt time.Time, reason string) error {
	if len(reason) > 2000 {
		reason = reason[:2000]
	}
	return r.db.WithContext(ctx).Model(&TrashDir{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"last_error":      reason,
			"next_attempt_at": nextAttemptAt,
		}).Error
}
