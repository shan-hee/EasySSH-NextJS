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
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
	SSLMode  string
	Debug    bool // 是否开启SQL调试日志
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
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnvInt("DB_PORT", 5432),
			User:     getEnv("DB_USER", "easyssh"),
			Password: getEnv("DB_PASSWORD", "easyssh_dev_password"),
			DBName:   getEnv("DB_NAME", "easyssh"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
			Debug:    getEnvBool("DB_DEBUG", false), // 默认关闭SQL调试
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

	// 验证必要配置
	if err := config.Validate(); err != nil {
		return nil, err
	}

	return config, nil
}

// Validate 验证配置
func (c *Config) Validate() error {
	if c.Database.Host == "" {
		return fmt.Errorf("database host is required")
	}
	if c.Database.User == "" {
		return fmt.Errorf("database user is required")
	}
	if c.JWT.Secret == "" {
		return fmt.Errorf("JWT secret is required")
	}
	if c.Server.Env == "production" && c.JWT.Secret == "easyssh-secret-change-in-production" {
		return fmt.Errorf("must change JWT secret in production")
	}
	if c.Server.EncryptionKey == "" {
		return fmt.Errorf("encryption key is required")
	}
	keyLen := len(c.Server.EncryptionKey)
	if keyLen != 16 && keyLen != 24 && keyLen != 32 {
		return fmt.Errorf("encryption key must be 16, 24 or 32 bytes")
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
