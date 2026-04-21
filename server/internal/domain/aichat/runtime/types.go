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
	TransportWS  TransportType = "ws"
	TransportSSE TransportType = "sse"
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

type SessionView struct {
	ID               string         `json:"id"`
	Model            string         `json:"model"`
	PermissionMode   string         `json:"permission_mode"`
	Status           SessionStatus  `json:"status"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	Messages         []MessageView  `json:"messages"`
	Tasks            []TaskView     `json:"tasks"`
	AvailableTools   []ToolView     `json:"available_tools"`
	DefaultTransport TransportType  `json:"default_transport"`
}

type Event struct {
	ID           string              `json:"id"`
	Type         EventType           `json:"type"`
	SessionID    string              `json:"session_id"`
	CreatedAt    time.Time           `json:"created_at"`
	Session      *SessionView        `json:"session,omitempty"`
	Assistant    *AssistantEventData `json:"assistant,omitempty"`
	Task         *TaskView           `json:"task,omitempty"`
	Confirmation *ConfirmationView   `json:"confirmation,omitempty"`
	Error        *ErrorView          `json:"error,omitempty"`
}

type CreateSessionInput struct {
	Model          string
	PermissionMode string
}
