package settings

import (
	"context"
	"fmt"
	"strconv"
	"strings"
)

// GetCORSConfig 获取 CORS 配置
func (s *service) GetCORSConfig(ctx context.Context) (*CORSConfig, error) {
	config := &CORSConfig{
		AllowedOrigins: []string{"http://localhost:3000"},
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Content-Type", "Authorization"},
	}

	if setting, err := s.repo.GetByKey(ctx, KeyCORSAllowedOrigins); err == nil && setting != nil && setting.Value != "" {
		origins := strings.Split(setting.Value, ",")
		// 清理空格
		for i, origin := range origins {
			origins[i] = strings.TrimSpace(origin)
		}
		config.AllowedOrigins = origins
	}

	if setting, err := s.repo.GetByKey(ctx, KeyCORSAllowedMethods); err == nil && setting != nil && setting.Value != "" {
		methods := strings.Split(setting.Value, ",")
		for i, method := range methods {
			methods[i] = strings.TrimSpace(method)
		}
		config.AllowedMethods = methods
	}

	if setting, err := s.repo.GetByKey(ctx, KeyCORSAllowedHeaders); err == nil && setting != nil && setting.Value != "" {
		headers := strings.Split(setting.Value, ",")
		for i, header := range headers {
			headers[i] = strings.TrimSpace(header)
		}
		config.AllowedHeaders = headers
	}

	return config, nil
}

// SaveCORSConfig 保存 CORS 配置
func (s *service) SaveCORSConfig(ctx context.Context, config *CORSConfig) error {
	// 验证配置
	if len(config.AllowedOrigins) == 0 {
		return fmt.Errorf("at least one allowed origin is required")
	}

	// 保存到数据库
	if err := s.repo.Set(ctx, KeyCORSAllowedOrigins, strings.Join(config.AllowedOrigins, ","), "cors", false); err != nil {
		return err
	}
	if err := s.repo.Set(ctx, KeyCORSAllowedMethods, strings.Join(config.AllowedMethods, ","), "cors", false); err != nil {
		return err
	}
	if err := s.repo.Set(ctx, KeyCORSAllowedHeaders, strings.Join(config.AllowedHeaders, ","), "cors", false); err != nil {
		return err
	}

	// 清除缓存
	if s.configManager != nil {
		s.configManager.InvalidateCache("cors_config")
	}

	return nil
}

// GetRateLimitConfig 获取速率限制配置
func (s *service) GetRateLimitConfig(ctx context.Context) (*RateLimitConfig, error) {
	config := &RateLimitConfig{
		LoginLimit: 5,   // 默认 5 次/分钟
		APILimit:   100, // 默认 100 次/分钟
	}

	if setting, err := s.repo.GetByKey(ctx, KeyRateLimitLogin); err == nil && setting != nil && setting.Value != "" {
		if v, err := strconv.Atoi(setting.Value); err == nil {
			config.LoginLimit = v
		}
	}

	if setting, err := s.repo.GetByKey(ctx, KeyRateLimitAPI); err == nil && setting != nil && setting.Value != "" {
		if v, err := strconv.Atoi(setting.Value); err == nil {
			config.APILimit = v
		}
	}

	return config, nil
}

// SaveRateLimitConfig 保存速率限制配置
func (s *service) SaveRateLimitConfig(ctx context.Context, config *RateLimitConfig) error {
	// 验证配置
	if config.LoginLimit < 1 || config.LoginLimit > 100 {
		return fmt.Errorf("login rate limit must be between 1 and 100")
	}
	if config.APILimit < 10 || config.APILimit > 10000 {
		return fmt.Errorf("API rate limit must be between 10 and 10000")
	}

	// 保存到数据库
	if err := s.repo.Set(ctx, KeyRateLimitLogin, strconv.Itoa(config.LoginLimit), "ratelimit", false); err != nil {
		return err
	}
	if err := s.repo.Set(ctx, KeyRateLimitAPI, strconv.Itoa(config.APILimit), "ratelimit", false); err != nil {
		return err
	}

	// 清除缓存
	if s.configManager != nil {
		s.configManager.InvalidateCache("rate_limit_config")
	}

	return nil
}

// GetCookieConfig 获取 Cookie 配置
func (s *service) GetCookieConfig(ctx context.Context) (*CookieConfig, error) {
	config := &CookieConfig{
		Secure: true, // 默认启用
		Domain: "",   // 默认为空
	}

	if setting, err := s.repo.GetByKey(ctx, KeyCookieSecure); err == nil && setting != nil && setting.Value != "" {
		config.Secure = setting.Value == "true"
	}

	if setting, err := s.repo.GetByKey(ctx, KeyCookieDomain); err == nil && setting != nil {
		config.Domain = setting.Value
	}

	return config, nil
}

// SaveCookieConfig 保存 Cookie 配置
func (s *service) SaveCookieConfig(ctx context.Context, config *CookieConfig) error {
	// 保存到数据库
	secureStr := "false"
	if config.Secure {
		secureStr = "true"
	}

	if err := s.repo.Set(ctx, KeyCookieSecure, secureStr, "cookie", false); err != nil {
		return err
	}
	if err := s.repo.Set(ctx, KeyCookieDomain, config.Domain, "cookie", false); err != nil {
		return err
	}

	// 清除缓存
	if s.configManager != nil {
		s.configManager.InvalidateCache("cookie_config")
	}

	return nil
}
