package batchtask

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// BatchTask 批量任务模型
type BatchTask struct {
	ID            uuid.UUID      `gorm:"type:uuid;primary_key" json:"id"`
	UserID        uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	TaskName      string         `gorm:"type:varchar(100);not null" json:"task_name"`
	TaskType      string         `gorm:"type:varchar(20);not null" json:"task_type"` // command/script/file
	Content       string         `gorm:"type:text" json:"content"`                   // 命令内容或文件路径
	ScriptID      *uuid.UUID     `gorm:"type:uuid" json:"script_id,omitempty"`       // 关联的脚本ID
	ServerIDs     []string       `gorm:"type:jsonb;serializer:json;not null" json:"server_ids"`
	ExecutionMode string         `gorm:"type:varchar(20);default:'parallel'" json:"execution_mode"` // parallel/sequential
	Status        string         `gorm:"type:varchar(20);default:'pending'" json:"status"`          // pending/running/completed/failed
	SuccessCount  int            `gorm:"default:0" json:"success_count"`
	FailedCount   int            `gorm:"default:0" json:"failed_count"`
	StartedAt     *time.Time     `json:"started_at,omitempty"`
	CompletedAt   *time.Time     `json:"completed_at,omitempty"`
	Duration      int            `json:"duration,omitempty"` // 执行耗时（秒）
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (BatchTask) TableName() string {
	return "batch_tasks"
}

// BeforeCreate GORM 钩子：创建前自动生成 UUID
func (b *BatchTask) BeforeCreate(tx *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	return nil
}

// CreateBatchTaskRequest 创建批量任务请求
type CreateBatchTaskRequest struct {
	TaskName      string    `json:"task_name" binding:"required"`
	TaskType      string    `json:"task_type" binding:"required,oneof=command script file"`
	Content       string    `json:"content"`
	ScriptID      *string   `json:"script_id,omitempty"`
	ServerIDs     []string  `json:"server_ids" binding:"required,min=1"`
	ExecutionMode string    `json:"execution_mode"`
}

// UpdateBatchTaskRequest 更新批量任务请求
type UpdateBatchTaskRequest struct {
	TaskName      string   `json:"task_name,omitempty"`
	Content       string   `json:"content,omitempty"`
	ServerIDs     []string `json:"server_ids,omitempty"`
	ExecutionMode string   `json:"execution_mode,omitempty"`
}

// ListBatchTasksRequest 批量任务列表查询请求
type ListBatchTasksRequest struct {
	Page     int    `form:"page" json:"page"`
	Limit    int    `form:"limit" json:"limit"`
	Status   string `form:"status" json:"status"`     // 状态筛选
	TaskType string `form:"task_type" json:"task_type"` // 类型筛选
}

// ListBatchTasksResponse 批量任务列表响应
type ListBatchTasksResponse struct {
	Data       []BatchTask `json:"data"`
	Total      int64       `json:"total"`
	Page       int         `json:"page"`
	PageSize   int         `json:"page_size"`
	TotalPages int         `json:"total_pages"`
}

// BatchTaskStatistics 批量任务统计
type BatchTaskStatistics struct {
	TotalTasks     int64          `json:"total_tasks"`
	PendingTasks   int64          `json:"pending_tasks"`
	RunningTasks   int64          `json:"running_tasks"`
	CompletedTasks int64          `json:"completed_tasks"`
	FailedTasks    int64          `json:"failed_tasks"`
	ByType         map[string]int `json:"by_type"`
}
