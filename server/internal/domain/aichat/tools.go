package aichat

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
)

// ToolCall AI 请求的工具调用
type ToolCall struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments"`
}

// ToolResult 工具执行结果
type ToolResult struct {
	ToolCallID string `json:"tool_call_id"`
	Content    string `json:"content"`
	IsError    bool   `json:"is_error,omitempty"`
}

// ToolExecutor 工具执行器接口
type ToolExecutor interface {
	Execute(ctx context.Context, userID uuid.UUID, args json.RawMessage) (*ToolResult, error)
}
