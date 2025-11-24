package notificationconfig

import (
	"context"
	"encoding/json"
	"errors"

	"gorm.io/gorm"
)

// Repository 通知配置仓库接口
type Repository interface {
	// Get 获取通知配置（单例模式）
	Get(ctx context.Context) (*NotificationConfig, error)

	// Save 保存通知配置
	Save(ctx context.Context, config *NotificationConfig) error

	// GetSMTPConfig 获取SMTP配置
	GetSMTPConfig(ctx context.Context) (*SMTPConfig, error)

	// SaveSMTPConfig 保存SMTP配置
	SaveSMTPConfig(ctx context.Context, config *SMTPConfig) error

	// GetWebhookConfig 获取Webhook配置
	GetWebhookConfig(ctx context.Context) (*WebhookConfig, error)

	// SaveWebhookConfig 保存Webhook配置
	SaveWebhookConfig(ctx context.Context, config *WebhookConfig) error

	// GetDingTalkConfig 获取钉钉配置
	GetDingTalkConfig(ctx context.Context) (*DingTalkConfig, error)

	// SaveDingTalkConfig 保存钉钉配置
	SaveDingTalkConfig(ctx context.Context, config *DingTalkConfig) error

	// GetWeComConfig 获取企业微信配置
	GetWeComConfig(ctx context.Context) (*WeComConfig, error)

	// SaveWeComConfig 保存企业微信配置
	SaveWeComConfig(ctx context.Context, config *WeComConfig) error
}

type repository struct {
	db *gorm.DB
}

// NewRepository 创建通知配置仓库
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// Get 获取通知配置
func (r *repository) Get(ctx context.Context) (*NotificationConfig, error) {
	var config NotificationConfig

	// 查询第一条记录（单例模式）
	err := r.db.WithContext(ctx).First(&config).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// 如果不存在，创建默认配置（所有通知都禁用）
			// 初始化为有效的JSON对象，而不是空字符串
			defaultSMTP, _ := json.Marshal(&SMTPConfig{Enabled: false})
			defaultWebhook, _ := json.Marshal(&WebhookConfig{Enabled: false, Method: "POST"})
			defaultDingTalk, _ := json.Marshal(&DingTalkConfig{Enabled: false})
			defaultWeCom, _ := json.Marshal(&WeComConfig{Enabled: false})

			config = NotificationConfig{
				SMTPConfig:     string(defaultSMTP),
				WebhookConfig:  string(defaultWebhook),
				DingTalkConfig: string(defaultDingTalk),
				WeComConfig:    string(defaultWeCom),
			}

			// 创建默认配置
			if err := r.db.WithContext(ctx).Create(&config).Error; err != nil {
				return nil, err
			}
		} else {
			return nil, err
		}
	}

	return &config, nil
}

// Save 保存通知配置
func (r *repository) Save(ctx context.Context, config *NotificationConfig) error {
	// 查询是否存在配置
	var existing NotificationConfig
	err := r.db.WithContext(ctx).First(&existing).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		// 不存在则创建
		return r.db.WithContext(ctx).Create(config).Error
	} else if err != nil {
		return err
	}

	// 存在则更新（保留ID）
	config.ID = existing.ID
	return r.db.WithContext(ctx).Save(config).Error
}

// GetSMTPConfig 获取SMTP配置
func (r *repository) GetSMTPConfig(ctx context.Context) (*SMTPConfig, error) {
	config, err := r.Get(ctx)
	if err != nil {
		return nil, err
	}

	if config.SMTPConfig == "" {
		return &SMTPConfig{Enabled: false}, nil
	}

	var smtp SMTPConfig
	if err := json.Unmarshal([]byte(config.SMTPConfig), &smtp); err != nil {
		return &SMTPConfig{Enabled: false}, nil
	}

	return &smtp, nil
}

// SaveSMTPConfig 保存SMTP配置
func (r *repository) SaveSMTPConfig(ctx context.Context, smtpConfig *SMTPConfig) error {
	config, err := r.Get(ctx)
	if err != nil {
		return err
	}

	// 序列化SMTP配置
	data, err := json.Marshal(smtpConfig)
	if err != nil {
		return err
	}

	config.SMTPConfig = string(data)
	return r.Save(ctx, config)
}

// GetWebhookConfig 获取Webhook配置
func (r *repository) GetWebhookConfig(ctx context.Context) (*WebhookConfig, error) {
	config, err := r.Get(ctx)
	if err != nil {
		return nil, err
	}

	if config.WebhookConfig == "" {
		return &WebhookConfig{Enabled: false, Method: "POST"}, nil
	}

	var webhook WebhookConfig
	if err := json.Unmarshal([]byte(config.WebhookConfig), &webhook); err != nil {
		return &WebhookConfig{Enabled: false, Method: "POST"}, nil
	}

	return &webhook, nil
}

// SaveWebhookConfig 保存Webhook配置
func (r *repository) SaveWebhookConfig(ctx context.Context, webhookConfig *WebhookConfig) error {
	config, err := r.Get(ctx)
	if err != nil {
		return err
	}

	// 序列化Webhook配置
	data, err := json.Marshal(webhookConfig)
	if err != nil {
		return err
	}

	config.WebhookConfig = string(data)
	return r.Save(ctx, config)
}

// GetDingTalkConfig 获取钉钉配置
func (r *repository) GetDingTalkConfig(ctx context.Context) (*DingTalkConfig, error) {
	config, err := r.Get(ctx)
	if err != nil {
		return nil, err
	}

	if config.DingTalkConfig == "" {
		return &DingTalkConfig{Enabled: false}, nil
	}

	var dingtalk DingTalkConfig
	if err := json.Unmarshal([]byte(config.DingTalkConfig), &dingtalk); err != nil {
		return &DingTalkConfig{Enabled: false}, nil
	}

	return &dingtalk, nil
}

// SaveDingTalkConfig 保存钉钉配置
func (r *repository) SaveDingTalkConfig(ctx context.Context, dingtalkConfig *DingTalkConfig) error {
	config, err := r.Get(ctx)
	if err != nil {
		return err
	}

	// 序列化钉钉配置
	data, err := json.Marshal(dingtalkConfig)
	if err != nil {
		return err
	}

	config.DingTalkConfig = string(data)
	return r.Save(ctx, config)
}

// GetWeComConfig 获取企业微信配置
func (r *repository) GetWeComConfig(ctx context.Context) (*WeComConfig, error) {
	config, err := r.Get(ctx)
	if err != nil {
		return nil, err
	}

	if config.WeComConfig == "" {
		return &WeComConfig{Enabled: false}, nil
	}

	var wecom WeComConfig
	if err := json.Unmarshal([]byte(config.WeComConfig), &wecom); err != nil {
		return &WeComConfig{Enabled: false}, nil
	}

	return &wecom, nil
}

// SaveWeComConfig 保存企业微信配置
func (r *repository) SaveWeComConfig(ctx context.Context, wecomConfig *WeComConfig) error {
	config, err := r.Get(ctx)
	if err != nil {
		return err
	}

	// 序列化企业微信配置
	data, err := json.Marshal(wecomConfig)
	if err != nil {
		return err
	}

	config.WeComConfig = string(data)
	return r.Save(ctx, config)
}
