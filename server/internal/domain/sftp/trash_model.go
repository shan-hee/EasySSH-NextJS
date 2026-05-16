package sftp

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// TrashDir 记录一个需要清理的远端 .trash 目录（按 user/server 维度）
type TrashDir struct {
	ID       uuid.UUID `gorm:"type:char(36);primary_key" json:"id"`
	UserID   uuid.UUID `gorm:"type:char(36);not null;index;uniqueIndex:idx_sftp_trash_dir_key" json:"user_id"`
	ServerID uuid.UUID `gorm:"type:char(36);not null;index;uniqueIndex:idx_sftp_trash_dir_key" json:"server_id"`
	Path     string    `gorm:"type:text;not null" json:"path"`
	PathHash string    `gorm:"size:64;not null;uniqueIndex:idx_sftp_trash_dir_key" json:"-"`
	LastSeen time.Time `gorm:"not null;index" json:"last_seen"`

	LastCleanedAt *time.Time `gorm:"index" json:"last_cleaned_at,omitempty"`

	FailCount     int       `gorm:"not null;default:0" json:"fail_count"`
	NextAttemptAt time.Time `gorm:"not null;index" json:"next_attempt_at"`
	LastError     string    `gorm:"type:text" json:"last_error,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (TrashDir) TableName() string {
	return "sftp_trash_dirs"
}

func (t *TrashDir) BeforeCreate(tx *gorm.DB) error {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	if t.PathHash == "" {
		t.PathHash = hashText(t.Path)
	}
	return nil
}
