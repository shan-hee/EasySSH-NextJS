package sftp

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type TrashItemStatus string

const (
	TrashItemStatusActive    TrashItemStatus = "active"
	TrashItemStatusRestored  TrashItemStatus = "restored"
	TrashItemStatusPurged    TrashItemStatus = "purged"
	TrashItemStatusMissing   TrashItemStatus = "missing"
	TrashItemStatusPurging   TrashItemStatus = "purging"   // 正在被清理器处理（中间状态）
	TrashItemStatusRestoring TrashItemStatus = "restoring" // 正在被用户恢复（中间状态）
)

// TrashItem 回收站条目索引（用于全局回收站视图，不改变物理存储位置）
type TrashItem struct {
	ID       uuid.UUID `gorm:"type:char(36);primary_key" json:"id"`
	UserID   uuid.UUID `gorm:"type:char(36);not null;index;uniqueIndex:idx_sftp_trash_item_key" json:"user_id"`
	ServerID uuid.UUID `gorm:"type:char(36);not null;index;uniqueIndex:idx_sftp_trash_item_key" json:"server_id"`

	ParentDir    string `gorm:"type:text;not null" json:"parent_dir"`
	OriginalPath string `gorm:"type:text;not null" json:"original_path"`
	OriginalName string `gorm:"type:text;not null" json:"original_name"`

	TrashDir  string `gorm:"type:text;not null" json:"trash_dir"`
	TrashPath string `gorm:"type:text;not null" json:"trash_path"`
	TrashHash string `gorm:"size:64;not null;uniqueIndex:idx_sftp_trash_item_key" json:"-"`
	TrashName string `gorm:"type:text;not null" json:"trash_name"`

	IsDir bool   `gorm:"not null" json:"is_dir"`
	Size  int64  `gorm:"not null" json:"size"`
	Mode  uint32 `gorm:"not null" json:"mode"`

	DeletedAt time.Time       `gorm:"not null;index" json:"deleted_at"`
	Status    TrashItemStatus `gorm:"type:varchar(20);not null;index" json:"status"`

	RestoredAt   *time.Time `gorm:"index" json:"restored_at,omitempty"`
	RestoredPath string     `gorm:"type:text" json:"restored_path,omitempty"`

	PurgedAt *time.Time `gorm:"index" json:"purged_at,omitempty"`

	// Version 乐观锁版本号，用于解决清理器与用户恢复操作的竞态条件
	// 每次状态变更时递增，确保操作的原子性
	Version int64 `gorm:"not null;default:1" json:"version"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (TrashItem) TableName() string {
	return "sftp_trash_items"
}

func (t *TrashItem) BeforeCreate(tx *gorm.DB) error {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	if t.TrashHash == "" {
		t.TrashHash = hashText(t.TrashPath)
	}
	return nil
}
