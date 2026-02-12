package rest

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/easyssh/server/internal/domain/aichat"
	"github.com/gin-gonic/gin"
)

// AIChatToolsHandler AI聊天工具处理器
type AIChatToolsHandler struct {
	toolExecutor *aichat.ToolExecutorService
}

// NewAIChatToolsHandler 创建AI聊天工具处理器
func NewAIChatToolsHandler(toolExecutor *aichat.ToolExecutorService) *AIChatToolsHandler {
	return &AIChatToolsHandler{
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

// ToolExecuteRequestDTO 工具执行请求DTO
type ToolExecuteRequestDTO struct {
	ToolCall       ToolCallDTO `json:"tool_call" binding:"required"`
	PermissionMode string      `json:"permission_mode,omitempty" binding:"omitempty,oneof=readonly balanced privileged"`
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
	permissionMode := aichat.NormalizePermissionMode(dto.PermissionMode)
	result, err := h.toolExecutor.ExecuteTool(c.Request.Context(), userID, toolCall, permissionMode)
	if err != nil {
		if errors.Is(err, aichat.ErrToolPermissionDenied) {
			RespondError(c, http.StatusForbidden, "tool_permission_denied", err.Error())
			return
		}
		RespondError(c, http.StatusInternalServerError, "tool_execution_failed", err.Error())
		return
	}

	RespondSuccess(c, &ToolExecuteResponseDTO{
		ToolCallID: result.ToolCallID,
		Content:    result.Content,
		IsError:    result.IsError,
	})
}
