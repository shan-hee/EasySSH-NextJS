package script

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Script 脚本模型
type Script struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key" json:"id"`
	UserID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	Name        string         `gorm:"type:varchar(100);not null" json:"name"`
	Description string         `gorm:"type:text" json:"description"`
	Content     string         `gorm:"type:text;not null" json:"content"`
	Language    string         `gorm:"type:varchar(20);default:'bash'" json:"language"`
	Tags        []string       `gorm:"type:jsonb;serializer:json" json:"tags"`
	Executions  int            `gorm:"default:0" json:"executions"`
	Author      string         `gorm:"type:varchar(50)" json:"author"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (Script) TableName() string {
	return "scripts"
}

// BeforeCreate GORM 钩子：创建前自动生成 UUID
func (s *Script) BeforeCreate(tx *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}

// CreateScriptRequest 创建脚本请求
type CreateScriptRequest struct {
	Name        string   `json:"name" binding:"required"`
	Description string   `json:"description"`
	Content     string   `json:"content" binding:"required"`
	Language    string   `json:"language"`
	Tags        []string `json:"tags"`
}

// UpdateScriptRequest 更新脚本请求
type UpdateScriptRequest struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Content     string   `json:"content"`
	Language    string   `json:"language"`
	Tags        []string `json:"tags"`
}

// ListScriptsRequest 脚本列表查询请求
type ListScriptsRequest struct {
	Page     int      `form:"page" json:"page"`
	Limit    int      `form:"limit" json:"limit"`
	Search   string   `form:"search" json:"search"`     // 搜索关键词
	Tags     []string `form:"tags" json:"tags"`         // 标签筛选
	Language string   `form:"language" json:"language"` // 语言筛选
}

// ListScriptsResponse 脚本列表响应
type ListScriptsResponse struct {
	Data       []Script `json:"data"`
	Total      int64    `json:"total"`
	Page       int      `json:"page"`
	PageSize   int      `json:"page_size"`
	TotalPages int      `json:"total_pages"`
}
