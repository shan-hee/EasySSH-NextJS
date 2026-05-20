package security

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"regexp"
	"strings"
)

// Service 安全配置服务接口
type Service interface {
	// Get 获取安全配置
	Get(ctx context.Context) (*SecurityConfig, error)

	// Save 保存安全配置
	Save(ctx context.Context, config *SecurityConfig) error

	// GetCORSConfig 获取CORS配置
	GetCORSConfig(ctx context.Context) (*CORSConfig, error)

	// GetCookieConfig 获取Cookie配置
	GetCookieConfig(ctx context.Context) (*CookieConfig, error)

	// GetAllConfigs 一次性获取所有配置（CORS + Cookie）
	GetAllConfigs(ctx context.Context) (*CORSConfig, *CookieConfig, error)

	// GetRateLimitConfig 获取速率限制配置
	GetRateLimitConfig(ctx context.Context) (*RateLimitConfig, error)

	// GetAccountLockConfig 获取账户锁定配置
	GetAccountLockConfig(ctx context.Context) (*AccountLockConfig, error)

	// CheckIPAllowed 检查IP是否允许访问
	CheckIPAllowed(ctx context.Context, ip string) (bool, error)

	// CheckIPAllowedWithConfig 使用已有配置检查IP是否允许访问(避免重复查询)
	CheckIPAllowedWithConfig(config *SecurityConfig, ip string) bool
}

type service struct {
	repo Repository
}

func applySecurityConfigDefaults(config *SecurityConfig) {
	if config == nil {
		return
	}

	if config.SessionTimeout <= 0 {
		config.SessionTimeout = 30
	}
	if config.MaxTabs <= 0 {
		config.MaxTabs = 10
	}
	if config.InactiveMinutes <= 0 {
		config.InactiveMinutes = 15
	}
	if config.LoginLimit <= 0 {
		config.LoginLimit = 5
	}
	if config.APILimit <= 0 {
		config.APILimit = 100
	}
	if config.TwoFALimit <= 0 {
		config.TwoFALimit = 5
	}
	if config.MaxIPFailAttempts <= 0 {
		config.MaxIPFailAttempts = 10
	}
	if config.IPLockDurationMinutes <= 0 {
		config.IPLockDurationMinutes = 30
	}
	if config.MaxAccountFailAttempts <= 0 {
		config.MaxAccountFailAttempts = 5
	}
	if config.AccountLockDurationMinutes <= 0 {
		config.AccountLockDurationMinutes = 60
	}
}

// NewService 创建安全配置服务
func NewService(repo Repository) Service {
	return &service{repo: repo}
}

// Get 获取安全配置
func (s *service) Get(ctx context.Context) (*SecurityConfig, error) {
	config, err := s.repo.Get(ctx)
	if err != nil {
		return nil, err
	}
	applySecurityConfigDefaults(config)
	return config, nil
}

// Save 保存安全配置
func (s *service) Save(ctx context.Context, config *SecurityConfig) error {
	// 验证配置
	if err := s.validate(config); err != nil {
		return err
	}

	return s.repo.Save(ctx, config)
}

// GetCORSConfig 获取CORS配置
func (s *service) GetCORSConfig(ctx context.Context) (*CORSConfig, error) {
	return s.repo.GetCORSConfig(ctx)
}

// GetCookieConfig 获取Cookie配置
func (s *service) GetCookieConfig(ctx context.Context) (*CookieConfig, error) {
	return s.repo.GetCookieConfig(ctx)
}

// GetAllConfigs 一次性获取所有配置（CORS + Cookie）
func (s *service) GetAllConfigs(ctx context.Context) (*CORSConfig, *CookieConfig, error) {
	return s.repo.GetAllConfigs(ctx)
}

// GetRateLimitConfig 获取速率限制配置
func (s *service) GetRateLimitConfig(ctx context.Context) (*RateLimitConfig, error) {
	config, err := s.Get(ctx)
	if err != nil {
		return nil, err
	}

	twoFALimit := config.TwoFALimit
	if twoFALimit <= 0 {
		twoFALimit = 5 // 默认值
	}

	return &RateLimitConfig{
		LoginLimit: config.LoginLimit,
		APILimit:   config.APILimit,
		TwoFALimit: twoFALimit,
	}, nil
}

// GetAccountLockConfig 获取账户锁定配置
func (s *service) GetAccountLockConfig(ctx context.Context) (*AccountLockConfig, error) {
	config, err := s.Get(ctx)
	if err != nil {
		return DefaultAccountLockConfig(), err
	}

	return &AccountLockConfig{
		Enabled:                    config.AccountLockEnabled,
		MaxIPFailAttempts:          config.MaxIPFailAttempts,
		IPLockDurationMinutes:      config.IPLockDurationMinutes,
		MaxAccountFailAttempts:     config.MaxAccountFailAttempts,
		AccountLockDurationMinutes: config.AccountLockDurationMinutes,
	}, nil
}

// CheckIPAllowed 检查IP是否允许访问
func (s *service) CheckIPAllowed(ctx context.Context, ip string) (bool, error) {
	config, err := s.Get(ctx)
	if err != nil {
		return false, err
	}

	return s.CheckIPAllowedWithConfig(config, ip), nil
}

// CheckIPAllowedWithConfig 使用已有配置检查IP是否允许访问(避免重复查询)
func (s *service) CheckIPAllowedWithConfig(config *SecurityConfig, ip string) bool {
	// 1. 先检查黑名单（优先级最高）
	if config.BlocklistIPs != "" {
		blocklist := strings.Split(config.BlocklistIPs, "\n")
		for _, blocked := range blocklist {
			blocked = strings.TrimSpace(blocked)
			if blocked == "" {
				continue
			}
			if s.matchIP(ip, blocked) {
				return false
			}
		}
	}

	// 2. 检查白名单
	if config.AllowlistIPs != "" {
		allowlist := strings.Split(config.AllowlistIPs, "\n")
		for _, allowed := range allowlist {
			allowed = strings.TrimSpace(allowed)
			if allowed == "" {
				continue
			}
			if s.matchIP(ip, allowed) {
				return true
			}
		}
		// 如果配置了白名单但不在列表中，则拒绝
		return false
	}

	// 3. 如果没有配置任何白名单，则允许所有IP
	return true
}

// matchIP 检查IP是否匹配规则（支持单个IP和CIDR）
func (s *service) matchIP(ip, rule string) bool {
	// 尝试解析为CIDR
	if strings.Contains(rule, "/") {
		_, ipNet, err := net.ParseCIDR(rule)
		if err != nil {
			return false
		}
		testIP := net.ParseIP(ip)
		if testIP == nil {
			return false
		}
		return ipNet.Contains(testIP)
	}

	// 单个IP地址匹配
	return ip == rule
}

// validate 验证安全配置
func (s *service) validate(config *SecurityConfig) error {
	// 验证会话超时
	if config.SessionTimeout < 5 || config.SessionTimeout > 1440 {
		return errors.New("session timeout must be between 5 and 1440 minutes")
	}

	// 验证最大标签页数
	if config.MaxTabs < 1 || config.MaxTabs > 200 {
		return errors.New("max tabs must be between 1 and 200")
	}

	// 验证非活动断开时间
	if config.InactiveMinutes < 5 || config.InactiveMinutes > 1440 {
		return errors.New("inactive minutes must be between 5 and 1440")
	}

	// 验证速率限制
	if config.LoginLimit < 1 || config.LoginLimit > 100 {
		return errors.New("login limit must be between 1 and 100")
	}
	if config.APILimit < 10 || config.APILimit > 10000 {
		return errors.New("api limit must be between 10 and 10000")
	}
	if config.TwoFALimit < 1 || config.TwoFALimit > 20 {
		return errors.New("2FA limit must be between 1 and 20")
	}

	// 验证CORS配置
	if config.CORSConfig != "" {
		var cors CORSConfig
		if err := json.Unmarshal([]byte(config.CORSConfig), &cors); err != nil {
			return fmt.Errorf("invalid CORS config: %w", err)
		}

		if len(cors.AllowedOrigins) == 0 {
			return errors.New("at least one allowed origin is required")
		}
		if len(cors.AllowedMethods) == 0 {
			return errors.New("at least one allowed method is required")
		}
		if len(cors.AllowedHeaders) == 0 {
			return errors.New("at least one allowed header is required")
		}
	}

	// 验证IP白名单格式
	if config.AllowlistIPs != "" {
		ips := strings.Split(config.AllowlistIPs, "\n")
		for _, ip := range ips {
			ip = strings.TrimSpace(ip)
			if ip == "" {
				continue
			}
			if err := s.validateIPAddress(ip); err != nil {
				return fmt.Errorf("invalid allowlist IP: %s - %w", ip, err)
			}
		}
	}

	// 验证IP黑名单格式
	if config.BlocklistIPs != "" {
		ips := strings.Split(config.BlocklistIPs, "\n")
		for _, ip := range ips {
			ip = strings.TrimSpace(ip)
			if ip == "" {
				continue
			}
			if err := s.validateIPAddress(ip); err != nil {
				return fmt.Errorf("invalid blocklist IP: %s - %w", ip, err)
			}
		}
	}

	return nil
}

// validateIPAddress 验证IP地址格式（支持IPv4、IPv6和CIDR）
func (s *service) validateIPAddress(ip string) error {
	// CIDR格式
	if strings.Contains(ip, "/") {
		_, _, err := net.ParseCIDR(ip)
		if err != nil {
			return fmt.Errorf("invalid CIDR format: %w", err)
		}
		return nil
	}

	// 单个IP地址
	if net.ParseIP(ip) == nil {
		return errors.New("invalid IP address format")
	}

	return nil
}

// validateIPAddressWithRegex 使用正则表达式验证IP地址（备用方法）
func (s *service) validateIPAddressWithRegex(ip string) error {
	// IPv4 或 CIDR 正则
	ipv4Pattern := `^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$`
	// IPv6 或 CIDR 正则（简化版）
	ipv6Pattern := `^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(\/\d{1,3})?$`

	ipv4Regex := regexp.MustCompile(ipv4Pattern)
	ipv6Regex := regexp.MustCompile(ipv6Pattern)

	if !ipv4Regex.MatchString(ip) && !ipv6Regex.MatchString(ip) {
		return errors.New("invalid IP address or CIDR format")
	}

	return nil
}
