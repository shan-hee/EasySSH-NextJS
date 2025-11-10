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
	KeySystemName            = "system.name"
	KeySystemLogo            = "system.logo"
	KeySystemFavicon         = "system.favicon"
	KeyDefaultLanguage       = "system.default_language"
	KeyDefaultTimezone       = "system.default_timezone"
	KeyDateFormat            = "system.date_format"
	KeyDefaultPageSize       = "system.default_page_size"
	KeyMaxFileUploadSize     = "system.max_file_upload_size"
)

// 标签/会话配置相关的键名
const (
	KeyTabMaxTabs         = "tabsession.max_tabs"
	KeyTabInactiveMinutes = "tabsession.inactive_minutes"
	KeyTabHibernate       = "tabsession.hibernate"
	KeySessionTimeout     = "tabsession.session_timeout"     // 会话超时时间（分钟）
	KeyRememberLogin      = "tabsession.remember_login"      // 是否允许记住登录状态
)

// 数据库连接池配置相关的键名
const (
	KeyDBMaxIdleConns    = "database.max_idle_conns"
	KeyDBMaxOpenConns    = "database.max_open_conns"
	KeyDBConnMaxLifetime = "database.conn_max_lifetime" // 分钟
	KeyDBConnMaxIdleTime = "database.conn_max_idle_time" // 分钟
)

// JWT 配置相关的键名
const (
	KeyJWTAccessExpire  = "jwt.access_expire_hours"
	KeyJWTRefreshExpire = "jwt.refresh_expire_hours"
)

// CORS 配置相关的键名
const (
	KeyCORSAllowedOrigins = "cors.allowed_origins" // 逗号分隔的域名列表
	KeyCORSAllowedMethods = "cors.allowed_methods" // 逗号分隔的方法列表
	KeyCORSAllowedHeaders = "cors.allowed_headers" // 逗号分隔的头部列表
)

// 速率限制配置相关的键名
const (
	KeyRateLimitLogin = "ratelimit.login" // 登录接口速率限制（次/分钟/IP）
	KeyRateLimitAPI   = "ratelimit.api"   // API 接口速率限制（次/分钟/IP）
)

// Cookie 安全配置相关的键名
const (
	KeyCookieSecure = "cookie.secure" // Cookie Secure 标志
	KeyCookieDomain = "cookie.domain" // Cookie 域名
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
	SystemName    string `json:"system_name"`
	SystemLogo    string `json:"system_logo"`
	SystemFavicon string `json:"system_favicon"`

	// 国际化设置
	DefaultLanguage string `json:"default_language"`
	DefaultTimezone string `json:"default_timezone"`
	DateFormat      string `json:"date_format"`

	// 其他设置
	DefaultPageSize   int `json:"default_page_size"`
	MaxFileUploadSize int `json:"max_file_upload_size"`
}

// TabSessionConfig 标签/会话配置结构
type TabSessionConfig struct {
	MaxTabs         int  `json:"max_tabs"`          // 最大标签页数
	InactiveMinutes int  `json:"inactive_minutes"`  // 非活动断开提醒时间（分钟）
	Hibernate       bool `json:"hibernate"`         // 是否启用后台标签页休眠
	SessionTimeout  int  `json:"session_timeout"`   // 会话超时时间（分钟）
	RememberLogin   bool `json:"remember_login"`    // 是否允许记住登录状态
}

// DatabasePoolConfig 数据库连接池配置结构
type DatabasePoolConfig struct {
	MaxIdleConns    int `json:"max_idle_conns"`    // 最大空闲连接数
	MaxOpenConns    int `json:"max_open_conns"`    // 最大打开连接数
	ConnMaxLifetime int `json:"conn_max_lifetime"` // 连接最大生命周期（分钟）
	ConnMaxIdleTime int `json:"conn_max_idle_time"` // 连接最大空闲时间（分钟）
}

// JWTConfig JWT 配置结构
type JWTConfig struct {
	AccessExpire  int `json:"access_expire"`  // 访问令牌过期时间（小时）
	RefreshExpire int `json:"refresh_expire"` // 刷新令牌过期时间（小时）
}

// CORSConfig CORS 配置结构
type CORSConfig struct {
	AllowedOrigins []string `json:"allowed_origins"` // 允许的域名列表
	AllowedMethods []string `json:"allowed_methods"` // 允许的方法列表
	AllowedHeaders []string `json:"allowed_headers"` // 允许的头部列表
}

// RateLimitConfig 速率限制配置结构
type RateLimitConfig struct {
	LoginLimit int `json:"login_limit"` // 登录接口速率限制（次/分钟/IP）
	APILimit   int `json:"api_limit"`   // API 接口速率限制（次/分钟/IP）
}

// CookieConfig Cookie 安全配置结构
type CookieConfig struct {
	Secure bool   `json:"secure"` // Cookie Secure 标志
	Domain string `json:"domain"` // Cookie 域名
}
