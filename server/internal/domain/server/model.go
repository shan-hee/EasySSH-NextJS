package server

import (
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/gorm"
)

// AuthMethod 认证方式
type AuthMethod string

const (
	AuthMethodPassword AuthMethod = "password"
	AuthMethodKey      AuthMethod = "key"
)

// ServerStatus 服务器状态
type ServerStatus string

const (
	StatusOnline  ServerStatus = "online"
	StatusOffline ServerStatus = "offline"
	StatusError   ServerStatus = "error"
	StatusUnknown ServerStatus = "unknown"
)

// Server 服务器模型
type Server struct {
	ID            uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID        uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	Name          string         `gorm:"not null;size:100" json:"name"`
	Host          string         `gorm:"not null;size:255" json:"host"`
	Port          int            `gorm:"default:22" json:"port"`
	Username      string         `gorm:"not null;size:50" json:"username"`
	AuthMethod    AuthMethod     `gorm:"type:varchar(20);not null" json:"auth_method"`
	Password      string         `gorm:"type:text" json:"-"`       // 加密存储，不在 JSON 中返回
	PrivateKey    string         `gorm:"type:text" json:"-"`       // 加密存储，不在 JSON 中返回
	Group         string         `gorm:"size:50" json:"group"`
	Tags          pq.StringArray `gorm:"type:text[]" json:"tags"`
	Status        ServerStatus   `gorm:"type:varchar(20);default:'unknown'" json:"status"`
	LastConnected *time.Time     `json:"last_connected,omitempty"`
	Description   string         `gorm:"type:text" json:"description"`
	SortOrder     int            `gorm:"default:0;index" json:"sort_order"` // 用户自定义排序顺序
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"` // 软删除
}

// TableName 指定表名
func (Server) TableName() string {
	return "servers"
}

// BeforeCreate GORM 钩子：创建前生成 UUID
func (s *Server) BeforeCreate(tx *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}

// IsOnline 判断服务器是否在线
func (s *Server) IsOnline() bool {
	return s.Status == StatusOnline
}

// ToPublic 转换为公开信息（不包含密码和私钥）
func (s *Server) ToPublic() map[string]interface{} {
	result := map[string]interface{}{
		"id":          s.ID,
		"user_id":     s.UserID,
		"name":        s.Name,
		"host":        s.Host,
		"port":        s.Port,
		"username":    s.Username,
		"auth_method": s.AuthMethod,
		"group":       s.Group,
		"tags":        s.Tags,
		"status":      s.Status,
		"description": s.Description,
		"sort_order":  s.SortOrder,
		"created_at":  s.CreatedAt,
		"updated_at":  s.UpdatedAt,
	}

	if s.LastConnected != nil {
		result["last_connected"] = s.LastConnected
	}

	return result
}

// UpdateStatus 更新服务器状态
func (s *Server) UpdateStatus(status ServerStatus) {
	s.Status = status
	if status == StatusOnline {
		now := time.Now()
		s.LastConnected = &now
	}
}
