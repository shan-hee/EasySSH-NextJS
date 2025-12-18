package rest

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/easyssh/server/internal/domain/aichat"
	"github.com/gin-gonic/gin"
	openai "github.com/sashabaranov/go-openai"
)

// AIChatToolsHandler AI聊天工具处理器
type AIChatToolsHandler struct {
	service      aichat.Service
	toolExecutor *aichat.ToolExecutorService
}

// NewAIChatToolsHandler 创建AI聊天工具处理器
func NewAIChatToolsHandler(service aichat.Service, toolExecutor *aichat.ToolExecutorService) *AIChatToolsHandler {
	return &AIChatToolsHandler{
		service:      service,
		toolExecutor: toolExecutor,
	}
}

// ToolCallDTO 工具调用DTO
type ToolCallDTO struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments"`
	Dangerous bool            `json:"dangerous,omitempty"`
}

// ChatWithToolsRequestDTO 带工具的聊天请求DTO
type ChatWithToolsRequestDTO struct {
	Messages    []ChatMessageWithToolsDTO `json:"messages" binding:"required,min=1"`
	Model       string                    `json:"model,omitempty"`
	Stream      bool                      `json:"stream"`
	EnableTools bool                      `json:"enable_tools"`
}

// ChatMessageWithToolsDTO 带工具的聊天消息DTO
type ChatMessageWithToolsDTO struct {
	Role       string        `json:"role" binding:"required"`
	Content    string        `json:"content"`
	ToolCalls  []ToolCallDTO `json:"tool_calls,omitempty"`
	ToolCallID string        `json:"tool_call_id,omitempty"`
}

// ChatWithToolsResponseDTO 带工具的聊天响应DTO
type ChatWithToolsResponseDTO struct {
	Content   string        `json:"content"`
	Model     string        `json:"model,omitempty"`
	Usage     *ChatUsageDTO `json:"usage,omitempty"`
	ToolCalls []ToolCallDTO `json:"tool_calls,omitempty"`
}

// ToolExecuteRequestDTO 工具执行请求DTO
type ToolExecuteRequestDTO struct {
	ToolCall ToolCallDTO `json:"tool_call" binding:"required"`
}

// ToolExecuteResponseDTO 工具执行响应DTO
type ToolExecuteResponseDTO struct {
	ToolCallID string `json:"tool_call_id"`
	Content    string `json:"content"`
	IsError    bool   `json:"is_error,omitempty"`
}

// ToolDefinitionDTO 工具定义DTO
type ToolDefinitionDTO struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
	Dangerous   bool                   `json:"dangerous"`
}

// GetTools 获取可用工具列表
// @Summary 获取可用工具列表
// @Tags AI工具
// @Accept json
// @Produce json
// @Success 200 {array} ToolDefinitionDTO
// @Router /api/v1/ai/tools [get]
func (h *AIChatToolsHandler) GetTools(c *gin.Context) {
	tools := aichat.GetAvailableTools()
	result := make([]ToolDefinitionDTO, len(tools))
	for i, tool := range tools {
		result[i] = ToolDefinitionDTO{
			Name:        tool.Name,
			Description: tool.Description,
			Parameters:  tool.Parameters,
			Dangerous:   aichat.IsDangerousTool(tool.Name),
		}
	}
	RespondSuccess(c, result)
}

// ChatWithTools 带工具的聊天
// @Summary 带工具的聊天
// @Tags AI工具
// @Accept json
// @Produce json
// @Param request body ChatWithToolsRequestDTO true "聊天请求"
// @Success 200 {object} ChatWithToolsResponseDTO
// @Router /api/v1/ai/chat/tools [post]
func (h *AIChatToolsHandler) ChatWithTools(c *gin.Context) {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	var dto ChatWithToolsRequestDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 如果是流式请求
	if dto.Stream {
		h.streamChatWithTools(c, userID, &dto)
		return
	}

	// 转换为领域模型
	messages := convertToAIChatMessages(dto.Messages)

	req := &aichat.ChatRequest{
		Messages:    messages,
		Model:       dto.Model,
		Stream:      false,
		EnableTools: dto.EnableTools,
	}

	// 调用服务
	resp, err := h.service.ChatWithTools(c.Request.Context(), userID, req)
	if err != nil {
		if err == aichat.ErrAINotConfigured {
			RespondError(c, http.StatusServiceUnavailable, "ai_not_configured", "AI service is not configured")
			return
		}
		RespondError(c, http.StatusInternalServerError, "chat_failed", err.Error())
		return
	}

	// 转换为DTO
	respDTO := &ChatWithToolsResponseDTO{
		Content: resp.Content,
		Model:   resp.Model,
	}
	if resp.Usage != nil {
		respDTO.Usage = &ChatUsageDTO{
			PromptTokens:     resp.Usage.PromptTokens,
			CompletionTokens: resp.Usage.CompletionTokens,
			TotalTokens:      resp.Usage.TotalTokens,
		}
	}
	if len(resp.ToolCalls) > 0 {
		respDTO.ToolCalls = make([]ToolCallDTO, len(resp.ToolCalls))
		for i, tc := range resp.ToolCalls {
			respDTO.ToolCalls[i] = ToolCallDTO{
				ID:        tc.ID,
				Name:      tc.Name,
				Arguments: tc.Arguments,
				Dangerous: aichat.IsDangerousTool(tc.Name),
			}
		}
	}

	RespondSuccess(c, respDTO)
}

// streamChatWithTools 流式带工具聊天
func (h *AIChatToolsHandler) streamChatWithTools(c *gin.Context, userID interface{}, dto *ChatWithToolsRequestDTO) {
	uid, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	messages := convertToAIChatMessages(dto.Messages)

	req := &aichat.ChatRequest{
		Messages:    messages,
		Model:       dto.Model,
		Stream:      true,
		EnableTools: dto.EnableTools,
	}

	headersInitialized := false
	initSSEHeaders := func() {
		if headersInitialized {
			return
		}
		headersInitialized = true
		c.Writer.Header().Set("Content-Type", "text/event-stream")
		c.Writer.Header().Set("Cache-Control", "no-cache")
		c.Writer.Header().Set("Connection", "keep-alive")
		c.Writer.Header().Set("X-Accel-Buffering", "no")
		c.Writer.Flush()
	}

	// 调用流式服务
	err = h.service.StreamChatWithTools(c.Request.Context(), uid, req, func(delta *aichat.StreamDelta) error {
		initSSEHeaders()

		event := struct {
			Content   string        `json:"content,omitempty"`
			Done      bool          `json:"done,omitempty"`
			ToolCalls []ToolCallDTO `json:"tool_calls,omitempty"`
		}{
			Content: delta.Content,
			Done:    delta.Done,
		}

		if len(delta.ToolCalls) > 0 {
			event.ToolCalls = make([]ToolCallDTO, len(delta.ToolCalls))
			for i, tc := range delta.ToolCalls {
				event.ToolCalls[i] = ToolCallDTO{
					ID:        tc.ID,
					Name:      tc.Name,
					Arguments: tc.Arguments,
					Dangerous: aichat.IsDangerousTool(tc.Name),
				}
			}
		}

		data, err := json.Marshal(event)
		if err != nil {
			return err
		}

		_, err = fmt.Fprintf(c.Writer, "data: %s\n\n", data)
		if err != nil {
			return err
		}

		c.Writer.Flush()
		return nil
	})

	if err != nil {
		var apiErr *openai.APIError
		var reqErr *openai.RequestError
		statusCode := 0
		if errors.As(err, &apiErr) && apiErr.HTTPStatusCode > 0 {
			statusCode = apiErr.HTTPStatusCode
		} else if errors.As(err, &reqErr) && reqErr.HTTPStatusCode > 0 {
			statusCode = reqErr.HTTPStatusCode
		}

		// 如果在真正开始 SSE 之前就失败（例如 OpenAI 429/401/400），返回 HTTP 错误，便于在“API 调用记录”中看到状态码。
		if !headersInitialized {
			errCode := "ai_stream_failed"
			switch statusCode {
			case http.StatusTooManyRequests:
				errCode = "rate_limited"
			case http.StatusBadRequest:
				errCode = "bad_request"
			case http.StatusUnauthorized:
				errCode = "unauthorized"
			case http.StatusForbidden:
				errCode = "forbidden"
			}
			if statusCode == 0 {
				statusCode = http.StatusBadGateway
			}
			RespondError(c, statusCode, errCode, err.Error())
			return
		}

		// 已开始 SSE：只能通过事件把错误推送给前端
		errEvent := struct {
			Error string `json:"error"`
			Done  bool   `json:"done"`
		}{
			Error: err.Error(),
			Done:  true,
		}
		data, _ := json.Marshal(errEvent)
		fmt.Fprintf(c.Writer, "data: %s\n\n", data)
		c.Writer.Flush()
	}
}

// ExecuteTool 执行工具
// @Summary 执行工具
// @Tags AI工具
// @Accept json
// @Produce json
// @Param request body ToolExecuteRequestDTO true "工具执行请求"
// @Success 200 {object} ToolExecuteResponseDTO
// @Router /api/v1/ai/tools/execute [post]
func (h *AIChatToolsHandler) ExecuteTool(c *gin.Context) {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	var dto ToolExecuteRequestDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 转换为领域模型
	toolCall := &aichat.ToolCall{
		ID:        dto.ToolCall.ID,
		Name:      dto.ToolCall.Name,
		Arguments: dto.ToolCall.Arguments,
	}

	// 执行工具
	result, err := h.toolExecutor.ExecuteTool(c.Request.Context(), userID, toolCall)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "tool_execution_failed", err.Error())
		return
	}

	RespondSuccess(c, &ToolExecuteResponseDTO{
		ToolCallID: result.ToolCallID,
		Content:    result.Content,
		IsError:    result.IsError,
	})
}

// convertToAIChatMessages 转换消息格式
func convertToAIChatMessages(messages []ChatMessageWithToolsDTO) []aichat.ChatMessage {
	result := make([]aichat.ChatMessage, len(messages))
	for i, m := range messages {
		msg := aichat.ChatMessage{
			Role:       m.Role,
			Content:    m.Content,
			ToolCallID: m.ToolCallID,
		}
		if len(m.ToolCalls) > 0 {
			msg.ToolCalls = make([]aichat.ToolCall, len(m.ToolCalls))
			for j, tc := range m.ToolCalls {
				msg.ToolCalls[j] = aichat.ToolCall{
					ID:        tc.ID,
					Name:      tc.Name,
					Arguments: tc.Arguments,
				}
			}
		}
		result[i] = msg
	}
	return result
}
