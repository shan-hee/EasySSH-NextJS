package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config 应用配置
type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Redis    RedisConfig
	JWT      JWTConfig
}

// ServerConfig 服务器配置
type ServerConfig struct {
	Port          int
	Env           string // development, production
	EncryptionKey string // 加密密钥（16、24 或 32 字节用于 AES）
}

// DatabaseConfig 数据库配置
type DatabaseConfig struct {
	Host            string
	Port            int
	User            string
	Password        string
	DBName          string
	SSLMode         string
	Debug           bool // 是否开启SQL调试日志
	MaxIdleConns    int  // 最大空闲连接数
	MaxOpenConns    int  // 最大打开连接数
	ConnMaxLifetime int  // 连接最大生命周期（分钟）
	ConnMaxIdleTime int  // 连接最大空闲时间（分钟）
}

// RedisConfig Redis 配置
type RedisConfig struct {
	Host     string
	Port     int
	Password string
	DB       int
}

// JWTConfig JWT 配置
type JWTConfig struct {
	Secret        string
	AccessExpire  int // 访问令牌过期时间（小时）
	RefreshExpire int // 刷新令牌过期时间（小时）
}

// Load 从环境变量加载配置
func Load() (*Config, error) {
	config := &Config{
		Server: ServerConfig{
			Port:          getEnvInt("PORT", 8521),
			Env:           getEnv("ENV", "development"),
			EncryptionKey: getEnv("ENCRYPTION_KEY", "easyssh-encryption-key-32byte"), // 32 字节
		},
		Database: DatabaseConfig{
			Host:            getEnv("DB_HOST", "localhost"),
			Port:            getEnvInt("DB_PORT", 5432),
			User:            getEnv("DB_USER", "easyssh"),
			Password:        getEnv("DB_PASSWORD", "easyssh_dev_password"),
			DBName:          getEnv("DB_NAME", "easyssh"),
			SSLMode:         getEnv("DB_SSLMODE", "disable"),
			MaxIdleConns:    getEnvInt("DB_MAX_IDLE_CONNS", 10),
			MaxOpenConns:    getEnvInt("DB_MAX_OPEN_CONNS", 100),
			ConnMaxLifetime: getEnvInt("DB_CONN_MAX_LIFETIME", 60),  // 60分钟
			ConnMaxIdleTime: getEnvInt("DB_CONN_MAX_IDLE_TIME", 10), // 10分钟
		},
		Redis: RedisConfig{
			Host:     getEnv("REDIS_HOST", "localhost"),
			Port:     getEnvInt("REDIS_PORT", 6379),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       getEnvInt("REDIS_DB", 0),
		},
		JWT: JWTConfig{
			Secret:        getEnv("JWT_SECRET", "easyssh-secret-change-in-production"),
			AccessExpire:  getEnvInt("JWT_ACCESS_EXPIRE_HOURS", 1),     // 1 小时
			RefreshExpire: getEnvInt("JWT_REFRESH_EXPIRE_HOURS", 168),  // 7 天
		},
	}

	// 根据运行环境自动设置配置
	config.applyEnvironmentDefaults()

	// 验证必要配置
	if err := config.Validate(); err != nil {
		return nil, err
	}

	return config, nil
}

// applyEnvironmentDefaults 根据运行环境自动设置默认配置
func (c *Config) applyEnvironmentDefaults() {
	// 根据 ENV 自动设置数据库调试模式
	if c.Server.Env == "development" {
		c.Database.Debug = true // 开发环境开启 SQL 调试
	} else {
		c.Database.Debug = false // 生产环境关闭 SQL 调试
	}

	// 设置 Gin 框架模式（通过环境变量）
	if c.Server.Env == "production" {
		os.Setenv("GIN_MODE", "release")
	} else {
		os.Setenv("GIN_MODE", "debug")
	}
}

// Validate 验证配置
func (c *Config) Validate() error {
	// 服务器配置验证
	if c.Server.Port < 1 || c.Server.Port > 65535 {
		return fmt.Errorf("server port must be between 1 and 65535")
	}
	if c.Server.Env != "development" && c.Server.Env != "production" {
		return fmt.Errorf("server environment must be 'development' or 'production'")
	}
	if c.Server.EncryptionKey == "" {
		return fmt.Errorf("encryption key is required")
	}
	keyLen := len(c.Server.EncryptionKey)
	if keyLen != 16 && keyLen != 24 && keyLen != 32 {
		return fmt.Errorf("encryption key must be 16, 24 or 32 bytes, got %d bytes", keyLen)
	}
	// 生产环境必须使用强加密密钥
	if c.Server.Env == "production" && c.Server.EncryptionKey == "easyssh-encryption-key-32byte" {
		return fmt.Errorf("must change encryption key in production environment")
	}

	// 数据库配置验证
	if c.Database.Host == "" {
		return fmt.Errorf("database host is required")
	}
	if c.Database.Port < 1 || c.Database.Port > 65535 {
		return fmt.Errorf("database port must be between 1 and 65535")
	}
	if c.Database.User == "" {
		return fmt.Errorf("database user is required")
	}
	if c.Database.DBName == "" {
		return fmt.Errorf("database name is required")
	}
	validSSLModes := map[string]bool{
		"disable":     true,
		"require":     true,
		"verify-ca":   true,
		"verify-full": true,
	}
	if !validSSLModes[c.Database.SSLMode] {
		return fmt.Errorf("invalid database SSL mode: %s (must be disable, require, verify-ca, or verify-full)", c.Database.SSLMode)
	}
	// 生产环境建议使用 SSL
	if c.Server.Env == "production" && c.Database.SSLMode == "disable" {
		fmt.Println("⚠️  Warning: Database SSL is disabled in production environment")
	}
	// 连接池参数验证
	if c.Database.MaxIdleConns < 1 || c.Database.MaxIdleConns > 100 {
		return fmt.Errorf("database max idle connections must be between 1 and 100")
	}
	if c.Database.MaxOpenConns < 1 || c.Database.MaxOpenConns > 1000 {
		return fmt.Errorf("database max open connections must be between 1 and 1000")
	}
	if c.Database.MaxIdleConns > c.Database.MaxOpenConns {
		return fmt.Errorf("database max idle connections cannot exceed max open connections")
	}
	if c.Database.ConnMaxLifetime < 1 || c.Database.ConnMaxLifetime > 1440 {
		return fmt.Errorf("database connection max lifetime must be between 1 and 1440 minutes (24 hours)")
	}
	if c.Database.ConnMaxIdleTime < 1 || c.Database.ConnMaxIdleTime > 60 {
		return fmt.Errorf("database connection max idle time must be between 1 and 60 minutes")
	}

	// Redis 配置验证
	if c.Redis.Host == "" {
		return fmt.Errorf("redis host is required")
	}
	if c.Redis.Port < 1 || c.Redis.Port > 65535 {
		return fmt.Errorf("redis port must be between 1 and 65535")
	}
	if c.Redis.DB < 0 || c.Redis.DB > 15 {
		return fmt.Errorf("redis database must be between 0 and 15")
	}

	// JWT 配置验证
	if c.JWT.Secret == "" {
		return fmt.Errorf("JWT secret is required")
	}
	if len(c.JWT.Secret) < 32 {
		return fmt.Errorf("JWT secret must be at least 32 characters for security")
	}
	if c.Server.Env == "production" && c.JWT.Secret == "easyssh-secret-change-in-production" {
		return fmt.Errorf("must change JWT secret in production environment")
	}
	if c.JWT.AccessExpire < 1 || c.JWT.AccessExpire > 24 {
		return fmt.Errorf("JWT access token expiration must be between 1 and 24 hours")
	}
	if c.JWT.RefreshExpire < 24 || c.JWT.RefreshExpire > 720 {
		return fmt.Errorf("JWT refresh token expiration must be between 24 hours (1 day) and 720 hours (30 days)")
	}
	if c.JWT.RefreshExpire <= c.JWT.AccessExpire {
		return fmt.Errorf("JWT refresh token expiration must be greater than access token expiration")
	}

	return nil
}

// GetDSN 获取数据库连接字符串
func (c *DatabaseConfig) GetDSN() string {
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		c.Host, c.Port, c.User, c.Password, c.DBName, c.SSLMode)
}

// GetRedisAddr 获取 Redis 地址
func (c *RedisConfig) GetRedisAddr() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}

// 辅助函数：获取环境变量（字符串）
func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

// 辅助函数：获取环境变量（整数）
func getEnvInt(key string, defaultValue int) int {
	valueStr := os.Getenv(key)
	if valueStr == "" {
		return defaultValue
	}
	value, err := strconv.Atoi(valueStr)
	if err != nil {
		return defaultValue
	}
	return value
}

// 辅助函数：获取环境变量（布尔值）
func getEnvBool(key string, defaultValue bool) bool {
	valueStr := os.Getenv(key)
	if valueStr == "" {
		return defaultValue
	}
	value, err := strconv.ParseBool(valueStr)
	if err != nil {
		return defaultValue
	}
	return value
}
