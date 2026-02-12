package aiconfig

import (
	"time"

	"gorm.io/gorm"
)

// AIConfig AI系统配置模型（仅系统级配置）
type AIConfig struct {
	ID uint `gorm:"primarykey" json:"id"`

	// 系统级配置
	SystemEnabled     bool   `gorm:"default:false" json:"system_enabled"`
	SystemProvider    string `gorm:"size:20" json:"system_provider"`       // openai, openai-response, gemini, anthropic
	SystemAPIKey      string `gorm:"type:text" json:"-"`                   // API密钥（不对外输出）
	SystemAPIEndpoint string `gorm:"type:text" json:"system_api_endpoint"` // API 端点
	SystemModels      string `gorm:"type:text" json:"system_models"`       // 可用模型列表（逗号分隔）

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (AIConfig) TableName() string {
	return "ai_config"
}
