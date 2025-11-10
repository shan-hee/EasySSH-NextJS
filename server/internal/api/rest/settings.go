package rest

import (
	"fmt"
	"net/http"

	"github.com/easyssh/server/internal/domain/settings"
	"github.com/easyssh/server/internal/domain/tabsession"
	"github.com/gin-gonic/gin"
)

// SettingsHandler 系统设置处理器
type SettingsHandler struct {
	settingsService        settings.Service
	ipWhitelistService     settings.IPWhitelistService
	tabSessionService      tabsession.Service
}

// NewSettingsHandler 创建设置处理器
func NewSettingsHandler(settingsService settings.Service, ipWhitelistService settings.IPWhitelistService, tabSessionService tabsession.Service) *SettingsHandler {
	return &SettingsHandler{
		settingsService:       settingsService,
		ipWhitelistService:    ipWhitelistService,
		tabSessionService:     tabSessionService,
	}
}

// RegisterRoutes 注册路由
func (h *SettingsHandler) RegisterRoutes(r *gin.RouterGroup) {
	settingsGroup := r.Group("/settings")
	{
		// SMTP 配置相关
		settingsGroup.GET("/smtp", h.GetSMTPConfig)
		settingsGroup.POST("/smtp", h.SaveSMTPConfig)
		settingsGroup.POST("/smtp/test", h.TestSMTPConnection)

		// Webhook 配置相关
		settingsGroup.GET("/webhook", h.GetWebhookConfig)
		settingsGroup.POST("/webhook", h.SaveWebhookConfig)
		settingsGroup.POST("/webhook/test", h.TestWebhookConnection)

		// 钉钉配置相关
		settingsGroup.GET("/dingding", h.GetDingTalkConfig)
		settingsGroup.POST("/dingding", h.SaveDingTalkConfig)
		settingsGroup.POST("/dingding/test", h.TestDingTalkConnection)

		// 企业微信配置相关
		settingsGroup.GET("/wechat", h.GetWeComConfig)
		settingsGroup.POST("/wechat", h.SaveWeComConfig)
		settingsGroup.POST("/wechat/test", h.TestWeComConnection)

		// 系统通用配置相关
		settingsGroup.GET("/system", h.GetSystemConfig)
		settingsGroup.POST("/system", h.SaveSystemConfig)

		// 标签/会话配置相关
		settingsGroup.GET("/tabsession", h.GetTabSessionConfig)
		settingsGroup.POST("/tabsession", h.SaveTabSessionConfig)

		// IP 白名单配置相关
		settingsGroup.GET("/ip-whitelist", h.GetIPWhitelistConfig)
		settingsGroup.GET("/ip-whitelist/list", h.GetIPWhitelistList)
		settingsGroup.POST("/ip-whitelist", h.CreateIPWhitelist)
		settingsGroup.PUT("/ip-whitelist/:id", h.UpdateIPWhitelist)
		settingsGroup.DELETE("/ip-whitelist/:id", h.DeleteIPWhitelist)
		settingsGroup.POST("/ip-whitelist/:id/toggle", h.ToggleIPWhitelist)
		settingsGroup.POST("/ip-whitelist/check", h.CheckIPAllowed)

		// 高级配置路由组 - 必须在通配路由之前注册
		advancedGroup := settingsGroup.Group("/advanced")
		{
			// CORS 配置
			advancedGroup.GET("/cors", h.GetCORSConfig)
			advancedGroup.POST("/cors", h.SaveCORSConfig)

			// 速率限制配置
			advancedGroup.GET("/ratelimit", h.GetRateLimitConfig)
			advancedGroup.POST("/ratelimit", h.SaveRateLimitConfig)

			// Cookie 配置
			advancedGroup.GET("/cookie", h.GetCookieConfig)
			advancedGroup.POST("/cookie", h.SaveCookieConfig)
		}

		// 通用设置 - 通配路由必须放在最后,避免拦截其他路由
		settingsGroup.GET("/:category", h.GetSettingsByCategory)
		settingsGroup.POST("", h.SetSetting)
	}
}

// GetSMTPConfigRequest 获取 SMTP 配置请求
type GetSMTPConfigResponse struct {
	Config *settings.SMTPConfig `json:"config"`
}

// SaveSMTPConfigRequest 保存 SMTP 配置请求
type SaveSMTPConfigRequest struct {
	Enabled   bool   `json:"enabled"`
	Host      string `json:"host"`
	Port      int    `json:"port"`
	Username  string `json:"username"`
	Password  string `json:"password"`
	FromEmail string `json:"from_email"`
	FromName  string `json:"from_name"`
	UseTLS    bool   `json:"use_tls"`
}

// GetSMTPConfig 获取 SMTP 配置
// @Summary 获取 SMTP 配置
// @Tags 系统设置
// @Accept json
// @Produce json
// @Success 200 {object} GetSMTPConfigResponse
// @Router /api/v1/settings/smtp [get]
func (h *SettingsHandler) GetSMTPConfig(c *gin.Context) {
	config, err := h.settingsService.GetSMTPConfig(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 不返回密码
	config.Password = ""

	c.JSON(http.StatusOK, GetSMTPConfigResponse{Config: config})
}

// SaveSMTPConfig 保存 SMTP 配置
// @Summary 保存 SMTP 配置
// @Tags 系统设置
// @Accept json
// @Produce json
// @Param request body SaveSMTPConfigRequest true "SMTP 配置"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings/smtp [post]
func (h *SettingsHandler) SaveSMTPConfig(c *gin.Context) {
	var req SaveSMTPConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	config := &settings.SMTPConfig{
		Enabled:   req.Enabled,
		Host:      req.Host,
		Port:      req.Port,
		Username:  req.Username,
		Password:  req.Password,
		FromEmail: req.FromEmail,
		FromName:  req.FromName,
		UseTLS:    req.UseTLS,
	}

	// 如果密码为空，保持原有密码
	if req.Password == "" {
		existingConfig, err := h.settingsService.GetSMTPConfig(c.Request.Context())
		if err == nil && existingConfig != nil {
			config.Password = existingConfig.Password
		}
	}

	if err := h.settingsService.SaveSMTPConfig(c.Request.Context(), config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "SMTP configuration saved successfully"})
}

// TestSMTPConnection 测试 SMTP 连接
// @Summary 测试 SMTP 连接
// @Tags 系统设置
// @Accept json
// @Produce json
// @Param request body SaveSMTPConfigRequest true "SMTP 配置"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings/smtp/test [post]
func (h *SettingsHandler) TestSMTPConnection(c *gin.Context) {
	var req SaveSMTPConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	config := &settings.SMTPConfig{
		Enabled:   req.Enabled,
		Host:      req.Host,
		Port:      req.Port,
		Username:  req.Username,
		Password:  req.Password,
		FromEmail: req.FromEmail,
		FromName:  req.FromName,
		UseTLS:    req.UseTLS,
	}

	if err := h.settingsService.TestSMTPConnection(c.Request.Context(), config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "SMTP connection test successful"})
}

// GetSettingsByCategory 获取分类下的所有设置
// @Summary 获取分类设置
// @Tags 系统设置
// @Accept json
// @Produce json
// @Param category path string true "分类"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings/{category} [get]
func (h *SettingsHandler) GetSettingsByCategory(c *gin.Context) {
	category := c.Param("category")

	settings, err := h.settingsService.GetSettingsByCategory(c.Request.Context(), category)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, settings)
}

// SetSettingRequest 设置请求
type SetSettingRequest struct {
	Key      string `json:"key" binding:"required"`
	Value    string `json:"value"`
	Category string `json:"category" binding:"required"`
	IsPublic bool   `json:"is_public"`
}

// SetSetting 设置值
// @Summary 设置值
// @Tags 系统设置
// @Accept json
// @Produce json
// @Param request body SetSettingRequest true "设置请求"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings [post]
func (h *SettingsHandler) SetSetting(c *gin.Context) {
	var req SetSettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if err := h.settingsService.SetSetting(c.Request.Context(), req.Key, req.Value, req.Category, req.IsPublic); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Setting saved successfully"})
}

// === Webhook 配置相关 ===

// GetWebhookConfigResponse Webhook 配置响应
type GetWebhookConfigResponse struct {
	Config *settings.WebhookConfig `json:"config"`
}

// SaveWebhookConfigRequest 保存 Webhook 配置请求
type SaveWebhookConfigRequest struct {
	Enabled bool   `json:"enabled"`
	URL     string `json:"url"`
	Secret  string `json:"secret"`
	Method  string `json:"method"`
}

// GetWebhookConfig 获取 Webhook 配置
func (h *SettingsHandler) GetWebhookConfig(c *gin.Context) {
	config, err := h.settingsService.GetWebhookConfig(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 不返回密钥
	config.Secret = ""

	c.JSON(http.StatusOK, GetWebhookConfigResponse{Config: config})
}

// SaveWebhookConfig 保存 Webhook 配置
func (h *SettingsHandler) SaveWebhookConfig(c *gin.Context) {
	var req SaveWebhookConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	config := &settings.WebhookConfig{
		Enabled: req.Enabled,
		URL:     req.URL,
		Secret:  req.Secret,
		Method:  req.Method,
	}

	// 如果密钥为空，保持原有密钥
	if req.Secret == "" {
		existingConfig, err := h.settingsService.GetWebhookConfig(c.Request.Context())
		if err == nil && existingConfig != nil {
			config.Secret = existingConfig.Secret
		}
	}

	if err := h.settingsService.SaveWebhookConfig(c.Request.Context(), config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Webhook configuration saved successfully"})
}

// TestWebhookConnection 测试 Webhook 连接
func (h *SettingsHandler) TestWebhookConnection(c *gin.Context) {
	var req SaveWebhookConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	config := &settings.WebhookConfig{
		Enabled: req.Enabled,
		URL:     req.URL,
		Secret:  req.Secret,
		Method:  req.Method,
	}

	if err := h.settingsService.TestWebhookConnection(c.Request.Context(), config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Webhook connection test successful"})
}

// === 钉钉配置相关 ===

// GetDingTalkConfigResponse 钉钉配置响应
type GetDingTalkConfigResponse struct {
	Config *settings.DingTalkConfig `json:"config"`
}

// SaveDingTalkConfigRequest 保存钉钉配置请求
type SaveDingTalkConfigRequest struct {
	Enabled    bool   `json:"enabled"`
	WebhookURL string `json:"webhook_url"`
	Secret     string `json:"secret"`
}

// GetDingTalkConfig 获取钉钉配置
func (h *SettingsHandler) GetDingTalkConfig(c *gin.Context) {
	config, err := h.settingsService.GetDingTalkConfig(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 不返回密钥
	config.Secret = ""

	c.JSON(http.StatusOK, GetDingTalkConfigResponse{Config: config})
}

// SaveDingTalkConfig 保存钉钉配置
func (h *SettingsHandler) SaveDingTalkConfig(c *gin.Context) {
	var req SaveDingTalkConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	config := &settings.DingTalkConfig{
		Enabled:    req.Enabled,
		WebhookURL: req.WebhookURL,
		Secret:     req.Secret,
	}

	// 如果密钥为空，保持原有密钥
	if req.Secret == "" {
		existingConfig, err := h.settingsService.GetDingTalkConfig(c.Request.Context())
		if err == nil && existingConfig != nil {
			config.Secret = existingConfig.Secret
		}
	}

	if err := h.settingsService.SaveDingTalkConfig(c.Request.Context(), config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "DingTalk configuration saved successfully"})
}

// TestDingTalkConnection 测试钉钉连接
func (h *SettingsHandler) TestDingTalkConnection(c *gin.Context) {
	var req SaveDingTalkConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	config := &settings.DingTalkConfig{
		Enabled:    req.Enabled,
		WebhookURL: req.WebhookURL,
		Secret:     req.Secret,
	}

	if err := h.settingsService.TestDingTalkConnection(c.Request.Context(), config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "DingTalk connection test successful"})
}

// === 企业微信配置相关 ===

// GetWeComConfigResponse 企业微信配置响应
type GetWeComConfigResponse struct {
	Config *settings.WeComConfig `json:"config"`
}

// SaveWeComConfigRequest 保存企业微信配置请求
type SaveWeComConfigRequest struct {
	Enabled    bool   `json:"enabled"`
	WebhookURL string `json:"webhook_url"`
}

// GetWeComConfig 获取企业微信配置
func (h *SettingsHandler) GetWeComConfig(c *gin.Context) {
	config, err := h.settingsService.GetWeComConfig(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, GetWeComConfigResponse{Config: config})
}

// SaveWeComConfig 保存企业微信配置
func (h *SettingsHandler) SaveWeComConfig(c *gin.Context) {
	var req SaveWeComConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	config := &settings.WeComConfig{
		Enabled:    req.Enabled,
		WebhookURL: req.WebhookURL,
	}

	if err := h.settingsService.SaveWeComConfig(c.Request.Context(), config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "WeChat Work configuration saved successfully"})
}

// TestWeComConnection 测试企业微信连接
func (h *SettingsHandler) TestWeComConnection(c *gin.Context) {
	var req SaveWeComConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	config := &settings.WeComConfig{
		Enabled:    req.Enabled,
		WebhookURL: req.WebhookURL,
	}

	if err := h.settingsService.TestWeComConnection(c.Request.Context(), config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "WeChat Work connection test successful"})
}

// === 系统通用配置相关 ===

// GetSystemConfigResponse 系统配置响应
type GetSystemConfigResponse struct {
	Config *settings.SystemConfig `json:"config"`
}

// SaveSystemConfigRequest 保存系统配置请求
type SaveSystemConfigRequest struct {
	// 基本设置
	SystemName    string `json:"system_name"`
	SystemLogo    string `json:"system_logo"`
	SystemFavicon string `json:"system_favicon"`

	// 国际化设置
	DefaultLanguage string `json:"default_language"`
	DefaultTimezone string `json:"default_timezone"`
	DateFormat      string `json:"date_format"`

	// 其他设置
	DefaultPageSize   int `json:"default_page_size"`
	MaxFileUploadSize int `json:"max_file_upload_size"`
}

// GetSystemConfig 获取系统配置
// @Summary 获取系统配置
// @Tags 系统设置
// @Accept json
// @Produce json
// @Success 200 {object} GetSystemConfigResponse
// @Router /api/v1/settings/system [get]
func (h *SettingsHandler) GetSystemConfig(c *gin.Context) {
	config, err := h.settingsService.GetSystemConfig(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, GetSystemConfigResponse{Config: config})
}

// SaveSystemConfig 保存系统配置
// @Summary 保存系统配置
// @Tags 系统设置
// @Accept json
// @Produce json
// @Param request body SaveSystemConfigRequest true "系统配置"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings/system [post]
func (h *SettingsHandler) SaveSystemConfig(c *gin.Context) {
	var req SaveSystemConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	config := &settings.SystemConfig{
		// 基本设置
		SystemName:    req.SystemName,
		SystemLogo:    req.SystemLogo,
		SystemFavicon: req.SystemFavicon,

		// 国际化设置
		DefaultLanguage: req.DefaultLanguage,
		DefaultTimezone: req.DefaultTimezone,
		DateFormat:      req.DateFormat,

		// 其他设置
		DefaultPageSize:   req.DefaultPageSize,
		MaxFileUploadSize: req.MaxFileUploadSize,
	}

	if err := h.settingsService.SaveSystemConfig(c.Request.Context(), config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "System configuration saved successfully"})
}

// === 标签/会话配置相关 ===

// GetTabSessionConfigResponse 标签/会话配置响应
type GetTabSessionConfigResponse struct {
	Config *tabsession.TabSessionSettings `json:"config"`
}

// SaveTabSessionConfigRequest 保存标签/会话配置请求
type SaveTabSessionConfigRequest struct {
	MaxTabs         int  `json:"max_tabs"`
	InactiveMinutes int  `json:"inactive_minutes"`
	Hibernate       bool `json:"hibernate"`
	SessionTimeout  int  `json:"session_timeout"`
	RememberLogin   bool `json:"remember_login"`
}

// GetTabSessionConfig 获取标签/会话配置
// @Summary 获取标签/会话配置
// @Tags 系统设置
// @Accept json
// @Produce json
// @Success 200 {object} GetTabSessionConfigResponse
// @Router /api/v1/settings/tabsession [get]
func (h *SettingsHandler) GetTabSessionConfig(c *gin.Context) {
	config, err := h.tabSessionService.GetTabSessionConfig(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, GetTabSessionConfigResponse{Config: config})
}

// SaveTabSessionConfig 保存标签/会话配置
// @Summary 保存标签/会话配置
// @Tags 系统设置
// @Accept json
// @Produce json
// @Param request body SaveTabSessionConfigRequest true "标签/会话配置"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings/tabsession [post]
func (h *SettingsHandler) SaveTabSessionConfig(c *gin.Context) {
	var req SaveTabSessionConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	config := &tabsession.TabSessionSettings{
		MaxTabs:         req.MaxTabs,
		InactiveMinutes: req.InactiveMinutes,
		Hibernate:       req.Hibernate,
		SessionTimeout:  req.SessionTimeout,
		RememberLogin:   req.RememberLogin,
	}

	if err := h.tabSessionService.SaveTabSessionConfig(c.Request.Context(), config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tab session configuration saved successfully"})
}

// === IP 白名单配置相关 ===

// GetIPWhitelistConfigResponse IP 白名单配置响应
type GetIPWhitelistConfigResponse struct {
	Config *settings.IPWhitelistConfig `json:"config"`
}

// CreateIPWhitelistRequest 创建 IP 白名单请求
type CreateIPWhitelistRequest struct {
	IPAddress   string `json:"ip_address" binding:"required"`
	Description string `json:"description"`
}

// UpdateIPWhitelistRequest 更新 IP 白名单请求
type UpdateIPWhitelistRequest struct {
	IPAddress   string `json:"ip_address"`
	Description string `json:"description"`
}

// CheckIPRequest 检查 IP 请求
type CheckIPRequest struct {
	IP string `json:"ip" binding:"required"`
}

// CheckIPResponse 检查 IP 响应
type CheckIPResponse struct {
	Allowed bool   `json:"allowed"`
	Message string `json:"message"`
}

// GetIPWhitelistConfig 获取 IP 白名单配置
// @Summary 获取 IP 白名单配置
// @Tags 系统设置
// @Accept json
// @Produce json
// @Success 200 {object} GetIPWhitelistConfigResponse
// @Router /api/v1/settings/ip-whitelist [get]
func (h *SettingsHandler) GetIPWhitelistConfig(c *gin.Context) {
	config, err := h.ipWhitelistService.GetIPWhitelistConfig()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, GetIPWhitelistConfigResponse{Config: config})
}

// GetIPWhitelistList 获取 IP 白名单列表
// @Summary 获取 IP 白名单列表
// @Tags 系统设置
// @Accept json
// @Produce json
// @Success 200 {object} []settings.IPWhitelist
// @Router /api/v1/settings/ip-whitelist/list [get]
func (h *SettingsHandler) GetIPWhitelistList(c *gin.Context) {
	whitelists, err := h.ipWhitelistService.GetAllIPWhitelists()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, whitelists)
}

// CreateIPWhitelist 创建 IP 白名单
// @Summary 创建 IP 白名单
// @Tags 系统设置
// @Accept json
// @Produce json
// @Param request body CreateIPWhitelistRequest true "IP 白名单"
// @Success 201 {object} settings.IPWhitelist
// @Router /api/v1/settings/ip-whitelist [post]
func (h *SettingsHandler) CreateIPWhitelist(c *gin.Context) {
	var req CreateIPWhitelistRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// TODO: 从 JWT token 中获取用户 ID
	var userID uint = 1 // 临时使用固定值

	ipWhitelist := &settings.IPWhitelist{
		IPAddress:   req.IPAddress,
		Description: req.Description,
		Enabled:     true,
		CreatedBy:   userID,
	}

	if err := h.ipWhitelistService.CreateIPWhitelist(ipWhitelist); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, ipWhitelist)
}

// UpdateIPWhitelist 更新 IP 白名单
// @Summary 更新 IP 白名单
// @Tags 系统设置
// @Accept json
// @Produce json
// @Param id path int true "IP 白名单 ID"
// @Param request body UpdateIPWhitelistRequest true "IP 白名单"
// @Success 200 {object} settings.IPWhitelist
// @Router /api/v1/settings/ip-whitelist/{id} [put]
func (h *SettingsHandler) UpdateIPWhitelist(c *gin.Context) {
	idParam := c.Param("id")
	var id uint
	if _, err := fmt.Sscanf(idParam, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req UpdateIPWhitelistRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	updates := make(map[string]interface{})
	if req.IPAddress != "" {
		updates["ip_address"] = req.IPAddress
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}

	if err := h.ipWhitelistService.UpdateIPWhitelist(id, updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	whitelist, err := h.ipWhitelistService.GetIPWhitelistByID(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, whitelist)
}

// DeleteIPWhitelist 删除 IP 白名单
// @Summary 删除 IP 白名单
// @Tags 系统设置
// @Accept json
// @Produce json
// @Param id path int true "IP 白名单 ID"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings/ip-whitelist/{id} [delete]
func (h *SettingsHandler) DeleteIPWhitelist(c *gin.Context) {
	idParam := c.Param("id")
	var id uint
	if _, err := fmt.Sscanf(idParam, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	if err := h.ipWhitelistService.DeleteIPWhitelist(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "IP whitelist deleted successfully"})
}

// ToggleIPWhitelist 切换 IP 白名单状态
// @Summary 切换 IP 白名单状态
// @Tags 系统设置
// @Accept json
// @Produce json
// @Param id path int true "IP 白名单 ID"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings/ip-whitelist/{id}/toggle [post]
func (h *SettingsHandler) ToggleIPWhitelist(c *gin.Context) {
	idParam := c.Param("id")
	var id uint
	if _, err := fmt.Sscanf(idParam, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	if err := h.ipWhitelistService.ToggleIPWhitelist(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "IP whitelist status toggled successfully"})
}

// CheckIPAllowed 检查 IP 是否被允许
// @Summary 检查 IP 是否被允许
// @Tags 系统设置
// @Accept json
// @Produce json
// @Param request body CheckIPRequest true "IP 地址"
// @Success 200 {object} CheckIPResponse
// @Router /api/v1/settings/ip-whitelist/check [post]
func (h *SettingsHandler) CheckIPAllowed(c *gin.Context) {
	var req CheckIPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	allowed, err := h.ipWhitelistService.IsIPAllowed(req.IP)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	message := "IP is allowed"
	if !allowed {
		message = "IP is not in whitelist"
	}

	c.JSON(http.StatusOK, CheckIPResponse{
		Allowed: allowed,
		Message: message,
	})
}

// === CORS 配置相关 ===

// GetCORSConfigResponse CORS 配置响应
type GetCORSConfigResponse struct {
	Config *settings.CORSConfig `json:"config"`
}

// SaveCORSConfigRequest 保存 CORS 配置请求
type SaveCORSConfigRequest struct {
	AllowedOrigins []string `json:"allowed_origins"`
	AllowedMethods []string `json:"allowed_methods"`
	AllowedHeaders []string `json:"allowed_headers"`
}

// GetCORSConfig 获取 CORS 配置
// @Summary 获取 CORS 配置
// @Tags 系统设置
// @Accept json
// @Produce json
// @Success 200 {object} GetCORSConfigResponse
// @Router /api/v1/settings/advanced/cors [get]
func (h *SettingsHandler) GetCORSConfig(c *gin.Context) {
	config, err := h.settingsService.GetCORSConfig(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, GetCORSConfigResponse{Config: config})
}

// SaveCORSConfig 保存 CORS 配置
// @Summary 保存 CORS 配置
// @Tags 系统设置
// @Accept json
// @Produce json
// @Param request body SaveCORSConfigRequest true "CORS 配置"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/settings/advanced/cors [post]
func (h *SettingsHandler) SaveCORSConfig(c *gin.Context) {
	var req SaveCORSConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	config := &settings.CORSConfig{
		AllowedOrigins: req.AllowedOrigins,
		AllowedMethods: req.AllowedMethods,
		AllowedHeaders: req.AllowedHeaders,
	}

	if err := h.settingsService.SaveCORSConfig(c.Request.Context(), config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "CORS 配置已保存",
		"config":  config,
	})
}

// === 速率限制配置相关 ===

// GetRateLimitConfigResponse 速率限制配置响应
type GetRateLimitConfigResponse struct {
	Config *settings.RateLimitConfig `json:"config"`
}

// SaveRateLimitConfigRequest 保存速率限制配置请求
type SaveRateLimitConfigRequest struct {
	LoginLimit int `json:"login_limit"`
	APILimit   int `json:"api_limit"`
}

// GetRateLimitConfig 获取速率限制配置
// @Summary 获取速率限制配置
// @Tags 系统设置
// @Accept json
// @Produce json
// @Success 200 {object} GetRateLimitConfigResponse
// @Router /api/v1/settings/advanced/ratelimit [get]
func (h *SettingsHandler) GetRateLimitConfig(c *gin.Context) {
	config, err := h.settingsService.GetRateLimitConfig(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, GetRateLimitConfigResponse{Config: config})
}

// SaveRateLimitConfig 保存速率限制配置
// @Summary 保存速率限制配置
// @Tags 系统设置
// @Accept json
// @Produce json
// @Param request body SaveRateLimitConfigRequest true "速率限制配置"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/settings/advanced/ratelimit [post]
func (h *SettingsHandler) SaveRateLimitConfig(c *gin.Context) {
	var req SaveRateLimitConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	config := &settings.RateLimitConfig{
		LoginLimit: req.LoginLimit,
		APILimit:   req.APILimit,
	}

	if err := h.settingsService.SaveRateLimitConfig(c.Request.Context(), config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "速率限制配置已保存",
		"config":  config,
	})
}

// === Cookie 配置相关 ===

// GetCookieConfigResponse Cookie 配置响应
type GetCookieConfigResponse struct {
	Config *settings.CookieConfig `json:"config"`
}

// SaveCookieConfigRequest 保存 Cookie 配置请求
type SaveCookieConfigRequest struct {
	Secure bool   `json:"secure"`
	Domain string `json:"domain"`
}

// GetCookieConfig 获取 Cookie 配置
// @Summary 获取 Cookie 配置
// @Tags 系统设置
// @Accept json
// @Produce json
// @Success 200 {object} GetCookieConfigResponse
// @Router /api/v1/settings/advanced/cookie [get]
func (h *SettingsHandler) GetCookieConfig(c *gin.Context) {
	config, err := h.settingsService.GetCookieConfig(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, GetCookieConfigResponse{Config: config})
}

// SaveCookieConfig 保存 Cookie 配置
// @Summary 保存 Cookie 配置
// @Tags 系统设置
// @Accept json
// @Produce json
// @Param request body SaveCookieConfigRequest true "Cookie 配置"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/settings/advanced/cookie [post]
func (h *SettingsHandler) SaveCookieConfig(c *gin.Context) {
	var req SaveCookieConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	config := &settings.CookieConfig{
		Secure: req.Secure,
		Domain: req.Domain,
	}

	if err := h.settingsService.SaveCookieConfig(c.Request.Context(), config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Cookie 配置已保存",
		"config":  config,
	})
}
