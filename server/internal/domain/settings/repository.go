package settings

import (
	"context"
	"fmt"

	"gorm.io/gorm"
)

// Repository 系统设置仓储接口
type Repository interface {
	// 基本 CRUD
	GetByKey(ctx context.Context, key string) (*Settings, error)
	GetByCategory(ctx context.Context, category string) ([]*Settings, error)
	GetAll(ctx context.Context) ([]*Settings, error)
	GetPublicSettings(ctx context.Context) ([]*Settings, error)
	Set(ctx context.Context, key, value, category string, isPublic bool) error
	Delete(ctx context.Context, key string) error

	// SMTP 配置专用方法
	GetSMTPConfig(ctx context.Context) (*SMTPConfig, error)
	SaveSMTPConfig(ctx context.Context, config *SMTPConfig) error

	// Webhook 配置专用方法
	GetWebhookConfig(ctx context.Context) (*WebhookConfig, error)
	SaveWebhookConfig(ctx context.Context, config *WebhookConfig) error

	// 钉钉配置专用方法
	GetDingTalkConfig(ctx context.Context) (*DingTalkConfig, error)
	SaveDingTalkConfig(ctx context.Context, config *DingTalkConfig) error

	// 企业微信配置专用方法
	GetWeComConfig(ctx context.Context) (*WeComConfig, error)
	SaveWeComConfig(ctx context.Context, config *WeComConfig) error

	// 系统通用配置专用方法
	GetSystemConfig(ctx context.Context) (*SystemConfig, error)
	SaveSystemConfig(ctx context.Context, config *SystemConfig) error
}

type repository struct {
	db *gorm.DB
}

// NewRepository 创建设置仓储
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// GetByKey 根据键获取设置
func (r *repository) GetByKey(ctx context.Context, key string) (*Settings, error) {
	var setting Settings
	if err := r.db.WithContext(ctx).Where("key = ?", key).First(&setting).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get setting by key: %w", err)
	}
	return &setting, nil
}

// GetByCategory 根据分类获取设置
func (r *repository) GetByCategory(ctx context.Context, category string) ([]*Settings, error) {
	var settings []*Settings
	if err := r.db.WithContext(ctx).Where("category = ?", category).Find(&settings).Error; err != nil {
		return nil, fmt.Errorf("failed to get settings by category: %w", err)
	}
	return settings, nil
}

// GetAll 获取所有设置
func (r *repository) GetAll(ctx context.Context) ([]*Settings, error) {
	var settings []*Settings
	if err := r.db.WithContext(ctx).Find(&settings).Error; err != nil {
		return nil, fmt.Errorf("failed to get all settings: %w", err)
	}
	return settings, nil
}

// GetPublicSettings 获取所有公开设置
func (r *repository) GetPublicSettings(ctx context.Context) ([]*Settings, error) {
	var settings []*Settings
	if err := r.db.WithContext(ctx).Where("is_public = ?", true).Find(&settings).Error; err != nil {
		return nil, fmt.Errorf("failed to get public settings: %w", err)
	}
	return settings, nil
}

// Set 设置键值
func (r *repository) Set(ctx context.Context, key, value, category string, isPublic bool) error {
	setting := &Settings{
		Key:      key,
		Value:    value,
		Category: category,
		IsPublic: isPublic,
	}

	// 使用 GORM 的 Save 方法，如果存在则更新，不存在则创建
	if err := r.db.WithContext(ctx).
		Where("key = ?", key).
		Assign(map[string]interface{}{
			"value":     value,
			"category":  category,
			"is_public": isPublic,
		}).
		FirstOrCreate(setting).Error; err != nil {
		return fmt.Errorf("failed to set setting: %w", err)
	}
	return nil
}

// Delete 删除设置
func (r *repository) Delete(ctx context.Context, key string) error {
	if err := r.db.WithContext(ctx).Where("key = ?", key).Delete(&Settings{}).Error; err != nil {
		return fmt.Errorf("failed to delete setting: %w", err)
	}
	return nil
}

// GetSMTPConfig 获取 SMTP 配置
func (r *repository) GetSMTPConfig(ctx context.Context) (*SMTPConfig, error) {
	// 获取所有邮件相关的设置
	settings, err := r.GetByCategory(ctx, "email")
	if err != nil {
		return nil, err
	}

	// 构建配置映射
	configMap := make(map[string]string)
	for _, setting := range settings {
		configMap[setting.Key] = setting.Value
	}

	// 解析配置
	config := &SMTPConfig{
		Enabled:   configMap[KeyEmailEnabled] == "true",
		Host:      configMap[KeySMTPHost],
		Port:      0,
		Username:  configMap[KeySMTPUsername],
		Password:  configMap[KeySMTPPassword],
		FromEmail: configMap[KeySMTPFromEmail],
		FromName:  configMap[KeySMTPFromName],
		UseTLS:    configMap[KeySMTPUseTLS] == "true",
	}

	// 解析端口
	if portStr, ok := configMap[KeySMTPPort]; ok && portStr != "" {
		var port int
		if _, err := fmt.Sscanf(portStr, "%d", &port); err == nil {
			config.Port = port
		}
	}

	return config, nil
}

// SaveSMTPConfig 保存 SMTP 配置
func (r *repository) SaveSMTPConfig(ctx context.Context, config *SMTPConfig) error {
	// 使用事务确保原子性
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		repo := &repository{db: tx}

		// 保存各个配置项
		settings := map[string]string{
			KeyEmailEnabled:  fmt.Sprintf("%t", config.Enabled),
			KeySMTPHost:      config.Host,
			KeySMTPPort:      fmt.Sprintf("%d", config.Port),
			KeySMTPUsername:  config.Username,
			KeySMTPPassword:  config.Password,
			KeySMTPFromEmail: config.FromEmail,
			KeySMTPFromName:  config.FromName,
			KeySMTPUseTLS:    fmt.Sprintf("%t", config.UseTLS),
		}

		for key, value := range settings {
			if err := repo.Set(ctx, key, value, "email", false); err != nil {
				return err
			}
		}

		return nil
	})
}

// GetWebhookConfig 获取 Webhook 配置
func (r *repository) GetWebhookConfig(ctx context.Context) (*WebhookConfig, error) {
	settings, err := r.GetByCategory(ctx, "webhook")
	if err != nil {
		return nil, err
	}

	configMap := make(map[string]string)
	for _, setting := range settings {
		configMap[setting.Key] = setting.Value
	}

	config := &WebhookConfig{
		Enabled: configMap[KeyWebhookEnabled] == "true",
		URL:     configMap[KeyWebhookURL],
		Secret:  configMap[KeyWebhookSecret],
		Method:  configMap[KeyWebhookMethod],
	}

	// 默认使用 POST 方法
	if config.Method == "" {
		config.Method = "POST"
	}

	return config, nil
}

// SaveWebhookConfig 保存 Webhook 配置
func (r *repository) SaveWebhookConfig(ctx context.Context, config *WebhookConfig) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		repo := &repository{db: tx}

		settings := map[string]string{
			KeyWebhookEnabled: fmt.Sprintf("%t", config.Enabled),
			KeyWebhookURL:     config.URL,
			KeyWebhookSecret:  config.Secret,
			KeyWebhookMethod:  config.Method,
		}

		for key, value := range settings {
			if err := repo.Set(ctx, key, value, "webhook", false); err != nil {
				return err
			}
		}

		return nil
	})
}

// GetDingTalkConfig 获取钉钉配置
func (r *repository) GetDingTalkConfig(ctx context.Context) (*DingTalkConfig, error) {
	settings, err := r.GetByCategory(ctx, "dingding")
	if err != nil {
		return nil, err
	}

	configMap := make(map[string]string)
	for _, setting := range settings {
		configMap[setting.Key] = setting.Value
	}

	config := &DingTalkConfig{
		Enabled:    configMap[KeyDingTalkEnabled] == "true",
		WebhookURL: configMap[KeyDingTalkWebhook],
		Secret:     configMap[KeyDingTalkSecret],
	}

	return config, nil
}

// SaveDingTalkConfig 保存钉钉配置
func (r *repository) SaveDingTalkConfig(ctx context.Context, config *DingTalkConfig) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		repo := &repository{db: tx}

		settings := map[string]string{
			KeyDingTalkEnabled: fmt.Sprintf("%t", config.Enabled),
			KeyDingTalkWebhook: config.WebhookURL,
			KeyDingTalkSecret:  config.Secret,
		}

		for key, value := range settings {
			if err := repo.Set(ctx, key, value, "dingding", false); err != nil {
				return err
			}
		}

		return nil
	})
}

// GetWeComConfig 获取企业微信配置
func (r *repository) GetWeComConfig(ctx context.Context) (*WeComConfig, error) {
	settings, err := r.GetByCategory(ctx, "wechat")
	if err != nil {
		return nil, err
	}

	configMap := make(map[string]string)
	for _, setting := range settings {
		configMap[setting.Key] = setting.Value
	}

	config := &WeComConfig{
		Enabled:    configMap[KeyWeComEnabled] == "true",
		WebhookURL: configMap[KeyWeComWebhook],
	}

	return config, nil
}

// SaveWeComConfig 保存企业微信配置
func (r *repository) SaveWeComConfig(ctx context.Context, config *WeComConfig) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		repo := &repository{db: tx}

		settings := map[string]string{
			KeyWeComEnabled: fmt.Sprintf("%t", config.Enabled),
			KeyWeComWebhook: config.WebhookURL,
		}

		for key, value := range settings {
			if err := repo.Set(ctx, key, value, "wechat", false); err != nil {
				return err
			}
		}

		return nil
	})
}

// GetSystemConfig 获取系统通用配置
func (r *repository) GetSystemConfig(ctx context.Context) (*SystemConfig, error) {
	// 获取所有系统相关的设置
	settings, err := r.GetByCategory(ctx, "system")
	if err != nil {
		return nil, err
	}

	// 构建配置映射
	configMap := make(map[string]string)
	for _, setting := range settings {
		configMap[setting.Key] = setting.Value
	}

	// 默认排除规则
	defaultExcludePatterns := `node_modules
.git
.svn
.hg
__pycache__
.pytest_cache
.next
.nuxt
dist
build
target
vendor
.DS_Store
thumbs.db`

	// 解析配置，设置默认值
	config := &SystemConfig{
		// 基本设置
		SystemName:    getOrDefault(configMap, KeySystemName, "EasySSH"),
		SystemLogo:    getOrDefault(configMap, KeySystemLogo, "/logo.svg"),
		SystemFavicon: getOrDefault(configMap, KeySystemFavicon, "/logo.svg"),

		// 国际化设置
		DefaultLanguage: getOrDefault(configMap, KeyDefaultLanguage, "zh-CN"),
		DefaultTimezone: getOrDefault(configMap, KeyDefaultTimezone, "Asia/Shanghai"),
		DateFormat:      getOrDefault(configMap, KeyDateFormat, "YYYY-MM-DD HH:mm:ss"),

		// 性能设置
		DefaultPageSize:   getIntOrDefault(configMap, KeyDefaultPageSize, 20),
		MaxFileUploadSize: getIntOrDefault(configMap, KeyMaxFileUploadSize, 100),

		// 文件传输设置
		DownloadExcludePatterns: getOrDefault(configMap, KeyDownloadExcludePatterns, defaultExcludePatterns),
		DefaultDownloadMode:     getOrDefault(configMap, KeyDefaultDownloadMode, "fast"),
		SkipExcludedOnUpload:    getBoolOrDefault(configMap, KeySkipExcludedOnUpload, true),
	}

	return config, nil
}

// SaveSystemConfig 保存系统通用配置
func (r *repository) SaveSystemConfig(ctx context.Context, config *SystemConfig) error {
	// 使用事务确保原子性
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		repo := &repository{db: tx}

		// 保存各个配置项
		settings := map[string]string{
			KeySystemName:      config.SystemName,
			KeySystemLogo:      config.SystemLogo,
			KeySystemFavicon:   config.SystemFavicon,
			KeyDefaultLanguage: config.DefaultLanguage,
			KeyDefaultTimezone: config.DefaultTimezone,
			KeyDateFormat:      config.DateFormat,
			KeyDefaultPageSize: fmt.Sprintf("%d", config.DefaultPageSize),
			KeyMaxFileUploadSize: fmt.Sprintf("%d", config.MaxFileUploadSize),
			KeyDownloadExcludePatterns: config.DownloadExcludePatterns,
			KeyDefaultDownloadMode:     config.DefaultDownloadMode,
			KeySkipExcludedOnUpload:    fmt.Sprintf("%t", config.SkipExcludedOnUpload),
		}

		for key, value := range settings {
			if err := repo.Set(ctx, key, value, "system", true); err != nil {
				return err
			}
		}

		return nil
	})
}

// 辅助函数
func getOrDefault(configMap map[string]string, key, defaultValue string) string {
	if value, ok := configMap[key]; ok && value != "" {
		return value
	}
	return defaultValue
}

func getBoolOrDefault(configMap map[string]string, key string, defaultValue bool) bool {
	if value, ok := configMap[key]; ok {
		return value == "true"
	}
	return defaultValue
}

func getIntOrDefault(configMap map[string]string, key string, defaultValue int) int {
	if value, ok := configMap[key]; ok && value != "" {
		var intValue int
		if _, err := fmt.Sscanf(value, "%d", &intValue); err == nil {
			return intValue
		}
	}
	return defaultValue
}
