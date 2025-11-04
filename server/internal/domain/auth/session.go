package auth

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Session 用户会话模型 - 跟踪活跃的登录会话
type Session struct {
	ID           uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID       uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	RefreshToken string         `gorm:"uniqueIndex;not null;size:500" json:"-"` // refresh token (哈希值)
	DeviceType   string         `gorm:"size:100" json:"device_type"`            // 设备类型: desktop, mobile, tablet
	DeviceName   string         `gorm:"size:200" json:"device_name"`            // 设备名称/浏览器
	IPAddress    string         `gorm:"size:45" json:"ip_address"`              // IPv4/IPv6
	Location     string         `gorm:"size:200" json:"location"`               // 地理位置
	UserAgent    string         `gorm:"type:text" json:"user_agent"`            // 完整 User-Agent
	LastActivity time.Time      `gorm:"not null" json:"last_activity"`          // 最后活动时间
	ExpiresAt    time.Time      `gorm:"not null;index" json:"expires_at"`       // 过期时间
	CreatedAt    time.Time      `json:"created_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"` // 软删除
}

// TableName 指定表名
func (Session) TableName() string {
	return "user_sessions"
}

// BeforeCreate GORM 钩子
func (s *Session) BeforeCreate(tx *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	if s.LastActivity.IsZero() {
		s.LastActivity = time.Now()
	}
	return nil
}

// IsExpired 检查会话是否已过期
func (s *Session) IsExpired() bool {
	return time.Now().After(s.ExpiresAt)
}

// IsActive 检查会话是否活跃(最近15分钟内有活动)
func (s *Session) IsActive() bool {
	return time.Since(s.LastActivity) < 15*time.Minute
}

// UpdateActivity 更新最后活动时间
func (s *Session) UpdateActivity() {
	s.LastActivity = time.Now()
}
