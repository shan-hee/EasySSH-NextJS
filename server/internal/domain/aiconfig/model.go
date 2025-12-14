package aiconfig

import (
	"time"

	"gorm.io/gorm"
)

// AIConfig AI系统配置模型（仅系统级配置）
type AIConfig struct {
	ID uint `gorm:"primarykey" json:"id"`

	// 系统级配置
	SystemEnabled      bool   `gorm:"default:false" json:"system_enabled"`
	SystemProvider     string `gorm:"size:20" json:"system_provider"`           // openai, anthropic, azure, custom
	SystemAPIKey       string `gorm:"type:text" json:"-"`                       // API密钥（不对外输出）
	SystemAPIEndpoint  string `gorm:"type:text" json:"system_api_endpoint"`
	SystemDefaultModel string `gorm:"size:100" json:"system_default_model"`
	SystemRateLimit    int    `gorm:"default:0" json:"system_rate_limit"` // 0表示无限制

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (AIConfig) TableName() string {
	return "ai_config"
}
