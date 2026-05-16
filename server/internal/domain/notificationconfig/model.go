package notificationconfig

import (
	"time"

	"gorm.io/gorm"
)

// NotificationConfig 通知配置模型
type NotificationConfig struct {
	ID uint `gorm:"primarykey" json:"id"`

	// SMTP配置（JSON存储）
	SMTPConfig string `gorm:"type:text" json:"smtp_config"` // JSON: SMTPConfig

	// Webhook配置（JSON存储）
	WebhookConfig string `gorm:"type:text" json:"webhook_config"` // JSON: WebhookConfig

	// 钉钉配置（JSON存储）
	DingTalkConfig string `gorm:"type:text" json:"dingtalk_config"` // JSON: DingTalkConfig

	// 企业微信配置（JSON存储）
	WeComConfig string `gorm:"type:text" json:"wecom_config"` // JSON: WeComConfig

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (NotificationConfig) TableName() string {
	return "notification_config"
}

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

// AllNotificationConfig 所有通知配置的统一结构
type AllNotificationConfig struct {
	SMTP     *SMTPConfig     `json:"smtp"`
	Webhook  *WebhookConfig  `json:"webhook"`
	DingTalk *DingTalkConfig `json:"dingtalk"`
	WeCom    *WeComConfig    `json:"wecom"`
}
