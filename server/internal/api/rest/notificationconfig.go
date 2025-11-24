package rest

import (
	"net/http"

	"github.com/easyssh/server/internal/domain/notificationconfig"
	"github.com/gin-gonic/gin"
)

// NotificationConfigHandler 通知配置处理器
type NotificationConfigHandler struct {
	service notificationconfig.Service
}

// NewNotificationConfigHandler 创建通知配置处理器
func NewNotificationConfigHandler(service notificationconfig.Service) *NotificationConfigHandler {
	return &NotificationConfigHandler{service: service}
}

// GetSMTPConfig 获取SMTP配置
// @Summary 获取SMTP配置
// @Tags 通知设置
// @Accept json
// @Produce json
// @Success 200 {object} notificationconfig.SMTPConfig
// @Router /api/v1/settings/smtp [get]
func (h *NotificationConfigHandler) GetSMTPConfig(c *gin.Context) {
	config, err := h.service.GetSMTPConfig(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 不返回密码
	config.Password = ""

	c.JSON(http.StatusOK, gin.H{"config": config})
}

// SaveSMTPConfig 保存SMTP配置
// @Summary 保存SMTP配置
// @Tags 通知设置
// @Accept json
// @Produce json
// @Param request body notificationconfig.SMTPConfig true "SMTP配置"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings/smtp [post]
func (h *NotificationConfigHandler) SaveSMTPConfig(c *gin.Context) {
	var config notificationconfig.SMTPConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if err := h.service.SaveSMTPConfig(c.Request.Context(), &config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "SMTP configuration saved successfully"})
}

// TestSMTPConnection 测试SMTP连接
// @Summary 测试SMTP连接
// @Tags 通知设置
// @Accept json
// @Produce json
// @Param request body notificationconfig.SMTPConfig true "SMTP配置"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings/smtp/test [post]
func (h *NotificationConfigHandler) TestSMTPConnection(c *gin.Context) {
	var config notificationconfig.SMTPConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if err := h.service.TestSMTPConnection(c.Request.Context(), &config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "SMTP connection test successful"})
}

// GetWebhookConfig 获取Webhook配置
// @Summary 获取Webhook配置
// @Tags 通知设置
// @Accept json
// @Produce json
// @Success 200 {object} notificationconfig.WebhookConfig
// @Router /api/v1/settings/webhook [get]
func (h *NotificationConfigHandler) GetWebhookConfig(c *gin.Context) {
	config, err := h.service.GetWebhookConfig(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 不返回密钥
	config.Secret = ""

	c.JSON(http.StatusOK, gin.H{"config": config})
}

// SaveWebhookConfig 保存Webhook配置
// @Summary 保存Webhook配置
// @Tags 通知设置
// @Accept json
// @Produce json
// @Param request body notificationconfig.WebhookConfig true "Webhook配置"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings/webhook [post]
func (h *NotificationConfigHandler) SaveWebhookConfig(c *gin.Context) {
	var config notificationconfig.WebhookConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if err := h.service.SaveWebhookConfig(c.Request.Context(), &config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Webhook configuration saved successfully"})
}

// TestWebhookConnection 测试Webhook连接
// @Summary 测试Webhook连接
// @Tags 通知设置
// @Accept json
// @Produce json
// @Param request body notificationconfig.WebhookConfig true "Webhook配置"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings/webhook/test [post]
func (h *NotificationConfigHandler) TestWebhookConnection(c *gin.Context) {
	var config notificationconfig.WebhookConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if err := h.service.TestWebhookConnection(c.Request.Context(), &config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Webhook connection test successful"})
}

// GetDingTalkConfig 获取钉钉配置
// @Summary 获取钉钉配置
// @Tags 通知设置
// @Accept json
// @Produce json
// @Success 200 {object} notificationconfig.DingTalkConfig
// @Router /api/v1/settings/dingding [get]
func (h *NotificationConfigHandler) GetDingTalkConfig(c *gin.Context) {
	config, err := h.service.GetDingTalkConfig(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 不返回密钥
	config.Secret = ""

	c.JSON(http.StatusOK, gin.H{"config": config})
}

// SaveDingTalkConfig 保存钉钉配置
// @Summary 保存钉钉配置
// @Tags 通知设置
// @Accept json
// @Produce json
// @Param request body notificationconfig.DingTalkConfig true "钉钉配置"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings/dingding [post]
func (h *NotificationConfigHandler) SaveDingTalkConfig(c *gin.Context) {
	var config notificationconfig.DingTalkConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if err := h.service.SaveDingTalkConfig(c.Request.Context(), &config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "DingTalk configuration saved successfully"})
}

// TestDingTalkConnection 测试钉钉连接
// @Summary 测试钉钉连接
// @Tags 通知设置
// @Accept json
// @Produce json
// @Param request body notificationconfig.DingTalkConfig true "钉钉配置"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings/dingding/test [post]
func (h *NotificationConfigHandler) TestDingTalkConnection(c *gin.Context) {
	var config notificationconfig.DingTalkConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if err := h.service.TestDingTalkConnection(c.Request.Context(), &config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "DingTalk connection test successful"})
}

// GetWeComConfig 获取企业微信配置
// @Summary 获取企业微信配置
// @Tags 通知设置
// @Accept json
// @Produce json
// @Success 200 {object} notificationconfig.WeComConfig
// @Router /api/v1/settings/wechat [get]
func (h *NotificationConfigHandler) GetWeComConfig(c *gin.Context) {
	config, err := h.service.GetWeComConfig(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"config": config})
}

// SaveWeComConfig 保存企业微信配置
// @Summary 保存企业微信配置
// @Tags 通知设置
// @Accept json
// @Produce json
// @Param request body notificationconfig.WeComConfig true "企业微信配置"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings/wechat [post]
func (h *NotificationConfigHandler) SaveWeComConfig(c *gin.Context) {
	var config notificationconfig.WeComConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if err := h.service.SaveWeComConfig(c.Request.Context(), &config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "WeCom configuration saved successfully"})
}

// TestWeComConnection 测试企业微信连接
// @Summary 测试企业微信连接
// @Tags 通知设置
// @Accept json
// @Produce json
// @Param request body notificationconfig.WeComConfig true "企业微信配置"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings/wechat/test [post]
func (h *NotificationConfigHandler) TestWeComConnection(c *gin.Context) {
	var config notificationconfig.WeComConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if err := h.service.TestWeComConnection(c.Request.Context(), &config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "WeCom connection test successful"})
}

// GetAllNotificationConfig 获取所有通知配置
// @Summary 获取所有通知配置
// @Tags 通知设置
// @Accept json
// @Produce json
// @Success 200 {object} notificationconfig.AllNotificationConfig
// @Router /api/v1/settings/notifications [get]
func (h *NotificationConfigHandler) GetAllNotificationConfig(c *gin.Context) {
	config, err := h.service.GetAllConfig(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 清空敏感字段
	if config.SMTP != nil {
		config.SMTP.Password = ""
	}
	if config.Webhook != nil {
		config.Webhook.Secret = ""
	}
	if config.DingTalk != nil {
		config.DingTalk.Secret = ""
	}

	c.JSON(http.StatusOK, gin.H{"config": config})
}

// SaveAllNotificationConfig 保存所有通知配置
// @Summary 保存所有通知配置
// @Tags 通知设置
// @Accept json
// @Produce json
// @Param request body notificationconfig.AllNotificationConfig true "所有通知配置"
// @Success 200 {object} map[string]string
// @Router /api/v1/settings/notifications [post]
func (h *NotificationConfigHandler) SaveAllNotificationConfig(c *gin.Context) {
	var config notificationconfig.AllNotificationConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if err := h.service.SaveAllConfig(c.Request.Context(), &config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Notification configuration saved successfully"})
}
