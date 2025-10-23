package auditlog

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ActionType 操作类型
type ActionType string

const (
	// 认证相关
	ActionLogin  ActionType = "login"
	ActionLogout ActionType = "logout"

	// 服务器管理
	ActionServerCreate ActionType = "server_create"
	ActionServerUpdate ActionType = "server_update"
	ActionServerDelete ActionType = "server_delete"
	ActionServerTest   ActionType = "server_test"

	// SSH 连接
	ActionSSHConnect    ActionType = "ssh_connect"
	ActionSSHDisconnect ActionType = "ssh_disconnect"

	// SFTP 操作
	ActionSFTPUpload   ActionType = "sftp_upload"
	ActionSFTPDownload ActionType = "sftp_download"
	ActionSFTPDelete   ActionType = "sftp_delete"
	ActionSFTPRename   ActionType = "sftp_rename"
	ActionSFTPMkdir    ActionType = "sftp_mkdir"

	// 监控查询
	ActionMonitoringQuery ActionType = "monitoring_query"

	// 系统管理
	ActionUserCreate ActionType = "user_create"
	ActionUserUpdate ActionType = "user_update"
	ActionUserDelete ActionType = "user_delete"
)

// Status 操作状态
type Status string

const (
	StatusSuccess Status = "success"
	StatusFailure Status = "failure"
	StatusWarning Status = "warning"
)

// AuditLog 审计日志模型
type AuditLog struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;index;not null" json:"user_id"`
	Username  string    `gorm:"size:50" json:"username"` // 冗余字段，方便查询
	ServerID  *uuid.UUID `gorm:"type:uuid;index" json:"server_id,omitempty"` // 关联的服务器 ID（可选）
	Action    ActionType `gorm:"type:varchar(50);not null;index" json:"action"`
	Resource  string     `gorm:"size:255" json:"resource"` // 操作的资源，如文件路径、服务器名称等
	Status    Status     `gorm:"type:varchar(20);not null;index" json:"status"`
	IP        string     `gorm:"size:45" json:"ip"` // 客户端 IP 地址
	UserAgent string     `gorm:"size:500" json:"user_agent"` // 用户代理
	Details   string     `gorm:"type:text" json:"details"` // 详细信息（JSON 格式）
	ErrorMsg  string     `gorm:"type:text" json:"error_msg,omitempty"` // 错误信息（失败时）
	Duration  int64      `gorm:"default:0" json:"duration"` // 操作耗时（毫秒）
	CreatedAt time.Time  `gorm:"index" json:"created_at"`
}

// TableName 指定表名
func (AuditLog) TableName() string {
	return "audit_logs"
}

// BeforeCreate GORM 钩子：创建前
func (a *AuditLog) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	if a.CreatedAt.IsZero() {
		a.CreatedAt = time.Now()
	}
	return nil
}

// CreateAuditLogRequest 创建审计日志请求
type CreateAuditLogRequest struct {
	UserID    uuid.UUID   `json:"user_id" binding:"required"`
	Username  string      `json:"username"`
	ServerID  *uuid.UUID  `json:"server_id,omitempty"`
	Action    ActionType  `json:"action" binding:"required"`
	Resource  string      `json:"resource"`
	Status    Status      `json:"status" binding:"required"`
	IP        string      `json:"ip"`
	UserAgent string      `json:"user_agent"`
	Details   string      `json:"details"`
	ErrorMsg  string      `json:"error_msg,omitempty"`
	Duration  int64       `json:"duration"`
}

// ListAuditLogsRequest 查询审计日志请求
type ListAuditLogsRequest struct {
	UserID    *uuid.UUID `form:"user_id"`
	ServerID  *uuid.UUID `form:"server_id"`
	Action    ActionType `form:"action"`
	Status    Status     `form:"status"`
	StartTime *time.Time `form:"start_time"`
	EndTime   *time.Time `form:"end_time"`
	Page      int        `form:"page,default=1"`
	PageSize  int        `form:"page_size,default=20"`
}

// AuditLogStatistics 审计日志统计
type AuditLogStatistics struct {
	TotalLogs       int64                `json:"total_logs"`
	SuccessCount    int64                `json:"success_count"`
	FailureCount    int64                `json:"failure_count"`
	ActionStats     map[ActionType]int64 `json:"action_stats"` // 各类操作统计
	RecentFailures  []*AuditLog          `json:"recent_failures"` // 最近失败的操作
	TopUsers        []UserActionCount    `json:"top_users"` // 操作最多的用户
}

// UserActionCount 用户操作统计
type UserActionCount struct {
	UserID   uuid.UUID `json:"user_id"`
	Username string    `json:"username"`
	Count    int64     `json:"count"`
}
