package settings

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/smtp"
	"strings"

	"github.com/easyssh/server/internal/domain/notification"
)

// Service 系统设置服务接口
type Service interface {
	// 基本设置操作
	GetSetting(ctx context.Context, key string) (string, error)
	GetSettingsByCategory(ctx context.Context, category string) (map[string]string, error)
	SetSetting(ctx context.Context, key, value, category string, isPublic bool) error
	DeleteSetting(ctx context.Context, key string) error

	// SMTP 配置
	GetSMTPConfig(ctx context.Context) (*SMTPConfig, error)
	SaveSMTPConfig(ctx context.Context, config *SMTPConfig) error
	TestSMTPConnection(ctx context.Context, config *SMTPConfig) error

	// Webhook 配置
	GetWebhookConfig(ctx context.Context) (*WebhookConfig, error)
	SaveWebhookConfig(ctx context.Context, config *WebhookConfig) error
	TestWebhookConnection(ctx context.Context, config *WebhookConfig) error

	// 钉钉配置
	GetDingTalkConfig(ctx context.Context) (*DingTalkConfig, error)
	SaveDingTalkConfig(ctx context.Context, config *DingTalkConfig) error
	TestDingTalkConnection(ctx context.Context, config *DingTalkConfig) error

	// 企业微信配置
	GetWeComConfig(ctx context.Context) (*WeComConfig, error)
	SaveWeComConfig(ctx context.Context, config *WeComConfig) error
	TestWeComConnection(ctx context.Context, config *WeComConfig) error

	// 系统通用配置
	GetSystemConfig(ctx context.Context) (*SystemConfig, error)
	SaveSystemConfig(ctx context.Context, config *SystemConfig) error

	// 数据库连接池配置
	GetDatabasePoolConfig(ctx context.Context) (*DatabasePoolConfig, error)
	SaveDatabasePoolConfig(ctx context.Context, config *DatabasePoolConfig) error

	// JWT 配置
	GetJWTConfig(ctx context.Context) (*JWTConfig, error)
	SaveJWTConfig(ctx context.Context, config *JWTConfig) error

	// CORS 配置
	GetCORSConfig(ctx context.Context) (*CORSConfig, error)
	SaveCORSConfig(ctx context.Context, config *CORSConfig) error

	// 速率限制配置
	GetRateLimitConfig(ctx context.Context) (*RateLimitConfig, error)
	SaveRateLimitConfig(ctx context.Context, config *RateLimitConfig) error

	// Cookie 配置
	GetCookieConfig(ctx context.Context) (*CookieConfig, error)
	SaveCookieConfig(ctx context.Context, config *CookieConfig) error
}

type service struct {
	repo          Repository
	configManager *ConfigManager // 配置管理器（用于清除缓存）
}

// NewService 创建设置服务
func NewService(repo Repository) Service {
	return &service{repo: repo}
}

// SetConfigManager 设置配置管理器（用于清除缓存）
func (s *service) SetConfigManager(cm *ConfigManager) {
	s.configManager = cm
}

// GetSetting 获取单个设置值
func (s *service) GetSetting(ctx context.Context, key string) (string, error) {
	setting, err := s.repo.GetByKey(ctx, key)
	if err != nil {
		return "", err
	}
	if setting == nil {
		return "", fmt.Errorf("setting not found: %s", key)
	}
	return setting.Value, nil
}

// GetSettingsByCategory 获取分类下的所有设置
func (s *service) GetSettingsByCategory(ctx context.Context, category string) (map[string]string, error) {
	settings, err := s.repo.GetByCategory(ctx, category)
	if err != nil {
		return nil, err
	}

	result := make(map[string]string)
	for _, setting := range settings {
		result[setting.Key] = setting.Value
	}
	return result, nil
}

// SetSetting 设置值
func (s *service) SetSetting(ctx context.Context, key, value, category string, isPublic bool) error {
	return s.repo.Set(ctx, key, value, category, isPublic)
}

// DeleteSetting 删除设置
func (s *service) DeleteSetting(ctx context.Context, key string) error {
	return s.repo.Delete(ctx, key)
}

// GetSMTPConfig 获取 SMTP 配置
func (s *service) GetSMTPConfig(ctx context.Context) (*SMTPConfig, error) {
	return s.repo.GetSMTPConfig(ctx)
}

// SaveSMTPConfig 保存 SMTP 配置
func (s *service) SaveSMTPConfig(ctx context.Context, config *SMTPConfig) error {
	// 验证配置
	if config.Enabled {
		if config.Host == "" {
			return fmt.Errorf("SMTP host is required")
		}
		if config.Port <= 0 || config.Port > 65535 {
			return fmt.Errorf("invalid SMTP port: %d", config.Port)
		}
		if config.FromEmail == "" {
			return fmt.Errorf("from email is required")
		}
	}

	return s.repo.SaveSMTPConfig(ctx, config)
}

// TestSMTPConnection 测试 SMTP 连接
func (s *service) TestSMTPConnection(ctx context.Context, config *SMTPConfig) error {
	if !config.Enabled {
		return fmt.Errorf("SMTP is not enabled")
	}

	// 验证必填字段
	if config.Host == "" {
		return fmt.Errorf("SMTP host is required")
	}
	if config.Port <= 0 || config.Port > 65535 {
		return fmt.Errorf("invalid SMTP port: %d", config.Port)
	}
	if config.FromEmail == "" {
		return fmt.Errorf("from email is required")
	}

	// 测试实际连接
	return testSMTPConnectionImpl(config)
}

// testSMTPConnectionImpl 测试 SMTP 连接的具体实现
func testSMTPConnectionImpl(config *SMTPConfig) error {
	// 导入所需的包在文件开头添加
	// 使用 net/smtp 进行连接测试
	addr := fmt.Sprintf("%s:%d", config.Host, config.Port)

	// 尝试连接并认证
	var auth smtp.Auth
	if config.Username != "" && config.Password != "" {
		auth = smtp.PlainAuth("", config.Username, config.Password, config.Host)
	}

	// 发送测试邮件到发件人自己
	testMessage := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: EasySSH SMTP Test\r\n\r\nThis is a test email from EasySSH. Your SMTP configuration is working correctly!", config.FromEmail, config.FromEmail)

	if config.UseTLS {
		// 使用 TLS 连接
		return sendMailTLS(addr, auth, config.FromEmail, []string{config.FromEmail}, []byte(testMessage))
	}

	// 使用普通连接
	return smtp.SendMail(addr, auth, config.FromEmail, []string{config.FromEmail}, []byte(testMessage))
}

// sendMailTLS 使用 TLS 发送邮件
func sendMailTLS(addr string, auth smtp.Auth, from string, to []string, msg []byte) error {
	// 解析主机名（去掉端口）
	host := addr[:strings.LastIndex(addr, ":")]

	// 建立 TLS 连接
	tlsConfig := &tls.Config{
		ServerName: host,
	}

	conn, err := tls.Dial("tcp", addr, tlsConfig)
	if err != nil {
		return fmt.Errorf("failed to connect via TLS: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("failed to create SMTP client: %w", err)
	}
	defer client.Close()

	// 认证
	if auth != nil {
		if err = client.Auth(auth); err != nil {
			return fmt.Errorf("SMTP authentication failed: %w", err)
		}
	}

	// 发送邮件
	if err = client.Mail(from); err != nil {
		return fmt.Errorf("failed to set sender: %w", err)
	}

	for _, addr := range to {
		if err = client.Rcpt(addr); err != nil {
			return fmt.Errorf("failed to set recipient: %w", err)
		}
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("failed to get data writer: %w", err)
	}

	if _, err = w.Write(msg); err != nil {
		return fmt.Errorf("failed to write message: %w", err)
	}

	if err = w.Close(); err != nil {
		return fmt.Errorf("failed to close data writer: %w", err)
	}

	return client.Quit()
}

// GetWebhookConfig 获取 Webhook 配置
func (s *service) GetWebhookConfig(ctx context.Context) (*WebhookConfig, error) {
	return s.repo.GetWebhookConfig(ctx)
}

// SaveWebhookConfig 保存 Webhook 配置
func (s *service) SaveWebhookConfig(ctx context.Context, config *WebhookConfig) error {
	// 验证配置
	if config.Enabled {
		if config.URL == "" {
			return fmt.Errorf("webhook URL is required")
		}
		if config.Method != "POST" && config.Method != "GET" {
			return fmt.Errorf("webhook method must be POST or GET")
		}
	}

	return s.repo.SaveWebhookConfig(ctx, config)
}

// TestWebhookConnection 测试 Webhook 连接
func (s *service) TestWebhookConnection(ctx context.Context, config *WebhookConfig) error {
	if !config.Enabled {
		return fmt.Errorf("webhook is not enabled")
	}

	if config.URL == "" {
		return fmt.Errorf("webhook URL is required")
	}

	// 转换为 notification.WebhookConfig
	notificationConfig := &notification.WebhookConfig{
		URL:    config.URL,
		Secret: config.Secret,
		Method: config.Method,
	}

	return notification.TestWebhookConnection(notificationConfig)
}

// GetDingTalkConfig 获取钉钉配置
func (s *service) GetDingTalkConfig(ctx context.Context) (*DingTalkConfig, error) {
	return s.repo.GetDingTalkConfig(ctx)
}

// SaveDingTalkConfig 保存钉钉配置
func (s *service) SaveDingTalkConfig(ctx context.Context, config *DingTalkConfig) error {
	// 验证配置
	if config.Enabled {
		if config.WebhookURL == "" {
			return fmt.Errorf("dingtalk webhook URL is required")
		}
	}

	return s.repo.SaveDingTalkConfig(ctx, config)
}

// TestDingTalkConnection 测试钉钉连接
func (s *service) TestDingTalkConnection(ctx context.Context, config *DingTalkConfig) error {
	if !config.Enabled {
		return fmt.Errorf("dingtalk is not enabled")
	}

	if config.WebhookURL == "" {
		return fmt.Errorf("dingtalk webhook URL is required")
	}

	// 转换为 notification.DingTalkConfig
	notificationConfig := &notification.DingTalkConfig{
		WebhookURL: config.WebhookURL,
		Secret:     config.Secret,
	}

	return notification.TestDingTalkConnection(notificationConfig)
}

// GetWeComConfig 获取企业微信配置
func (s *service) GetWeComConfig(ctx context.Context) (*WeComConfig, error) {
	return s.repo.GetWeComConfig(ctx)
}

// SaveWeComConfig 保存企业微信配置
func (s *service) SaveWeComConfig(ctx context.Context, config *WeComConfig) error {
	// 验证配置
	if config.Enabled {
		if config.WebhookURL == "" {
			return fmt.Errorf("wechat work webhook URL is required")
		}
	}

	return s.repo.SaveWeComConfig(ctx, config)
}

// TestWeComConnection 测试企业微信连接
func (s *service) TestWeComConnection(ctx context.Context, config *WeComConfig) error {
	if !config.Enabled {
		return fmt.Errorf("wechat work is not enabled")
	}

	if config.WebhookURL == "" {
		return fmt.Errorf("wechat work webhook URL is required")
	}

	// 转换为 notification.WeComConfig
	notificationConfig := &notification.WeComConfig{
		WebhookURL: config.WebhookURL,
	}

	return notification.TestWeComConnection(notificationConfig)
}

// GetSystemConfig 获取系统通用配置
func (s *service) GetSystemConfig(ctx context.Context) (*SystemConfig, error) {
	return s.repo.GetSystemConfig(ctx)
}

// SaveSystemConfig 保存系统通用配置
func (s *service) SaveSystemConfig(ctx context.Context, config *SystemConfig) error {
	// 验证配置
	if config.SystemName == "" {
		return fmt.Errorf("system name is required")
	}
	if config.DefaultPageSize < 10 || config.DefaultPageSize > 100 {
		return fmt.Errorf("default page size must be between 10 and 100")
	}
	if config.MaxFileUploadSize < 1 || config.MaxFileUploadSize > 1024 {
		return fmt.Errorf("max file upload size must be between 1 and 1024 MB")
	}

	return s.repo.SaveSystemConfig(ctx, config)
}
