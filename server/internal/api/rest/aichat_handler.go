package rest

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/easyssh/server/internal/domain/aichat"
	"github.com/gin-gonic/gin"
)

// AIChatHandler AI聊天处理器
type AIChatHandler struct {
	service aichat.Service
}

// NewAIChatHandler 创建AI聊天处理器
func NewAIChatHandler(service aichat.Service) *AIChatHandler {
	return &AIChatHandler{service: service}
}

// ChatRequestDTO 聊天请求DTO
type ChatRequestDTO struct {
	Messages []ChatMessageDTO `json:"messages" binding:"required,min=1"`
	Model    string           `json:"model,omitempty"`
	Stream   bool             `json:"stream"`
}

// ChatMessageDTO 聊天消息DTO
type ChatMessageDTO struct {
	Role    string `json:"role" binding:"required,oneof=user assistant system"`
	Content string `json:"content" binding:"required"`
}

// ChatResponseDTO 聊天响应DTO
type ChatResponseDTO struct {
	Content string        `json:"content"`
	Model   string        `json:"model,omitempty"`
	Usage   *ChatUsageDTO `json:"usage,omitempty"`
}

// ChatUsageDTO 使用统计DTO
type ChatUsageDTO struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// Chat 发送聊天请求（非流式）
// @Summary 发送聊天请求
// @Tags AI聊天
// @Accept json
// @Produce json
// @Param request body ChatRequestDTO true "聊天请求"
// @Success 200 {object} ChatResponseDTO
// @Router /api/v1/ai/chat [post]
func (h *AIChatHandler) Chat(c *gin.Context) {
	// 获取用户ID
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	var dto ChatRequestDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 如果是流式请求，使用SSE
	if dto.Stream {
		h.streamChat(c, userID, &dto)
		return
	}

	// 转换为领域模型
	messages := make([]aichat.ChatMessage, len(dto.Messages))
	for i, m := range dto.Messages {
		messages[i] = aichat.ChatMessage{
			Role:    m.Role,
			Content: m.Content,
		}
	}

	req := &aichat.ChatRequest{
		Messages: messages,
		Model:    dto.Model,
		Stream:   false,
	}

	// 调用服务
	resp, err := h.service.Chat(c.Request.Context(), userID, req)
	if err != nil {
		if err == aichat.ErrAINotConfigured {
			RespondError(c, http.StatusServiceUnavailable, "ai_not_configured", "AI service is not configured")
			return
		}
		RespondError(c, http.StatusInternalServerError, "chat_failed", err.Error())
		return
	}

	// 转换为DTO
	respDTO := &ChatResponseDTO{
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

	RespondSuccess(c, respDTO)
}

// streamChat 流式聊天（SSE）
func (h *AIChatHandler) streamChat(c *gin.Context, userID interface{}, dto *ChatRequestDTO) {
	// 解析用户ID
	uid, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	// 转换为领域模型
	messages := make([]aichat.ChatMessage, len(dto.Messages))
	for i, m := range dto.Messages {
		messages[i] = aichat.ChatMessage{
			Role:    m.Role,
			Content: m.Content,
		}
	}

	req := &aichat.ChatRequest{
		Messages: messages,
		Model:    dto.Model,
		Stream:   true,
	}

	// 设置SSE头
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no") // 禁用Nginx缓冲

	// 确保在函数结束时关闭连接
	c.Writer.Flush()

	// 调用流式服务
	err = h.service.StreamChat(c.Request.Context(), uid, req, func(delta *aichat.StreamDelta) error {
		// 构造SSE事件
		event := struct {
			Content string `json:"content,omitempty"`
			Done    bool   `json:"done,omitempty"`
		}{
			Content: delta.Content,
			Done:    delta.Done,
		}

		data, err := json.Marshal(event)
		if err != nil {
			return err
		}

		// 写入SSE格式
		_, err = fmt.Fprintf(c.Writer, "data: %s\n\n", data)
		if err != nil {
			return err
		}

		c.Writer.Flush()
		return nil
	})

	if err != nil {
		// 发送错误事件
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

// StreamChat 流式聊天（SSE）端点
// @Summary 流式聊天
// @Tags AI聊天
// @Accept json
// @Produce text/event-stream
// @Param request body ChatRequestDTO true "聊天请求"
// @Success 200 {string} string "SSE stream"
// @Router /api/v1/ai/chat/stream [post]
func (h *AIChatHandler) StreamChat(c *gin.Context) {
	// 获取用户ID
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	var dto ChatRequestDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 强制使用流式
	dto.Stream = true
	h.streamChat(c, userID, &dto)
}

// GetConfig 获取当前用户的有效AI配置（不包含敏感信息）
// @Summary 获取AI配置状态
// @Tags AI聊天
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/ai/config [get]
func (h *AIChatHandler) GetConfig(c *gin.Context) {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	config, err := h.service.GetEffectiveConfig(c.Request.Context(), userID)
	if err != nil {
		if err == aichat.ErrAINotConfigured {
			c.JSON(http.StatusOK, gin.H{
				"configured": false,
				"message":    "AI service is not configured",
			})
			return
		}
		RespondError(c, http.StatusInternalServerError, "get_config_failed", err.Error())
		return
	}

	// 返回配置状态（不包含API密钥）
	c.JSON(http.StatusOK, gin.H{
		"configured": true,
		"provider":   config.Provider,
		"model":      config.Model,
		"has_key":    config.APIKey != "",
	})
}
