package operationrecord

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type RecordType string

const (
	TypeConnection RecordType = "connection"
	TypeTransfer   RecordType = "transfer"
	TypeExecution  RecordType = "execution"
)

type Status string

const (
	StatusPending  Status = "pending"
	StatusRunning  Status = "running"
	StatusSuccess  Status = "success"
	StatusFailure  Status = "failure"
	StatusPartial  Status = "partial"
	StatusCanceled Status = "canceled"
	StatusTimeout  Status = "timeout"
)

// OperationRecord 统一承载连接、传输、执行等用户操作型历史。
type OperationRecord struct {
	ID     uuid.UUID `gorm:"type:char(36);primary_key" json:"id"`
	UserID uuid.UUID `gorm:"type:char(36);not null;index;index:idx_operation_user_time,priority:1" json:"user_id"`

	Username string     `gorm:"size:50" json:"username"`
	Type     RecordType `gorm:"type:varchar(30);not null;index;index:idx_operation_type_time,priority:1" json:"type"`
	Action   string     `gorm:"type:varchar(50);not null;index" json:"action"`
	Status   Status     `gorm:"type:varchar(30);not null;index" json:"status"`

	ServerID   *uuid.UUID `gorm:"type:char(36);index" json:"server_id,omitempty"`
	ServerName string     `gorm:"size:100" json:"server_name"`
	Title      string     `gorm:"size:255" json:"title"`
	Resource   string     `gorm:"type:text" json:"resource"`
	Source     string     `gorm:"size:50;index" json:"source"`

	StartedAt  *time.Time `gorm:"index" json:"started_at,omitempty"`
	FinishedAt *time.Time `gorm:"index" json:"finished_at,omitempty"`
	DurationMs int64      `gorm:"default:0" json:"duration_ms"`

	Progress     int `gorm:"default:0" json:"progress"`
	TotalCount   int `gorm:"default:0" json:"total_count"`
	SuccessCount int `gorm:"default:0" json:"success_count"`
	FailureCount int `gorm:"default:0" json:"failure_count"`

	BytesTotal     int64 `gorm:"default:0" json:"bytes_total"`
	BytesProcessed int64 `gorm:"default:0" json:"bytes_processed"`
	SpeedBps       int64 `gorm:"default:0" json:"speed_bps"`

	ErrorMessage string `gorm:"type:text" json:"error_message,omitempty"`
	DetailJSON   string `gorm:"type:text" json:"detail_json,omitempty"`

	SourceTable string `gorm:"size:80;not null;uniqueIndex:idx_operation_source" json:"source_table"`
	SourceID    string `gorm:"size:80;not null;uniqueIndex:idx_operation_source" json:"source_id"`

	CreatedAt time.Time      `gorm:"index;index:idx_operation_user_time,priority:2,sort:desc;index:idx_operation_type_time,priority:2,sort:desc" json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (OperationRecord) TableName() string {
	return "operation_records"
}

func (r *OperationRecord) BeforeCreate(tx *gorm.DB) error {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	return nil
}

type ListRequest struct {
	UserID    *uuid.UUID
	Type      RecordType
	Action    string
	Status    Status
	ServerID  *uuid.UUID
	StartTime *time.Time
	EndTime   *time.Time
	Page      int
	PageSize  int
}

type ListResponse struct {
	Records    []*OperationRecord `json:"records"`
	Total      int64              `json:"total"`
	Page       int                `json:"page"`
	PageSize   int                `json:"page_size"`
	TotalPages int                `json:"total_pages"`
}

type StatisticsRequest struct {
	UserID    *uuid.UUID
	Type      RecordType
	StartTime *time.Time
	EndTime   *time.Time
	Days      int
}

type Statistics struct {
	Total        int64                `json:"total"`
	SuccessCount int64                `json:"success_count"`
	FailureCount int64                `json:"failure_count"`
	RunningCount int64                `json:"running_count"`
	ByType       map[RecordType]int64 `json:"by_type"`
	ByStatus     map[Status]int64     `json:"by_status"`
}
