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

// User 用户模型
type User struct {
	ID               uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Username         string         `gorm:"uniqueIndex;not null;size:50" json:"username"`
	Email            string         `gorm:"uniqueIndex;not null;size:100" json:"email"`
	Password         string         `gorm:"not null;size:255" json:"-"` // bcrypt hash，不在 JSON 中返回
	Role             UserRole       `gorm:"type:varchar(20);default:'user'" json:"role"`
	Avatar           string         `gorm:"type:text" json:"avatar"`
	// 个性化偏好
	Language         string         `gorm:"size:20;default:''" json:"language"` // 用户界面语言偏好，如 zh-CN、en-US
	Timezone         string         `gorm:"size:50;default:''" json:"timezone"` // 用户时区偏好，如 Asia/Shanghai
	TwoFactorEnabled bool           `gorm:"default:false" json:"two_factor_enabled"`
	TwoFactorSecret  string         `gorm:"size:255" json:"-"` // TOTP secret，不在 JSON 中返回
	BackupCodes      string         `gorm:"type:text" json:"-"` // 备份码列表（JSON 格式），不在 JSON 中返回

	// 通知设置
	NotifyEmailLogin  bool `gorm:"default:true" json:"notify_email_login"`   // 登录邮件通知
	NotifyEmailAlert  bool `gorm:"default:true" json:"notify_email_alert"`   // 告警邮件通知
	NotifyBrowser     bool `gorm:"default:true" json:"notify_browser"`       // 浏览器通知

	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"` // 软删除
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
		"id":                 u.ID,
		"username":           u.Username,
		"email":              u.Email,
		"role":               u.Role,
		"avatar":             u.Avatar,
		"language":           u.Language,
		"timezone":           u.Timezone,
		"two_factor_enabled": u.TwoFactorEnabled,
		"notify_email_login": u.NotifyEmailLogin,
		"notify_email_alert": u.NotifyEmailAlert,
		"notify_browser":     u.NotifyBrowser,
		"created_at":         u.CreatedAt,
		"updated_at":         u.UpdatedAt,
	}
}

// AuthorizationCode OAuth 授权码模型（用于 Authorization Code + PKCE 流程）
type AuthorizationCode struct {
	Code                string    `gorm:"primaryKey;size:255" json:"code"`                 // 授权码本体（高熵随机字符串）
	UserID              uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`         // 关联的用户 ID
	ClientID            string    `gorm:"size:100;not null;index" json:"client_id"`        // 客户端 ID（如 easyssh-web）
	RedirectURI         string    `gorm:"size:500;not null" json:"redirect_uri"`           // 回调地址
	Scope               string    `gorm:"size:255" json:"scope"`                           // 作用域（可选，逗号分隔）
	CodeChallenge       string    `gorm:"size:255;not null" json:"code_challenge"`         // PKCE code_challenge
	CodeChallengeMethod string    `gorm:"size:50;not null" json:"code_challenge_method"`   // PKCE 方法（目前仅支持 S256）
	ExpiresAt           time.Time `gorm:"not null;index" json:"expires_at"`                // 过期时间
	Used                bool      `gorm:"not null;default:false;index" json:"used"`        // 是否已使用（一次性）
	CreatedAt           time.Time `gorm:"autoCreateTime" json:"created_at"`                // 创建时间
}

// TableName 指定授权码表名
func (AuthorizationCode) TableName() string {
	return "authorization_codes"
}
