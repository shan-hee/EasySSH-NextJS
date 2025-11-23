package rest

import (
	"encoding/json"
	"net/http"

	"github.com/easyssh/server/internal/domain/systemconfig"
	"github.com/gin-gonic/gin"
)

// SystemConfigHandler 系统配置处理器
type SystemConfigHandler struct {
	service systemconfig.Service
}

// NewSystemConfigHandler 创建系统配置处理器
func NewSystemConfigHandler(service systemconfig.Service) *SystemConfigHandler {
	return &SystemConfigHandler{service: service}
}

// GetSystemConfigResponseV2 获取系统配置响应（新版）
type GetSystemConfigResponseV2 struct {
	Config *SystemConfigDTOV2 `json:"config"`
}

// SystemConfigDTOV2 系统配置DTO（新版）
type SystemConfigDTOV2 struct {
	SystemName              string                                   `json:"system_name"`
	SystemLogo              string                                   `json:"system_logo"`
	SystemFavicon           string                                   `json:"system_favicon"`
	DefaultLanguage         string                                   `json:"default_language"`
	DefaultTimezone         string                                   `json:"default_timezone"`
	DateFormat              string                                   `json:"date_format"`
	DownloadExcludePatterns string                                   `json:"download_exclude_patterns"`
	DefaultDownloadMode     string                                   `json:"default_download_mode"`
	SkipExcludedOnUpload    bool                                     `json:"skip_excluded_on_upload"`
	MaxFileUploadSize       int                                      `json:"max_file_upload_size"`
	CompletionEnabled       bool                                     `json:"completion_enabled"`
	CompletionProviders     *systemconfig.CompletionProvidersConfig  `json:"completion_providers,omitempty"`
	CompletionQuotas        *systemconfig.CompletionQuotasConfig     `json:"completion_quotas,omitempty"`
	CompletionCache         *systemconfig.CompletionCacheConfig      `json:"completion_cache,omitempty"`
}

// GetSystemConfig 获取系统配置
// @Summary 获取系统配置
// @Tags 系统设置
// @Accept json
// @Produce json
// @Success 200 {object} GetSystemConfigResponse
// @Router /api/v1/settings/system [get]
func (h *SystemConfigHandler) GetSystemConfig(c *gin.Context) {
	config, err := h.service.Get(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 转换为DTO
	dto := h.toDTO(config)

	c.JSON(http.StatusOK, GetSystemConfigResponseV2{Config: dto})
}

// SaveSystemConfig 保存系统配置
// @Summary 保存系统配置
// @Tags 系统设置
// @Accept json
// @Produce json
// @Param request body SystemConfigDTOV2 true "系统配置"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings/system [post]
func (h *SystemConfigHandler) SaveSystemConfig(c *gin.Context) {
	var dto SystemConfigDTOV2
	if err := c.ShouldBindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// 转换为模型
	config, err := h.fromDTO(&dto)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.Save(c.Request.Context(), config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "System configuration saved successfully"})
}

// toDTO 将模型转换为DTO
func (h *SystemConfigHandler) toDTO(config *systemconfig.SystemConfig) *SystemConfigDTOV2 {
	dto := &SystemConfigDTOV2{
		SystemName:              config.SystemName,
		SystemLogo:              config.SystemLogo,
		SystemFavicon:           config.SystemFavicon,
		DefaultLanguage:         config.DefaultLanguage,
		DefaultTimezone:         config.DefaultTimezone,
		DateFormat:              config.DateFormat,
		DownloadExcludePatterns: config.DownloadExcludePatterns,
		DefaultDownloadMode:     config.DefaultDownloadMode,
		SkipExcludedOnUpload:    config.SkipExcludedOnUpload,
		MaxFileUploadSize:       config.MaxFileUploadSize,
		CompletionEnabled:       config.CompletionEnabled,
	}

	// 解析补全配置
	if config.CompletionProviders != "" {
		var providers systemconfig.CompletionProvidersConfig
		if err := json.Unmarshal([]byte(config.CompletionProviders), &providers); err == nil {
			dto.CompletionProviders = &providers
		}
	}

	if config.CompletionQuotas != "" {
		var quotas systemconfig.CompletionQuotasConfig
		if err := json.Unmarshal([]byte(config.CompletionQuotas), &quotas); err == nil {
			dto.CompletionQuotas = &quotas
		}
	}

	if config.CompletionCache != "" {
		var cache systemconfig.CompletionCacheConfig
		if err := json.Unmarshal([]byte(config.CompletionCache), &cache); err == nil {
			dto.CompletionCache = &cache
		}
	}

	return dto
}

// fromDTO 将DTO转换为模型
func (h *SystemConfigHandler) fromDTO(dto *SystemConfigDTOV2) (*systemconfig.SystemConfig, error) {
	config := &systemconfig.SystemConfig{
		SystemName:              dto.SystemName,
		SystemLogo:              dto.SystemLogo,
		SystemFavicon:           dto.SystemFavicon,
		DefaultLanguage:         dto.DefaultLanguage,
		DefaultTimezone:         dto.DefaultTimezone,
		DateFormat:              dto.DateFormat,
		DownloadExcludePatterns: dto.DownloadExcludePatterns,
		DefaultDownloadMode:     dto.DefaultDownloadMode,
		SkipExcludedOnUpload:    dto.SkipExcludedOnUpload,
		MaxFileUploadSize:       dto.MaxFileUploadSize,
		CompletionEnabled:       dto.CompletionEnabled,
	}

	// 序列化补全配置
	if dto.CompletionProviders != nil {
		data, err := json.Marshal(dto.CompletionProviders)
		if err != nil {
			return nil, err
		}
		config.CompletionProviders = string(data)
	}

	if dto.CompletionQuotas != nil {
		data, err := json.Marshal(dto.CompletionQuotas)
		if err != nil {
			return nil, err
		}
		config.CompletionQuotas = string(data)
	}

	if dto.CompletionCache != nil {
		data, err := json.Marshal(dto.CompletionCache)
		if err != nil {
			return nil, err
		}
		config.CompletionCache = string(data)
	}

	return config, nil
}
