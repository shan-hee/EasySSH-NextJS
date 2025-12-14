package useraiconfig

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Repository 用户AI配置仓库接口
type Repository interface {
	// GetByUserID 根据用户ID获取AI配置
	GetByUserID(ctx context.Context, userID uuid.UUID) (*UserAIConfig, error)

	// Save 保存用户AI配置
	Save(ctx context.Context, config *UserAIConfig) error

	// Delete 删除用户AI配置
	Delete(ctx context.Context, userID uuid.UUID) error
}

type repository struct {
	db *gorm.DB
}

// NewRepository 创建用户AI配置仓库
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// GetByUserID 根据用户ID获取AI配置
func (r *repository) GetByUserID(ctx context.Context, userID uuid.UUID) (*UserAIConfig, error) {
	var config UserAIConfig

	err := r.db.WithContext(ctx).Where("user_id = ?", userID).First(&config).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// 如果不存在，返回默认配置（使用系统配置）
			return &UserAIConfig{
				UserID:          userID,
				UseSystemConfig: true,
				CustomEnabled:   false,
			}, nil
		}
		return nil, err
	}

	return &config, nil
}

// Save 保存用户AI配置
func (r *repository) Save(ctx context.Context, config *UserAIConfig) error {
	// 查询是否存在该用户的配置
	var existing UserAIConfig
	err := r.db.WithContext(ctx).Where("user_id = ?", config.UserID).First(&existing).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		// 不存在则创建
		return r.db.WithContext(ctx).Create(config).Error
	} else if err != nil {
		return err
	}

	// 存在则更新（保留ID）
	config.ID = existing.ID

	// 如果新配置的 API Key 为空，保留原有的 API Key（避免误删除）
	if config.CustomAPIKey == "" && existing.CustomAPIKey != "" {
		config.CustomAPIKey = existing.CustomAPIKey
	}

	return r.db.WithContext(ctx).Save(config).Error
}

// Delete 删除用户AI配置
func (r *repository) Delete(ctx context.Context, userID uuid.UUID) error {
	return r.db.WithContext(ctx).Where("user_id = ?", userID).Delete(&UserAIConfig{}).Error
}
