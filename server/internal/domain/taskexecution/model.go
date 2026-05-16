package taskexecution

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// TriggerType 触发类型
type TriggerType string

const (
	TriggerSchedule TriggerType = "schedule" // 定时触发
	TriggerManual   TriggerType = "manual"   // 手动触发
)

// ExecutionStatus 执行状态
type ExecutionStatus string

const (
	StatusPending  ExecutionStatus = "pending"  // 等待执行
	StatusRunning  ExecutionStatus = "running"  // 执行中
	StatusSuccess  ExecutionStatus = "success"  // 成功
	StatusFailed   ExecutionStatus = "failed"   // 失败
	StatusPartial  ExecutionStatus = "partial"  // 部分成功
	StatusTimeout  ExecutionStatus = "timeout"  // 超时
	StatusCanceled ExecutionStatus = "canceled" // 已取消
)

// TaskExecution 任务执行记录（主记录）
type TaskExecution struct {
	ID              uuid.UUID       `gorm:"type:char(36);primary_key" json:"id"`
	ScheduledTaskID uuid.UUID       `gorm:"type:char(36);not null;index" json:"scheduled_task_id"`
	UserID          uuid.UUID       `gorm:"type:char(36);not null;index" json:"user_id"`
	Username        string          `gorm:"type:varchar(50)" json:"username"`
	TaskName        string          `gorm:"type:varchar(100);not null" json:"task_name"`
	TaskType        string          `gorm:"type:varchar(20);not null" json:"task_type"`
	TriggerType     TriggerType     `gorm:"type:varchar(20);not null" json:"trigger_type"`
	Command         string          `gorm:"type:text" json:"command"`
	Status          ExecutionStatus `gorm:"type:varchar(20);not null;index" json:"status"`
	TotalServers    int             `gorm:"default:0" json:"total_servers"`
	SuccessCount    int             `gorm:"default:0" json:"success_count"`
	FailedCount     int             `gorm:"default:0" json:"failed_count"`
	StartTime       time.Time       `gorm:"not null;index" json:"start_time"`
	EndTime         *time.Time      `json:"end_time,omitempty"`
	Duration        int64           `json:"duration"` // 毫秒
	ErrorMessage    string          `gorm:"type:text" json:"error_message,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
	DeletedAt       gorm.DeletedAt  `gorm:"index" json:"-"`

	// 关联
	ServerResults []TaskExecutionServer `gorm:"foreignKey:ExecutionID" json:"server_results,omitempty"`
}

// TaskExecutionServer 单个服务器的执行结果
type TaskExecutionServer struct {
	ID           uuid.UUID       `gorm:"type:char(36);primary_key" json:"id"`
	ExecutionID  uuid.UUID       `gorm:"type:char(36);not null;index" json:"execution_id"`
	ServerID     uuid.UUID       `gorm:"type:char(36);not null;index" json:"server_id"`
	ServerName   string          `gorm:"type:varchar(100)" json:"server_name"`
	ServerHost   string          `gorm:"type:varchar(255)" json:"server_host"`
	Status       ExecutionStatus `gorm:"type:varchar(20);not null" json:"status"`
	ExitCode     *int            `json:"exit_code,omitempty"`
	Output       string          `gorm:"type:text" json:"output"`
	ErrorMessage string          `gorm:"type:text" json:"error_message,omitempty"`
	StartTime    time.Time       `json:"start_time"`
	EndTime      *time.Time      `json:"end_time,omitempty"`
	Duration     int64           `json:"duration"` // 毫秒
	CreatedAt    time.Time       `json:"created_at"`
}

// TableName 指定表名
func (TaskExecution) TableName() string {
	return "task_executions"
}

func (TaskExecutionServer) TableName() string {
	return "task_execution_servers"
}

// BeforeCreate GORM钩子
func (te *TaskExecution) BeforeCreate(tx *gorm.DB) error {
	if te.ID == uuid.Nil {
		te.ID = uuid.New()
	}
	return nil
}

func (tes *TaskExecutionServer) BeforeCreate(tx *gorm.DB) error {
	if tes.ID == uuid.Nil {
		tes.ID = uuid.New()
	}
	return nil
}

// === 请求/响应结构 ===

// ListExecutionsRequest 查询执行历史请求
type ListExecutionsRequest struct {
	Page            int             `form:"page" json:"page"`
	Limit           int             `form:"limit" json:"limit"`
	ScheduledTaskID *uuid.UUID      `form:"scheduled_task_id" json:"scheduled_task_id"`
	Status          ExecutionStatus `form:"status" json:"status"`
	TriggerType     TriggerType     `form:"trigger_type" json:"trigger_type"`
	TaskType        string          `form:"task_type" json:"task_type"`
	StartTime       *time.Time      `form:"start_time" json:"start_time"`
	EndTime         *time.Time      `form:"end_time" json:"end_time"`
}

// ListExecutionsResponse 执行历史列表响应
type ListExecutionsResponse struct {
	Data       []TaskExecution `json:"data"`
	Total      int64           `json:"total"`
	Page       int             `json:"page"`
	PageSize   int             `json:"page_size"`
	TotalPages int             `json:"total_pages"`
}

// ExecutionStatistics 执行统计信息
type ExecutionStatistics struct {
	TotalExecutions  int64                     `json:"total_executions"`
	SuccessCount     int64                     `json:"success_count"`
	FailedCount      int64                     `json:"failed_count"`
	PartialCount     int64                     `json:"partial_count"`
	RunningCount     int64                     `json:"running_count"`
	AverageDuration  int64                     `json:"average_duration"` // 毫秒
	ByStatus         map[ExecutionStatus]int64 `json:"by_status"`
	ByTaskType       map[string]int64          `json:"by_task_type"`
	RecentExecutions []TaskExecution           `json:"recent_executions"`
}

// ExecutionDetailResponse 执行详情响应（包含服务器结果）
type ExecutionDetailResponse struct {
	TaskExecution
	ServerResults []TaskExecutionServer `json:"server_results"`
}
