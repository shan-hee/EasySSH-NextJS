package security

import (
	"time"

	"gorm.io/gorm"
)

// SecurityConfig 安全配置模型
type SecurityConfig struct {
	ID uint `gorm:"primarykey" json:"id"`

	// 会话管理
	SessionTimeout  int  `gorm:"not null;default:30" json:"session_timeout"`   // 会话超时时间（分钟）
	MaxTabs         int  `gorm:"not null;default:10" json:"max_tabs"`          // 最大标签页数
	InactiveMinutes int  `gorm:"not null;default:15" json:"inactive_minutes"`  // 非活动断开提醒��间（分钟）
	RememberLogin   bool `gorm:"not null;default:true" json:"remember_login"`  // 是否允许记住登录状态
	Hibernate       bool `gorm:"not null;default:true" json:"hibernate"`       // 是否启用后台标签页休眠

	// 网络安全
	AllowlistIPs string `gorm:"type:text" json:"allowlist_ips"` // IP白名单（换行分隔）
	BlocklistIPs string `gorm:"type:text" json:"blocklist_ips"` // IP黑名单（换行分隔）

	// CORS配置（JSON存储）
	CORSConfig string `gorm:"type:jsonb" json:"cors_config"` // JSON: CORSConfig

	// Cookie配置（JSON存储）
	CookieConfig string `gorm:"type:jsonb" json:"cookie_config"` // JSON: CookieConfig

	// 速率限制
	LoginLimit int `gorm:"not null;default:5" json:"login_limit"`   // 登录接口速率限制（次/分钟/IP）
	APILimit   int `gorm:"not null;default:100" json:"api_limit"`   // API 接口速率限制（次/分钟/IP）

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (SecurityConfig) TableName() string {
	return "security_config"
}

// CORSConfig CORS 配置结构
type CORSConfig struct {
	AllowedOrigins []string `json:"allowed_origins"` // 允许的域名列表
	AllowedMethods []string `json:"allowed_methods"` // 允许的方法列表
	AllowedHeaders []string `json:"allowed_headers"` // 允许的头部列表
}

// DefaultCORSConfig 默认CORS配置
func DefaultCORSConfig() *CORSConfig {
	return &CORSConfig{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders: []string{"*"},
	}
}

// CookieConfig Cookie 配置结构
type CookieConfig struct {
	Secure bool   `json:"secure"` // Cookie Secure 标志
	Domain string `json:"domain"` // Cookie 域名
}

// DefaultCookieConfig 默认Cookie配置
func DefaultCookieConfig() *CookieConfig {
	return &CookieConfig{
		Secure: true,
		Domain: "",
	}
}

// RateLimitConfig 速率限制配置结构
type RateLimitConfig struct {
	LoginLimit int `json:"login_limit"` // 登录接口速率限制（次/分钟/IP）
	APILimit   int `json:"api_limit"`   // API 接口速率限制（次/分钟/IP）
}
