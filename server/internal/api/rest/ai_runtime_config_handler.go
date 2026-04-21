package rest

import (
	"errors"
	"net/http"

	"github.com/easyssh/server/internal/domain/aichat"
	"github.com/gin-gonic/gin"
)

type AIRuntimeConfigHandler struct {
	resolver aichat.ConfigResolver
}

func NewAIRuntimeConfigHandler(resolver aichat.ConfigResolver) *AIRuntimeConfigHandler {
	return &AIRuntimeConfigHandler{resolver: resolver}
}

// GetConfig 获取当前用户的有效 AI 配置（不包含敏感信息）
// @Summary 获取 AI 配置状态
// @Tags AI 会话
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/ai/config [get]
func (h *AIRuntimeConfigHandler) GetConfig(c *gin.Context) {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	config, err := h.resolver.Resolve(c.Request.Context(), userID)
	if err != nil {
		if errors.Is(err, aichat.ErrAINotConfigured) {
			c.JSON(http.StatusOK, gin.H{
				"configured": false,
				"message":    "AI service is not configured",
			})
			return
		}

		RespondError(c, http.StatusInternalServerError, "get_config_failed", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"configured": true,
		"provider":   config.Provider,
		"model":      config.Model,
		"models":     config.Models,
		"has_key":    config.APIKey != "",
	})
}
