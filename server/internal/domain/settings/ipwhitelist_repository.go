package settings

import (
	"context"
	"fmt"

	"gorm.io/gorm"
)

// IPWhitelistRepository IP 白名单仓储接口
type IPWhitelistRepository interface {
	Create(ctx context.Context, ipWhitelist *IPWhitelist) error
	GetByID(ctx context.Context, id uint) (*IPWhitelist, error)
	GetAll(ctx context.Context) ([]IPWhitelist, error)
	GetEnabled(ctx context.Context) ([]IPWhitelist, error)
	Update(ctx context.Context, id uint, updates map[string]interface{}) error
	Delete(ctx context.Context, id uint) error
	Toggle(ctx context.Context, id uint) error
	IsIPAllowed(ctx context.Context, ip string) (bool, error)
}

type ipWhitelistRepository struct {
	db *gorm.DB
}

// NewIPWhitelistRepository 创建 IP 白名单仓储
func NewIPWhitelistRepository(db *gorm.DB) IPWhitelistRepository {
	return &ipWhitelistRepository{db: db}
}

// Create 创建 IP 白名单项
func (r *ipWhitelistRepository) Create(ctx context.Context, ipWhitelist *IPWhitelist) error {
	if err := r.db.WithContext(ctx).Create(ipWhitelist).Error; err != nil {
		return fmt.Errorf("failed to create IP whitelist: %w", err)
	}
	return nil
}

// GetByID 根据ID获取IP白名单项
func (r *ipWhitelistRepository) GetByID(ctx context.Context, id uint) (*IPWhitelist, error) {
	var ipWhitelist IPWhitelist
	if err := r.db.WithContext(ctx).First(&ipWhitelist, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get IP whitelist by ID: %w", err)
	}
	return &ipWhitelist, nil
}

// GetAll 获取所有IP白名单项
func (r *ipWhitelistRepository) GetAll(ctx context.Context) ([]IPWhitelist, error) {
	var ipWhitelists []IPWhitelist
	if err := r.db.WithContext(ctx).Order("created_at DESC").Find(&ipWhitelists).Error; err != nil {
		return nil, fmt.Errorf("failed to get all IP whitelists: %w", err)
	}
	return ipWhitelists, nil
}

// GetEnabled 获取所有启用的IP白名单项
func (r *ipWhitelistRepository) GetEnabled(ctx context.Context) ([]IPWhitelist, error) {
	var ipWhitelists []IPWhitelist
	if err := r.db.WithContext(ctx).Where("enabled = ?", true).Order("created_at DESC").Find(&ipWhitelists).Error; err != nil {
		return nil, fmt.Errorf("failed to get enabled IP whitelists: %w", err)
	}
	return ipWhitelists, nil
}

// Update 更新IP白名单项
func (r *ipWhitelistRepository) Update(ctx context.Context, id uint, updates map[string]interface{}) error {
	if err := r.db.WithContext(ctx).Model(&IPWhitelist{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return fmt.Errorf("failed to update IP whitelist: %w", err)
	}
	return nil
}

// Delete 删除IP白名单项
func (r *ipWhitelistRepository) Delete(ctx context.Context, id uint) error {
	if err := r.db.WithContext(ctx).Delete(&IPWhitelist{}, id).Error; err != nil {
		return fmt.Errorf("failed to delete IP whitelist: %w", err)
	}
	return nil
}

// Toggle 切换IP白名单项的启用状态
func (r *ipWhitelistRepository) Toggle(ctx context.Context, id uint) error {
	var ipWhitelist IPWhitelist
	if err := r.db.WithContext(ctx).First(&ipWhitelist, id).Error; err != nil {
		return fmt.Errorf("failed to get IP whitelist: %w", err)
	}

	ipWhitelist.Enabled = !ipWhitelist.Enabled
	if err := r.db.WithContext(ctx).Save(&ipWhitelist).Error; err != nil {
		return fmt.Errorf("failed to toggle IP whitelist: %w", err)
	}
	return nil
}

// IsIPAllowed 检查IP是否被允许访问
func (r *ipWhitelistRepository) IsIPAllowed(ctx context.Context, ip string) (bool, error) {
	// 获取所有启用的IP白名单项
	enabledWhitelists, err := r.GetEnabled(ctx)
	if err != nil {
		return false, fmt.Errorf("failed to get enabled IP whitelists: %w", err)
	}

	// 如果没有启用任何白名单项，则允许所有IP访问
	if len(enabledWhitelists) == 0 {
		return true, nil
	}

	// 检查IP是否在任何白名单项中
	for _, whitelist := range enabledWhitelists {
		if allowed, err := whitelist.Contains(ip); err != nil {
			// 记录错误但继续检查其他项
			fmt.Printf("Error checking IP %s against whitelist %d: %v\n", ip, whitelist.ID, err)
			continue
		} else if allowed {
			return true, nil
		}
	}

	// 如果没有匹配的项，则拒绝访问
	return false, nil
}