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
	ID        uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Username  string         `gorm:"uniqueIndex;not null;size:50" json:"username"`
	Email     string         `gorm:"uniqueIndex;not null;size:100" json:"email"`
	Password  string         `gorm:"not null;size:255" json:"-"` // bcrypt hash，不在 JSON 中返回
	Role      UserRole       `gorm:"type:varchar(20);default:'user'" json:"role"`
	Avatar    string         `gorm:"size:255" json:"avatar"`
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

// ToPublic 转换为公开信息（不包含密码）
func (u *User) ToPublic() map[string]interface{} {
	return map[string]interface{}{
		"id":         u.ID,
		"username":   u.Username,
		"email":      u.Email,
		"role":       u.Role,
		"avatar":     u.Avatar,
		"created_at": u.CreatedAt,
		"updated_at": u.UpdatedAt,
	}
}
