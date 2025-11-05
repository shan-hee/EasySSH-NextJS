package tabsession

import (
	"context"
	"fmt"
)

// Service 标签/会话配置服务接口
type Service interface {
	GetTabSessionConfig(ctx context.Context) (*TabSessionSettings, error)
	SaveTabSessionConfig(ctx context.Context, config *TabSessionSettings) error
	CreateDefaultConfig(ctx context.Context) error
}

type service struct {
	repo Repository
}

// NewService 创建标签/会话配置服务
func NewService(repo Repository) Service {
	return &service{repo: repo}
}

// GetTabSessionConfig ���取标签/会话配置
func (s *service) GetTabSessionConfig(ctx context.Context) (*TabSessionSettings, error) {
	config, err := s.repo.GetFirst(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get tab session config: %w", err)
	}

	// 如果没有配置，创建默认配置
	if config == nil {
		if err := s.CreateDefaultConfig(ctx); err != nil {
			return nil, fmt.Errorf("failed to create default config: %w", err)
		}
		// 重新获取配置
		config, err = s.repo.GetFirst(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to get newly created config: %w", err)
		}
	}

	return config, nil
}

// SaveTabSessionConfig 保存标签/会话配置
func (s *service) SaveTabSessionConfig(ctx context.Context, config *TabSessionSettings) error {
	// 验证配置
	if err := config.Validate(); err != nil {
		return fmt.Errorf("validation failed: %w", err)
	}

	// 获取现有配置
	existing, err := s.repo.GetFirst(ctx)
	if err != nil {
		return fmt.Errorf("failed to get existing config: %w", err)
	}

	if existing == nil {
		// 创建新配置
		return s.repo.Create(ctx, config)
	} else {
		// 更新现有配置
		config.ID = existing.ID
		return s.repo.Update(ctx, config)
	}
}

// CreateDefaultConfig 创建默认配置
func (s *service) CreateDefaultConfig(ctx context.Context) error {
	defaultConfig := DefaultTabSessionSettings()
	return s.repo.Create(ctx, defaultConfig)
}