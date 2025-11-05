package rest

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/easyssh/server/internal/domain/settings"
	"github.com/gin-gonic/gin"
)

// SettingsHandler 系统设置处理器
type SettingsHandler struct {
	settingsService settings.Service
}

// NewSettingsHandler 创建设置处理器
func NewSettingsHandler(settingsService settings.Service) *SettingsHandler {
	return &SettingsHandler{
		settingsService: settingsService,
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
		settingsGroup.POST("/upload/logo", h.UploadLogo)

		// 通用设置
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
	SystemName        string `json:"system_name"`
	SystemDescription string `json:"system_description"`
	SystemLogo        string `json:"system_logo"`
	SystemFavicon     string `json:"system_favicon"`

	// 国际化设置
	DefaultLanguage string `json:"default_language"`
	DefaultTimezone string `json:"default_timezone"`
	DateFormat      string `json:"date_format"`

	// 功能设置
	EnableUserRegistration bool `json:"enable_user_registration"`
	EnableGuestAccess      bool `json:"enable_guest_access"`
	EnableFileManager      bool `json:"enable_file_manager"`
	EnableWebTerminal      bool `json:"enable_web_terminal"`
	EnableMonitoring       bool `json:"enable_monitoring"`

	// 安全设置
	SessionTimeout    int  `json:"session_timeout"`
	MaxLoginAttempts  int  `json:"max_login_attempts"`
	PasswordMinLength int  `json:"password_min_length"`
	RequireTwoFactor  bool `json:"require_two_factor"`

	// 其他设置
	DefaultPageSize         int  `json:"default_page_size"`
	MaxFileUploadSize       int  `json:"max_file_upload_size"`
	EnableSystemStats       bool `json:"enable_system_stats"`
	EnableMaintenanceMode   bool `json:"enable_maintenance_mode"`
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
		SystemName:        req.SystemName,
		SystemDescription: req.SystemDescription,
		SystemLogo:        req.SystemLogo,
		SystemFavicon:     req.SystemFavicon,

		// 国际化设置
		DefaultLanguage: req.DefaultLanguage,
		DefaultTimezone: req.DefaultTimezone,
		DateFormat:      req.DateFormat,

		// 功能设置
		EnableUserRegistration: req.EnableUserRegistration,
		EnableGuestAccess:      req.EnableGuestAccess,
		EnableFileManager:      req.EnableFileManager,
		EnableWebTerminal:      req.EnableWebTerminal,
		EnableMonitoring:       req.EnableMonitoring,

		// 安全设置
		SessionTimeout:    req.SessionTimeout,
		MaxLoginAttempts:  req.MaxLoginAttempts,
		PasswordMinLength: req.PasswordMinLength,
		RequireTwoFactor:  req.RequireTwoFactor,

		// 其他设置
		DefaultPageSize:         req.DefaultPageSize,
		MaxFileUploadSize:       req.MaxFileUploadSize,
		EnableSystemStats:       req.EnableSystemStats,
		EnableMaintenanceMode:   req.EnableMaintenanceMode,
	}

	if err := h.settingsService.SaveSystemConfig(c.Request.Context(), config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "System configuration saved successfully"})
}

// UploadLogo 上传Logo文件
// @Summary 上传Logo文件
// @Tags 系统设置
// @Accept multipart/form-data
// @Produce json
// @Param file formData file true "Logo文件"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings/upload/logo [post]
func (h *SettingsHandler) UploadLogo(c *gin.Context) {
	// 限制文件大小 (10MB)
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 10<<20)

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无法获取上传文件"})
		return
	}
	defer file.Close()

	// 检查文件类型
	allowedTypes := map[string]bool{
		"image/jpeg": true,
		"image/jpg":  true,
		"image/png":  true,
		"image/svg+xml": true,
		"image/webp": true,
	}

	// 读取文件头512字节来检测文件类型
	buffer := make([]byte, 512)
	_, err = file.Read(buffer)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无法读取文件"})
		return
	}

	// 重置文件指针
	_, err = file.Seek(0, 0)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "文件处理失败"})
		return
	}

	contentType := http.DetectContentType(buffer)
	if !allowedTypes[contentType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "不支持的文件类型，仅支持 JPG、PNG、SVG、WebP 格式"})
		return
	}

	// 检查文件扩展名
	ext := strings.ToLower(filepath.Ext(header.Filename))
	validExtensions := map[string]bool{
		".jpg":  true,
		".jpeg": true,
		".png":  true,
		".svg":  true,
		".webp": true,
	}

	if !validExtensions[ext] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "不支持的文件扩展名"})
		return
	}

	// 创建上传目录
	uploadDir := filepath.Join("..", "..", "web", "public", "uploads")
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法创建上传目录"})
		return
	}

	// 生成唯一文件名
	timestamp := time.Now().Unix()
	fileName := fmt.Sprintf("logo_%d%s", timestamp, ext)
	filePath := filepath.Join(uploadDir, fileName)

	// 创建目标文件
	dst, err := os.Create(filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法创建文件"})
		return
	}
	defer dst.Close()

	// 复制文件内容
	_, err = io.Copy(dst, file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "文件保存失败"})
		return
	}

	// 返回文件URL
	fileURL := fmt.Sprintf("/uploads/%s", fileName)

	c.JSON(http.StatusOK, gin.H{
		"message":  "Logo上传成功",
		"file_url": fileURL,
		"file_name": fileName,
	})
}
