package notificationconfig

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net/http"
	"net/smtp"
	"net/url"
	"strings"
	"time"
)

// Service 通知配置服务接口
type Service interface {
	// Get 获取通知配置
	Get(ctx context.Context) (*NotificationConfig, error)

	// Save 保存通知配置
	Save(ctx context.Context, config *NotificationConfig) error

	// SMTP相关
	GetSMTPConfig(ctx context.Context) (*SMTPConfig, error)
	SaveSMTPConfig(ctx context.Context, config *SMTPConfig) error
	TestSMTPConnection(ctx context.Context, config *SMTPConfig) error

	// Webhook相关
	GetWebhookConfig(ctx context.Context) (*WebhookConfig, error)
	SaveWebhookConfig(ctx context.Context, config *WebhookConfig) error
	TestWebhookConnection(ctx context.Context, config *WebhookConfig) error

	// 钉钉相关
	GetDingTalkConfig(ctx context.Context) (*DingTalkConfig, error)
	SaveDingTalkConfig(ctx context.Context, config *DingTalkConfig) error
	TestDingTalkConnection(ctx context.Context, config *DingTalkConfig) error

	// 企业微信相关
	GetWeComConfig(ctx context.Context) (*WeComConfig, error)
	SaveWeComConfig(ctx context.Context, config *WeComConfig) error
	TestWeComConnection(ctx context.Context, config *WeComConfig) error

	// 统一配置接口
	GetAllConfig(ctx context.Context) (*AllNotificationConfig, error)
	SaveAllConfig(ctx context.Context, config *AllNotificationConfig) error
}

type service struct {
	repo Repository
}

// NewService 创建通知配置服务
func NewService(repo Repository) Service {
	return &service{repo: repo}
}

// Get 获取通知配置
func (s *service) Get(ctx context.Context) (*NotificationConfig, error) {
	return s.repo.Get(ctx)
}

// Save 保存通知配置
func (s *service) Save(ctx context.Context, config *NotificationConfig) error {
	return s.repo.Save(ctx, config)
}

// GetSMTPConfig 获取SMTP配置
func (s *service) GetSMTPConfig(ctx context.Context) (*SMTPConfig, error) {
	return s.repo.GetSMTPConfig(ctx)
}

// SaveSMTPConfig 保存SMTP配置
func (s *service) SaveSMTPConfig(ctx context.Context, config *SMTPConfig) error {
	// 验证配置
	if err := s.validateSMTPConfig(config); err != nil {
		return err
	}

	// 如果密码为空，保留原密码
	if config.Password == "" {
		existing, err := s.repo.GetSMTPConfig(ctx)
		if err == nil && existing != nil {
			config.Password = existing.Password
		}
	}

	return s.repo.SaveSMTPConfig(ctx, config)
}

// TestSMTPConnection 测试SMTP连接
func (s *service) TestSMTPConnection(ctx context.Context, config *SMTPConfig) error {
	if !config.Enabled {
		return errors.New("SMTP is disabled")
	}

	// 验证配置
	if err := s.validateSMTPConfig(config); err != nil {
		return err
	}

	// 构建SMTP地址
	addr := fmt.Sprintf("%s:%d", config.Host, config.Port)

	// 尝试连接
	var client *smtp.Client
	var err error

	if config.UseTLS {
		// 使用TLS连接
		tlsConfig := &tls.Config{
			ServerName:         config.Host,
			InsecureSkipVerify: false,
		}
		conn, err := tls.Dial("tcp", addr, tlsConfig)
		if err != nil {
			return fmt.Errorf("failed to connect with TLS: %w", err)
		}
		defer conn.Close()

		client, err = smtp.NewClient(conn, config.Host)
		if err != nil {
			return fmt.Errorf("failed to create SMTP client: %w", err)
		}
	} else {
		// 普通连接
		client, err = smtp.Dial(addr)
		if err != nil {
			return fmt.Errorf("failed to connect: %w", err)
		}
	}
	defer client.Close()

	// 尝试认证
	if config.Username != "" && config.Password != "" {
		auth := smtp.PlainAuth("", config.Username, config.Password, config.Host)
		if err := client.Auth(auth); err != nil {
			return fmt.Errorf("authentication failed: %w", err)
		}
	}

	return nil
}

// GetWebhookConfig 获取Webhook配置
func (s *service) GetWebhookConfig(ctx context.Context) (*WebhookConfig, error) {
	return s.repo.GetWebhookConfig(ctx)
}

// SaveWebhookConfig 保存Webhook配置
func (s *service) SaveWebhookConfig(ctx context.Context, config *WebhookConfig) error {
	// 验证配置
	if err := s.validateWebhookConfig(config); err != nil {
		return err
	}

	// 如果密钥为空，保留原密钥
	if config.Secret == "" {
		existing, err := s.repo.GetWebhookConfig(ctx)
		if err == nil && existing != nil {
			config.Secret = existing.Secret
		}
	}

	return s.repo.SaveWebhookConfig(ctx, config)
}

// TestWebhookConnection 测试Webhook连接
func (s *service) TestWebhookConnection(ctx context.Context, config *WebhookConfig) error {
	if !config.Enabled {
		return errors.New("Webhook is disabled")
	}

	// 验证配置
	if err := s.validateWebhookConfig(config); err != nil {
		return err
	}

	// 发送测试请求
	client := &http.Client{Timeout: 10 * time.Second}
	var req *http.Request
	var err error

	if config.Method == "GET" {
		req, err = http.NewRequestWithContext(ctx, "GET", config.URL, nil)
	} else {
		req, err = http.NewRequestWithContext(ctx, "POST", config.URL, strings.NewReader(`{"test": true}`))
		if err == nil {
			req.Header.Set("Content-Type", "application/json")
		}
	}

	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("webhook returned error status: %d", resp.StatusCode)
	}

	return nil
}

// GetDingTalkConfig 获取钉钉配置
func (s *service) GetDingTalkConfig(ctx context.Context) (*DingTalkConfig, error) {
	return s.repo.GetDingTalkConfig(ctx)
}

// SaveDingTalkConfig 保存钉钉配置
func (s *service) SaveDingTalkConfig(ctx context.Context, config *DingTalkConfig) error {
	// 验证配置
	if err := s.validateDingTalkConfig(config); err != nil {
		return err
	}

	// 如果密钥为空，保留原密钥
	if config.Secret == "" {
		existing, err := s.repo.GetDingTalkConfig(ctx)
		if err == nil && existing != nil {
			config.Secret = existing.Secret
		}
	}

	return s.repo.SaveDingTalkConfig(ctx, config)
}

// TestDingTalkConnection 测试钉钉连接
func (s *service) TestDingTalkConnection(ctx context.Context, config *DingTalkConfig) error {
	if !config.Enabled {
		return errors.New("DingTalk is disabled")
	}

	// 验证配置
	if err := s.validateDingTalkConfig(config); err != nil {
		return err
	}

	// 发送测试消息
	client := &http.Client{Timeout: 10 * time.Second}
	testMessage := `{"msgtype": "text", "text": {"content": "EasySSH 钉钉通知测试"}}`

	req, err := http.NewRequestWithContext(ctx, "POST", config.WebhookURL, strings.NewReader(testMessage))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("dingtalk returned error status: %d", resp.StatusCode)
	}

	return nil
}

// GetWeComConfig 获取企业微信配置
func (s *service) GetWeComConfig(ctx context.Context) (*WeComConfig, error) {
	return s.repo.GetWeComConfig(ctx)
}

// SaveWeComConfig 保存企业微信配置
func (s *service) SaveWeComConfig(ctx context.Context, config *WeComConfig) error {
	// 验证配置
	if err := s.validateWeComConfig(config); err != nil {
		return err
	}

	return s.repo.SaveWeComConfig(ctx, config)
}

// TestWeComConnection 测试企业微信连接
func (s *service) TestWeComConnection(ctx context.Context, config *WeComConfig) error {
	if !config.Enabled {
		return errors.New("WeCom is disabled")
	}

	// 验证配置
	if err := s.validateWeComConfig(config); err != nil {
		return err
	}

	// 发送测试消息
	client := &http.Client{Timeout: 10 * time.Second}
	testMessage := `{"msgtype": "text", "text": {"content": "EasySSH 企业微信通知测试"}}`

	req, err := http.NewRequestWithContext(ctx, "POST", config.WebhookURL, strings.NewReader(testMessage))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("wecom returned error status: %d", resp.StatusCode)
	}

	return nil
}

// validateSMTPConfig 验证SMTP配置
func (s *service) validateSMTPConfig(config *SMTPConfig) error {
	if !config.Enabled {
		return nil
	}

	if config.Host == "" {
		return errors.New("SMTP host is required")
	}
	if config.Port < 1 || config.Port > 65535 {
		return errors.New("SMTP port must be between 1 and 65535")
	}
	if config.Username == "" {
		return errors.New("SMTP username is required")
	}
	if config.FromEmail == "" {
		return errors.New("from email is required")
	}
	if config.FromName == "" {
		return errors.New("from name is required")
	}

	// 验证邮箱格式
	if !strings.Contains(config.FromEmail, "@") {
		return errors.New("invalid email format")
	}

	return nil
}

// validateWebhookConfig 验证Webhook配置
func (s *service) validateWebhookConfig(config *WebhookConfig) error {
	if !config.Enabled {
		return nil
	}

	if config.URL == "" {
		return errors.New("webhook URL is required")
	}

	// 验证URL格式
	if _, err := url.Parse(config.URL); err != nil {
		return fmt.Errorf("invalid webhook URL: %w", err)
	}

	// 验证HTTP方法
	if config.Method != "GET" && config.Method != "POST" {
		return errors.New("webhook method must be GET or POST")
	}

	return nil
}

// validateDingTalkConfig 验证钉钉配置
func (s *service) validateDingTalkConfig(config *DingTalkConfig) error {
	if !config.Enabled {
		return nil
	}

	if config.WebhookURL == "" {
		return errors.New("dingtalk webhook URL is required")
	}

	// 验证URL格式
	if _, err := url.Parse(config.WebhookURL); err != nil {
		return fmt.Errorf("invalid dingtalk webhook URL: %w", err)
	}

	return nil
}

// validateWeComConfig 验证企业微信配置
func (s *service) validateWeComConfig(config *WeComConfig) error {
	if !config.Enabled {
		return nil
	}

	if config.WebhookURL == "" {
		return errors.New("wecom webhook URL is required")
	}

	// 验证URL格式
	if _, err := url.Parse(config.WebhookURL); err != nil {
		return fmt.Errorf("invalid wecom webhook URL: %w", err)
	}

	return nil
}

// GetAllConfig 获取所有通知配置
func (s *service) GetAllConfig(ctx context.Context) (*AllNotificationConfig, error) {
	// 分别获取各个配置，复用现有的逻辑
	smtp, err := s.GetSMTPConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get SMTP config: %w", err)
	}

	webhook, err := s.GetWebhookConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get Webhook config: %w", err)
	}

	dingtalk, err := s.GetDingTalkConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get DingTalk config: %w", err)
	}

	wecom, err := s.GetWeComConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get WeCom config: %w", err)
	}

	return &AllNotificationConfig{
		SMTP:     smtp,
		Webhook:  webhook,
		DingTalk: dingtalk,
		WeCom:    wecom,
	}, nil
}

// SaveAllConfig 保存所有通知配置
func (s *service) SaveAllConfig(ctx context.Context, config *AllNotificationConfig) error {
	// 分别保存各个配置，复用现有的验证和密码保留逻辑
	if config.SMTP != nil {
		if err := s.SaveSMTPConfig(ctx, config.SMTP); err != nil {
			return fmt.Errorf("failed to save SMTP config: %w", err)
		}
	}

	if config.Webhook != nil {
		if err := s.SaveWebhookConfig(ctx, config.Webhook); err != nil {
			return fmt.Errorf("failed to save Webhook config: %w", err)
		}
	}

	if config.DingTalk != nil {
		if err := s.SaveDingTalkConfig(ctx, config.DingTalk); err != nil {
			return fmt.Errorf("failed to save DingTalk config: %w", err)
		}
	}

	if config.WeCom != nil {
		if err := s.SaveWeComConfig(ctx, config.WeCom); err != nil {
			return fmt.Errorf("failed to save WeCom config: %w", err)
		}
	}

	return nil
}
