package tabsession

import (
	"time"

	"gorm.io/gorm"
)

// TabSessionSettings 标签/会话配置模型
type TabSessionSettings struct {
	ID               uint           `gorm:"primarykey" json:"id"`
	MaxTabs          int            `gorm:"not null;default:50;check:max_tabs > 0 AND max_tabs <= 200" json:"max_tabs"`
	InactiveMinutes  int            `gorm:"not null;default:60;check:inactive_minutes >= 5 AND inactive_minutes <= 1440" json:"inactive_minutes"`
	Hibernate        bool           `gorm:"not null;default:true" json:"hibernate"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (TabSessionSettings) TableName() string {
	return "tab_session_settings"
}

// DefaultTabSessionSettings 返回默认配置
func DefaultTabSessionSettings() *TabSessionSettings {
	return &TabSessionSettings{
		MaxTabs:         50,
		InactiveMinutes: 60,
		Hibernate:       true,
	}
}

// Validate 验证配置是否合法
func (t *TabSessionSettings) Validate() error {
	if t.MaxTabs <= 0 || t.MaxTabs > 200 {
		return ErrInvalidMaxTabs
	}
	if t.InactiveMinutes < 5 || t.InactiveMinutes > 1440 {
		return ErrInvalidInactiveMinutes
	}
	return nil
}

// 错误定义
var (
	ErrInvalidMaxTabs         = NewValidationError("max_tabs", "最大标签页数必须在1-200之间")
	ErrInvalidInactiveMinutes = NewValidationError("inactive_minutes", "非活动时间必须在5-1440分钟之间")
)

// ValidationError 验证错误
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

func (e ValidationError) Error() string {
	return e.Message
}

func NewValidationError(field, message string) error {
	return ValidationError{
		Field:   field,
		Message: message,
	}
}