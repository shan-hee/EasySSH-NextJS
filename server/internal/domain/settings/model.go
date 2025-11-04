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
