package sshsession

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SSHSession SSH会话记录模型
type SSHSession struct {
	ID           uuid.UUID      `gorm:"type:uuid;primary_key" json:"id"`
	UserID       uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	ServerID     uuid.UUID      `gorm:"type:uuid;not null;index" json:"server_id"`
	SessionID    string         `gorm:"type:varchar(100);not null;unique;index" json:"session_id"`
	ClientIP     string         `gorm:"type:varchar(50)" json:"client_ip"`
	ClientPort   int            `json:"client_port"`
	TerminalType string         `gorm:"type:varchar(50)" json:"terminal_type"`
	Status       string         `gorm:"type:varchar(20);default:'active';index" json:"status"` // active/closed/timeout
	ConnectedAt  time.Time      `gorm:"not null" json:"connected_at"`
	DisconnectedAt *time.Time   `json:"disconnected_at,omitempty"`
	Duration     int            `json:"duration,omitempty"` // 连接时长(秒)
	BytesSent    int64          `gorm:"default:0" json:"bytes_sent"`
	BytesReceived int64         `gorm:"default:0" json:"bytes_received"`
	ErrorMessage string         `gorm:"type:text" json:"error_message,omitempty"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate GORM钩子：创建前生成UUID
func (s *SSHSession) BeforeCreate(tx *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}

// TableName 指定表名
func (SSHSession) TableName() string {
	return "ssh_sessions"
}

// SSHSessionWithServer SSH会话及服务器信息
type SSHSessionWithServer struct {
	ID             uuid.UUID  `json:"id"`
	UserID         uuid.UUID  `json:"user_id"`
	ServerID       uuid.UUID  `json:"server_id"`
	ServerName     string     `json:"server_name"`
	ServerHost     string     `json:"server_host"`
	SessionID      string     `json:"session_id"`
	ClientIP       string     `json:"client_ip"`
	ClientPort     int        `json:"client_port"`
	TerminalType   string     `json:"terminal_type"`
	Status         string     `json:"status"`
	ConnectedAt    time.Time  `json:"connected_at"`
	DisconnectedAt *time.Time `json:"disconnected_at,omitempty"`
	Duration       int        `json:"duration,omitempty"`
	BytesSent      int64      `json:"bytes_sent"`
	BytesReceived  int64      `json:"bytes_received"`
	ErrorMessage   string     `json:"error_message,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// CreateSSHSessionRequest 创建SSH会话记录请求
type CreateSSHSessionRequest struct {
	UserID       uuid.UUID `json:"user_id" binding:"required"`
	ServerID     uuid.UUID `json:"server_id" binding:"required"`
	SessionID    string    `json:"session_id" binding:"required"`
	ClientIP     string    `json:"client_ip"`
	ClientPort   int       `json:"client_port"`
	TerminalType string    `json:"terminal_type"`
}

// UpdateSSHSessionRequest 更新SSH会话记录请求
type UpdateSSHSessionRequest struct {
	Status        string  `json:"status,omitempty"`
	BytesSent     *int64  `json:"bytes_sent,omitempty"`
	BytesReceived *int64  `json:"bytes_received,omitempty"`
	ErrorMessage  string  `json:"error_message,omitempty"`
}

// ListSSHSessionsRequest SSH会话列表查询请求
type ListSSHSessionsRequest struct {
	Page     int       `form:"page" json:"page"`
	Limit    int       `form:"limit" json:"limit"`
	Status   string    `form:"status" json:"status"`
	ServerID string    `form:"server_id" json:"server_id"`
	UserID   string    `form:"user_id" json:"user_id"`
}

// ListSSHSessionsResponse SSH会话列表响应
type ListSSHSessionsResponse struct {
	Data       []SSHSessionWithServer `json:"data"`
	Total      int64                  `json:"total"`
	Page       int                    `json:"page"`
	PageSize   int                    `json:"page_size"`
	TotalPages int                    `json:"total_pages"`
}

// SSHSessionStatistics SSH会话统计信息
type SSHSessionStatistics struct {
	TotalSessions   int64          `json:"total_sessions"`
	ActiveSessions  int64          `json:"active_sessions"`
	ClosedSessions  int64          `json:"closed_sessions"`
	TotalDuration   int64          `json:"total_duration"`   // 总时长(秒)
	TotalBytesSent  int64          `json:"total_bytes_sent"` // 总发送字节数
	TotalBytesReceived int64       `json:"total_bytes_received"` // 总接收字节数
	ByServer        map[string]int `json:"by_server"` // 按服务器统计
}
