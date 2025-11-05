package tabsession

import (
	"context"

	"gorm.io/gorm"
)

// Repository 标签/会话配置仓储接口
type Repository interface {
	GetFirst(ctx context.Context) (*TabSessionSettings, error)
	Create(ctx context.Context, config *TabSessionSettings) error
	Update(ctx context.Context, config *TabSessionSettings) error
	Delete(ctx context.Context, id uint) error
}

type repository struct {
	db *gorm.DB
}

// NewRepository 创建标签/会话配置仓储
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// GetFirst 获取第一个配置记录
func (r *repository) GetFirst(ctx context.Context) (*TabSessionSettings, error) {
	var config TabSessionSettings
	err := r.db.WithContext(ctx).First(&config).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &config, nil
}

// Create 创建配置记录
func (r *repository) Create(ctx context.Context, config *TabSessionSettings) error {
	return r.db.WithContext(ctx).Create(config).Error
}

// Update 更新配置记录
func (r *repository) Update(ctx context.Context, config *TabSessionSettings) error {
	return r.db.WithContext(ctx).Save(config).Error
}

// Delete 删除配置记录
func (r *repository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&TabSessionSettings{}, id).Error
}