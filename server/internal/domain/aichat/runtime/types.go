package runtime

import "time"

type SessionStatus string

const (
	SessionStatusIdle                SessionStatus = "idle"
	SessionStatusRunning             SessionStatus = "running"
	SessionStatusWaitingConfirmation SessionStatus = "waiting_confirmation"
	SessionStatusClosed              SessionStatus = "closed"
)

type TaskStatus string

const (
	TaskStatusQueued         TaskStatus = "queued"
	TaskStatusWaitingConfirm TaskStatus = "waiting_confirm"
	TaskStatusRunning        TaskStatus = "running"
	TaskStatusSucceeded      TaskStatus = "succeeded"
	TaskStatusFailed         TaskStatus = "failed"
	TaskStatusCancelled      TaskStatus = "cancelled"
)

type Decision string

const (
	DecisionConfirm Decision = "confirm"
	DecisionReject  Decision = "reject"
)

type EventType string

const (
	EventSessionStarted        EventType = "session.started"
	EventAssistantDelta        EventType = "assistant.delta"
	EventAssistantCompleted    EventType = "assistant.completed"
	EventTaskCreated           EventType = "task.created"
	EventTaskUpdated           EventType = "task.updated"
	EventConfirmationRequested EventType = "confirmation.requested"
	EventConfirmationResolved  EventType = "confirmation.resolved"
	EventError                 EventType = "error"
	EventSessionCompleted      EventType = "session.completed"
)

type TransportType string

const (
	TransportAISDKUI TransportType = "ai_sdk_ui"
)

type ToolView struct {
	Name        string `json:"name"`
	DisplayName string `json:"display_name,omitempty"`
	Description string `json:"description"`
	Dangerous   bool   `json:"dangerous"`
}

type MessageView struct {
	ID        string    `json:"id"`
	Role      string    `json:"role"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}

type TaskView struct {
	ID                   string                 `json:"id"`
	AssistantMessageID   string                 `json:"assistant_message_id,omitempty"`
	ToolCallID           string                 `json:"tool_call_id"`
	ToolName             string                 `json:"tool_name"`
	ToolDisplayName      string                 `json:"tool_display_name,omitempty"`
	Summary              string                 `json:"summary,omitempty"`
	Status               TaskStatus             `json:"status"`
	Dangerous            bool                   `json:"dangerous"`
	RequiresConfirmation bool                   `json:"requires_confirmation"`
	Arguments            map[string]interface{} `json:"arguments,omitempty"`
	Result               string                 `json:"result,omitempty"`
	Error                string                 `json:"error,omitempty"`
	CreatedAt            time.Time              `json:"created_at"`
	UpdatedAt            time.Time              `json:"updated_at"`
}

type AssistantEventData struct {
	MessageID string `json:"message_id"`
	Delta     string `json:"delta,omitempty"`
	Content   string `json:"content,omitempty"`
}

type ConfirmationView struct {
	TaskID    string    `json:"task_id"`
	Status    string    `json:"status"`
	Decision  string    `json:"decision,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type ErrorView struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type UIMessage struct {
	ID       string                   `json:"id"`
	Role     string                   `json:"role"`
	Metadata map[string]interface{}   `json:"metadata,omitempty"`
	Parts    []map[string]interface{} `json:"parts"`
}

type SessionListItem struct {
	ID             string        `json:"id"`
	Model          string        `json:"model"`
	PermissionMode string        `json:"permission_mode"`
	Status         SessionStatus `json:"status"`
	Title          string        `json:"title"`
	CustomTitle    bool          `json:"custom_title"`
	MessageCount   int           `json:"message_count"`
	TaskCount      int           `json:"task_count"`
	CreatedAt      time.Time     `json:"created_at"`
	UpdatedAt      time.Time     `json:"updated_at"`
}

type SessionScope struct {
	Kind              string `json:"kind,omitempty"`
	TerminalSessionID string `json:"terminal_session_id,omitempty"`
	ServerID          string `json:"server_id,omitempty"`
	ServerName        string `json:"server_name,omitempty"`
	Host              string `json:"host,omitempty"`
	Port              int    `json:"port,omitempty"`
	Username          string `json:"username,omitempty"`
}

type SessionView struct {
	ID               string        `json:"id"`
	Model            string        `json:"model"`
	PermissionMode   string        `json:"permission_mode"`
	Scope            SessionScope  `json:"scope,omitempty"`
	Status           SessionStatus `json:"status"`
	CreatedAt        time.Time     `json:"created_at"`
	UpdatedAt        time.Time     `json:"updated_at"`
	Messages         []MessageView `json:"messages"`
	Tasks            []TaskView    `json:"tasks"`
	UIMessages       []UIMessage   `json:"ui_messages"`
	AvailableTools   []ToolView    `json:"available_tools"`
	DefaultTransport TransportType `json:"default_transport"`
}

type Event struct {
	ID           string              `json:"id"`
	Type         EventType           `json:"type"`
	SessionID    string              `json:"session_id"`
	CreatedAt    time.Time           `json:"created_at"`
	Session      *SessionView        `json:"session,omitempty"`
	Assistant    *AssistantEventData `json:"assistant,omitempty"`
	Task         *TaskView           `json:"task,omitempty"`
	UIMessage    *UIMessage          `json:"ui_message,omitempty"`
	Confirmation *ConfirmationView   `json:"confirmation,omitempty"`
	Error        *ErrorView          `json:"error,omitempty"`
}

type CreateSessionInput struct {
	Model          string
	PermissionMode string
	Scope          SessionScope
}

type SendUserMessageInput struct {
	Content        string
	Model          string
	PermissionMode string
	Scope          SessionScope
}

type ConfirmTaskInput struct {
	TaskID   string
	Decision Decision
}
