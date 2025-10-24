package filetransfer

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// FileTransfer 文件传输记录模型
type FileTransfer struct {
	ID           uuid.UUID      `gorm:"type:uuid;primary_key" json:"id"`
	UserID       uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	ServerID     uuid.UUID      `gorm:"type:uuid;not null;index" json:"server_id"`
	SessionID    string         `gorm:"type:varchar(100);index" json:"session_id"`
	TransferType string         `gorm:"type:varchar(20);not null;index" json:"transfer_type"` // upload/download
	SourcePath   string         `gorm:"type:text;not null" json:"source_path"`
	DestPath     string         `gorm:"type:text;not null" json:"dest_path"`
	FileName     string         `gorm:"type:varchar(255);not null" json:"file_name"`
	FileSize     int64          `gorm:"not null" json:"file_size"` // 字节
	Status       string         `gorm:"type:varchar(20);default:'pending';index" json:"status"` // pending/transferring/completed/failed
	Progress     int            `gorm:"default:0" json:"progress"` // 百分比 0-100
	BytesTransferred int64     `gorm:"default:0" json:"bytes_transferred"`
	StartedAt    *time.Time     `json:"started_at,omitempty"`
	CompletedAt  *time.Time     `json:"completed_at,omitempty"`
	Duration     int            `json:"duration,omitempty"` // 传输时长(秒)
	Speed        int64          `json:"speed,omitempty"` // 传输速度(字节/秒)
	ErrorMessage string         `gorm:"type:text" json:"error_message,omitempty"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate GORM钩子：创建前生成UUID
func (ft *FileTransfer) BeforeCreate(tx *gorm.DB) error {
	if ft.ID == uuid.Nil {
		ft.ID = uuid.New()
	}
	return nil
}

// TableName 指定表名
func (FileTransfer) TableName() string {
	return "file_transfers"
}

// CreateFileTransferRequest 创建文件传输记录请求
type CreateFileTransferRequest struct {
	UserID       uuid.UUID `json:"user_id" binding:"required"`
	ServerID     uuid.UUID `json:"server_id" binding:"required"`
	SessionID    string    `json:"session_id"`
	TransferType string    `json:"transfer_type" binding:"required,oneof=upload download"`
	SourcePath   string    `json:"source_path" binding:"required"`
	DestPath     string    `json:"dest_path" binding:"required"`
	FileName     string    `json:"file_name" binding:"required"`
	FileSize     int64     `json:"file_size" binding:"required"`
}

// UpdateFileTransferRequest 更新文件传输记录请求
type UpdateFileTransferRequest struct {
	Status           string  `json:"status,omitempty"`
	Progress         *int    `json:"progress,omitempty"`
	BytesTransferred *int64  `json:"bytes_transferred,omitempty"`
	ErrorMessage     string  `json:"error_message,omitempty"`
}

// ListFileTransfersRequest 文件传输列表查询请求
type ListFileTransfersRequest struct {
	Page         int    `form:"page" json:"page"`
	Limit        int    `form:"limit" json:"limit"`
	Status       string `form:"status" json:"status"`
	TransferType string `form:"transfer_type" json:"transfer_type"`
	ServerID     string `form:"server_id" json:"server_id"`
}

// ListFileTransfersResponse 文件传输列表响应
type ListFileTransfersResponse struct {
	Data       []FileTransfer `json:"data"`
	Total      int64          `json:"total"`
	Page       int            `json:"page"`
	PageSize   int            `json:"page_size"`
	TotalPages int            `json:"total_pages"`
}

// FileTransferStatistics 文件传输统计信息
type FileTransferStatistics struct {
	TotalTransfers    int64          `json:"total_transfers"`
	CompletedTransfers int64         `json:"completed_transfers"`
	FailedTransfers   int64          `json:"failed_transfers"`
	TotalBytesUploaded int64         `json:"total_bytes_uploaded"`
	TotalBytesDownloaded int64       `json:"total_bytes_downloaded"`
	ByType            map[string]int `json:"by_type"` // upload/download
	ByStatus          map[string]int `json:"by_status"`
}
