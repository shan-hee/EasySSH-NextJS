package aiconfig

import (
	"context"
	"errors"
	"fmt"
	"strings"
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

	provider := strings.ToLower(strings.TrimSpace(config.SystemProvider))
	if provider == "" {
		provider = "openai"
	}

	// 验证服务商
	validProviders := map[string]bool{
		"openai":          true,
		"openai-response": true,
		"gemini":          true,
		"anthropic":       true,
	}
	if !validProviders[provider] {
		return fmt.Errorf("invalid provider: %s (supported: openai, openai-response, gemini, anthropic)", config.SystemProvider)
	}
	config.SystemProvider = provider

	// 验证模型列表
	if strings.TrimSpace(config.SystemModels) == "" {
		return errors.New("at least one model is required when system AI is enabled")
	}

	return nil
}
