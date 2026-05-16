package sftp

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// TrashSettings 用户回收站配置（用户级别覆盖系统默认值）
type TrashSettings struct {
	ID     uuid.UUID `gorm:"type:char(36);primary_key" json:"id"`
	UserID uuid.UUID `gorm:"type:char(36);not null;uniqueIndex" json:"user_id"`

	// 保留期（小时），0 表示使用系统默认值
	RetentionHours int `gorm:"not null;default:0" json:"retention_hours"`

	// 单个 .trash 目录最大条目数，0 表示使用系统默认值
	MaxEntriesPerDir int `gorm:"not null;default:0" json:"max_entries_per_dir"`

	// 单个 .trash 目录最大占用空间（MB），0 表示使用系统默认值
	MaxBytesPerDirMB int `gorm:"not null;default:0" json:"max_bytes_per_dir_mb"`

	// 是否启用自动清理（使用值类型避免空指针风险）
	AutoCleanEnabled bool `gorm:"not null;default:true" json:"auto_clean_enabled"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (TrashSettings) TableName() string {
	return "sftp_trash_settings"
}

func (s *TrashSettings) BeforeCreate(tx *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}

// GetRetentionHoursOrDefault 获取保留期，若未设置则返回系统默认值
func (s *TrashSettings) GetRetentionHoursOrDefault(systemDefault int) int {
	if s == nil || s.RetentionHours <= 0 {
		return systemDefault
	}
	return s.RetentionHours
}

// GetMaxEntriesPerDirOrDefault 获取最大条目数，若未设置则返回系统默认值
func (s *TrashSettings) GetMaxEntriesPerDirOrDefault(systemDefault int) int {
	if s == nil || s.MaxEntriesPerDir <= 0 {
		return systemDefault
	}
	return s.MaxEntriesPerDir
}

// GetMaxBytesPerDirMBOrDefault 获取最大空间，若未设置则返回系统默认值
func (s *TrashSettings) GetMaxBytesPerDirMBOrDefault(systemDefault int) int {
	if s == nil || s.MaxBytesPerDirMB <= 0 {
		return systemDefault
	}
	return s.MaxBytesPerDirMB
}

// IsAutoCleanEnabled 检查是否启用自动清理
func (s *TrashSettings) IsAutoCleanEnabled() bool {
	if s == nil {
		return true // 默认启用
	}
	return s.AutoCleanEnabled
}
