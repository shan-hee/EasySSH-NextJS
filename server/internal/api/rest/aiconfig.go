package rest

import (
	"net/http"

	"github.com/easyssh/server/internal/domain/aiconfig"
	"github.com/gin-gonic/gin"
)

// AIConfigHandler AI配置处理器
type AIConfigHandler struct {
	service aiconfig.Service
}

// NewAIConfigHandler 创建AI配置处理器
func NewAIConfigHandler(service aiconfig.Service) *AIConfigHandler {
	return &AIConfigHandler{service: service}
}

// AIConfigDTO AI系统配置DTO
type AIConfigDTO struct {
	SystemEnabled      bool   `json:"system_enabled"`
	SystemProvider     string `json:"system_provider"`
	SystemAPIKey       string `json:"system_api_key,omitempty"` // 保存时传入，读取时不返回
	SystemAPIEndpoint  string `json:"system_api_endpoint"`
	SystemDefaultModel string `json:"system_default_model"`
	SystemRateLimit    int    `json:"system_rate_limit"`
	HasAPIKey          bool   `json:"has_api_key,omitempty"` // 仅读取时返回，表示是否已配置
}

// GetSystemAIConfig 获取系统级AI配置
// @Summary 获取系统级AI配置
// @Tags AI设置
// @Accept json
// @Produce json
// @Success 200 {object} AIConfigDTO
// @Router /api/v1/settings/ai/system [get]
func (h *AIConfigHandler) GetSystemAIConfig(c *gin.Context) {
	config, err := h.service.GetSystemConfig(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	dto := &AIConfigDTO{
		SystemEnabled:      config.SystemEnabled,
		SystemProvider:     config.SystemProvider,
		SystemAPIEndpoint:  config.SystemAPIEndpoint,
		SystemDefaultModel: config.SystemDefaultModel,
		SystemRateLimit:    config.SystemRateLimit,
		HasAPIKey:          config.SystemAPIKey != "",
	}

	c.JSON(http.StatusOK, dto)
}

// SaveSystemAIConfig 保存系统级AI配置
// @Summary 保存系统级AI配置
// @Tags AI设置
// @Accept json
// @Produce json
// @Param request body AIConfigDTO true "AI配置"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings/ai/system [post]
func (h *AIConfigHandler) SaveSystemAIConfig(c *gin.Context) {
	var dto AIConfigDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	config := &aiconfig.AIConfig{
		SystemEnabled:      dto.SystemEnabled,
		SystemProvider:     dto.SystemProvider,
		SystemAPIKey:       dto.SystemAPIKey,
		SystemAPIEndpoint:  dto.SystemAPIEndpoint,
		SystemDefaultModel: dto.SystemDefaultModel,
		SystemRateLimit:    dto.SystemRateLimit,
	}

	if err := h.service.SaveSystemConfig(c.Request.Context(), config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "System AI configuration saved successfully"})
}
