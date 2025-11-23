package aiconfig

import (
	"context"
	"errors"
	"fmt"
)

// Service AI配置服务接口
type Service interface {
	// GetSystemConfig 获取系统级AI配置
	GetSystemConfig(ctx context.Context) (*AIConfig, error)

	// SaveSystemConfig 保存系统级AI配置
	SaveSystemConfig(ctx context.Context, config *AIConfig) error
}

type service struct {
	repo Repository
}

// NewService 创建AI配置服务
func NewService(repo Repository) Service {
	return &service{repo: repo}
}

// GetSystemConfig 获取系统级AI配置
func (s *service) GetSystemConfig(ctx context.Context) (*AIConfig, error) {
	return s.repo.GetSystemConfig(ctx)
}

// SaveSystemConfig 保存系统级AI配置
func (s *service) SaveSystemConfig(ctx context.Context, config *AIConfig) error {
	// 验证配置
	if err := s.validateSystemConfig(config); err != nil {
		return err
	}

	return s.repo.SaveSystemConfig(ctx, config)
}

// validateSystemConfig 验证系统配置
func (s *service) validateSystemConfig(config *AIConfig) error {
	if !config.SystemEnabled {
		return nil
	}

	// 验证服务商
	validProviders := map[string]bool{
		"openai":    true,
		"anthropic": true,
		"azure":     true,
		"custom":    true,
	}
	if !validProviders[config.SystemProvider] {
		return fmt.Errorf("invalid provider: %s", config.SystemProvider)
	}

	// 验证默认模型
	if config.SystemDefaultModel == "" {
		return errors.New("default model is required when system AI is enabled")
	}

	// 验证速率限制
	if config.SystemRateLimit < 0 || config.SystemRateLimit > 1000 {
		return errors.New("rate limit must be between 0 and 1000")
	}

	return nil
}
