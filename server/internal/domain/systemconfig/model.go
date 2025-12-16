package systemconfig

import (
	"time"

	"gorm.io/gorm"
)

// SystemConfig 系统配置模型
type SystemConfig struct {
	ID uint `gorm:"primarykey" json:"id"`

	// 基本信息
	SystemName    string `gorm:"size:100;not null;default:'EasySSH'" json:"system_name"`
	SystemLogo    string `gorm:"type:text" json:"system_logo"`
	SystemFavicon string `gorm:"type:text" json:"system_favicon"`

	// 国际化设置
	DefaultLanguage string `gorm:"size:10;not null;default:'zh-CN'" json:"default_language"`
	DefaultTimezone string `gorm:"size:50;not null;default:'Asia/Shanghai'" json:"default_timezone"`
	DateFormat      string `gorm:"size:50;not null;default:'YYYY-MM-DD HH:mm:ss'" json:"date_format"`

	// 文件传输设置
	DownloadExcludePatterns string `gorm:"type:text" json:"download_exclude_patterns"`
	DefaultDownloadMode     string `gorm:"size:20;not null;default:'fast'" json:"default_download_mode"`
	SkipExcludedOnUpload    bool   `gorm:"not null;default:true" json:"skip_excluded_on_upload"`
	MaxFileUploadSize       int    `gorm:"not null;default:100" json:"max_file_upload_size"` // MB

	// 补全配置（JSON存储）
	CompletionEnabled   bool   `gorm:"not null;default:true" json:"completion_enabled"`
	CompletionProviders string `gorm:"type:jsonb" json:"completion_providers"` // JSON: CompletionProvidersConfig
	CompletionQuotas    string `gorm:"type:jsonb" json:"completion_quotas"`    // JSON: CompletionQuotasConfig
	CompletionCache     string `gorm:"type:jsonb" json:"completion_cache"`     // JSON: CompletionCacheConfig

	// 注册配置
	AllowRegistration bool   `gorm:"not null;default:false" json:"allow_registration"`
	DefaultRole       string `gorm:"size:20;not null;default:'user'" json:"default_role"` // 新用户默认角色: user, viewer

	// OAuth 配置
	OAuthEnabled       bool   `gorm:"not null;default:false" json:"oauth_enabled"`
	GoogleClientID     string `gorm:"size:255" json:"google_client_id"`
	GoogleClientSecret string `gorm:"size:255" json:"-"` // 加密存储，不返回给前端

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (SystemConfig) TableName() string {
	return "system_config"
}

// CompletionProvidersConfig 补全提供者配置
type CompletionProvidersConfig struct {
	Local         bool `json:"local"`          // 本地命令库
	RemoteHistory bool `json:"remote_history"` // 远端历史命令
	Script        bool `json:"script"`         // 脚本库
	Session       bool `json:"session"`        // 会话历史
}

// CompletionQuotasConfig 补全配额配置
type CompletionQuotasConfig struct {
	LocalMin               int  `json:"local_min"`                 // 本地命令库最少数量
	LocalMax               int  `json:"local_max"`                 // 本地命令库最多数量
	ScriptMin              int  `json:"script_min"`                // 脚本库最少数量
	ScriptMax              int  `json:"script_max"`                // 脚本库最多数量
	SessionMin             int  `json:"session_min"`               // 会话历史最少数量
	SessionMax             int  `json:"session_max"`               // 会话历史最多数量
	RemoteHistoryUnlimited bool `json:"remote_history_unlimited"`  // 远端历史是否无限制
	RemoteHistorySoftMax   int  `json:"remote_history_soft_max"`   // 远端历史软上限
}

// CompletionCacheConfig 补全缓存配置
type CompletionCacheConfig struct {
	TTLMinutes int `json:"ttl_minutes"` // 缓存TTL（分钟）
	MaxEntries int `json:"max_entries"` // 最大缓存条目数
}

// DefaultCompletionProviders 默认补全提供者配置
func DefaultCompletionProviders() *CompletionProvidersConfig {
	return &CompletionProvidersConfig{
		Local:         true,
		RemoteHistory: true,
		Script:        true,
		Session:       true,
	}
}

// DefaultCompletionQuotas 默认补全配额配置
func DefaultCompletionQuotas() *CompletionQuotasConfig {
	return &CompletionQuotasConfig{
		LocalMin:               1,
		LocalMax:               3,
		ScriptMin:              0,
		ScriptMax:              2,
		SessionMin:             0,
		SessionMax:             2,
		RemoteHistoryUnlimited: true,
		RemoteHistorySoftMax:   7,
	}
}

// DefaultCompletionCache 默认补全缓存配置
func DefaultCompletionCache() *CompletionCacheConfig {
	return &CompletionCacheConfig{
		TTLMinutes: 5,
		MaxEntries: 100,
	}
}

// DefaultDownloadExcludePatterns 默认下载排除规则
func DefaultDownloadExcludePatterns() string {
	return `node_modules
.git
.svn
.hg
.DS_Store
Thumbs.db
*.tmp
*.log
*.swp
*.bak
__pycache__
.pytest_cache
.venv
venv
dist
build
target`
}
