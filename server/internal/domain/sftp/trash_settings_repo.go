package sftp

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type TrashSettingsRepository interface {
	GetByUserID(ctx context.Context, userID uuid.UUID) (*TrashSettings, error)
	Upsert(ctx context.Context, settings TrashSettings) error
}

type gormTrashSettingsRepository struct {
	db *gorm.DB
}

func NewTrashSettingsRepository(db *gorm.DB) TrashSettingsRepository {
	return &gormTrashSettingsRepository{db: db}
}

func (r *gormTrashSettingsRepository) GetByUserID(ctx context.Context, userID uuid.UUID) (*TrashSettings, error) {
	var settings TrashSettings
	err := r.db.WithContext(ctx).Where("user_id = ?", userID).First(&settings).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil // 未找到返回 nil，表示使用系统默认值
		}
		return nil, err
	}
	return &settings, nil
}

func (r *gormTrashSettingsRepository) Upsert(ctx context.Context, settings TrashSettings) error {
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"retention_hours":      settings.RetentionHours,
			"max_entries_per_dir":  settings.MaxEntriesPerDir,
			"max_bytes_per_dir_mb": settings.MaxBytesPerDirMB,
			"auto_clean_enabled":   settings.AutoCleanEnabled,
			"updated_at":           time.Now(),
		}),
	}).Create(&settings).Error
}
