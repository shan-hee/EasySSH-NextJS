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

	// SendVerificationCode 发送验证码邮件（注册用）
	SendVerificationCode(ctx context.Context, email, code string) error

	// SendPasswordResetCode 发送密码重置验证码邮件
	SendPasswordResetCode(ctx context.Context, email, code string) error

	// SendNewDeviceAlert 发送新设备登录告警
	SendNewDeviceAlert(ctx context.Context, email, username, deviceName, ip, location string, loginTime time.Time) error

	// SendNewLocationAlert 发送新地理位置登录告警
	SendNewLocationAlert(ctx context.Context, email, username, location, ip string, loginTime time.Time) error

	// SendSuspiciousLoginAlert 发送可疑登录告警
	SendSuspiciousLoginAlert(ctx context.Context, email, username, reason, ip, location string, loginTime time.Time) error

	// SendAccountLockedAlert 发送账户锁定告警
	SendAccountLockedAlert(ctx context.Context, email, username, reason string, unlockTime time.Time) error
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
	SystemName   string // 系统名称（用于邮件模板）
	CurrentYear  int    // 当前年份（用于版权信息）
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
	TemplateLogin            EmailTemplate = "login"
	TemplateAlert            EmailTemplate = "alert"
	TemplateWelcome          EmailTemplate = "welcome"
	Template2FAEnabled       EmailTemplate = "2fa_enabled"
	TemplatePasswordChange   EmailTemplate = "password_changed"
	TemplateVerificationCode EmailTemplate = "verification_code"
	TemplatePasswordReset    EmailTemplate = "password_reset"
	TemplateNewDevice        EmailTemplate = "new_device"        // 新设备登录告警
	TemplateNewLocation      EmailTemplate = "new_location"      // 新地点登录告警
	TemplateSuspiciousLogin  EmailTemplate = "suspicious_login"  // 可疑登录告警
	TemplateAccountLocked    EmailTemplate = "account_locked"    // 账户锁定告警
)

// EmailData 邮件数据结构
type EmailData struct {
	To       string                 // 收件人
	Subject  string                 // 邮件主题
	Template EmailTemplate          // 模板类型
	Data     map[string]interface{} // 模板数据
}
