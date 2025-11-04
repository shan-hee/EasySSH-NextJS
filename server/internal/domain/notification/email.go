package notification

import (
	"context"
	"fmt"
	"time"
)

// EmailService 邮件服务接口
type EmailService interface {
	// SendLoginNotification 发送登录通知邮件
	SendLoginNotification(ctx context.Context, email, username, ipAddress, location, deviceInfo string, loginTime time.Time) error

	// SendAlertNotification 发送告警通知邮件
	SendAlertNotification(ctx context.Context, email, username, alertType, alertMessage string, alertTime time.Time) error

	// SendWelcomeEmail 发送欢迎邮件
	SendWelcomeEmail(ctx context.Context, email, username string) error

	// Send2FAEnabledNotification 发送 2FA 启用通知
	Send2FAEnabledNotification(ctx context.Context, email, username string) error

	// SendPasswordChangedNotification 发送密码修改通知
	SendPasswordChangedNotification(ctx context.Context, email, username string, changeTime time.Time) error
}

// EmailConfig 邮件服务配置
type EmailConfig struct {
	SMTPHost     string // SMTP 服务器地址
	SMTPPort     int    // SMTP 端口
	SMTPUsername string // SMTP 用户名
	SMTPPassword string // SMTP 密码
	FromEmail    string // 发件人邮箱
	FromName     string // 发件人名称
	UseTLS       bool   // 是否使用 TLS
}

// Validate 验证邮件配置
func (c *EmailConfig) Validate() error {
	if c.SMTPHost == "" {
		return fmt.Errorf("SMTP host is required")
	}
	if c.SMTPPort == 0 {
		return fmt.Errorf("SMTP port is required")
	}
	if c.FromEmail == "" {
		return fmt.Errorf("from email is required")
	}
	return nil
}

// EmailTemplate 邮件模板类型
type EmailTemplate string

const (
	TemplateLogin          EmailTemplate = "login"
	TemplateAlert          EmailTemplate = "alert"
	TemplateWelcome        EmailTemplate = "welcome"
	Template2FAEnabled     EmailTemplate = "2fa_enabled"
	TemplatePasswordChange EmailTemplate = "password_changed"
)

// EmailData 邮件数据结构
type EmailData struct {
	To       string                 // 收件人
	Subject  string                 // 邮件主题
	Template EmailTemplate          // 模板类型
	Data     map[string]interface{} // 模板数据
}
