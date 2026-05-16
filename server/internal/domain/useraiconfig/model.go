package useraiconfig

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// UserAIConfig 用户级AI配置模型
type UserAIConfig struct {
	ID     uint      `gorm:"primarykey" json:"id"`
	UserID uuid.UUID `gorm:"type:char(36);uniqueIndex;not null" json:"user_id"` // 关联用户ID

	// 用户AI配置
	UseSystemConfig bool   `gorm:"default:true" json:"use_system_config"` // 是否使用系统配置
	CustomEnabled   bool   `gorm:"default:false" json:"custom_enabled"`   // 是否启用自定义配置
	CustomProvider  string `gorm:"size:20" json:"custom_provider"`        // openai, openai-response, gemini, anthropic
	CustomAPIKey    string `gorm:"type:text" json:"-"`                    // 用户自定义API密钥（不对外输出）
	CustomEndpoint  string `gorm:"type:text" json:"custom_endpoint"`      // 用户自定义API端点
	CustomModels    string `gorm:"type:text" json:"custom_models"`        // 可用模型列表（逗号分隔）

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (UserAIConfig) TableName() string {
	return "user_ai_config"
}
