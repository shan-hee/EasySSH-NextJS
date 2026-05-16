package db

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/easyssh/server/internal/infra/config"
	"github.com/glebarez/sqlite"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// NewDB 创建数据库连接，默认使用 SQLite，可通过 DB_DRIVER 切换 postgres/mysql。
func NewDB(cfg *config.DatabaseConfig) (*gorm.DB, error) {
	gormConfig := &gorm.Config{
		Logger: gormLogger(cfg.Debug),
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	}

	var dialector gorm.Dialector
	dsn, err := cfg.DialectorDSN()
	if err != nil {
		return nil, err
	}
	switch cfg.Driver {
	case "sqlite":
		if err := ensureSQLiteDir(dsn); err != nil {
			return nil, err
		}
		dialector = sqlite.Open(dsn)
	case "postgres", "pgsql", "postgresql":
		dialector = postgres.Open(dsn)
	case "mysql":
		dialector = mysql.Open(dsn)
	default:
		return nil, fmt.Errorf("unsupported database driver: %s", cfg.Driver)
	}

	database, err := gorm.Open(dialector, gormConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	sqlDB, err := database.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database instance: %w", err)
	}

	sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
	sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)
	sqlDB.SetConnMaxLifetime(time.Duration(cfg.ConnMaxLifetime) * time.Minute)
	sqlDB.SetConnMaxIdleTime(time.Duration(cfg.ConnMaxIdleTime) * time.Minute)

	log.Printf("📊 Database connection pool configured: Driver=%s, MaxIdle=%d, MaxOpen=%d, MaxLifetime=%dm, MaxIdleTime=%dm",
		cfg.Driver, cfg.MaxIdleConns, cfg.MaxOpenConns, cfg.ConnMaxLifetime, cfg.ConnMaxIdleTime)

	if cfg.Driver == "sqlite" {
		if err := configureSQLite(database); err != nil {
			return nil, err
		}
	}

	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Printf("✅ Database connected successfully (%s)", cfg.Driver)
	return database, nil
}

func gormLogger(debug bool) logger.Interface {
	if debug {
		return logger.New(
			log.New(os.Stdout, "\r\n", log.LstdFlags),
			logger.Config{
				SlowThreshold:             200 * time.Millisecond,
				LogLevel:                  logger.Info,
				IgnoreRecordNotFoundError: true,
				Colorful:                  true,
			},
		)
	}

	return logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{
			SlowThreshold:             500 * time.Millisecond,
			LogLevel:                  logger.Warn,
			IgnoreRecordNotFoundError: true,
			Colorful:                  false,
		},
	)
}

func ensureSQLiteDir(dsn string) error {
	dbPath := sqlitePathFromDSN(dsn)
	if dbPath == "" || dbPath == ":memory:" {
		return nil
	}
	dir := filepath.Dir(dbPath)
	if dir == "." || dir == "" {
		return nil
	}
	if err := os.MkdirAll(dir, 0750); err != nil {
		return fmt.Errorf("failed to create sqlite database directory: %w", err)
	}
	return nil
}

func sqlitePathFromDSN(dsn string) string {
	dbPath := strings.TrimSpace(dsn)
	if strings.HasPrefix(dbPath, "file:") {
		dbPath = strings.TrimPrefix(dbPath, "file:")
		if idx := strings.IndexByte(dbPath, '?'); idx >= 0 {
			dbPath = dbPath[:idx]
		}
	}
	if strings.HasPrefix(dbPath, ":memory:") {
		return ":memory:"
	}
	return dbPath
}

func configureSQLite(database *gorm.DB) error {
	settings := []string{
		"PRAGMA foreign_keys = ON",
		"PRAGMA journal_mode = WAL",
		"PRAGMA busy_timeout = 5000",
	}
	for _, stmt := range settings {
		if err := database.Exec(stmt).Error; err != nil {
			return fmt.Errorf("failed to configure sqlite: %w", err)
		}
	}
	return nil
}

// Close 关闭数据库连接
func Close(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

// HealthCheck 数据库健康检查
func HealthCheck(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Ping()
}
