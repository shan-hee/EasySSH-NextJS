package settings

import (
	"time"

	"gorm.io/gorm"
)

// Settings 系统设置模型
type Settings struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	Key       string         `gorm:"uniqueIndex;not null;size:100" json:"key"`
	Value     string         `gorm:"type:text" json:"value"`
	Category  string         `gorm:"size:50;index" json:"category"` // email, notification, system, etc.
	IsPublic  bool           `gorm:"default:false" json:"is_public"` // 是否公开（非管理员可读）
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (Settings) TableName() string {
	return "system_settings"
}

// SMTP 配置相关的键名
const (
	KeyEmailEnabled  = "email.enabled"
	KeySMTPHost      = "email.smtp_host"
	KeySMTPPort      = "email.smtp_port"
	KeySMTPUsername  = "email.smtp_username"
	KeySMTPPassword  = "email.smtp_password"
	KeySMTPFromEmail = "email.from_email"
	KeySMTPFromName  = "email.from_name"
	KeySMTPUseTLS    = "email.use_tls"
)

// Webhook 配置相关的键名
const (
	KeyWebhookEnabled = "webhook.enabled"
	KeyWebhookURL     = "webhook.url"
	KeyWebhookSecret  = "webhook.secret"
	KeyWebhookMethod  = "webhook.method" // GET 或 POST
)

// 钉钉配置相关的键名
const (
	KeyDingTalkEnabled = "dingding.enabled"
	KeyDingTalkWebhook = "dingding.webhook_url"
	KeyDingTalkSecret  = "dingding.secret"
)

// 企业微信配置相关的键名
const (
	KeyWeComEnabled = "wechat.enabled"
	KeyWeComWebhook = "wechat.webhook_url"
)

// 系统通用配置相关的键名
const (
	KeySystemName              = "system.name"
	KeySystemDescription       = "system.description"
	KeySystemLogo              = "system.logo"
	KeySystemFavicon           = "system.favicon"
	KeyDefaultLanguage         = "system.default_language"
	KeyDefaultTimezone         = "system.default_timezone"
	KeyDateFormat              = "system.date_format"
	KeyEnableUserRegistration  = "system.enable_user_registration"
	KeyEnableGuestAccess       = "system.enable_guest_access"
	KeyEnableFileManager       = "system.enable_file_manager"
	KeyEnableWebTerminal       = "system.enable_web_terminal"
	KeyEnableMonitoring        = "system.enable_monitoring"
	KeySessionTimeout          = "system.session_timeout"
	KeyMaxLoginAttempts        = "system.max_login_attempts"
	KeyPasswordMinLength       = "system.password_min_length"
	KeyRequireTwoFactor        = "system.require_two_factor"
	KeyDefaultPageSize         = "system.default_page_size"
	KeyMaxFileUploadSize       = "system.max_file_upload_size"
	KeyEnableSystemStats       = "system.enable_system_stats"
	KeyEnableMaintenanceMode   = "system.enable_maintenance_mode"
)

// SMTPConfig SMTP 配置结构
type SMTPConfig struct {
	Enabled   bool   `json:"enabled"`
	Host      string `json:"host"`
	Port      int    `json:"port"`
	Username  string `json:"username"`
	Password  string `json:"password"`
	FromEmail string `json:"from_email"`
	FromName  string `json:"from_name"`
	UseTLS    bool   `json:"use_tls"`
}

// WebhookConfig Webhook 配置结构
type WebhookConfig struct {
	Enabled bool   `json:"enabled"`
	URL     string `json:"url"`
	Secret  string `json:"secret"`
	Method  string `json:"method"` // POST 或 GET，默认 POST
}

// DingTalkConfig 钉钉配置结构
type DingTalkConfig struct {
	Enabled    bool   `json:"enabled"`
	WebhookURL string `json:"webhook_url"`
	Secret     string `json:"secret"` // 签名密钥（可选）
}

// WeComConfig 企业微信配置结构
type WeComConfig struct {
	Enabled    bool   `json:"enabled"`
	WebhookURL string `json:"webhook_url"`
}

// SystemConfig 系统通用配置结构
type SystemConfig struct {
	// 基本设置
	SystemName        string `json:"system_name"`
	SystemDescription string `json:"system_description"`
	SystemLogo        string `json:"system_logo"`
	SystemFavicon     string `json:"system_favicon"`

	// 国际化设置
	DefaultLanguage string `json:"default_language"`
	DefaultTimezone string `json:"default_timezone"`
	DateFormat      string `json:"date_format"`

	// 功能设置
	EnableUserRegistration bool `json:"enable_user_registration"`
	EnableGuestAccess      bool `json:"enable_guest_access"`
	EnableFileManager      bool `json:"enable_file_manager"`
	EnableWebTerminal      bool `json:"enable_web_terminal"`
	EnableMonitoring       bool `json:"enable_monitoring"`

	// 安全设置
	SessionTimeout    int `json:"session_timeout"`
	MaxLoginAttempts  int `json:"max_login_attempts"`
	PasswordMinLength int `json:"password_min_length"`
	RequireTwoFactor  bool `json:"require_two_factor"`

	// 其他设置
	DefaultPageSize         int  `json:"default_page_size"`
	MaxFileUploadSize       int  `json:"max_file_upload_size"`
	EnableSystemStats       bool `json:"enable_system_stats"`
	EnableMaintenanceMode   bool `json:"enable_maintenance_mode"`
}
