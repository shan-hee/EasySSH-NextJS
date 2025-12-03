package useraiconfig

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// UserAIConfig 用户级AI配置模型
type UserAIConfig struct {
	ID     uint      `gorm:"primarykey" json:"id"`
	UserID uuid.UUID `gorm:"type:uuid;uniqueIndex;not null" json:"user_id"` // 关联用户ID

	// 用户AI配置
	UseSystemConfig bool   `gorm:"default:true" json:"use_system_config"`   // 是否使用系统配置
	CustomEnabled   bool   `gorm:"default:false" json:"custom_enabled"`     // 是否启用自定义配置
	CustomProvider  string `gorm:"size:20" json:"custom_provider"`          // openai, anthropic, azure, custom
	CustomAPIKey    string `gorm:"type:text" json:"custom_api_key"`         // 用户自定义API密钥（加密存储）
	CustomEndpoint  string `gorm:"type:text" json:"custom_endpoint"`        // 用户自定义API端点
	CustomModel     string `gorm:"size:100" json:"custom_model"`            // 用户自定义模型

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (UserAIConfig) TableName() string {
	return "user_ai_config"
}
