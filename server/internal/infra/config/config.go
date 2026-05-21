package config

import (
	"encoding/base64"
	"fmt"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	mysqlconfig "github.com/go-sql-driver/mysql"
)

// Config 应用配置
type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	JWT      JWTConfig
	SFTP     SFTPConfig
}

// ServerConfig 服务器配置
type ServerConfig struct {
	Port           int
	Env            string   // development, production
	EncryptionKey  string   // 加密密钥（Base64 编码的 32 字节 AES 密钥）
	WebDevPort     int      // 前端开发端口（从 WEB_PORT 读取）
	TrustedProxies []string // 可信反向代理 IP/CIDR，用于解析客户端真实 IP
}

// DatabaseConfig 数据库配置
type DatabaseConfig struct {
	Driver          string // sqlite, postgres, mysql
	DSN             string // 数据库连接串；SQLite 时为数据库文件路径或 file: DSN
	Debug           bool   // 是否开启SQL调试日志
	MaxIdleConns    int    // 最大空闲连接数
	MaxOpenConns    int    // 最大打开连接数
	ConnMaxLifetime int    // 连接最大生命周期（分钟）
	ConnMaxIdleTime int    // 连接最大空闲时间（分钟）
}

// JWTConfig JWT 配置
type JWTConfig struct {
	Secret string
}

// SFTPConfig SFTP/SSH 池化相关配置
type SFTPConfig struct {
	MaxIdleTimeSeconds     int // SSH 空闲回收时间（秒）
	CleanupIntervalSeconds int // 清理/keepalive 扫描间隔（秒）
	MaxLifeTimeMinutes     int // SSH 最大寿命（分钟，0 表示不启用）
	ConnTimeoutSeconds     int // SSH 建连/keepalive 超时（秒）
	MaxSFTPSessionsPerConn int // 单条 SSH 最大并发 SFTP 会话数（0 表示不限制）

	// .trash 清理 worker（独立后台任务，不依赖连接池空闲）
	TrashCleanerEnabled         bool
	TrashCleanIntervalSeconds   int // 扫描间隔（秒）
	TrashSuccessCooldownSeconds int // 一次成功清理后的冷却（秒）
	TrashRetentionHours         int // 保留期（小时）
	TrashMaxEntriesPerTrashDir  int // 单个 .trash 目录最大条目数（0 表示不限制）
	TrashMaxBytesPerTrashDirMB  int // 单个 .trash 目录最大占用（MB，0 表示不限制）
	TrashMaxDeletesPerDirPerRun int // 单次对单目录最大删除条数
	TrashMaxFailCount           int // 单个目录最大失败重试次数
	TrashBatchSize              int // 每轮最多处理多少条记录
	TrashConcurrency            int // 并发处理多少个 server
	TrashConnectTimeoutSeconds  int // 单次连接超时（秒）
	TrashJobTimeoutSeconds      int // 单个 server 清理总超时（秒）
	TrashRetryBaseDelaySeconds  int // 失败重试基础延迟（秒）
	TrashRetryMaxDelaySeconds   int // 失败重试最大延迟（秒）
}

// Load 从环境变量加载配置
func Load() (*Config, error) {
	config := &Config{
		Server: ServerConfig{
			Port:          getBackendPort(),
			Env:           getEnv("ENV", "development"),
			EncryptionKey: getEnv("ENCRYPTION_KEY", "ZWFzeXNzaC1lbmNyeXB0aW9uLWtleS0zMmJ5dGVzISE="), // Base64 编码的 32 字节（仅开发环境占位）
			WebDevPort:    getEnvInt("WEB_PORT", 3000),
			TrustedProxies: getEnvStringList("TRUSTED_PROXIES", []string{
				"127.0.0.1",
				"::1",
			}),
		},
		Database: DatabaseConfig{
			Driver:          getEnv("DB_DRIVER", "sqlite"),
			DSN:             expandEnvRefs(getEnv("DB_DSN", "./data/easyssh.db")),
			MaxIdleConns:    getEnvInt("DB_MAX_IDLE_CONNS", 10),
			MaxOpenConns:    getEnvInt("DB_MAX_OPEN_CONNS", 100),
			ConnMaxLifetime: getEnvInt("DB_CONN_MAX_LIFETIME", 60),  // 60分钟
			ConnMaxIdleTime: getEnvInt("DB_CONN_MAX_IDLE_TIME", 10), // 10分钟
		},
		JWT: JWTConfig{
			Secret: getEnv("JWT_SECRET", "easyssh-secret-change-in-production"),
		},
		SFTP: SFTPConfig{
			MaxIdleTimeSeconds:     getEnvInt("SFTP_MAX_IDLE_TIME_SECONDS", 120),   // 2分钟
			CleanupIntervalSeconds: getEnvInt("SFTP_CLEANUP_INTERVAL_SECONDS", 30), // 30秒
			MaxLifeTimeMinutes:     getEnvInt("SFTP_MAX_LIFE_TIME_MINUTES", 0),     // 默认不启用
			ConnTimeoutSeconds:     getEnvInt("SFTP_CONN_TIMEOUT_SECONDS", 10),     // 10秒
			MaxSFTPSessionsPerConn: getEnvInt("SFTP_MAX_SESSIONS_PER_CONN", 8),     // 每条 SSH 默认最多 8 个 SFTP 会话

			TrashCleanerEnabled:         getEnvBool("SFTP_TRASH_CLEANER_ENABLED", true),
			TrashCleanIntervalSeconds:   getEnvInt("SFTP_TRASH_CLEAN_INTERVAL_SECONDS", 600),   // 10分钟
			TrashSuccessCooldownSeconds: getEnvInt("SFTP_TRASH_SUCCESS_COOLDOWN_SECONDS", 600), // 10分钟
			TrashRetentionHours:         getEnvInt("SFTP_TRASH_RETENTION_HOURS", 24),           // 默认保留 24h
			TrashMaxEntriesPerTrashDir:  getEnvInt("SFTP_TRASH_MAX_ENTRIES_PER_DIR", 5000),
			TrashMaxBytesPerTrashDirMB:  getEnvInt("SFTP_TRASH_MAX_BYTES_PER_DIR_MB", 2048), // 2GB
			TrashMaxDeletesPerDirPerRun: getEnvInt("SFTP_TRASH_MAX_DELETES_PER_DIR", 500),
			TrashMaxFailCount:           getEnvInt("SFTP_TRASH_MAX_FAIL_COUNT", 10), // 最多重试 10 次
			TrashBatchSize:              getEnvInt("SFTP_TRASH_BATCH_SIZE", 200),
			TrashConcurrency:            getEnvInt("SFTP_TRASH_CONCURRENCY", 2),
			TrashConnectTimeoutSeconds:  getEnvInt("SFTP_TRASH_CONNECT_TIMEOUT_SECONDS", 10),
			TrashJobTimeoutSeconds:      getEnvInt("SFTP_TRASH_JOB_TIMEOUT_SECONDS", 120),
			TrashRetryBaseDelaySeconds:  getEnvInt("SFTP_TRASH_RETRY_BASE_DELAY_SECONDS", 60),
			TrashRetryMaxDelaySeconds:   getEnvInt("SFTP_TRASH_RETRY_MAX_DELAY_SECONDS", 3600),
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

	if c.Database.Driver == "" {
		c.Database.Driver = "sqlite"
	}
	c.Database.Driver = strings.ToLower(strings.TrimSpace(c.Database.Driver))
	switch c.Database.Driver {
	case "pgsql", "postgresql":
		c.Database.Driver = "postgres"
	}
	c.Database.DSN = strings.TrimSpace(c.Database.DSN)
	if c.Database.DSN == "" && c.Database.Driver == "sqlite" {
		c.Database.DSN = "./data/easyssh.db"
	}

	// SQLite 是默认单机模式，连接池保持保守可以避免写锁争用。
	if c.Database.Driver == "sqlite" {
		c.Database.MaxIdleConns = 1
		c.Database.MaxOpenConns = 1
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
	if c.Server.Port < 0 || c.Server.Port > 65535 {
		return fmt.Errorf("server port must be between 0 and 65535")
	}
	if c.Server.Env != "development" && c.Server.Env != "production" {
		return fmt.Errorf("server environment must be 'development' or 'production'")
	}
	if c.Server.EncryptionKey == "" {
		return fmt.Errorf("encryption key is required")
	}
	decoded, err := base64.StdEncoding.DecodeString(c.Server.EncryptionKey)
	if err != nil || len(decoded) != 32 {
		return fmt.Errorf("encryption key must be a base64-encoded 32-byte key")
	}
	// 生产环境必须使用强加密密钥
	if c.Server.Env == "production" && c.Server.EncryptionKey == "ZWFzeXNzaC1lbmNyeXB0aW9uLWtleS0zMmJ5dGVzISE=" {
		return fmt.Errorf("must change encryption key in production environment")
	}

	// 数据库配置验证
	switch c.Database.Driver {
	case "sqlite":
		if c.Database.DSN == "" {
			return fmt.Errorf("database connection string is required for sqlite")
		}
	case "postgres":
		if err := validatePostgresDSN(c.Database.DSN); err != nil {
			return err
		}
		// 生产环境建议使用 SSL
		if c.Server.Env == "production" && postgresSSLMode(c.Database.DSN) == "disable" {
			fmt.Println("⚠️  Warning: Database SSL is disabled in production environment")
		}
	case "mysql":
		if err := validateMySQLDSN(c.Database.DSN); err != nil {
			return err
		}
	default:
		return fmt.Errorf("unsupported database driver: %s (must be sqlite, postgres/pgsql, or mysql)", c.Database.Driver)
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
	// SFTP/SSH 池化配置验证
	if c.SFTP.MaxIdleTimeSeconds < 5 || c.SFTP.MaxIdleTimeSeconds > 3600 {
		return fmt.Errorf("sftp max idle time must be between 5 and 3600 seconds")
	}
	if c.SFTP.CleanupIntervalSeconds < 5 || c.SFTP.CleanupIntervalSeconds > 600 {
		return fmt.Errorf("sftp cleanup interval must be between 5 and 600 seconds")
	}
	if c.SFTP.MaxLifeTimeMinutes < 0 || c.SFTP.MaxLifeTimeMinutes > 1440 {
		return fmt.Errorf("sftp max life time must be between 0 and 1440 minutes")
	}
	if c.SFTP.ConnTimeoutSeconds < 1 || c.SFTP.ConnTimeoutSeconds > 120 {
		return fmt.Errorf("sftp conn timeout must be between 1 and 120 seconds")
	}
	if c.SFTP.MaxSFTPSessionsPerConn < 0 || c.SFTP.MaxSFTPSessionsPerConn > 64 {
		return fmt.Errorf("sftp max sessions per conn must be between 0 and 64")
	}

	return nil
}

// DialectorDSN 返回传给 GORM dialector 的连接串。
func (c *DatabaseConfig) DialectorDSN() (string, error) {
	if c.Driver == "mysql" {
		return normalizeMySQLDSN(c.DSN)
	}
	return c.DSN, nil
}

func validatePostgresDSN(dsn string) error {
	if strings.TrimSpace(dsn) == "" {
		return fmt.Errorf("database connection string is required for postgres")
	}

	// pgx 同时支持 URL DSN 与 keyword/value DSN；这里只对 URL 形式做结构校验。
	if strings.Contains(dsn, "://") {
		parsed, err := url.Parse(dsn)
		if err != nil {
			return fmt.Errorf("invalid postgres connection string: %w", err)
		}
		if parsed.Scheme != "postgres" && parsed.Scheme != "postgresql" {
			return fmt.Errorf("invalid postgres connection string scheme: %s", parsed.Scheme)
		}
		if parsed.Host == "" {
			return fmt.Errorf("postgres connection string must include host")
		}
		if strings.Trim(parsed.Path, "/") == "" {
			return fmt.Errorf("postgres connection string must include database name")
		}
	}

	return nil
}

func validateMySQLDSN(dsn string) error {
	if strings.TrimSpace(dsn) == "" {
		return fmt.Errorf("database connection string is required for mysql")
	}

	_, err := normalizeMySQLDSN(dsn)
	return err
}

func postgresSSLMode(dsn string) string {
	if parsed, err := url.Parse(dsn); err == nil && (parsed.Scheme == "postgres" || parsed.Scheme == "postgresql") {
		return strings.ToLower(strings.TrimSpace(parsed.Query().Get("sslmode")))
	}

	for _, field := range strings.Fields(dsn) {
		key, value, ok := strings.Cut(field, "=")
		if ok && strings.EqualFold(key, "sslmode") {
			return strings.ToLower(strings.Trim(value, `'"`))
		}
	}

	return ""
}

func normalizeMySQLDSN(dsn string) (string, error) {
	dsn = strings.TrimSpace(dsn)
	if !strings.HasPrefix(strings.ToLower(dsn), "mysql://") {
		return dsn, nil
	}

	parsed, err := url.Parse(dsn)
	if err != nil {
		return "", fmt.Errorf("invalid mysql connection string: %w", err)
	}
	if parsed.Host == "" {
		return "", fmt.Errorf("mysql connection string must include host")
	}

	dbName := strings.TrimPrefix(parsed.Path, "/")
	if dbName == "" {
		return "", fmt.Errorf("mysql connection string must include database name")
	}

	cfg := mysqlconfig.NewConfig()
	cfg.User = parsed.User.Username()
	if password, ok := parsed.User.Password(); ok {
		cfg.Passwd = password
	}
	cfg.Net = "tcp"
	cfg.Addr = parsed.Host
	cfg.DBName = dbName
	cfg.ParseTime = true
	cfg.Loc = time.Local
	cfg.Params = map[string]string{
		"charset": "utf8mb4",
	}

	query := parsed.Query()
	for key, values := range query {
		if len(values) == 0 {
			continue
		}
		value := values[len(values)-1]
		switch strings.ToLower(key) {
		case "parsetime":
			parsedValue, err := strconv.ParseBool(value)
			if err != nil {
				return "", fmt.Errorf("invalid mysql parseTime value: %s", value)
			}
			cfg.ParseTime = parsedValue
		case "loc":
			loc, err := time.LoadLocation(value)
			if err != nil {
				return "", fmt.Errorf("invalid mysql loc value: %s", value)
			}
			cfg.Loc = loc
		default:
			cfg.Params[key] = value
		}
	}

	return cfg.FormatDSN(), nil
}

var envRefPattern = regexp.MustCompile(`\$\{([A-Za-z_][A-Za-z0-9_]*)(:-([^}]*))?\}`)

func expandEnvRefs(value string) string {
	return envRefPattern.ReplaceAllStringFunc(value, func(match string) string {
		parts := envRefPattern.FindStringSubmatch(match)
		if len(parts) == 0 {
			return match
		}
		if envValue := os.Getenv(parts[1]); envValue != "" {
			return envValue
		}
		if len(parts) > 3 {
			return parts[3]
		}
		return ""
	})
}

func getBackendPort() int {
	rawURL := strings.TrimSpace(os.Getenv("NEXT_PUBLIC_BACKEND_URL"))
	if rawURL == "" {
		return 8520
	}

	port, hasPort, err := explicitPortFromURL(rawURL)
	if err != nil {
		fmt.Printf("⚠️  Warning: invalid NEXT_PUBLIC_BACKEND_URL %q, using default backend port 8520: %v\n", rawURL, err)
		return 8520
	}
	if !hasPort {
		return 8520
	}
	return port
}

func explicitPortFromURL(rawURL string) (int, bool, error) {
	if !strings.Contains(rawURL, "://") {
		rawURL = "http://" + rawURL
	}

	parsed, err := url.Parse(rawURL)
	if err != nil {
		return 0, false, err
	}

	rawPort := parsed.Port()
	if rawPort == "" {
		return 0, false, nil
	}

	port, err := strconv.Atoi(rawPort)
	if err != nil {
		return 0, false, fmt.Errorf("invalid port %q", rawPort)
	}
	if port < 0 || port > 65535 {
		return 0, false, fmt.Errorf("port must be between 0 and 65535")
	}
	return port, true, nil
}

// 辅助函数：获取环境变量（字符串）
func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

func getEnvStringList(key string, defaultValue []string) []string {
	value := os.Getenv(key)
	if strings.TrimSpace(value) == "" {
		return defaultValue
	}

	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			result = append(result, part)
		}
	}
	if len(result) == 0 {
		return defaultValue
	}
	return result
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
