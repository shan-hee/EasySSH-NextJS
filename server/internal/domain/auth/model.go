package auth

import (
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// UserRole 用户角色类型
type UserRole string

const (
	RoleAdmin  UserRole = "admin"
	RoleUser   UserRole = "user"
	RoleViewer UserRole = "viewer"
)

// MonitorDataSourceType 监控数据源类型
type MonitorDataSourceType string

const (
	MonitorDataSourceEasySSH MonitorDataSourceType = "easyssh" // SSH 直连采集（默认）
	MonitorDataSourceNezha   MonitorDataSourceType = "nezha"   // Nezha Dashboard API
	MonitorDataSourceKomari  MonitorDataSourceType = "komari"  // Komari Monitor REST API
)

// User 用户模型
type User struct {
	ID        uuid.UUID `gorm:"type:char(36);primary_key" json:"id"`
	Username  string    `gorm:"not null;size:50" json:"username"` // 允许重复，用户可修改
	Email     string    `gorm:"uniqueIndex;not null;size:100" json:"email"`
	Password  string    `gorm:"not null;size:255" json:"-"` // bcrypt hash，不在 JSON 中返回
	Role      UserRole  `gorm:"type:varchar(20);default:'user'" json:"role"`
	Avatar    string    `gorm:"type:text" json:"avatar"`
	GoogleSub *string   `gorm:"uniqueIndex;size:255" json:"-"` // Google OIDC subject，OAuth 账户稳定标识
	// 个性化偏好
	Language         string `gorm:"size:20;default:''" json:"language"` // 用户界面语言偏好，如 zh-CN、en-US
	Timezone         string `gorm:"size:50;default:''" json:"timezone"` // 用户时区偏好，如 Asia/Shanghai
	TwoFactorEnabled bool   `gorm:"default:false" json:"two_factor_enabled"`
	TwoFactorSecret  string `gorm:"size:255" json:"-"`  // TOTP secret，不在 JSON 中返回
	BackupCodes      string `gorm:"type:text" json:"-"` // 备份码列表（JSON 格式），不在 JSON 中返回

	// 通知设置
	NotifyEmailLogin  bool `gorm:"default:true" json:"notify_email_login"`  // 登录邮件通知
	NotifyEmailAlert  bool `gorm:"default:true" json:"notify_email_alert"`  // 告警邮件通知
	NotifyBrowser     bool `gorm:"default:true" json:"notify_browser"`      // 浏览器通知
	NotifyNewDevice   bool `gorm:"default:true" json:"notify_new_device"`   // 新设备登录通知
	NotifyNewLocation bool `gorm:"default:true" json:"notify_new_location"` // 新地点登录通知
	NotifySuspicious  bool `gorm:"default:true" json:"notify_suspicious"`   // 可疑登录通知

	// 账户锁定相关
	FailedLoginAttempts int        `gorm:"default:0" json:"failed_login_attempts,omitempty"`     // 连续失败登录次数
	LastFailedLogin     *time.Time `json:"-"`                                                    // 最后一次登录失败时间
	LockedUntil         *time.Time `gorm:"index:idx_users_locked" json:"locked_until,omitempty"` // 锁定截止时间
	LockReason          string     `gorm:"size:200" json:"lock_reason,omitempty"`                // 锁定原因

	// 监控数据源设置
	// MonitorDataSource: 当前选中的数据源类型 (easyssh/nezha/komari)
	// 每个外部数据源单独存储配置，切换时配置不会丢失
	MonitorDataSource string `gorm:"size:20;default:'easyssh'" json:"monitor_data_source"` // 当前选中的数据源
	// Nezha 数据源配置
	NezhaAPIEndpoint string `gorm:"type:text" json:"nezha_api_endpoint"` // Nezha API 地址
	NezhaAPIToken    string `gorm:"type:text" json:"-"`                  // Nezha API Token（加密存储）
	// Komari 数据源配置
	KomariAPIEndpoint string `gorm:"type:text" json:"komari_api_endpoint"` // Komari API 地址
	KomariAPIToken    string `gorm:"type:text" json:"-"`                   // Komari API Token（加密存储）

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"` // 软删除
}

// TableName 指定表名
func (User) TableName() string {
	return "users"
}

// BeforeCreate GORM 钩子：创建前生成 UUID
func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}

// SetPassword 设置密码（bcrypt 加密）
func (u *User) SetPassword(password string) error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u.Password = string(hashedPassword)
	return nil
}

// CheckPassword 验证密码
func (u *User) CheckPassword(password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(password))
	return err == nil
}

// IsAdmin 判断是否是管理员
func (u *User) IsAdmin() bool {
	return u.Role == RoleAdmin
}

// IsViewer 判断是否是只读用户
func (u *User) IsViewer() bool {
	return u.Role == RoleViewer
}

// ToPublic 转换为公开信息（不包含密码和敏感信息）
func (u *User) ToPublic() map[string]interface{} {
	return map[string]interface{}{
		"id":                  u.ID,
		"username":            u.Username,
		"email":               u.Email,
		"role":                u.Role,
		"avatar":              u.Avatar,
		"google_linked":       u.GoogleSub != nil && *u.GoogleSub != "",
		"language":            u.Language,
		"timezone":            u.Timezone,
		"two_factor_enabled":  u.TwoFactorEnabled,
		"notify_email_login":  u.NotifyEmailLogin,
		"notify_email_alert":  u.NotifyEmailAlert,
		"notify_browser":      u.NotifyBrowser,
		"notify_new_device":   u.NotifyNewDevice,
		"notify_new_location": u.NotifyNewLocation,
		"notify_suspicious":   u.NotifySuspicious,
		"monitor_data_source": u.MonitorDataSource,
		// Nezha 配置
		"nezha_api_endpoint":  u.NezhaAPIEndpoint,
		"nezha_api_token_set": u.NezhaAPIToken != "",
		// Komari 配置
		"komari_api_endpoint":  u.KomariAPIEndpoint,
		"komari_api_token_set": u.KomariAPIToken != "",
		"created_at":           u.CreatedAt,
		"updated_at":           u.UpdatedAt,
	}
}

// IsLocked 检查账户是否被锁定
func (u *User) IsLocked() bool {
	if u.LockedUntil == nil {
		return false
	}
	return time.Now().Before(*u.LockedUntil)
}

// GetLockRemainingTime 获取锁定剩余时间
func (u *User) GetLockRemainingTime() time.Duration {
	if u.LockedUntil == nil {
		return 0
	}
	remaining := time.Until(*u.LockedUntil)
	if remaining < 0 {
		return 0
	}
	return remaining
}
