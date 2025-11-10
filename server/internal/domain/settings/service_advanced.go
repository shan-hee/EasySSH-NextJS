package settings

import (
	"context"
	"fmt"
	"strconv"
	"strings"
)

// GetDatabasePoolConfig 获取数据库连接池配置
func (s *service) GetDatabasePoolConfig(ctx context.Context) (*DatabasePoolConfig, error) {
	config := &DatabasePoolConfig{
		MaxIdleConns:    10,  // 默认值
		MaxOpenConns:    100,
		ConnMaxLifetime: 60,
		ConnMaxIdleTime: 10,
	}

	// 从数据库读取配置
	if setting, err := s.repo.GetByKey(ctx, KeyDBMaxIdleConns); err == nil && setting != nil && setting.Value != "" {
		if v, err := strconv.Atoi(setting.Value); err == nil {
			config.MaxIdleConns = v
		}
	}

	if setting, err := s.repo.GetByKey(ctx, KeyDBMaxOpenConns); err == nil && setting != nil && setting.Value != "" {
		if v, err := strconv.Atoi(setting.Value); err == nil {
			config.MaxOpenConns = v
		}
	}

	if setting, err := s.repo.GetByKey(ctx, KeyDBConnMaxLifetime); err == nil && setting != nil && setting.Value != "" {
		if v, err := strconv.Atoi(setting.Value); err == nil {
			config.ConnMaxLifetime = v
		}
	}

	if setting, err := s.repo.GetByKey(ctx, KeyDBConnMaxIdleTime); err == nil && setting != nil && setting.Value != "" {
		if v, err := strconv.Atoi(setting.Value); err == nil {
			config.ConnMaxIdleTime = v
		}
	}

	return config, nil
}

// SaveDatabasePoolConfig 保存数据库连接池配置
func (s *service) SaveDatabasePoolConfig(ctx context.Context, config *DatabasePoolConfig) error {
	// 验证配置
	if config.MaxIdleConns < 1 || config.MaxIdleConns > 100 {
		return fmt.Errorf("max idle connections must be between 1 and 100")
	}
	if config.MaxOpenConns < 1 || config.MaxOpenConns > 1000 {
		return fmt.Errorf("max open connections must be between 1 and 1000")
	}
	if config.MaxIdleConns > config.MaxOpenConns {
		return fmt.Errorf("max idle connections cannot exceed max open connections")
	}
	if config.ConnMaxLifetime < 1 || config.ConnMaxLifetime > 1440 {
		return fmt.Errorf("connection max lifetime must be between 1 and 1440 minutes")
	}
	if config.ConnMaxIdleTime < 1 || config.ConnMaxIdleTime > 60 {
		return fmt.Errorf("connection max idle time must be between 1 and 60 minutes")
	}

	// 保存到数据库
	settings := []struct {
		key   string
		value string
	}{
		{KeyDBMaxIdleConns, strconv.Itoa(config.MaxIdleConns)},
		{KeyDBMaxOpenConns, strconv.Itoa(config.MaxOpenConns)},
		{KeyDBConnMaxLifetime, strconv.Itoa(config.ConnMaxLifetime)},
		{KeyDBConnMaxIdleTime, strconv.Itoa(config.ConnMaxIdleTime)},
	}

	for _, setting := range settings {
		if err := s.repo.Set(ctx, setting.key, setting.value, "database", false); err != nil {
			return err
		}
	}

	// 清除缓存
	if s.configManager != nil {
		s.configManager.InvalidateCache("database_pool_config")
	}

	return nil
}

// GetJWTConfig 获取 JWT 配置
func (s *service) GetJWTConfig(ctx context.Context) (*JWTConfig, error) {
	config := &JWTConfig{
		AccessExpire:  1,   // 默认 1 小时
		RefreshExpire: 168, // 默认 7 天
	}

	if setting, err := s.repo.GetByKey(ctx, KeyJWTAccessExpire); err == nil && setting != nil && setting.Value != "" {
		if v, err := strconv.Atoi(setting.Value); err == nil {
			config.AccessExpire = v
		}
	}

	if setting, err := s.repo.GetByKey(ctx, KeyJWTRefreshExpire); err == nil && setting != nil && setting.Value != "" {
		if v, err := strconv.Atoi(setting.Value); err == nil {
			config.RefreshExpire = v
		}
	}

	return config, nil
}

// SaveJWTConfig 保存 JWT 配置
func (s *service) SaveJWTConfig(ctx context.Context, config *JWTConfig) error {
	// 验证配置
	if config.AccessExpire < 1 || config.AccessExpire > 24 {
		return fmt.Errorf("access token expiration must be between 1 and 24 hours")
	}
	if config.RefreshExpire < 24 || config.RefreshExpire > 720 {
		return fmt.Errorf("refresh token expiration must be between 24 and 720 hours")
	}
	if config.RefreshExpire <= config.AccessExpire {
		return fmt.Errorf("refresh token expiration must be greater than access token")
	}

	// 保存到数据库
	if err := s.repo.Set(ctx, KeyJWTAccessExpire, strconv.Itoa(config.AccessExpire), "jwt", false); err != nil {
		return err
	}
	if err := s.repo.Set(ctx, KeyJWTRefreshExpire, strconv.Itoa(config.RefreshExpire), "jwt", false); err != nil {
		return err
	}

	// 清除缓存
	if s.configManager != nil {
		s.configManager.InvalidateCache("jwt_config")
	}

	return nil
}

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
