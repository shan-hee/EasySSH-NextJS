package settings

import (
	"context"
	"fmt"
)

// IPWhitelistService IP 白名单服务实现
type ipWhitelistService struct {
	repo IPWhitelistRepository
}

// NewIPWhitelistService 创建 IP 白名单服务
func NewIPWhitelistService(repo IPWhitelistRepository) IPWhitelistService {
	return &ipWhitelistService{repo: repo}
}

// CreateIPWhitelist 创建 IP 白名单项
func (s *ipWhitelistService) CreateIPWhitelist(ipWhitelist *IPWhitelist) error {
	// 验证 IP 地址格式
	if !ipWhitelist.IsValid() {
		return fmt.Errorf("invalid IP address or CIDR notation: %s", ipWhitelist.IPAddress)
	}

	// 检查是否已存在相同的 IP 地址
	ctx := context.Background()
	existing, err := s.repo.GetAll(ctx)
	if err != nil {
		return fmt.Errorf("failed to check existing IP whitelists: %w", err)
	}

	for _, existingIP := range existing {
		if existingIP.IPAddress == ipWhitelist.IPAddress && existingIP.ID != ipWhitelist.ID {
			return fmt.Errorf("IP address %s already exists", ipWhitelist.IPAddress)
		}
	}

	return s.repo.Create(ctx, ipWhitelist)
}

// GetIPWhitelistByID 根据 ID 获取 IP 白名单项
func (s *ipWhitelistService) GetIPWhitelistByID(id uint) (*IPWhitelist, error) {
	ctx := context.Background()
	return s.repo.GetByID(ctx, id)
}

// GetAllIPWhitelists 获取所有 IP 白名单项
func (s *ipWhitelistService) GetAllIPWhitelists() ([]IPWhitelist, error) {
	ctx := context.Background()
	return s.repo.GetAll(ctx)
}

// UpdateIPWhitelist 更新 IP 白名单项
func (s *ipWhitelistService) UpdateIPWhitelist(id uint, updates map[string]interface{}) error {
	ctx := context.Background()

	// 如果要更新 IP 地址，需要验证格式
	if ipAddress, ok := updates["ip_address"].(string); ok {
		tempIP := &IPWhitelist{IPAddress: ipAddress}
		if !tempIP.IsValid() {
			return fmt.Errorf("invalid IP address or CIDR notation: %s", ipAddress)
		}

		// 检查是否已存在相同的 IP 地址
		existing, err := s.repo.GetAll(ctx)
		if err != nil {
			return fmt.Errorf("failed to check existing IP whitelists: %w", err)
		}

		for _, existingIP := range existing {
			if existingIP.IPAddress == ipAddress && existingIP.ID != id {
				return fmt.Errorf("IP address %s already exists", ipAddress)
			}
		}
	}

	return s.repo.Update(ctx, id, updates)
}

// DeleteIPWhitelist 删除 IP 白名单项
func (s *ipWhitelistService) DeleteIPWhitelist(id uint) error {
	ctx := context.Background()
	return s.repo.Delete(ctx, id)
}

// ToggleIPWhitelist 切换 IP 白名单项的启用状态
func (s *ipWhitelistService) ToggleIPWhitelist(id uint) error {
	ctx := context.Background()
	return s.repo.Toggle(ctx, id)
}

// IsIPAllowed 检查 IP 是否被允许访问
func (s *ipWhitelistService) IsIPAllowed(ip string) (bool, error) {
	ctx := context.Background()
	return s.repo.IsIPAllowed(ctx, ip)
}

// GetEnabledIPWhitelists 获取所有启用的 IP 白名单项
func (s *ipWhitelistService) GetEnabledIPWhitelists() ([]IPWhitelist, error) {
	ctx := context.Background()
	return s.repo.GetEnabled(ctx)
}

// GetIPWhitelistConfig 获取 IP 白名单配置
func (s *ipWhitelistService) GetIPWhitelistConfig() (*IPWhitelistConfig, error) {
	ctx := context.Background()
	whitelists, err := s.repo.GetAll(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get IP whitelists: %w", err)
	}

	config := &IPWhitelistConfig{
		Enabled: false, // 默认禁用
		IPs:     make([]IPWhitelistItem, 0),
	}

	// 检查是否有启用的白名单项
	enabledCount := 0
	for _, whitelist := range whitelists {
		if whitelist.Enabled {
			enabledCount++
			config.Enabled = true
		}

		config.IPs = append(config.IPs, IPWhitelistItem{
			IPAddress:   whitelist.IPAddress,
			Description: whitelist.Description,
			Enabled:     whitelist.Enabled,
		})
	}

	return config, nil
}