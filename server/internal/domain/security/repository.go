package security

import (
	"context"
	"encoding/json"
	"errors"

	"gorm.io/gorm"
)

// Repository 安全配置仓库接口
type Repository interface {
	// Get 获取安全配置（单例模式）
	Get(ctx context.Context) (*SecurityConfig, error)

	// Save 保存安全配置
	Save(ctx context.Context, config *SecurityConfig) error

	// GetCORSConfig 获取CORS配置
	GetCORSConfig(ctx context.Context) (*CORSConfig, error)

	// GetCookieConfig 获取Cookie配置
	GetCookieConfig(ctx context.Context) (*CookieConfig, error)

	// GetAllConfigs 一次性获取所有配置（CORS + Cookie）
	GetAllConfigs(ctx context.Context) (*CORSConfig, *CookieConfig, error)
}

type repository struct {
	db *gorm.DB
}

// NewRepository 创建安全配置仓库
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// Get 获取安全配置
func (r *repository) Get(ctx context.Context) (*SecurityConfig, error) {
	var config SecurityConfig

	// 查询第一条记录（单例模式）
	err := r.db.WithContext(ctx).First(&config).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// 如果不存在，创建默认配置
			config = SecurityConfig{
				SessionTimeout:  30,
				MaxTabs:         10,
				InactiveMinutes: 15,
				RememberLogin:   true,
				Hibernate:       true,
				LoginLimit:      5,
				APILimit:        100,
				TwoFALimit:      5,

				AccountLockEnabled:         true,
				MaxIPFailAttempts:          10,
				IPLockDurationMinutes:      30,
				MaxAccountFailAttempts:     5,
				AccountLockDurationMinutes: 60,
			}

			// 序列化默认CORS配置
			if cors, err := json.Marshal(DefaultCORSConfig()); err == nil {
				config.CORSConfig = string(cors)
			}

			// 序列化默认Cookie配置
			if cookie, err := json.Marshal(DefaultCookieConfig()); err == nil {
				config.CookieConfig = string(cookie)
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

// Save 保存安全配置
func (r *repository) Save(ctx context.Context, config *SecurityConfig) error {
	// 查询是否存在配置
	var existing SecurityConfig
	err := r.db.WithContext(ctx).First(&existing).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		// 不存在则创建
		return r.db.WithContext(ctx).Create(config).Error
	} else if err != nil {
		return err
	}

	// 存在则更新（保留ID）
	config.ID = existing.ID
	return r.db.WithContext(ctx).Save(config).Error
}

// GetCORSConfig 获取CORS配置
func (r *repository) GetCORSConfig(ctx context.Context) (*CORSConfig, error) {
	config, err := r.Get(ctx)
	if err != nil {
		return nil, err
	}

	if config.CORSConfig == "" {
		return DefaultCORSConfig(), nil
	}

	var cors CORSConfig
	if err := json.Unmarshal([]byte(config.CORSConfig), &cors); err != nil {
		return DefaultCORSConfig(), nil
	}

	return &cors, nil
}

// GetCookieConfig 获取Cookie配置
func (r *repository) GetCookieConfig(ctx context.Context) (*CookieConfig, error) {
	config, err := r.Get(ctx)
	if err != nil {
		return nil, err
	}

	if config.CookieConfig == "" {
		return DefaultCookieConfig(), nil
	}

	var cookie CookieConfig
	if err := json.Unmarshal([]byte(config.CookieConfig), &cookie); err != nil {
		return DefaultCookieConfig(), nil
	}

	return &cookie, nil
}

// GetAllConfigs 一次性获取所有配置（CORS + Cookie）
func (r *repository) GetAllConfigs(ctx context.Context) (*CORSConfig, *CookieConfig, error) {
	config, err := r.Get(ctx)
	if err != nil {
		return nil, nil, err
	}

	// 解析CORS配置
	var cors CORSConfig
	if config.CORSConfig == "" {
		cors = *DefaultCORSConfig()
	} else {
		if err := json.Unmarshal([]byte(config.CORSConfig), &cors); err != nil {
			cors = *DefaultCORSConfig()
		}
	}

	// 解析Cookie配置
	var cookie CookieConfig
	if config.CookieConfig == "" {
		cookie = *DefaultCookieConfig()
	} else {
		if err := json.Unmarshal([]byte(config.CookieConfig), &cookie); err != nil {
			cookie = *DefaultCookieConfig()
		}
	}

	return &cors, &cookie, nil
}
