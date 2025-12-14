package aiconfig

import (
	"context"
	"errors"

	"gorm.io/gorm"
)

// Repository AI配置仓库接口
type Repository interface {
	// GetSystemConfig 获取系统级AI配置
	GetSystemConfig(ctx context.Context) (*AIConfig, error)

	// SaveSystemConfig 保存系统级AI配置
	SaveSystemConfig(ctx context.Context, config *AIConfig) error
}

type repository struct {
	db *gorm.DB
}

// NewRepository 创建AI配置仓库
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// GetSystemConfig 获取系统级AI配置
func (r *repository) GetSystemConfig(ctx context.Context) (*AIConfig, error) {
	var config AIConfig

	// 查询第一条记录（系统配置只有一条）
	err := r.db.WithContext(ctx).First(&config).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// 如果不存在，创建默认系统配置
			config = AIConfig{
				SystemEnabled: false,
			}

			// 创建默认配置
			if err := r.db.WithContext(ctx).Create(&config).Error; err != nil {
				return nil, err
			}
		} else {
			return nil, err
		}
	}

	return &config, nil
}

// SaveSystemConfig 保存系统级AI配置
func (r *repository) SaveSystemConfig(ctx context.Context, config *AIConfig) error {
	// 查询是否存在系统配置
	var existing AIConfig
	err := r.db.WithContext(ctx).First(&existing).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		// 不存在则创建
		return r.db.WithContext(ctx).Create(config).Error
	} else if err != nil {
		return err
	}

	// 存在则更新（保留ID）
	config.ID = existing.ID

	// 如果新配置的 API Key 为空，保留原有的 API Key（避免误删除）
	if config.SystemAPIKey == "" && existing.SystemAPIKey != "" {
		config.SystemAPIKey = existing.SystemAPIKey
	}

	return r.db.WithContext(ctx).Save(config).Error
}
