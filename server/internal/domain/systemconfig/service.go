package systemconfig

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
)

// Service 系统配置服务接口
type Service interface {
	// Get 获取系统配置
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

type service struct {
	repo Repository
}

// NewService 创建系统配置服务
func NewService(repo Repository) Service {
	return &service{repo: repo}
}

// Get 获取系统配置
func (s *service) Get(ctx context.Context) (*SystemConfig, error) {
	return s.repo.Get(ctx)
}

// Save 保存系统配置
func (s *service) Save(ctx context.Context, config *SystemConfig) error {
	// 验证配置
	if err := s.validate(config); err != nil {
		return err
	}

	// 序列化补全配置（如果是结构体形式传入）
	// 这里假设前端传入的是已经序列化好的JSON字符串
	// 如果需要从结构体转换，可以在这里处理

	return s.repo.Save(ctx, config)
}

// GetCompletionProviders 获取补全提供者配置
func (s *service) GetCompletionProviders(ctx context.Context) (*CompletionProvidersConfig, error) {
	return s.repo.GetCompletionProviders(ctx)
}

// GetCompletionQuotas 获取补全配额配置
func (s *service) GetCompletionQuotas(ctx context.Context) (*CompletionQuotasConfig, error) {
	return s.repo.GetCompletionQuotas(ctx)
}

// GetCompletionCache 获取补全缓存配置
func (s *service) GetCompletionCache(ctx context.Context) (*CompletionCacheConfig, error) {
	return s.repo.GetCompletionCache(ctx)
}

// validate 验证系统配置
func (s *service) validate(config *SystemConfig) error {
	// 验证系统名称
	if config.SystemName == "" {
		return errors.New("system name is required")
	}
	if len(config.SystemName) > 100 {
		return errors.New("system name is too long (max 100 characters)")
	}

	// 验证语言
	validLanguages := map[string]bool{
		"zh-CN": true,
		"en-US": true,
	}
	if !validLanguages[config.DefaultLanguage] {
		return fmt.Errorf("invalid language: %s", config.DefaultLanguage)
	}

	// 验证时区
	if config.DefaultTimezone == "" {
		return errors.New("timezone is required")
	}

	// 验证日期格式
	if config.DateFormat == "" {
		return errors.New("date format is required")
	}

	// 验证下载模式
	if config.DefaultDownloadMode != "fast" && config.DefaultDownloadMode != "compatible" {
		return fmt.Errorf("invalid download mode: %s", config.DefaultDownloadMode)
	}

	// 验证文件上传大小
	if config.MaxFileUploadSize < 1 || config.MaxFileUploadSize > 1024 {
		return errors.New("max file upload size must be between 1 and 1024 MB")
	}

	// 验证补全配置
	if err := s.validateCompletionConfig(config); err != nil {
		return err
	}

	if err := s.validateJWTSessionConfig(config.JWTSessionConfig()); err != nil {
		return err
	}

	return nil
}

func (s *service) validateJWTSessionConfig(config *JWTSessionConfig) error {
	if config.AccessExpireMinutes < 5 || config.AccessExpireMinutes > 1440 {
		return errors.New("JWT access token expiration must be between 5 and 1440 minutes")
	}
	if config.RefreshIdleExpireDays < 1 || config.RefreshIdleExpireDays > 90 {
		return errors.New("JWT refresh token idle expiration must be between 1 and 90 days")
	}
	if config.RefreshAbsoluteExpireDays < 1 || config.RefreshAbsoluteExpireDays > 365 {
		return errors.New("JWT refresh token absolute expiration must be between 1 and 365 days")
	}
	if config.RefreshAbsoluteExpireDays < config.RefreshIdleExpireDays {
		return errors.New("JWT refresh token absolute expiration must be greater than or equal to idle expiration")
	}
	return nil
}

// validateCompletionConfig 验证补全配置
func (s *service) validateCompletionConfig(config *SystemConfig) error {
	// 验证补全提供者配置
	if config.CompletionProviders != "" {
		var providers CompletionProvidersConfig
		if err := json.Unmarshal([]byte(config.CompletionProviders), &providers); err != nil {
			return fmt.Errorf("invalid completion providers config: %w", err)
		}
	}

	// 验证补全配额配置
	if config.CompletionQuotas != "" {
		var quotas CompletionQuotasConfig
		if err := json.Unmarshal([]byte(config.CompletionQuotas), &quotas); err != nil {
			return fmt.Errorf("invalid completion quotas config: %w", err)
		}

		// 验证配额范围
		if quotas.LocalMin < 0 || quotas.LocalMin > 10 {
			return errors.New("local_min must be between 0 and 10")
		}
		if quotas.LocalMax < 1 || quotas.LocalMax > 10 {
			return errors.New("local_max must be between 1 and 10")
		}
		if quotas.LocalMin > quotas.LocalMax {
			return errors.New("local_min must be less than or equal to local_max")
		}

		if quotas.ScriptMin < 0 || quotas.ScriptMin > 10 {
			return errors.New("script_min must be between 0 and 10")
		}
		if quotas.ScriptMax < 0 || quotas.ScriptMax > 10 {
			return errors.New("script_max must be between 0 and 10")
		}
		if quotas.ScriptMin > quotas.ScriptMax {
			return errors.New("script_min must be less than or equal to script_max")
		}

		if quotas.SessionMin < 0 || quotas.SessionMin > 10 {
			return errors.New("session_min must be between 0 and 10")
		}
		if quotas.SessionMax < 0 || quotas.SessionMax > 10 {
			return errors.New("session_max must be between 0 and 10")
		}
		if quotas.SessionMin > quotas.SessionMax {
			return errors.New("session_min must be less than or equal to session_max")
		}

		if quotas.RemoteHistorySoftMax < 1 || quotas.RemoteHistorySoftMax > 20 {
			return errors.New("remote_history_soft_max must be between 1 and 20")
		}
	}

	// 验证补全缓存配置
	if config.CompletionCache != "" {
		var cache CompletionCacheConfig
		if err := json.Unmarshal([]byte(config.CompletionCache), &cache); err != nil {
			return fmt.Errorf("invalid completion cache config: %w", err)
		}

		if cache.TTLMinutes < 1 || cache.TTLMinutes > 60 {
			return errors.New("ttl_minutes must be between 1 and 60")
		}
		if cache.MaxEntries < 10 || cache.MaxEntries > 1000 {
			return errors.New("max_entries must be between 10 and 1000")
		}
	}

	return nil
}
