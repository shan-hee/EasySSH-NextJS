package auth

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Session 用户会话模型 - 跟踪活跃的登录会话
type Session struct {
	ID                             uuid.UUID      `gorm:"type:char(36);primary_key" json:"id"`
	UserID                         uuid.UUID      `gorm:"type:char(36);not null;index;index:idx_sessions_user_expires,priority:1" json:"user_id"`
	RefreshToken                   string         `gorm:"uniqueIndex;not null;size:500" json:"-"`                                                // refresh token (哈希值)
	PreviousRefreshToken           string         `gorm:"size:500;index" json:"-"`                                                               // 上一个 refresh token 哈希，用于短暂并发刷新宽限
	PreviousRefreshTokenValidUntil *time.Time     `json:"-"`                                                                                     // 上一个 refresh token 的宽限截止时间
	DeviceType                     string         `gorm:"size:100" json:"device_type"`                                                           // 设备类型: desktop, mobile, tablet
	DeviceName                     string         `gorm:"size:200" json:"device_name"`                                                           // 设备名称/浏览器
	IPAddress                      string         `gorm:"size:45" json:"ip_address"`                                                             // IPv4/IPv6
	Location                       string         `gorm:"size:200" json:"location"`                                                              // 地理位置
	UserAgent                      string         `gorm:"type:text" json:"user_agent"`                                                           // 完整 User-Agent
	LastActivity                   time.Time      `gorm:"not null" json:"last_activity"`                                                         // 最后活动时间
	ExpiresAt                      time.Time      `gorm:"not null;index;index:idx_sessions_user_expires,priority:2,sort:desc" json:"expires_at"` // 过期时间，复合索引优化按用户查询活跃会话
	CreatedAt                      time.Time      `json:"created_at"`
	DeletedAt                      gorm.DeletedAt `gorm:"index" json:"-"` // 软删除

	// 登录检测相关字段
	DeviceFingerprint string `gorm:"size:64;index:idx_sessions_user_device" json:"device_fingerprint"` // 设备指纹
	IsNewDevice       bool   `gorm:"default:false" json:"is_new_device"`                               // 是否为新设备
	IsNewLocation     bool   `gorm:"default:false" json:"is_new_location"`                             // 是否为新位置
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
