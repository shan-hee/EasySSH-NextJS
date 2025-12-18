package aichat

import "time"

// ChatMessage 聊天消息
type ChatMessage struct {
	Role       string      `json:"role"`                  // user, assistant, system, tool
	Content    string      `json:"content"`               // 消息内容
	ToolCalls  []ToolCall  `json:"tool_calls,omitempty"`  // AI 请求的工具调用（assistant 角色）
	ToolCallID string      `json:"tool_call_id,omitempty"` // 工具调用 ID（tool 角色）
}

// ChatRequest 聊天请求
type ChatRequest struct {
	Messages    []ChatMessage `json:"messages"`              // 消息历史
	Model       string        `json:"model,omitempty"`       // 模型名称（可选，使用默认）
	Stream      bool          `json:"stream,omitempty"`      // 是否流式响应
	EnableTools bool          `json:"enable_tools,omitempty"` // 是否启用工具调用
}

// ChatResponse 聊天响应（非流式）
type ChatResponse struct {
	Content   string     `json:"content"`             // 响应内容
	Model     string     `json:"model,omitempty"`     // 使用的模型
	Usage     *ChatUsage `json:"usage,omitempty"`     // token使用情况
	ToolCalls []ToolCall `json:"tool_calls,omitempty"` // AI 请求的工具调用
}

// ChatUsage token使用统计
type ChatUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// StreamDelta 流式响应增量
type StreamDelta struct {
	Content   string     `json:"content,omitempty"`    // 增量内容
	Done      bool       `json:"done,omitempty"`       // 是否完成
	ToolCalls []ToolCall `json:"tool_calls,omitempty"` // AI 请求的工具调用（流式结束时返回）
}

// AIProvider AI提供商配置
type AIProvider struct {
	Name     string // 提供商名称: openai, anthropic
	APIKey   string // API密钥
	Endpoint string // API端点
	Models   string // 可用模型列表（逗号分隔）
}

// ProviderConfig 提供商配置（用于实际调用）
type ProviderConfig struct {
	Provider string
	APIKey   string
	Endpoint string
	Model    string   // 当前选择的模型（由用户在请求中指定）
	Models   []string // 可用的模型列表
}

// ChatContext 聊天上下文
type ChatContext struct {
	UserID    string
	SessionID string
	StartTime time.Time
}
