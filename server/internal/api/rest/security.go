package rest

import (
	"encoding/json"
	"net/http"

	"github.com/easyssh/server/internal/domain/security"
	"github.com/easyssh/server/internal/domain/systemconfig"
	"github.com/gin-gonic/gin"
)

// SecurityHandler 安全配置处理器
type SecurityHandler struct {
	service             security.Service
	systemConfigService systemconfig.Service
}

// NewSecurityHandler 创建安全配置处理器
func NewSecurityHandler(service security.Service) *SecurityHandler {
	return &SecurityHandler{service: service}
}

// SetSystemConfigService 设置系统配置服务，用于在会话设置接口中合并 JWT 过期与刷新配置。
func (h *SecurityHandler) SetSystemConfigService(service systemconfig.Service) {
	h.systemConfigService = service
}

// SecurityConfigDTO 安全配置DTO
type SecurityConfigDTO struct {
	SessionTimeout  int                  `json:"session_timeout"`
	MaxTabs         int                  `json:"max_tabs"`
	InactiveMinutes int                  `json:"inactive_minutes"`
	RememberLogin   bool                 `json:"remember_login"`
	Hibernate       bool                 `json:"hibernate"`
	AllowlistIPs    string               `json:"allowlist_ips"`
	BlocklistIPs    string               `json:"blocklist_ips"`
	CORSConfig      *security.CORSConfig `json:"cors_config,omitempty"`
	LoginLimit      int                  `json:"login_limit"`
	APILimit        int                  `json:"api_limit"`
	TwoFALimit      int                  `json:"two_fa_limit"`
}

// GetSecurityConfig 获取安全配置
// @Summary 获取安全配置
// @Tags 安全设置
// @Accept json
// @Produce json
// @Success 200 {object} SecurityConfigDTO
// @Router /api/v1/settings/security [get]
func (h *SecurityHandler) GetSecurityConfig(c *gin.Context) {
	config, err := h.service.Get(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 转换为DTO
	dto := h.toDTO(config)

	c.JSON(http.StatusOK, gin.H{"config": dto})
}

// SaveSecurityConfig 保存安全配置
// @Summary 保存安全配置
// @Tags 安全设置
// @Accept json
// @Produce json
// @Param request body SecurityConfigDTO true "安全配置"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings/security [post]
func (h *SecurityHandler) SaveSecurityConfig(c *gin.Context) {
	var dto SecurityConfigDTO
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

	c.JSON(http.StatusOK, gin.H{"message": "Security configuration saved successfully"})
}

// GetCORSConfig 获取CORS配置
// @Summary 获取CORS配置
// @Tags 安全设置
// @Accept json
// @Produce json
// @Success 200 {object} security.CORSConfig
// @Router /api/v1/settings/advanced/cors [get]
func (h *SecurityHandler) GetCORSConfig(c *gin.Context) {
	config, err := h.service.GetCORSConfig(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"config": config})
}

// SaveCORSConfig 保存CORS配置
// @Summary 保存CORS配置
// @Tags 安全设置
// @Accept json
// @Produce json
// @Param request body security.CORSConfig true "CORS配置"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings/advanced/cors [post]
func (h *SecurityHandler) SaveCORSConfig(c *gin.Context) {
	var corsConfig security.CORSConfig
	if err := c.ShouldBindJSON(&corsConfig); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// 获取当前配置
	config, err := h.service.Get(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 序列化CORS配置
	data, err := json.Marshal(&corsConfig)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	config.CORSConfig = string(data)

	if err := h.service.Save(c.Request.Context(), config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "CORS configuration saved successfully"})
}

// GetRateLimitConfig 获取速率限制配置
// @Summary 获取速率限制配置
// @Tags 安全设置
// @Accept json
// @Produce json
// @Success 200 {object} map[string]int
// @Router /api/v1/settings/advanced/ratelimit [get]
func (h *SecurityHandler) GetRateLimitConfig(c *gin.Context) {
	config, err := h.service.Get(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"config": gin.H{
			"login_limit":  config.LoginLimit,
			"api_limit":    config.APILimit,
			"two_fa_limit": config.TwoFALimit,
		},
	})
}

// SaveRateLimitConfig 保存速率限制配置
// @Summary 保存速率限制配置
// @Tags 安全设置
// @Accept json
// @Produce json
// @Param request body map[string]int true "速率限制配置"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings/advanced/ratelimit [post]
func (h *SecurityHandler) SaveRateLimitConfig(c *gin.Context) {
	var req struct {
		LoginLimit int `json:"login_limit"`
		APILimit   int `json:"api_limit"`
		TwoFALimit int `json:"two_fa_limit"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// 获取当前配置
	config, err := h.service.Get(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	config.LoginLimit = req.LoginLimit
	config.APILimit = req.APILimit
	if req.TwoFALimit > 0 {
		config.TwoFALimit = req.TwoFALimit
	} else if config.TwoFALimit <= 0 {
		config.TwoFALimit = 5
	}

	if err := h.service.Save(c.Request.Context(), config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Rate limit configuration saved successfully"})
}

// GetCookieConfig 获取Cookie配置
// @Summary 获取Cookie配置
// @Tags 安全设置
// @Accept json
// @Produce json
// @Success 200 {object} security.CookieConfig
// @Router /api/v1/settings/advanced/cookie [get]
func (h *SecurityHandler) GetCookieConfig(c *gin.Context) {
	config, err := h.service.GetCookieConfig(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"config": config})
}

// SaveCookieConfig 保存Cookie配置
// @Summary 保存Cookie配置
// @Tags 安全设置
// @Accept json
// @Produce json
// @Param request body security.CookieConfig true "Cookie配置"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings/advanced/cookie [post]
func (h *SecurityHandler) SaveCookieConfig(c *gin.Context) {
	var cookieConfig security.CookieConfig
	if err := c.ShouldBindJSON(&cookieConfig); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// 获取当前配置
	config, err := h.service.Get(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 序列化Cookie配置
	data, err := json.Marshal(&cookieConfig)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	config.CookieConfig = string(data)

	if err := h.service.Save(c.Request.Context(), config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Cookie configuration saved successfully"})
}

// GetTabSessionConfig 获取标签/会话配置
// @Summary 获取标签/会话配置
// @Tags 安全设置
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/settings/tabsession [get]
func (h *SecurityHandler) GetTabSessionConfig(c *gin.Context) {
	config, err := h.service.Get(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	response := gin.H{
		"max_tabs":         config.MaxTabs,
		"inactive_minutes": config.InactiveMinutes,
		"hibernate":        config.Hibernate,
		"session_timeout":  config.SessionTimeout,
		"remember_login":   config.RememberLogin,
	}

	if h.systemConfigService != nil {
		if systemCfg, err := h.systemConfigService.Get(c.Request.Context()); err == nil {
			jwtCfg := systemCfg.JWTSessionConfig()
			response["jwt_access_expire_minutes"] = jwtCfg.AccessExpireMinutes
			response["jwt_refresh_idle_expire_days"] = jwtCfg.RefreshIdleExpireDays
			response["jwt_refresh_absolute_expire_days"] = jwtCfg.RefreshAbsoluteExpireDays
			response["jwt_refresh_rotate"] = jwtCfg.RefreshRotate
			response["jwt_refresh_reuse_detection"] = jwtCfg.RefreshReuseDetection
		}
	}

	c.JSON(http.StatusOK, gin.H{"config": response})
}

// SaveTabSessionConfig 保存标签/会话配置
// @Summary 保存标签/会话配置
// @Tags 安全设置
// @Accept json
// @Produce json
// @Param request body map[string]interface{} true "标签/会话配置"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings/tabsession [post]
func (h *SecurityHandler) SaveTabSessionConfig(c *gin.Context) {
	var req struct {
		MaxTabs         int  `json:"max_tabs"`
		InactiveMinutes int  `json:"inactive_minutes"`
		Hibernate       bool `json:"hibernate"`
		SessionTimeout  int  `json:"session_timeout"`
		RememberLogin   bool `json:"remember_login"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// 获取当前配置
	config, err := h.service.Get(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	config.MaxTabs = req.MaxTabs
	config.InactiveMinutes = req.InactiveMinutes
	config.Hibernate = req.Hibernate
	config.SessionTimeout = req.SessionTimeout
	config.RememberLogin = req.RememberLogin

	if err := h.service.Save(c.Request.Context(), config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tab session configuration saved successfully"})
}

// GetAccessControlConfig 获取IP访问控制配置
// @Summary 获取IP访问控制配置
// @Tags 安全设置
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/settings/access-control [get]
func (h *SecurityHandler) GetAccessControlConfig(c *gin.Context) {
	config, err := h.service.Get(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"config": gin.H{
			"allowlist_ips": config.AllowlistIPs,
			"blocklist_ips": config.BlocklistIPs,
		},
	})
}

// SaveAccessControlConfig 保存IP访问控制配置
// @Summary 保存IP访问控制配置
// @Tags 安全设置
// @Accept json
// @Produce json
// @Param request body map[string]interface{} true "IP访问控制配置"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings/access-control [post]
func (h *SecurityHandler) SaveAccessControlConfig(c *gin.Context) {
	var req struct {
		AllowlistIPs string `json:"allowlist_ips"`
		BlocklistIPs string `json:"blocklist_ips"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// 获取当前配置
	config, err := h.service.Get(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	config.AllowlistIPs = req.AllowlistIPs
	config.BlocklistIPs = req.BlocklistIPs

	if err := h.service.Save(c.Request.Context(), config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Access control configuration saved successfully"})
}

// toDTO 将模型转换为DTO
func (h *SecurityHandler) toDTO(config *security.SecurityConfig) *SecurityConfigDTO {
	dto := &SecurityConfigDTO{
		SessionTimeout:  config.SessionTimeout,
		MaxTabs:         config.MaxTabs,
		InactiveMinutes: config.InactiveMinutes,
		RememberLogin:   config.RememberLogin,
		Hibernate:       config.Hibernate,
		AllowlistIPs:    config.AllowlistIPs,
		BlocklistIPs:    config.BlocklistIPs,
		LoginLimit:      config.LoginLimit,
		APILimit:        config.APILimit,
		TwoFALimit:      config.TwoFALimit,
	}

	// 解析CORS配置
	if config.CORSConfig != "" {
		var cors security.CORSConfig
		if err := json.Unmarshal([]byte(config.CORSConfig), &cors); err == nil {
			dto.CORSConfig = &cors
		}
	}

	return dto
}

// fromDTO 将DTO转换为模型
func (h *SecurityHandler) fromDTO(dto *SecurityConfigDTO) (*security.SecurityConfig, error) {
	config := &security.SecurityConfig{
		SessionTimeout:  dto.SessionTimeout,
		MaxTabs:         dto.MaxTabs,
		InactiveMinutes: dto.InactiveMinutes,
		RememberLogin:   dto.RememberLogin,
		Hibernate:       dto.Hibernate,
		AllowlistIPs:    dto.AllowlistIPs,
		BlocklistIPs:    dto.BlocklistIPs,
		LoginLimit:      dto.LoginLimit,
		APILimit:        dto.APILimit,
		TwoFALimit:      dto.TwoFALimit,
	}

	// 序列化CORS配置
	if dto.CORSConfig != nil {
		data, err := json.Marshal(dto.CORSConfig)
		if err != nil {
			return nil, err
		}
		config.CORSConfig = string(data)
	}

	return config, nil
}
