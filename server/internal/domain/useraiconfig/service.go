package useraiconfig

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
)

// Service 用户AI配置服务接口
type Service interface {
	// GetUserConfig 获取用户AI配置
	GetUserConfig(ctx context.Context, userID uuid.UUID) (*UserAIConfig, error)

	// SaveUserConfig 保存用户AI配置
	SaveUserConfig(ctx context.Context, config *UserAIConfig) error

	// DeleteUserConfig 删除用户AI配置（恢复使用系统配置）
	DeleteUserConfig(ctx context.Context, userID uuid.UUID) error
}

type service struct {
	repo Repository
}

// NewService 创建用户AI配置服务
func NewService(repo Repository) Service {
	return &service{repo: repo}
}

// GetUserConfig 获取用户AI配置
func (s *service) GetUserConfig(ctx context.Context, userID uuid.UUID) (*UserAIConfig, error) {
	return s.repo.GetByUserID(ctx, userID)
}

// SaveUserConfig 保存用户AI配置
func (s *service) SaveUserConfig(ctx context.Context, config *UserAIConfig) error {
	// 验证配置
	if err := s.validateUserConfig(config); err != nil {
		return err
	}

	return s.repo.Save(ctx, config)
}

// DeleteUserConfig 删除用户AI配置（恢复使用系统配置）
func (s *service) DeleteUserConfig(ctx context.Context, userID uuid.UUID) error {
	return s.repo.Delete(ctx, userID)
}

// validateUserConfig 验证用户配置
func (s *service) validateUserConfig(config *UserAIConfig) error {
	// 如果使用系统配置，不需要验证自定义配置
	if config.UseSystemConfig {
		return nil
	}

	// 如果启用自定义配置，需要验证
	if config.CustomEnabled {
		// 验证服务商
		validProviders := map[string]bool{
			"openai":    true,
			"anthropic": true,
			"azure":     true,
			"custom":    true,
		}
		if !validProviders[config.CustomProvider] {
			return fmt.Errorf("invalid provider: %s", config.CustomProvider)
		}

		// 验证API密钥
		if config.CustomAPIKey == "" {
			return errors.New("API key is required when custom AI is enabled")
		}

		// 验证模型
		if config.CustomModel == "" {
			return errors.New("model is required when custom AI is enabled")
		}
	}

	return nil
}
