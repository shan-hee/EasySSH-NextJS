package notification

import (
	"bytes"
	"context"
	"crypto/tls"
	"fmt"
	"html/template"
	"net/smtp"
	"time"
)

// smtpEmailService SMTP 邮件服务实现
type smtpEmailService struct {
	config    *EmailConfig
	templates map[EmailTemplate]*template.Template
}

// NewEmailService 创建邮件服务
func NewEmailService(config *EmailConfig) (EmailService, error) {
	if err := config.Validate(); err != nil {
		return nil, fmt.Errorf("invalid email config: %w", err)
	}

	service := &smtpEmailService{
		config:    config,
		templates: make(map[EmailTemplate]*template.Template),
	}

	// 初始化邮件模板
	if err := service.initTemplates(); err != nil {
		return nil, fmt.Errorf("failed to init templates: %w", err)
	}

	return service, nil
}

// initTemplates 初始化邮件模板
func (s *smtpEmailService) initTemplates() error {
	// 登录通知模板
	s.templates[TemplateLogin] = template.Must(template.New("login").Parse(loginTemplate))

	// 告警通知模板
	s.templates[TemplateAlert] = template.Must(template.New("alert").Parse(alertTemplate))

	// 欢迎邮件模板
	s.templates[TemplateWelcome] = template.Must(template.New("welcome").Parse(welcomeTemplate))

	// 2FA 启用通知模板
	s.templates[Template2FAEnabled] = template.Must(template.New("2fa_enabled").Parse(twoFAEnabledTemplate))

	// 密码修改通知模板
	s.templates[TemplatePasswordChange] = template.Must(template.New("password_changed").Parse(passwordChangedTemplate))

	return nil
}

// SendLoginNotification 发送登录通知邮件
func (s *smtpEmailService) SendLoginNotification(ctx context.Context, email, username, ipAddress, location, deviceInfo string, loginTime time.Time) error {
	data := map[string]interface{}{
		"Username":   username,
		"IPAddress":  ipAddress,
		"Location":   location,
		"DeviceInfo": deviceInfo,
		"LoginTime":  loginTime.Format("2006-01-02 15:04:05"),
	}

	return s.sendEmail(ctx, &EmailData{
		To:       email,
		Subject:  "🔐 新设备登录通知 - EasySSH",
		Template: TemplateLogin,
		Data:     data,
	})
}

// SendAlertNotification 发送告警通知邮件
func (s *smtpEmailService) SendAlertNotification(ctx context.Context, email, username, alertType, alertMessage string, alertTime time.Time) error {
	data := map[string]interface{}{
		"Username":     username,
		"AlertType":    alertType,
		"AlertMessage": alertMessage,
		"AlertTime":    alertTime.Format("2006-01-02 15:04:05"),
	}

	return s.sendEmail(ctx, &EmailData{
		To:       email,
		Subject:  "⚠️ 系统告警通知 - EasySSH",
		Template: TemplateAlert,
		Data:     data,
	})
}

// SendWelcomeEmail 发送欢迎邮件
func (s *smtpEmailService) SendWelcomeEmail(ctx context.Context, email, username string) error {
	data := map[string]interface{}{
		"Username": username,
	}

	return s.sendEmail(ctx, &EmailData{
		To:       email,
		Subject:  "🎉 欢迎使用 EasySSH",
		Template: TemplateWelcome,
		Data:     data,
	})
}

// Send2FAEnabledNotification 发送 2FA 启用通知
func (s *smtpEmailService) Send2FAEnabledNotification(ctx context.Context, email, username string) error {
	data := map[string]interface{}{
		"Username": username,
		"Time":     time.Now().Format("2006-01-02 15:04:05"),
	}

	return s.sendEmail(ctx, &EmailData{
		To:       email,
		Subject:  "🔒 双因子认证已启用 - EasySSH",
		Template: Template2FAEnabled,
		Data:     data,
	})
}

// SendPasswordChangedNotification 发送密码修改通知
func (s *smtpEmailService) SendPasswordChangedNotification(ctx context.Context, email, username string, changeTime time.Time) error {
	data := map[string]interface{}{
		"Username":   username,
		"ChangeTime": changeTime.Format("2006-01-02 15:04:05"),
	}

	return s.sendEmail(ctx, &EmailData{
		To:       email,
		Subject:  "🔑 密码已修改 - EasySSH",
		Template: TemplatePasswordChange,
		Data:     data,
	})
}

// sendEmail 发送邮件（内部方法）
func (s *smtpEmailService) sendEmail(ctx context.Context, emailData *EmailData) error {
	// 获取模板
	tmpl, ok := s.templates[emailData.Template]
	if !ok {
		return fmt.Errorf("template %s not found", emailData.Template)
	}

	// 渲染模板
	var body bytes.Buffer
	if err := tmpl.Execute(&body, emailData.Data); err != nil {
		return fmt.Errorf("failed to render template: %w", err)
	}

	// 构建邮件内容
	message := s.buildMessage(emailData.To, emailData.Subject, body.String())

	// 发送邮件
	return s.send(emailData.To, message)
}

// buildMessage 构建邮件内容
func (s *smtpEmailService) buildMessage(to, subject, body string) []byte {
	msg := fmt.Sprintf("From: %s <%s>\r\n", s.config.FromName, s.config.FromEmail)
	msg += fmt.Sprintf("To: %s\r\n", to)
	msg += fmt.Sprintf("Subject: %s\r\n", subject)
	msg += "MIME-Version: 1.0\r\n"
	msg += "Content-Type: text/html; charset=UTF-8\r\n"
	msg += "\r\n"
	msg += body

	return []byte(msg)
}

// send 发送邮件到 SMTP 服务器
func (s *smtpEmailService) send(to string, message []byte) error {
	// 构建 SMTP 服务器地址
	addr := fmt.Sprintf("%s:%d", s.config.SMTPHost, s.config.SMTPPort)

	// 创建认证
	auth := smtp.PlainAuth("", s.config.SMTPUsername, s.config.SMTPPassword, s.config.SMTPHost)

	// 如果启用 TLS
	if s.config.UseTLS {
		// 创建 TLS 配置
		tlsConfig := &tls.Config{
			ServerName: s.config.SMTPHost,
		}

		// 连接到 SMTP 服务器
		conn, err := tls.Dial("tcp", addr, tlsConfig)
		if err != nil {
			return fmt.Errorf("failed to dial SMTP server: %w", err)
		}
		defer conn.Close()

		// 创建 SMTP 客户端
		client, err := smtp.NewClient(conn, s.config.SMTPHost)
		if err != nil {
			return fmt.Errorf("failed to create SMTP client: %w", err)
		}
		defer client.Close()

		// 认证
		if err := client.Auth(auth); err != nil {
			return fmt.Errorf("SMTP authentication failed: %w", err)
		}

		// 设置发件人
		if err := client.Mail(s.config.FromEmail); err != nil {
			return fmt.Errorf("failed to set sender: %w", err)
		}

		// 设置收件人
		if err := client.Rcpt(to); err != nil {
			return fmt.Errorf("failed to set recipient: %w", err)
		}

		// 发送邮件内容
		w, err := client.Data()
		if err != nil {
			return fmt.Errorf("failed to get data writer: %w", err)
		}

		if _, err := w.Write(message); err != nil {
			return fmt.Errorf("failed to write message: %w", err)
		}

		if err := w.Close(); err != nil {
			return fmt.Errorf("failed to close data writer: %w", err)
		}

		return client.Quit()
	}

	// 不使用 TLS，直接发送
	return smtp.SendMail(addr, auth, s.config.FromEmail, []string{to}, message)
}
