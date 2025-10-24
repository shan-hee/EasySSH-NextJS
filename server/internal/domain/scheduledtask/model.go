package scheduledtask

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ScheduledTask 定时任务模型
type ScheduledTask struct {
	ID             uuid.UUID      `gorm:"type:uuid;primary_key" json:"id"`
	UserID         uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	TaskName       string         `gorm:"type:varchar(100);not null" json:"task_name"`
	TaskType       string         `gorm:"type:varchar(20);not null" json:"task_type"` // command/script/batch
	ScriptID       *uuid.UUID     `gorm:"type:uuid" json:"script_id,omitempty"`
	BatchTaskID    *uuid.UUID     `gorm:"type:uuid" json:"batch_task_id,omitempty"`
	Command        string         `gorm:"type:text" json:"command,omitempty"`
	ServerIDs      []string       `gorm:"type:jsonb;serializer:json" json:"server_ids"`
	CronExpression string         `gorm:"type:varchar(100);not null" json:"cron_expression"`
	Timezone       string         `gorm:"type:varchar(50);default:'UTC'" json:"timezone"`
	Enabled        bool           `gorm:"default:true" json:"enabled"`
	LastRunAt      *time.Time     `json:"last_run_at,omitempty"`
	NextRunAt      *time.Time     `json:"next_run_at,omitempty"`
	RunCount       int            `gorm:"default:0" json:"run_count"`
	FailureCount   int            `gorm:"default:0" json:"failure_count"`
	LastStatus     string         `gorm:"type:varchar(20)" json:"last_status,omitempty"` // success/failed
	Description    string         `gorm:"type:text" json:"description"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate GORM钩子：创建前生成UUID
func (st *ScheduledTask) BeforeCreate(tx *gorm.DB) error {
	if st.ID == uuid.Nil {
		st.ID = uuid.New()
	}
	return nil
}

// TableName 指定表名
func (ScheduledTask) TableName() string {
	return "scheduled_tasks"
}

// CreateScheduledTaskRequest 创建定时任务请求
type CreateScheduledTaskRequest struct {
	TaskName       string    `json:"task_name" binding:"required"`
	TaskType       string    `json:"task_type" binding:"required,oneof=command script batch"`
	ScriptID       *string   `json:"script_id,omitempty"`
	BatchTaskID    *string   `json:"batch_task_id,omitempty"`
	Command        string    `json:"command,omitempty"`
	ServerIDs      []string  `json:"server_ids,omitempty"`
	CronExpression string    `json:"cron_expression" binding:"required"`
	Timezone       string    `json:"timezone,omitempty"`
	Enabled        *bool     `json:"enabled,omitempty"`
	Description    string    `json:"description,omitempty"`
}

// UpdateScheduledTaskRequest 更新定时任务请求
type UpdateScheduledTaskRequest struct {
	TaskName       string   `json:"task_name,omitempty"`
	Command        string   `json:"command,omitempty"`
	ServerIDs      []string `json:"server_ids,omitempty"`
	CronExpression string   `json:"cron_expression,omitempty"`
	Timezone       string   `json:"timezone,omitempty"`
	Enabled        *bool    `json:"enabled,omitempty"`
	Description    string   `json:"description,omitempty"`
}

// ListScheduledTasksRequest 定时任务列表查询请求
type ListScheduledTasksRequest struct {
	Page     int    `form:"page" json:"page"`
	Limit    int    `form:"limit" json:"limit"`
	Enabled  *bool  `form:"enabled" json:"enabled"`
	TaskType string `form:"task_type" json:"task_type"`
}

// ListScheduledTasksResponse 定时任务列表响应
type ListScheduledTasksResponse struct {
	Data       []ScheduledTask `json:"data"`
	Total      int64           `json:"total"`
	Page       int             `json:"page"`
	PageSize   int             `json:"page_size"`
	TotalPages int             `json:"total_pages"`
}

// ScheduledTaskStatistics 定时任务统计信息
type ScheduledTaskStatistics struct {
	TotalTasks    int64          `json:"total_tasks"`
	EnabledTasks  int64          `json:"enabled_tasks"`
	DisabledTasks int64          `json:"disabled_tasks"`
	TotalRuns     int64          `json:"total_runs"`
	ByType        map[string]int `json:"by_type"`
}
