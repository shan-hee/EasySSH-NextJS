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
	SystemName              string                                  `json:"system_name"`
	SystemLogo              string                                  `json:"system_logo"`
	SystemFavicon           string                                  `json:"system_favicon"`
	DefaultLanguage         string                                  `json:"default_language"`
	DefaultTimezone         string                                  `json:"default_timezone"`
	DateFormat              string                                  `json:"date_format"`
	DownloadExcludePatterns string                                  `json:"download_exclude_patterns"`
	DefaultDownloadMode     string                                  `json:"default_download_mode"`
	SkipExcludedOnUpload    bool                                    `json:"skip_excluded_on_upload"`
	MaxFileUploadSize       int                                     `json:"max_file_upload_size"`
	CompletionEnabled       bool                                    `json:"completion_enabled"`
	CompletionProviders     *systemconfig.CompletionProvidersConfig `json:"completion_providers,omitempty"`
	CompletionQuotas        *systemconfig.CompletionQuotasConfig    `json:"completion_quotas,omitempty"`
	CompletionCache         *systemconfig.CompletionCacheConfig     `json:"completion_cache,omitempty"`
	// 注册配置
	AllowRegistration bool   `json:"allow_registration"`
	DefaultRole       string `json:"default_role"`
	// OAuth 配置
	OAuthEnabled       bool   `json:"oauth_enabled"`
	GoogleClientID     string `json:"google_client_id"`
	GoogleClientSecret string `json:"google_client_secret,omitempty"`
	// JWT 过期与刷新（不包含 JWT_SECRET）
	JWTAccessExpireMinutes       int  `json:"jwt_access_expire_minutes"`
	JWTRefreshIdleExpireDays     int  `json:"jwt_refresh_idle_expire_days"`
	JWTRefreshAbsoluteExpireDays int  `json:"jwt_refresh_absolute_expire_days"`
	JWTRefreshRotate             bool `json:"jwt_refresh_rotate"`
	JWTRefreshReuseDetection     bool `json:"jwt_refresh_reuse_detection"`
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
	jwtConfig := config.JWTSessionConfig()
	dto := &SystemConfigDTOV2{
		SystemName:                   config.SystemName,
		SystemLogo:                   config.SystemLogo,
		SystemFavicon:                config.SystemFavicon,
		DefaultLanguage:              config.DefaultLanguage,
		DefaultTimezone:              config.DefaultTimezone,
		DateFormat:                   config.DateFormat,
		DownloadExcludePatterns:      config.DownloadExcludePatterns,
		DefaultDownloadMode:          config.DefaultDownloadMode,
		SkipExcludedOnUpload:         config.SkipExcludedOnUpload,
		MaxFileUploadSize:            config.MaxFileUploadSize,
		CompletionEnabled:            config.CompletionEnabled,
		AllowRegistration:            config.AllowRegistration,
		DefaultRole:                  config.DefaultRole,
		OAuthEnabled:                 config.OAuthEnabled,
		GoogleClientID:               config.GoogleClientID,
		GoogleClientSecret:           config.GoogleClientSecret,
		JWTAccessExpireMinutes:       jwtConfig.AccessExpireMinutes,
		JWTRefreshIdleExpireDays:     jwtConfig.RefreshIdleExpireDays,
		JWTRefreshAbsoluteExpireDays: jwtConfig.RefreshAbsoluteExpireDays,
		JWTRefreshRotate:             jwtConfig.RefreshRotate,
		JWTRefreshReuseDetection:     jwtConfig.RefreshReuseDetection,
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
		SystemName:                   dto.SystemName,
		SystemLogo:                   dto.SystemLogo,
		SystemFavicon:                dto.SystemFavicon,
		DefaultLanguage:              dto.DefaultLanguage,
		DefaultTimezone:              dto.DefaultTimezone,
		DateFormat:                   dto.DateFormat,
		DownloadExcludePatterns:      dto.DownloadExcludePatterns,
		DefaultDownloadMode:          dto.DefaultDownloadMode,
		SkipExcludedOnUpload:         dto.SkipExcludedOnUpload,
		MaxFileUploadSize:            dto.MaxFileUploadSize,
		CompletionEnabled:            dto.CompletionEnabled,
		AllowRegistration:            dto.AllowRegistration,
		DefaultRole:                  dto.DefaultRole,
		OAuthEnabled:                 dto.OAuthEnabled,
		GoogleClientID:               dto.GoogleClientID,
		GoogleClientSecret:           dto.GoogleClientSecret,
		JWTAccessExpireMinutes:       dto.JWTAccessExpireMinutes,
		JWTRefreshIdleExpireDays:     dto.JWTRefreshIdleExpireDays,
		JWTRefreshAbsoluteExpireDays: dto.JWTRefreshAbsoluteExpireDays,
		JWTRefreshRotate:             dto.JWTRefreshRotate,
		JWTRefreshReuseDetection:     dto.JWTRefreshReuseDetection,
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

// PatchBasicInfo 部分更新基本信息配置
// @Summary 部分更新基本信息配置
// @Tags 系统设置
// @Accept json
// @Produce json
// @Param request body SystemConfigDTOV2 true "基本信息配置"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings/system/basic [patch]
func (h *SystemConfigHandler) PatchBasicInfo(c *gin.Context) {
	var dto SystemConfigDTOV2
	if err := c.ShouldBindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// 获取现有配置
	existingConfig, err := h.service.Get(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 只更新基本信息字段
	existingConfig.SystemName = dto.SystemName
	existingConfig.SystemLogo = dto.SystemLogo
	existingConfig.SystemFavicon = dto.SystemFavicon
	existingConfig.DefaultLanguage = dto.DefaultLanguage
	existingConfig.DefaultTimezone = dto.DefaultTimezone
	existingConfig.DateFormat = dto.DateFormat
	existingConfig.AllowRegistration = dto.AllowRegistration
	existingConfig.DefaultRole = dto.DefaultRole
	existingConfig.OAuthEnabled = dto.OAuthEnabled
	existingConfig.GoogleClientID = dto.GoogleClientID
	existingConfig.GoogleClientSecret = dto.GoogleClientSecret

	if err := h.service.Save(c.Request.Context(), existingConfig); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Basic info updated successfully"})
}

// PatchFileTransferConfig 部分更新文件传输配置
// @Summary 部分更新文件传输配置
// @Tags 系统设置
// @Accept json
// @Produce json
// @Param request body SystemConfigDTOV2 true "文件传输配置"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings/system/file-transfer [patch]
func (h *SystemConfigHandler) PatchFileTransferConfig(c *gin.Context) {
	var dto SystemConfigDTOV2
	if err := c.ShouldBindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// 获取现有配置
	existingConfig, err := h.service.Get(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 只更新文件传输字段
	existingConfig.DownloadExcludePatterns = dto.DownloadExcludePatterns
	existingConfig.DefaultDownloadMode = dto.DefaultDownloadMode
	existingConfig.SkipExcludedOnUpload = dto.SkipExcludedOnUpload
	existingConfig.MaxFileUploadSize = dto.MaxFileUploadSize

	if err := h.service.Save(c.Request.Context(), existingConfig); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "File transfer config updated successfully"})
}

// PatchCompletionConfig 部分更新补全配置
// @Summary 部分更新补全配置
// @Tags 系统设置
// @Accept json
// @Produce json
// @Param request body SystemConfigDTOV2 true "补全配置"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings/system/completion [patch]
func (h *SystemConfigHandler) PatchCompletionConfig(c *gin.Context) {
	var dto SystemConfigDTOV2
	if err := c.ShouldBindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// 获取现有配置
	existingConfig, err := h.service.Get(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 只更新补全配置字段
	existingConfig.CompletionEnabled = dto.CompletionEnabled

	// 序列化补全配置
	if dto.CompletionProviders != nil {
		data, err := json.Marshal(dto.CompletionProviders)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		existingConfig.CompletionProviders = string(data)
	}

	if dto.CompletionQuotas != nil {
		data, err := json.Marshal(dto.CompletionQuotas)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		existingConfig.CompletionQuotas = string(data)
	}

	if dto.CompletionCache != nil {
		data, err := json.Marshal(dto.CompletionCache)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		existingConfig.CompletionCache = string(data)
	}

	if err := h.service.Save(c.Request.Context(), existingConfig); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Completion config updated successfully"})
}

// PatchJWTSessionConfig 部分更新 JWT 过期与刷新配置。
// @Summary 部分更新 JWT 会话配置
// @Tags 系统设置
// @Accept json
// @Produce json
// @Param request body SystemConfigDTOV2 true "JWT 会话配置"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings/system/jwt-session [patch]
func (h *SystemConfigHandler) PatchJWTSessionConfig(c *gin.Context) {
	var dto SystemConfigDTOV2
	if err := c.ShouldBindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	existingConfig, err := h.service.Get(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	existingConfig.JWTAccessExpireMinutes = dto.JWTAccessExpireMinutes
	existingConfig.JWTRefreshIdleExpireDays = dto.JWTRefreshIdleExpireDays
	existingConfig.JWTRefreshAbsoluteExpireDays = dto.JWTRefreshAbsoluteExpireDays
	existingConfig.JWTRefreshRotate = dto.JWTRefreshRotate
	existingConfig.JWTRefreshReuseDetection = dto.JWTRefreshReuseDetection

	if err := h.service.Save(c.Request.Context(), existingConfig); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "JWT session configuration saved successfully"})
}
