package settings

import (
	"fmt"
	"net"
	"time"

	"gorm.io/gorm"
)

// IPWhitelist IP 白名单模型
type IPWhitelist struct {
	ID          uint           `gorm:"primarykey" json:"id"`
	IPAddress   string         `gorm:"not null;size:45" json:"ip_address"` // IPv4/IPv6 地址或 CIDR
	Description string         `gorm:"size:200" json:"description"`       // 描述
	Enabled     bool           `gorm:"default:true" json:"enabled"`       // 是否启用
	CreatedBy   uint           `json:"created_by"`                        // 创建者 ID
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (IPWhitelist) TableName() string {
	return "ip_whitelist"
}

// IsValid 验证 IP 地址或 CIDR 是否有效
func (i *IPWhitelist) IsValid() bool {
	// 尝试解析为 IP 地址
	if ip := net.ParseIP(i.IPAddress); ip != nil {
		return true
	}

	// 尝试解析为 CIDR
	if _, _, err := net.ParseCIDR(i.IPAddress); err == nil {
		return true
	}

	return false
}

// Contains 检查给定 IP 是否在白名单中
func (i *IPWhitelist) Contains(targetIP string) (bool, error) {
	if !i.Enabled {
		return false, nil
	}

	// 如果是单个 IP 地址
	if ip := net.ParseIP(i.IPAddress); ip != nil {
		target := net.ParseIP(targetIP)
		if target == nil {
			return false, fmt.Errorf("invalid target IP address: %s", targetIP)
		}
		return ip.Equal(target), nil
	}

	// 如果是 CIDR
	_, ipNet, err := net.ParseCIDR(i.IPAddress)
	if err != nil {
		return false, fmt.Errorf("invalid CIDR notation: %s", i.IPAddress)
	}

	target := net.ParseIP(targetIP)
	if target == nil {
		return false, fmt.Errorf("invalid target IP address: %s", targetIP)
	}

	return ipNet.Contains(target), nil
}

// IPWhitelistService IP 白名单服务接口
type IPWhitelistService interface {
	CreateIPWhitelist(ipWhitelist *IPWhitelist) error
	GetIPWhitelistByID(id uint) (*IPWhitelist, error)
	GetAllIPWhitelists() ([]IPWhitelist, error)
	UpdateIPWhitelist(id uint, updates map[string]interface{}) error
	DeleteIPWhitelist(id uint) error
	ToggleIPWhitelist(id uint) error
	IsIPAllowed(ip string) (bool, error)
	GetEnabledIPWhitelists() ([]IPWhitelist, error)
	GetIPWhitelistConfig() (*IPWhitelistConfig, error)
}

// IPWhitelistConfig IP 白名单配置结构
type IPWhitelistConfig struct {
	Enabled bool                `json:"enabled"`
	IPs     []IPWhitelistItem   `json:"ips"`
}

// IPWhitelistItem IP 白名单项
type IPWhitelistItem struct {
	IPAddress   string `json:"ip_address"`
	Description string `json:"description"`
	Enabled     bool   `json:"enabled"`
}