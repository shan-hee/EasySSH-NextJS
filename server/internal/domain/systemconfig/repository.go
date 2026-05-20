package systemconfig

import (
	"context"
	"encoding/json"
	"errors"

	"gorm.io/gorm"
)

// Repository 系统配置仓库接口
type Repository interface {
	// Get 获取系统配置（单例模式，只有一条记录）
	Get(ctx context.Context) (*SystemConfig, error)

	// Save 保存系统配置
	Save(ctx context.Context, config *SystemConfig) error

	// GetCompletionProviders 获取补全提供者配置
	GetCompletionProviders(ctx context.Context) (*CompletionProvidersConfig, error)

	// GetCompletionQuotas 获取补全配额配置
	GetCompletionQuotas(ctx context.Context) (*CompletionQuotasConfig, error)

	// GetCompletionCache 获取补全缓存配置
	GetCompletionCache(ctx context.Context) (*CompletionCacheConfig, error)
}

type repository struct {
	db *gorm.DB
}

// NewRepository 创建系统配置仓库
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// Get 获取系统配置
func (r *repository) Get(ctx context.Context) (*SystemConfig, error) {
	var config SystemConfig

	// 查询第一条记录（单例模式）
	err := r.db.WithContext(ctx).First(&config).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// 如果不存在，创建默认配置
			jwtDefaults := DefaultJWTSessionConfig()
			config = SystemConfig{
				SystemName:                   "EasySSH",
				DefaultLanguage:              "zh-CN",
				DefaultTimezone:              "Asia/Shanghai",
				DateFormat:                   "YYYY-MM-DD HH:mm:ss",
				DefaultDownloadMode:          "fast",
				SkipExcludedOnUpload:         true,
				MaxFileUploadSize:            100,
				DownloadExcludePatterns:      DefaultDownloadExcludePatterns(),
				CompletionEnabled:            true,
				JWTAccessExpireMinutes:       jwtDefaults.AccessExpireMinutes,
				JWTRefreshIdleExpireDays:     jwtDefaults.RefreshIdleExpireDays,
				JWTRefreshAbsoluteExpireDays: jwtDefaults.RefreshAbsoluteExpireDays,
				JWTRefreshRotate:             jwtDefaults.RefreshRotate,
				JWTRefreshReuseDetection:     jwtDefaults.RefreshReuseDetection,
			}

			// 序列化默认补全配置
			if providers, err := json.Marshal(DefaultCompletionProviders()); err == nil {
				config.CompletionProviders = string(providers)
			}
			if quotas, err := json.Marshal(DefaultCompletionQuotas()); err == nil {
				config.CompletionQuotas = string(quotas)
			}
			if cache, err := json.Marshal(DefaultCompletionCache()); err == nil {
				config.CompletionCache = string(cache)
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

// Save 保存系统配置
func (r *repository) Save(ctx context.Context, config *SystemConfig) error {
	// 查询是否存在配置
	var existing SystemConfig
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

// GetCompletionProviders 获取补全提供者配置
func (r *repository) GetCompletionProviders(ctx context.Context) (*CompletionProvidersConfig, error) {
	config, err := r.Get(ctx)
	if err != nil {
		return nil, err
	}

	if config.CompletionProviders == "" {
		return DefaultCompletionProviders(), nil
	}

	var providers CompletionProvidersConfig
	if err := json.Unmarshal([]byte(config.CompletionProviders), &providers); err != nil {
		return DefaultCompletionProviders(), nil
	}

	return &providers, nil
}

// GetCompletionQuotas 获取补全配额配置
func (r *repository) GetCompletionQuotas(ctx context.Context) (*CompletionQuotasConfig, error) {
	config, err := r.Get(ctx)
	if err != nil {
		return nil, err
	}

	if config.CompletionQuotas == "" {
		return DefaultCompletionQuotas(), nil
	}

	var quotas CompletionQuotasConfig
	if err := json.Unmarshal([]byte(config.CompletionQuotas), &quotas); err != nil {
		return DefaultCompletionQuotas(), nil
	}

	return &quotas, nil
}

// GetCompletionCache 获取补全缓存配置
func (r *repository) GetCompletionCache(ctx context.Context) (*CompletionCacheConfig, error) {
	config, err := r.Get(ctx)
	if err != nil {
		return nil, err
	}

	if config.CompletionCache == "" {
		return DefaultCompletionCache(), nil
	}

	var cache CompletionCacheConfig
	if err := json.Unmarshal([]byte(config.CompletionCache), &cache); err != nil {
		return DefaultCompletionCache(), nil
	}

	return &cache, nil
}
