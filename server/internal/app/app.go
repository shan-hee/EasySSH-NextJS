package app

import (
	"context"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/easyssh/server/internal/api/middleware"
	"github.com/easyssh/server/internal/api/rest"
	"github.com/easyssh/server/internal/api/ws"
	"github.com/easyssh/server/internal/domain/aichat"
	"github.com/easyssh/server/internal/domain/aichat/runtime"
	"github.com/easyssh/server/internal/domain/aiconfig"
	"github.com/easyssh/server/internal/domain/auditlog"
	"github.com/easyssh/server/internal/domain/auth"
	"github.com/easyssh/server/internal/domain/batchtask"
	"github.com/easyssh/server/internal/domain/completion"
	"github.com/easyssh/server/internal/domain/filetransfer"
	"github.com/easyssh/server/internal/domain/monitor"
	"github.com/easyssh/server/internal/domain/monitoring"
	"github.com/easyssh/server/internal/domain/notification"
	"github.com/easyssh/server/internal/domain/notificationconfig"
	"github.com/easyssh/server/internal/domain/permission"
	"github.com/easyssh/server/internal/domain/scheduledtask"
	"github.com/easyssh/server/internal/domain/script"
	"github.com/easyssh/server/internal/domain/security"
	"github.com/easyssh/server/internal/domain/server"
	"github.com/easyssh/server/internal/domain/sftp"
	"github.com/easyssh/server/internal/domain/ssh"
	"github.com/easyssh/server/internal/domain/sshhostkey"
	"github.com/easyssh/server/internal/domain/sshkey"
	"github.com/easyssh/server/internal/domain/sshsession"
	"github.com/easyssh/server/internal/domain/systemconfig"
	"github.com/easyssh/server/internal/domain/taskexecution"
	"github.com/easyssh/server/internal/domain/taskexecutor"
	"github.com/easyssh/server/internal/domain/taskscheduler"
	"github.com/easyssh/server/internal/domain/user"
	"github.com/easyssh/server/internal/domain/useraiconfig"
	"github.com/easyssh/server/internal/domain/verification"
	"github.com/easyssh/server/internal/infra/config"
	"github.com/easyssh/server/internal/infra/db"
	"github.com/easyssh/server/internal/pkg/crypto"
	"github.com/easyssh/server/internal/pkg/geoip"
	"github.com/easyssh/server/internal/platform"
	settingsresolver "github.com/easyssh/server/internal/settings"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Options configures the reusable EasySSH HTTP runtime.
type Options struct {
	Config     *config.Config
	Profile    platform.RuntimeProfile
	DataDir    string
	Version    string
	ListenHost string
	StaticFS   fs.FS
	StaticDir  string
}

// Runtime owns the HTTP server and background workers started by EasySSH.
type Runtime struct {
	cfg                   *config.Config
	database              *gorm.DB
	srv                   *http.Server
	addr                  string
	listenAddr            string
	runtimeInfo           platform.RuntimeInfo
	taskScheduler         *taskscheduler.Scheduler
	trashCleaner          *sftp.TrashCleaner
	sftpHandler           *rest.SFTPHandler
	monitorConnectionPool *monitor.ConnectionPool
	shutdownOnce          sync.Once
}

func New(opts Options) (*Runtime, error) {
	// 加载配置
	cfg := opts.Config
	if cfg == nil {
		loaded, err := config.Load()
		if err != nil {
			return nil, fmt.Errorf("failed to load config: %w", err)
		}
		cfg = loaded
	}
	staticDir := opts.StaticDir
	if strings.TrimSpace(staticDir) == "" {
		staticDir = "./static"
	}
	runtimeInfo := platform.RuntimeInfoForProfile(opts.Profile, opts.DataDir)
	if strings.TrimSpace(opts.Version) != "" {
		runtimeInfo.Version = strings.TrimSpace(opts.Version)
	}

	// 设置 Gin 模式
	if cfg.Server.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// 初始化数据库
	database, err := db.NewDB(&cfg.Database)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	log.Println("✅ GeoIP client initialized with in-memory cache")

	// 数据库迁移（自动迁移）
	if err := database.AutoMigrate(
		&auth.User{},
		&auth.Session{}, // 用户会话表
		&server.Server{},
		&auditlog.AuditLog{},
		&script.Script{},               // 脚本表
		&batchtask.BatchTask{},         // 批量任务表
		&scheduledtask.ScheduledTask{}, // 定时任务表
		&sshsession.SSHSession{},       // SSH会话表
		&filetransfer.FileTransfer{},   // 文件传输表
		// 新的配置表
		&systemconfig.SystemConfig{},             // 系统配置表
		&security.SecurityConfig{},               // 安全配置表
		&notificationconfig.NotificationConfig{}, // 通知配置表
		&aiconfig.AIConfig{},                     // AI配置表
		&useraiconfig.UserAIConfig{},             // 用户AI配置表
		// 其他表
		&sshkey.SSHKey{},         // SSH密钥表
		&sshhostkey.SSHHostKey{}, // SSH主机密钥表（TOFU安全验证）
		// 任务执行相关表
		&taskexecution.TaskExecution{},       // 任务执行历史表
		&taskexecution.TaskExecutionServer{}, // 任务执行服务器结果表
		&sftp.TrashDir{},                     // SFTP .trash 清理登记表
		&sftp.TrashItem{},                    // SFTP 回收站索引表
		&sftp.TrashSettings{},                // SFTP 回收站用户设置表
		// 安全增强相关表
		&auth.LoginAttempt{},       // 登录尝试记录表
		&auth.TrustedDevice{},      // 可信设备表
		&auth.LoginAlert{},         // 登录告警表
		&auth.RSAKeyPair{},         // RSA 密钥对表
		&permission.Permission{},   // 权限定义表
		&runtime.AISessionRecord{}, // AI 会话持久化表
	); err != nil {
		db.Close(database)
		return nil, fmt.Errorf("failed to migrate database: %w", err)
	}
	log.Println("✅ Database migrated successfully")

	// 系统配置服务（JWT_SECRET 仍来自 .env，其余 JWT 过期/刷新配置来自系统设置）
	systemConfigRepo := systemconfig.NewRepository(database)
	systemConfigService := systemconfig.NewService(systemConfigRepo)
	systemCfg, err := systemConfigService.Get(context.Background())
	if err != nil {
		db.Close(database)
		return nil, fmt.Errorf("failed to load system config: %w", err)
	}
	jwtSettings := systemCfg.JWTSessionConfig()

	// 初始化服务层
	// JWT 服务
	accessTokenDuration := time.Duration(jwtSettings.AccessExpireMinutes) * time.Minute
	refreshIdleDuration := time.Duration(jwtSettings.RefreshIdleExpireDays) * 24 * time.Hour
	refreshAbsoluteDuration := time.Duration(jwtSettings.RefreshAbsoluteExpireDays) * 24 * time.Hour

	jwtService := auth.NewJWTService(auth.JWTConfig{
		SecretKey:                     cfg.JWT.Secret,
		AccessTokenDuration:           accessTokenDuration,
		RefreshIdleExpireDuration:     refreshIdleDuration,
		RefreshAbsoluteExpireDuration: refreshAbsoluteDuration,
		RefreshRotate:                 jwtSettings.RefreshRotate,
		RefreshReuseDetection:         jwtSettings.RefreshReuseDetection,
	})

	// 一次性 Ticket：进程内短期存储（用于 WebSocket 握手 / 原生下载等无法附带 Authorization Header 的场景）
	ticketService := auth.NewInMemoryTicketService(auth.InMemoryTicketConfig{
		TTL: 30 * time.Second,
	})

	// 认证服务（会话过期时间与 JWT 刷新闲置过期时间保持一致）
	authRepo := auth.NewRepository(database)
	authService := auth.NewService(authRepo, jwtService, refreshIdleDuration)
	var desktopLocalOwner *auth.User
	if runtimeInfo.Profile == platform.RuntimeProfileDesktop {
		desktopLocalOwner, err = authService.EnsureLocalOwner(
			context.Background(),
			platform.DesktopLocalOwnerUsername,
			platform.DesktopLocalOwnerEmail,
		)
		if err != nil {
			db.Close(database)
			return nil, fmt.Errorf("failed to ensure desktop local owner: %w", err)
		}
		log.Printf("✅ Desktop local owner ready: %s", desktopLocalOwner.Email)
	}

	// 安全配置服务
	securityRepo := security.NewRepository(database)
	securityService := security.NewService(securityRepo)

	// 通知配置服务
	notificationConfigRepo := notificationconfig.NewRepository(database)
	notificationConfigService := notificationconfig.NewService(notificationConfigRepo)

	// AI配置服务
	aiConfigRepo := aiconfig.NewRepository(database)
	aiConfigService := aiconfig.NewService(aiConfigRepo)

	// 用户AI配置服务
	userAIConfigRepo := useraiconfig.NewRepository(database)
	userAIConfigService := useraiconfig.NewService(userAIConfigRepo)

	log.Println("✅ New configuration services initialized")

	// 邮件服务(支持动态配置)
	// 从新的通知配置服务加载 SMTP 配置
	var emailService notification.EmailService
	smtpConfig, err := notificationConfigService.GetSMTPConfig(context.Background())
	if err == nil && smtpConfig != nil && smtpConfig.Enabled {
		// 获取系统配置用于邮件模板
		sysConfig, _ := systemConfigService.Get(context.Background())
		systemName := "EasySSH"
		if sysConfig != nil && sysConfig.SystemName != "" {
			systemName = sysConfig.SystemName
		}

		// 从数据库加载成功且启用了邮件服务
		emailService, err = notification.NewEmailService(&notification.EmailConfig{
			SMTPHost:     smtpConfig.Host,
			SMTPPort:     smtpConfig.Port,
			SMTPUsername: smtpConfig.Username,
			SMTPPassword: smtpConfig.Password,
			FromEmail:    smtpConfig.FromEmail,
			FromName:     smtpConfig.FromName,
			UseTLS:       smtpConfig.UseTLS,
			SystemName:   systemName,
			CurrentYear:  time.Now().Year(),
		})
		if err != nil {
			log.Printf("⚠️ Warning: Failed to initialize email service: %v", err)
		} else {
			log.Println("✅ Email service initialized from database configuration")
		}
	} else {
		log.Println("ℹ️  Email service is disabled (configure via Web UI: Settings > Notifications > SMTP)")
	}

	// 注入邮件服务到认证服务
	if emailService != nil {
		type emailServiceSetter interface {
			SetEmailService(auth.EmailService)
		}
		if setter, ok := authService.(emailServiceSetter); ok {
			setter.SetEmailService(emailService)
		}
	}

	// 账户锁定服务（进程内短期计数 + 数据库账户锁定状态）
	lockConfig := auth.DefaultAccountLockConfig
	if securityConfig, err := securityService.GetAccountLockConfig(context.Background()); err == nil {
		lockConfig = auth.AccountLockConfig{
			Enabled:                securityConfig.Enabled,
			MaxIPFailAttempts:      securityConfig.MaxIPFailAttempts,
			IPLockDuration:         time.Duration(securityConfig.IPLockDurationMinutes) * time.Minute,
			MaxAccountFailAttempts: securityConfig.MaxAccountFailAttempts,
			AccountLockDuration:    time.Duration(securityConfig.AccountLockDurationMinutes) * time.Minute,
			FailCountWindow:        15 * time.Minute, // 默认 15 分钟窗口
		}
	}
	loginAttemptRepo := auth.NewLoginAttemptRepository(database)
	accountLockService := auth.NewAccountLockService(
		loginAttemptRepo,
		authRepo,
		lockConfig,
	)
	log.Println("✅ Account lock service initialized")

	type accountLockServiceSetter interface {
		SetAccountLockService(auth.AccountLockService)
	}
	if setter, ok := authService.(accountLockServiceSetter); ok {
		setter.SetAccountLockService(accountLockService)
	}

	// 登录检测服务（需要数据库）
	var loginDetectionService auth.LoginDetectionService
	trustedDeviceRepo := auth.NewTrustedDeviceRepository(database)
	loginAlertRepo := auth.NewLoginAlertRepository(database)
	geoipClient := geoip.NewClient()
	loginDetectionService = auth.NewLoginDetectionService(trustedDeviceRepo, loginAlertRepo, authRepo, geoipClient, emailService)
	log.Println("✅ Login detection service initialized")

	// 注入登录检测服务到认证服务
	type loginDetectionServiceSetter interface {
		SetLoginDetectionService(auth.LoginDetectionService)
	}
	if setter, ok := authService.(loginDetectionServiceSetter); ok {
		setter.SetLoginDetectionService(loginDetectionService)
	}

	// 验证码服务（进程内短期存储）
	verificationService := verification.NewService()
	log.Println("✅ Verification service initialized")

	// 加密器（用于服务器密码和私钥）
	encryptor, err := crypto.NewEncryptor(cfg.Server.EncryptionKey)
	if err != nil {
		db.Close(database)
		return nil, fmt.Errorf("failed to create encryptor: %w", err)
	}

	// 服务器服务
	serverRepo := server.NewRepository(database)
	serverService := server.NewService(serverRepo, encryptor)

	// SSH 主机密钥验证服务（TOFU安全模型）
	sshHostKeyService := sshhostkey.NewService(database)

	// SSH 会话管理器
	sessionManager := ssh.NewSessionManager()

	// 监控连接池（独立于终端会话）
	monitorConnectionPool := monitor.NewConnectionPool(serverService, encryptor)

	// 审计日志服务
	auditLogRepo := auditlog.NewRepository(database)
	auditLogService := auditlog.NewService(auditLogRepo)

	// 监控服务
	monitoringService := monitoring.NewService(serverService, encryptor)

	// 脚本服务
	scriptRepo := script.NewRepository(database)
	scriptService := script.NewService(scriptRepo)

	// 补全服务
	// 从新的系统配置服务读取补全缓存配置
	completionCacheConfig, err := systemConfigService.GetCompletionCache(context.Background())
	if err != nil {
		log.Printf("Failed to get completion cache config, using defaults: %v", err)
		completionCacheConfig = systemconfig.DefaultCompletionCache()
	}
	completionService := completion.NewService(scriptRepo, completionCacheConfig.TTLMinutes, completionCacheConfig.MaxEntries)

	// 批量任务服务
	batchTaskRepo := batchtask.NewRepository(database)
	batchTaskService := batchtask.NewService(batchTaskRepo)

	// 定时任务服务
	scheduledTaskRepo := scheduledtask.NewRepository(database)
	scheduledTaskService := scheduledtask.NewService(scheduledTaskRepo)

	// 任务执行历史服务
	taskExecutionRepo := taskexecution.NewRepository(database)
	taskExecutionService := taskexecution.NewService(taskExecutionRepo)

	// 任务执行引擎
	taskExecutor := taskexecutor.NewExecutor(
		serverService,
		scriptService,
		scheduledTaskRepo,
		taskExecutionRepo,
		encryptor,
		10, // 最大并发数
	)
	taskExecutor.SetHostKeyCallback(sshHostKeyService.GetHostKeyCallback())

	// 注入执行器到批量任务服务
	batchTaskService.SetExecutor(taskExecutor)

	// 任务调度器
	taskScheduler := taskscheduler.NewScheduler(scheduledTaskRepo, taskExecutor)

	// 注入调度器到定时任务服务
	scheduledTaskService.SetScheduler(taskScheduler)

	// 启动调度器
	if err := taskScheduler.Start(); err != nil {
		log.Printf("⚠️ Warning: Failed to start task scheduler: %v", err)
	} else {
		log.Println("✅ Task scheduler started")
	}

	// SSH会话服务
	sshSessionRepo := sshsession.NewRepository(database)
	sshSessionService := sshsession.NewService(sshSessionRepo)

	// 文件传输服务
	fileTransferRepo := filetransfer.NewRepository(database)
	fileTransferService := filetransfer.NewService(fileTransferRepo)

	// 用户管理服务
	userRepo := user.NewRepository(database)
	userService := user.NewService(userRepo)

	// 权限服务（用于后端接口授权 + 前端权限管理页）
	permissionRepo := permission.NewRepository(database)
	permissionService := permission.NewService(permissionRepo)
	if err := permissionService.EnsureDefaults(context.Background()); err != nil {
		log.Printf("⚠️ Warning: Failed to ensure default permissions: %v", err)
	} else {
		log.Println("✅ Default permissions ensured")
	}

	// SSH密钥服务
	sshKeyRepo := sshkey.NewRepository(database)
	sshKeyService := sshkey.NewService(sshKeyRepo, cfg.Server.EncryptionKey)

	// SFTP 上传 WebSocket 处理器
	sftpUploadWSHandler := ws.NewSFTPUploadHandler(securityService, cfg.Server.WebDevPort)

	// SFTP 跨服务器传输 WebSocket 处理器
	sftpTransferWSHandler := ws.NewSFTPTransferHandler(
		serverService,
		serverRepo,
		encryptor,
		securityService,
		cfg.Server.WebDevPort,
		sshHostKeyService.GetHostKeyCallback(),
	)

	// 令牌有效期（秒），用于 Cookie 和 API 响应
	accessTokenTTLSeconds := int(accessTokenDuration.Seconds())
	refreshTokenTTLSeconds := int(refreshIdleDuration.Seconds())

	// 初始化处理器
	var trashCleaner *sftp.TrashCleaner

	authHandler := rest.NewAuthHandler(
		authService,
		jwtService,
		securityService,
		accessTokenTTLSeconds,
		refreshTokenTTLSeconds,
		systemConfigService,
		verificationService,
		emailService,
		runtimeInfo,
		desktopLocalOwner,
	)
	oauthHandler := rest.NewOAuthHandler(
		authService,
		systemConfigService,
		securityService,
		accessTokenTTLSeconds,
		refreshTokenTTLSeconds,
	)
	serverHandler := rest.NewServerHandler(serverService)
	sshHandler := rest.NewSSHHandler(sessionManager)
	trashRepo := sftp.NewTrashDirRepository(database)
	trashItemRepo := sftp.NewTrashItemRepository(database)
	trashSettingsRepo := sftp.NewTrashSettingsRepository(database)
	sftpPoolConfig := &sftp.PoolConfig{
		MaxIdleTime:            time.Duration(cfg.SFTP.MaxIdleTimeSeconds) * time.Second,
		CleanupInterval:        time.Duration(cfg.SFTP.CleanupIntervalSeconds) * time.Second,
		MaxLifeTime:            time.Duration(cfg.SFTP.MaxLifeTimeMinutes) * time.Minute,
		ConnTimeout:            time.Duration(cfg.SFTP.ConnTimeoutSeconds) * time.Second,
		MaxSFTPSessionsPerConn: cfg.SFTP.MaxSFTPSessionsPerConn,
	}
	sftpHandler := rest.NewSFTPHandler(serverService, serverRepo, encryptor, sftpUploadWSHandler, sshHostKeyService.GetHostKeyCallback(), sftpPoolConfig)
	sftpHandler.SetTransferHandler(sftpTransferWSHandler) // 注入跨服务器传输处理器

	if pool := sftpHandler.GetPool(); pool != nil {
		pool.SetTrashRepository(trashRepo)
		pool.SetTrashItemRepository(trashItemRepo)
	}
	sftpHandler.SetTrashItemRepository(trashItemRepo)
	sftpHandler.SetTrashSettingsRepository(trashSettingsRepo)

	trashCleaner = sftp.NewTrashCleaner(sftp.TrashCleanerConfig{
		Enabled:          cfg.SFTP.TrashCleanerEnabled,
		Interval:         time.Duration(cfg.SFTP.TrashCleanIntervalSeconds) * time.Second,
		SuccessCooldown:  time.Duration(cfg.SFTP.TrashSuccessCooldownSeconds) * time.Second,
		Retention:        time.Duration(cfg.SFTP.TrashRetentionHours) * time.Hour,
		MaxEntries:       cfg.SFTP.TrashMaxEntriesPerTrashDir,
		MaxBytes:         int64(cfg.SFTP.TrashMaxBytesPerTrashDirMB) * 1024 * 1024,
		MaxDeletesPerDir: cfg.SFTP.TrashMaxDeletesPerDirPerRun,
		MaxFailCount:     cfg.SFTP.TrashMaxFailCount,
		BatchSize:        cfg.SFTP.TrashBatchSize,
		Concurrency:      cfg.SFTP.TrashConcurrency,
		ConnectTimeout:   time.Duration(cfg.SFTP.TrashConnectTimeoutSeconds) * time.Second,
		JobTimeout:       time.Duration(cfg.SFTP.TrashJobTimeoutSeconds) * time.Second,
		BaseRetryDelay:   time.Duration(cfg.SFTP.TrashRetryBaseDelaySeconds) * time.Second,
		MaxRetryDelay:    time.Duration(cfg.SFTP.TrashRetryMaxDelaySeconds) * time.Second,
	}, sftp.TrashCleanerDeps{
		Repo:            trashRepo,
		ItemRepo:        trashItemRepo,
		SettingsRepo:    trashSettingsRepo,
		ServerService:   serverService,
		Encryptor:       encryptor,
		HostKeyCallback: sshHostKeyService.GetHostKeyCallback(),
	})
	trashCleaner.Start()

	terminalHandler := ws.NewTerminalHandler(serverService, serverRepo, sessionManager, encryptor, sshSessionService, sshHostKeyService.GetHostKeyCallback(), securityService, cfg.Server.WebDevPort, completionService, systemConfigService)
	monitorHandler := ws.NewMonitorHandler(monitorConnectionPool, securityService, cfg.Server.WebDevPort)
	auditLogHandler := rest.NewAuditLogHandler(auditLogService)
	monitoringHandler := rest.NewMonitoringHandler(monitoringService, authService)
	ticketHandler := rest.NewTicketHandler(ticketService)
	scriptHandler := rest.NewScriptHandler(scriptService)
	batchTaskHandler := rest.NewBatchTaskHandler(batchTaskService)
	scheduledTaskHandler := rest.NewScheduledTaskHandler(scheduledTaskService)
	taskExecutionHandler := rest.NewTaskExecutionHandler(taskExecutionService)
	sshSessionHandler := rest.NewSSHSessionHandler(sshSessionService)
	fileTransferHandler := rest.NewFileTransferHandler(fileTransferService)
	userHandler := rest.NewUserHandler(userService, accountLockService)
	permissionHandler := rest.NewPermissionHandler(permissionService)
	// 新的配置处理器
	securityHandler := rest.NewSecurityHandler(securityService)
	securityHandler.SetSystemConfigService(systemConfigService)
	systemConfigHandler := rest.NewSystemConfigHandler(systemConfigService)
	notificationConfigHandler := rest.NewNotificationConfigHandler(notificationConfigService)
	aiConfigHandler := rest.NewAIConfigHandler(aiConfigService)
	userAIConfigHandler := rest.NewUserAIConfigHandler(userAIConfigService)
	settingsResolver := settingsresolver.NewResolver(runtimeInfo.Profile, aiConfigService, userAIConfigService)
	aiConfigResolver := aichat.NewConfigResolverWithSettings(settingsResolver, runtimeInfo.Profile)
	aiRuntimeConfigHandler := rest.NewAIRuntimeConfigHandler(aiConfigResolver)
	// AI 工具执行器和会话运行时
	aiToolExecutor := aichat.NewToolExecutorService(serverService, sftpHandler.GetPool(), encryptor)
	aiRuntimeManager := aichat.NewRuntimeManagerWithResolver(aiConfigResolver, aiToolExecutor)
	aiRuntimeManager.SetSessionStore(runtime.NewGormSessionStore(database))
	aiSessionHandler := rest.NewAISessionHandler(aiRuntimeManager)
	aiSessionWSHandler := ws.NewAISessionHandler(aiRuntimeManager, securityService, cfg.Server.WebDevPort)
	// Docker 处理器（复用监控连接池）
	dockerHandler := rest.NewDockerHandler(serverService, serverRepo, encryptor, sshHostKeyService.GetHostKeyCallback(), monitorConnectionPool)
	// 其他处理器
	sshKeyHandler := rest.NewSSHKeyHandler(sshKeyService)
	avatarHandler := rest.NewAvatarHandler()
	backupHandler := rest.NewBackupHandler(
		database,
		&cfg.Database,
	)
	desktopHandler := rest.NewDesktopHandler(runtimeInfo)

	// 创建 Gin 路由
	r := gin.New()
	if err := r.SetTrustedProxies(cfg.Server.TrustedProxies); err != nil {
		db.Close(database)
		return nil, fmt.Errorf("failed to configure trusted proxies: %w", err)
	}

	// 从系统配置加载最大上传大小
	systemConfig, err := systemConfigService.Get(context.Background())
	if err == nil {
		// 设置 Gin 的最大上传内存（转换为字节：MB -> Bytes）
		r.MaxMultipartMemory = int64(systemConfig.MaxFileUploadSize) << 20
		log.Printf("✅ Max file upload size set to %d MB", systemConfig.MaxFileUploadSize)
	} else {
		log.Printf("⚠️  Failed to load max file upload size, using default (32 MB): %v", err)
	}

	// 全局中间件
	r.Use(middleware.Recovery())                           // 错误恢复
	r.Use(middleware.Logger())                             // 日志记录
	r.Use(middleware.RequestID())                          // 请求 ID
	r.Use(middleware.SecurityHeaders())                    // 安全响应头
	r.Use(middleware.SecurityConfigCache(securityService)) // 安全配置缓存(避免重复查询)
	r.Use(middleware.CORS(cfg, securityService))           // 跨域（支持动态配置）
	r.Use(middleware.CSRFMiddleware(cfg))                  // Cookie 凭证端点 CSRF 防护
	auditConfig := middleware.DefaultAuditConfig()
	if runtimeInfo.Profile == platform.RuntimeProfileDesktop {
		auditConfig.Enabled = false
	}
	r.Use(middleware.AuditLogMiddleware(auditLogService, auditConfig)) // 审计日志
	r.Use(middleware.OptionalIPWhitelistMiddleware(securityService))   // IP 访问控制验证（可选）
	r.Use(middleware.AttachRuntimePrincipal(runtimeInfo))              // 暴露 runtime_profile；认证成功后会补齐当前 Principal

	// API v1 路由组
	v1 := r.Group("/api/v1")
	{
		// 健康检查
		v1.GET("/health", func(c *gin.Context) {
			// 检查数据库连接
			dbStatus := "ok"
			if err := db.HealthCheck(database); err != nil {
				dbStatus = "error: " + err.Error()
			}

			c.JSON(http.StatusOK, gin.H{
				"status":  "ok",
				"service": "easyssh-api",
				"version": "1.0.0",
				"dependencies": gin.H{
					"database": dbStatus,
				},
			})
		})

		v1.GET("/runtime", func(c *gin.Context) {
			c.JSON(http.StatusOK, runtimeInfo)
		})

		// Ping 端点（用于延迟测量）
		v1.HEAD("/ping", func(c *gin.Context) {
			c.Status(http.StatusOK)
		})
		v1.GET("/ping", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"pong": time.Now().UnixMilli()})
		})

		// 认证路由（公开）
		authRoutes := v1.Group("/auth")
		{
			authRoutes.POST("/send-verification-code", middleware.RequireCapability(runtimeInfo, platform.CapabilityUsers), authHandler.SendVerificationCode)
			authRoutes.POST("/send-password-reset-code", middleware.RequireCapability(runtimeInfo, platform.CapabilityUsers), authHandler.SendPasswordResetCode)
			authRoutes.POST("/reset-password", middleware.RequireCapability(runtimeInfo, platform.CapabilityUsers), authHandler.ResetPassword)
			authRoutes.POST("/register", middleware.RequireCapability(runtimeInfo, platform.CapabilityUsers), authHandler.Register)
			authRoutes.POST("/logout", authHandler.Logout)
			// 使用可选认证中间件，支持未登录和已登录状态
			authRoutes.GET("/status", middleware.OptionalAuth(jwtService, ticketService, authRepo, runtimeInfo), authHandler.CheckStatus) // 检查系统和认证状态
			authRoutes.GET("/csrf", authHandler.CSRFToken)                                                                                // 获取 CSRF token
			// 一次性 Ticket（需认证，用于 WS/下载握手）
			authRoutes.POST("/ticket", middleware.AuthMiddleware(jwtService, ticketService, authRepo, runtimeInfo), ticketHandler.CreateTicket)
			// 初始化管理员接口应用速率限制（支持动态配置）
			authRoutes.POST("/initialize-admin", middleware.RequireCapability(runtimeInfo, platform.CapabilityUsers), middleware.LoginRateLimitMiddleware(securityService), authHandler.InitializeAdmin)
			authRoutes.POST("/2fa/verify", middleware.RequireCapability(runtimeInfo, platform.CapabilityOAuth), middleware.TwoFARateLimitMiddleware(securityService), authHandler.Verify2FACode) // 验证 2FA 代码（登录时）
		}

		// OAuth 路由（公开）
		oauthRoutes := v1.Group("/oauth")
		{
			// 与 /oauth 前缀下的端点保持一一对应，便于前端统一通过 /api/v1 调用
			oauthRoutes.POST("/authorize", middleware.RequireCapability(runtimeInfo, platform.CapabilityOAuth), middleware.LoginRateLimitMiddleware(securityService), authHandler.OAuthAuthorize) // 开发版 PKCE 授权码端点（含登录验证）
			oauthRoutes.POST("/token", authHandler.OAuthToken)                                                                                                                                    // 交换/刷新 access_token
			oauthRoutes.POST("/logout", authHandler.Logout)                                                                                                                                       // 推荐登出端点（可携带 refresh_token Cookie）
			oauthRoutes.POST("/google/verify", middleware.RequireCapability(runtimeInfo, platform.CapabilityOAuth), oauthHandler.GoogleVerify)                                                    // 验证 Google ID Token
		}

		// 用户路由（需要认证）
		userRoutes := v1.Group("/users")
		userRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo, runtimeInfo))
		{
			userRoutes.GET("/me", authHandler.GetCurrentUser)
			userRoutes.PUT("/me", middleware.RequireCapability(runtimeInfo, platform.CapabilityUsers), authHandler.UpdateProfile)
			userRoutes.PUT("/me/password", middleware.RequireCapability(runtimeInfo, platform.CapabilityUsers), authHandler.ChangePassword)
			userRoutes.POST("/me/oauth/google/link", middleware.RequireCapability(runtimeInfo, platform.CapabilityOAuth), oauthHandler.GoogleLink)
			userRoutes.DELETE("/me/oauth/google/link", middleware.RequireCapability(runtimeInfo, platform.CapabilityOAuth), oauthHandler.GoogleUnlink)

			// 2FA 相关路由
			userRoutes.GET("/me/2fa/generate", middleware.RequireCapability(runtimeInfo, platform.CapabilitySecurityPolicy), authHandler.Generate2FASecret) // 生成 2FA secret
			userRoutes.POST("/me/2fa/enable", middleware.RequireCapability(runtimeInfo, platform.CapabilitySecurityPolicy), authHandler.Enable2FA)          // 启用 2FA
			userRoutes.POST("/me/2fa/disable", middleware.RequireCapability(runtimeInfo, platform.CapabilitySecurityPolicy), authHandler.Disable2FA)        // 禁用 2FA

			// 会话管理路由
			userRoutes.GET("/me/sessions", middleware.RequireCapability(runtimeInfo, platform.CapabilitySecurityPolicy), authHandler.ListSessions)                          // 获取活跃会话列表
			userRoutes.DELETE("/me/sessions/:session_id", middleware.RequireCapability(runtimeInfo, platform.CapabilitySecurityPolicy), authHandler.RevokeSession)          // 撤销指定会话
			userRoutes.POST("/me/sessions/revoke-others", middleware.RequireCapability(runtimeInfo, platform.CapabilitySecurityPolicy), authHandler.RevokeAllOtherSessions) // 撤销所有其他会话

			// 通知设置路由
			userRoutes.PUT("/me/notifications", middleware.RequireCapability(runtimeInfo, platform.CapabilityNotifications), authHandler.UpdateNotificationSettings) // 更新通知设置

			// 监控数据源设置路由
			userRoutes.PUT("/me/monitor-datasource", middleware.RequireCapability(runtimeInfo, platform.CapabilityMonitoring), authHandler.UpdateMonitorDataSource) // 更新监控数据源设置

			// 用户AI配置路由
			userRoutes.GET("/me/ai-config", userAIConfigHandler.GetUserAIConfig)       // 获取用户AI配置
			userRoutes.PUT("/me/ai-config", userAIConfigHandler.SaveUserAIConfig)      // 保存用户AI配置
			userRoutes.DELETE("/me/ai-config", userAIConfigHandler.DeleteUserAIConfig) // 删除用户AI配置
			userRoutes.POST("/me/ai-config/models", userAIConfigHandler.ProbeUserAIModels)
		}

		// 用户管理路由（需要认证）
		userManagementRoutes := v1.Group("/users")
		userManagementRoutes.Use(middleware.RequireCapability(runtimeInfo, platform.CapabilityUsers))
		userManagementRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo, runtimeInfo))
		userManagementRoutes.Use(middleware.RequirePermission(permissionService, "user:manage"))
		{
			userManagementRoutes.GET("", userHandler.ListUsers)                    // 获取用户列表
			userManagementRoutes.GET("/statistics", userHandler.GetStatistics)     // 获取统计信息
			userManagementRoutes.GET("/:id", userHandler.GetUser)                  // 获取用户详情
			userManagementRoutes.POST("", userHandler.CreateUser)                  // 创建用户
			userManagementRoutes.PUT("/:id", userHandler.UpdateUser)               // 更新用户
			userManagementRoutes.DELETE("/:id", userHandler.DeleteUser)            // 删除用户
			userManagementRoutes.POST("/:id/password", userHandler.ChangePassword) // 修改密码
			userManagementRoutes.POST("/:id/lock", userHandler.LockUser)           // 锁定账户
			userManagementRoutes.POST("/:id/unlock", userHandler.UnlockUser)       // 解锁账户
		}

		// 权限管理路由（需要认证）
		permissionRoutes := v1.Group("/permissions")
		permissionRoutes.Use(middleware.RequireCapability(runtimeInfo, platform.CapabilityPermissions))
		permissionRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo, runtimeInfo))
		permissionRoutes.Use(middleware.RequirePermission(permissionService, "user:manage"))
		{
			permissionRoutes.GET("", permissionHandler.ListPermissions)         // 获取权限列表
			permissionRoutes.POST("", permissionHandler.CreatePermission)       // 创建权限
			permissionRoutes.PUT("/:id", permissionHandler.UpdatePermission)    // 更新权限
			permissionRoutes.DELETE("/:id", permissionHandler.DeletePermission) // 删除权限
		}

		// 服务器路由（需要认证）
		serverRoutes := v1.Group("/servers")
		serverRoutes.Use(middleware.RequireCapability(runtimeInfo, platform.CapabilityServers))
		serverRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo, runtimeInfo))
		{
			serverRoutes.GET("", middleware.RequirePermission(permissionService, "server:view"), serverHandler.List)                     // 列表
			serverRoutes.GET("/statistics", middleware.RequirePermission(permissionService, "server:view"), serverHandler.GetStatistics) // 统计
			serverRoutes.GET("/:id", middleware.RequirePermission(permissionService, "server:view"), serverHandler.GetByID)              // 详情

			serverRoutes.POST("", middleware.RequirePermission(permissionService, "server:manage"), serverHandler.Create)           // 创建
			serverRoutes.PATCH("/reorder", middleware.RequirePermission(permissionService, "server:manage"), serverHandler.Reorder) // 批量更新排序
			serverRoutes.PUT("/:id", middleware.RequirePermission(permissionService, "server:manage"), serverHandler.Update)        // 更新
			serverRoutes.DELETE("/:id", middleware.RequirePermission(permissionService, "server:manage"), serverHandler.Delete)     // 删除
		}

		// SSH 路由（需要认证）
		sshRoutes := v1.Group("/ssh")
		sshRoutes.Use(middleware.RequireCapability(runtimeInfo, platform.CapabilityTerminal))
		sshRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo, runtimeInfo))
		{
			// WebSocket 终端
			sshRoutes.GET("/terminal/:server_id", middleware.RequirePermission(permissionService, "terminal:execute"), terminalHandler.HandleSSH)

			// 会话管理 REST API
			sshRoutes.GET("/sessions", middleware.RequirePermission(permissionService, "terminal:execute"), sshHandler.ListSessions)        // 会话列表
			sshRoutes.GET("/sessions/:id", middleware.RequirePermission(permissionService, "terminal:execute"), sshHandler.GetSession)      // 会话详情
			sshRoutes.DELETE("/sessions/:id", middleware.RequirePermission(permissionService, "terminal:execute"), sshHandler.CloseSession) // 关闭会话
			sshRoutes.GET("/statistics", middleware.RequirePermission(permissionService, "terminal:execute"), sshHandler.GetStatistics)     // 统计信息
		}

		// Docker 路由（需要认证）
		dockerRoutes := v1.Group("/docker/:serverId")
		dockerRoutes.Use(middleware.RequireCapability(runtimeInfo, platform.CapabilityDocker))
		dockerRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo, runtimeInfo))
		{
			dockerRoutes.GET("/containers", dockerHandler.ListContainers)                             // 容器列表
			dockerRoutes.GET("/containers/:id/logs", dockerHandler.GetContainerLogs)                  // 容器日志
			dockerRoutes.GET("/containers/:id/check-update", dockerHandler.CheckContainerImageUpdate) // 检查镜像更新
			dockerRoutes.POST("/containers/:id/start", dockerHandler.StartContainer)                  // 启动容器
			dockerRoutes.POST("/containers/:id/stop", dockerHandler.StopContainer)                    // 停止容器
			dockerRoutes.POST("/containers/:id/restart", dockerHandler.RestartContainer)              // 重启容器
			dockerRoutes.POST("/containers/:id/pause", dockerHandler.PauseContainer)                  // 暂停容器
			dockerRoutes.POST("/containers/:id/unpause", dockerHandler.UnpauseContainer)              // 恢复容器
			dockerRoutes.DELETE("/containers/:id", dockerHandler.RemoveContainer)                     // 删除容器
			dockerRoutes.GET("/images", dockerHandler.ListImages)                                     // 镜像列表
			dockerRoutes.GET("/system", dockerHandler.GetSystemInfo)                                  // 系统信息
			dockerRoutes.GET("/stats", dockerHandler.GetStats)                                        // 容器统计
			dockerRoutes.GET("/resources", dockerHandler.GetResources)                                // 资源页签数据（stats + systemInfo）
		}

		// 监控 WebSocket 路由（需要认证）
		monitorRoutes := v1.Group("/monitor")
		monitorRoutes.Use(middleware.RequireCapability(runtimeInfo, platform.CapabilityMonitoring))
		monitorRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo, runtimeInfo))
		{
			// WebSocket 实时监控 - 使用 server_id 查找活跃会话
			monitorRoutes.GET("/server/:server_id", monitorHandler.HandleMonitor) // 实时监控 WebSocket
		}

		// SFTP 路由（需要认证）
		sftpRoutes := v1.Group("/sftp/:server_id")
		sftpRoutes.Use(middleware.RequireCapability(runtimeInfo, platform.CapabilitySFTP))
		sftpRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo, runtimeInfo))
		{
			// 文件浏览
			sftpRoutes.GET("/list", middleware.RequirePermission(permissionService, "file:view"), sftpHandler.ListDirectory)      // 列出目录
			sftpRoutes.GET("/stat", middleware.RequirePermission(permissionService, "file:view"), sftpHandler.GetFileInfo)        // 文件信息
			sftpRoutes.GET("/disk-usage", middleware.RequirePermission(permissionService, "file:view"), sftpHandler.GetDiskUsage) // 磁盘使用

			// 文件传输
			sftpRoutes.POST("/upload", middleware.RequirePermission(permissionService, "file:manage"), sftpHandler.UploadFile)              // 旧版上传文件（保留兼容，不再由前端默认接入）
			sftpRoutes.POST("/upload/stream", middleware.RequirePermission(permissionService, "file:manage"), sftpHandler.UploadFileStream) // 新版流式上传文件
			sftpRoutes.GET("/download", middleware.RequirePermission(permissionService, "file:manage"), sftpHandler.DownloadFile)           // 下载文件

			// 文件操作
			sftpRoutes.POST("/mkdir", middleware.RequirePermission(permissionService, "file:manage"), sftpHandler.CreateDirectory) // 创建目录
			sftpRoutes.DELETE("/delete", middleware.RequirePermission(permissionService, "file:manage"), sftpHandler.Delete)       // 删除
			sftpRoutes.POST("/rename", middleware.RequirePermission(permissionService, "file:manage"), sftpHandler.Rename)         // 重命名
			sftpRoutes.POST("/chmod", middleware.RequirePermission(permissionService, "file:manage"), sftpHandler.Chmod)           // 修改权限

			// 批量操作
			sftpRoutes.POST("/batch-delete", middleware.RequirePermission(permissionService, "file:manage"), sftpHandler.BatchDelete)     // 批量删除
			sftpRoutes.POST("/batch-download", middleware.RequirePermission(permissionService, "file:manage"), sftpHandler.BatchDownload) // 批量下载

			// 文件内容
			sftpRoutes.GET("/read", middleware.RequirePermission(permissionService, "file:view"), sftpHandler.ReadFile)      // 读取文件
			sftpRoutes.POST("/write", middleware.RequirePermission(permissionService, "file:manage"), sftpHandler.WriteFile) // 写入文件

			// 回收站（.trash）
			sftpRoutes.GET("/trash/list", middleware.RequirePermission(permissionService, "file:view"), sftpHandler.ListTrash)
			sftpRoutes.POST("/trash/restore", middleware.RequirePermission(permissionService, "file:manage"), sftpHandler.RestoreTrash)
			sftpRoutes.DELETE("/trash/purge", middleware.RequirePermission(permissionService, "file:manage"), sftpHandler.PurgeTrash)
			sftpRoutes.POST("/trash/empty", middleware.RequirePermission(permissionService, "file:manage"), sftpHandler.EmptyTrash)

			// 连接管理
			sftpRoutes.POST("/close", middleware.RequirePermission(permissionService, "file:view"), sftpHandler.CloseConnection) // 关闭连接（用户关闭 SFTP 面板时调用）
		}

		// SFTP 连接池统计路由（需要认证）
		sftpPoolRoutes := v1.Group("/sftp/pool")
		sftpPoolRoutes.Use(middleware.RequireCapability(runtimeInfo, platform.CapabilitySFTP))
		sftpPoolRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo, runtimeInfo))
		sftpPoolRoutes.Use(middleware.RequirePermission(permissionService, "file:view"))
		{
			sftpPoolRoutes.GET("/stats", sftpHandler.GetPoolStats) // 连接池统计
		}

		// 全局回收站索引（需要认证）
		sftpTrashRoutes := v1.Group("/sftp/trash")
		sftpTrashRoutes.Use(middleware.RequireCapability(runtimeInfo, platform.CapabilitySFTP))
		sftpTrashRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo, runtimeInfo))
		{
			sftpTrashRoutes.GET("/items", middleware.RequirePermission(permissionService, "file:view"), sftpHandler.ListTrashItems)
			sftpTrashRoutes.POST("/items/:item_id/restore", middleware.RequirePermission(permissionService, "file:manage"), sftpHandler.RestoreTrashItem)
			sftpTrashRoutes.DELETE("/items/:item_id", middleware.RequirePermission(permissionService, "file:manage"), sftpHandler.PurgeTrashItem)
			sftpTrashRoutes.POST("/items/empty", middleware.RequirePermission(permissionService, "file:manage"), sftpHandler.EmptyTrashItems)
			sftpTrashRoutes.POST("/items/batch-restore", middleware.RequirePermission(permissionService, "file:manage"), sftpHandler.BatchRestoreTrashItems)
			sftpTrashRoutes.POST("/items/batch-purge", middleware.RequirePermission(permissionService, "file:manage"), sftpHandler.BatchPurgeTrashItems)
			// 回收站设置
			sftpTrashRoutes.GET("/settings", middleware.RequirePermission(permissionService, "file:view"), sftpHandler.GetTrashSettings)
			sftpTrashRoutes.PUT("/settings", middleware.RequirePermission(permissionService, "file:manage"), sftpHandler.UpdateTrashSettings)
			sftpTrashRoutes.DELETE("/settings", middleware.RequirePermission(permissionService, "file:manage"), sftpHandler.ResetTrashSettings)
		}

		// SFTP 上传进度 WebSocket 路由（需要认证）
		sftpWSRoutes := v1.Group("/sftp/upload/ws")
		sftpWSRoutes.Use(middleware.RequireCapability(runtimeInfo, platform.CapabilitySFTP))
		sftpWSRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo, runtimeInfo))
		sftpWSRoutes.Use(middleware.RequirePermission(permissionService, "file:manage"))
		{
			sftpWSRoutes.GET("/:task_id", sftpUploadWSHandler.HandleUploadWebSocket) // 上传进度 WebSocket
		}

		// SFTP 上传任务路由（需要认证）
		sftpUploadRoutes := v1.Group("/sftp/upload")
		sftpUploadRoutes.Use(middleware.RequireCapability(runtimeInfo, platform.CapabilitySFTP))
		sftpUploadRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo, runtimeInfo))
		sftpUploadRoutes.Use(middleware.RequirePermission(permissionService, "file:manage"))
		{
			sftpUploadRoutes.POST("/task", sftpHandler.CreateUploadTask)                  // 创建上传任务（服务端生成 task_id）
			sftpUploadRoutes.GET("/tasks", sftpHandler.ListUploadTasks)                   // 上传任务列表（内存运行态）
			sftpUploadRoutes.GET("/tasks/:task_id", sftpHandler.GetUploadTask)            // 上传任务详情（内存运行态）
			sftpUploadRoutes.POST("/tasks/:task_id/cancel", sftpHandler.CancelUploadTask) // 取消上传任务
		}

		// SFTP 跨服务器传输路由（需要认证）
		sftpTransferRoutes := v1.Group("/sftp")
		sftpTransferRoutes.Use(middleware.RequireCapability(runtimeInfo, platform.CapabilityTransfers))
		sftpTransferRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo, runtimeInfo))
		sftpTransferRoutes.Use(middleware.RequirePermission(permissionService, "file:manage"))
		{
			sftpTransferRoutes.POST("/transfer", sftpHandler.Transfer)                       // 跨服务器文件传输（流式中转）
			sftpTransferRoutes.POST("/transfer/direct", sftpHandler.DirectTransfer)          // 跨服务器直连传输（rsync/scp）
			sftpTransferRoutes.POST("/transfer/:task_id/cancel", sftpHandler.CancelTransfer) // 取消传输任务
		}

		// SFTP 跨服务器传输进度 WebSocket 路由（需要认证）
		sftpTransferWSRoutes := v1.Group("/sftp/transfer/ws")
		sftpTransferWSRoutes.Use(middleware.RequireCapability(runtimeInfo, platform.CapabilityTransfers))
		sftpTransferWSRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo, runtimeInfo))
		sftpTransferWSRoutes.Use(middleware.RequirePermission(permissionService, "file:manage"))
		{
			sftpTransferWSRoutes.GET("/:task_id", sftpTransferWSHandler.HandleTransferWebSocket) // 传输进度 WebSocket
		}

		// 监控路由（需要认证）
		monitoringRoutes := v1.Group("/monitoring")
		monitoringRoutes.Use(middleware.RequireCapability(runtimeInfo, platform.CapabilityMonitoring))
		monitoringRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo, runtimeInfo))
		{
			monitoringRoutes.GET("/resources", monitoringHandler.GetAllResources)                 // 所有服务器资源概览
			monitoringRoutes.GET("/resources/stream", monitoringHandler.StreamResources)          // 流式获取服务器资源（SSE）
			monitoringRoutes.POST("/datasource/test", monitoringHandler.TestDataSourceConnection) // 测试数据源连接
		}

		// 审计日志路由（需要认证）
		auditLogRoutes := v1.Group("/audit-logs")
		auditLogRoutes.Use(middleware.RequireCapability(runtimeInfo, platform.CapabilityAudit))
		auditLogRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo, runtimeInfo))
		auditLogRoutes.Use(middleware.RequirePermission(permissionService, "audit:view"))
		{
			auditLogRoutes.GET("", auditLogHandler.List)                      // 查询日志列表
			auditLogRoutes.GET("/me", auditLogHandler.GetMyLogs)              // 我的日志
			auditLogRoutes.GET("/statistics", auditLogHandler.GetStatistics)  // 统计信息
			auditLogRoutes.GET("/:id", auditLogHandler.GetByID)               // 日志详情
			auditLogRoutes.DELETE("/cleanup", auditLogHandler.CleanupOldLogs) // 清理旧日志（管理员）
		}

		// 脚本管理路由（需要认证）
		scriptRoutes := v1.Group("/scripts")
		scriptRoutes.Use(middleware.RequireCapability(runtimeInfo, platform.CapabilityScripts))
		scriptRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo, runtimeInfo))
		{
			scriptRoutes.GET("", scriptHandler.List)                 // 脚本列表
			scriptRoutes.POST("", scriptHandler.Create)              // 创建脚本
			scriptRoutes.GET("/:id", scriptHandler.GetByID)          // 脚本详情
			scriptRoutes.PUT("/:id", scriptHandler.Update)           // 更新脚本
			scriptRoutes.DELETE("/:id", scriptHandler.Delete)        // 删除脚本
			scriptRoutes.POST("/:id/execute", scriptHandler.Execute) // 执行脚本
		}

		// 批量任务路由（需要认证）
		batchTaskRoutes := v1.Group("/batch-tasks")
		batchTaskRoutes.Use(middleware.RequireCapability(runtimeInfo, platform.CapabilityAutomation))
		batchTaskRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo, runtimeInfo))
		{
			batchTaskRoutes.GET("", batchTaskHandler.List)                     // 任务列表
			batchTaskRoutes.POST("", batchTaskHandler.Create)                  // 创建任务
			batchTaskRoutes.GET("/statistics", batchTaskHandler.GetStatistics) // 统计信息
			batchTaskRoutes.GET("/:id", batchTaskHandler.GetByID)              // 任务详情
			batchTaskRoutes.PUT("/:id", batchTaskHandler.Update)               // 更新任务
			batchTaskRoutes.DELETE("/:id", batchTaskHandler.Delete)            // 删除任务
			batchTaskRoutes.POST("/:id/start", batchTaskHandler.Start)         // 启动任务
		}

		// 定时任务路由（需要认证）
		scheduledTaskRoutes := v1.Group("/scheduled-tasks")
		scheduledTaskRoutes.Use(middleware.RequireCapability(runtimeInfo, platform.CapabilityAutomation))
		scheduledTaskRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo, runtimeInfo))
		{
			scheduledTaskRoutes.GET("", scheduledTaskHandler.List)                     // 任务列表
			scheduledTaskRoutes.POST("", scheduledTaskHandler.Create)                  // 创建任务
			scheduledTaskRoutes.GET("/statistics", scheduledTaskHandler.GetStatistics) // 统计信息
			scheduledTaskRoutes.GET("/:id", scheduledTaskHandler.GetByID)              // 任务详情
			scheduledTaskRoutes.PUT("/:id", scheduledTaskHandler.Update)               // 更新任务
			scheduledTaskRoutes.DELETE("/:id", scheduledTaskHandler.Delete)            // 删除任务
			scheduledTaskRoutes.POST("/:id/toggle", scheduledTaskHandler.Toggle)       // 启用/禁用
			scheduledTaskRoutes.POST("/:id/trigger", scheduledTaskHandler.Trigger)     // 手动触发
		}

		// 任务执行历史路由（需要认证）
		taskExecutionRoutes := v1.Group("/task-executions")
		taskExecutionRoutes.Use(middleware.RequireCapability(runtimeInfo, platform.CapabilityAutomation))
		taskExecutionRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo, runtimeInfo))
		{
			taskExecutionRoutes.GET("", taskExecutionHandler.List)                     // 执行历史列表
			taskExecutionRoutes.GET("/statistics", taskExecutionHandler.GetStatistics) // 统计信息
			taskExecutionRoutes.GET("/:id", taskExecutionHandler.GetByID)              // 执行详情
			taskExecutionRoutes.GET("/:id/results", taskExecutionHandler.GetResults)   // 服务器执行结果
		}

		// SSH会话路由（需要认证）
		sshSessionRoutes := v1.Group("/ssh-sessions")
		sshSessionRoutes.Use(middleware.RequireCapability(runtimeInfo, platform.CapabilityTerminal))
		sshSessionRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo, runtimeInfo))
		{
			sshSessionRoutes.GET("", sshSessionHandler.List)                     // 会话列表
			sshSessionRoutes.DELETE("", sshSessionHandler.CleanupOldHistory)     // 清理旧会话记录
			sshSessionRoutes.GET("/statistics", sshSessionHandler.GetStatistics) // 统计信息
			sshSessionRoutes.GET("/:id", sshSessionHandler.GetByID)              // 会话详情
			sshSessionRoutes.DELETE("/:id", sshSessionHandler.Delete)            // 删除会话
			sshSessionRoutes.POST("/:id/close", sshSessionHandler.Close)         // 关闭会话
		}

		// 文件传输路由（需要认证）
		fileTransferRoutes := v1.Group("/file-transfers")
		fileTransferRoutes.Use(middleware.RequireCapability(runtimeInfo, platform.CapabilityTransfers))
		fileTransferRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo, runtimeInfo))
		{
			fileTransferRoutes.GET("", fileTransferHandler.List)                     // 传输列表
			fileTransferRoutes.POST("", fileTransferHandler.Create)                  // 创建传输记录
			fileTransferRoutes.GET("/statistics", fileTransferHandler.GetStatistics) // 统计信息
			fileTransferRoutes.GET("/:id", fileTransferHandler.GetByID)              // 传输详情
			fileTransferRoutes.PUT("/:id", fileTransferHandler.Update)               // 更新传输记录
			fileTransferRoutes.DELETE("/:id", fileTransferHandler.Delete)            // 删除传输记录
		}

		// 系统设置路由（需要认证）
		settingsGroup := v1.Group("/settings")
		settingsGroup.Use(middleware.RequireCapability(runtimeInfo, platform.CapabilitySettings))
		settingsGroup.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo, runtimeInfo))
		settingsGroup.Use(middleware.RequirePermission(permissionService, "system:settings"))
		{
			// 系统配置
			settingsGroup.GET("/system", systemConfigHandler.GetSystemConfig)
			settingsGroup.POST("/system", systemConfigHandler.SaveSystemConfig)
			// 系统配置 - 分组部分更新
			settingsGroup.PATCH("/system/basic", systemConfigHandler.PatchBasicInfo)
			settingsGroup.PATCH("/system/file-transfer", systemConfigHandler.PatchFileTransferConfig)
			settingsGroup.PATCH("/system/completion", systemConfigHandler.PatchCompletionConfig)
			settingsGroup.PATCH("/system/jwt-session", systemConfigHandler.PatchJWTSessionConfig)

			// 安全配置
			settingsGroup.GET("/security", securityHandler.GetSecurityConfig)
			settingsGroup.POST("/security", securityHandler.SaveSecurityConfig)

			// 标签/会话配置
			settingsGroup.GET("/tabsession", securityHandler.GetTabSessionConfig)
			settingsGroup.POST("/tabsession", securityHandler.SaveTabSessionConfig)

			// IP访问控制配置
			settingsGroup.GET("/access-control", middleware.RequireCapability(runtimeInfo, platform.CapabilitySecurityPolicy), securityHandler.GetAccessControlConfig)
			settingsGroup.POST("/access-control", middleware.RequireCapability(runtimeInfo, platform.CapabilitySecurityPolicy), securityHandler.SaveAccessControlConfig)

			// 通知配置 - 统一接口
			settingsGroup.GET("/notifications", middleware.RequireCapability(runtimeInfo, platform.CapabilityNotifications), notificationConfigHandler.GetAllNotificationConfig)
			settingsGroup.POST("/notifications", middleware.RequireCapability(runtimeInfo, platform.CapabilityNotifications), notificationConfigHandler.SaveAllNotificationConfig)

			// 通知配置 - SMTP
			settingsGroup.GET("/smtp", middleware.RequireCapability(runtimeInfo, platform.CapabilityNotifications), notificationConfigHandler.GetSMTPConfig)
			settingsGroup.POST("/smtp", middleware.RequireCapability(runtimeInfo, platform.CapabilityNotifications), notificationConfigHandler.SaveSMTPConfig)
			settingsGroup.POST("/smtp/test", middleware.RequireCapability(runtimeInfo, platform.CapabilityNotifications), notificationConfigHandler.TestSMTPConnection)

			// 通知配置 - Webhook
			settingsGroup.GET("/webhook", middleware.RequireCapability(runtimeInfo, platform.CapabilityNotifications), notificationConfigHandler.GetWebhookConfig)
			settingsGroup.POST("/webhook", middleware.RequireCapability(runtimeInfo, platform.CapabilityNotifications), notificationConfigHandler.SaveWebhookConfig)
			settingsGroup.POST("/webhook/test", middleware.RequireCapability(runtimeInfo, platform.CapabilityNotifications), notificationConfigHandler.TestWebhookConnection)

			// 通知配置 - 钉钉
			settingsGroup.GET("/dingtalk", middleware.RequireCapability(runtimeInfo, platform.CapabilityNotifications), notificationConfigHandler.GetDingTalkConfig)
			settingsGroup.POST("/dingtalk", middleware.RequireCapability(runtimeInfo, platform.CapabilityNotifications), notificationConfigHandler.SaveDingTalkConfig)
			settingsGroup.POST("/dingtalk/test", middleware.RequireCapability(runtimeInfo, platform.CapabilityNotifications), notificationConfigHandler.TestDingTalkConnection)

			// 通知配置 - 企业微信
			settingsGroup.GET("/wecom", middleware.RequireCapability(runtimeInfo, platform.CapabilityNotifications), notificationConfigHandler.GetWeComConfig)
			settingsGroup.POST("/wecom", middleware.RequireCapability(runtimeInfo, platform.CapabilityNotifications), notificationConfigHandler.SaveWeComConfig)
			settingsGroup.POST("/wecom/test", middleware.RequireCapability(runtimeInfo, platform.CapabilityNotifications), notificationConfigHandler.TestWeComConnection)

			// 高级配置路由组
			advancedGroup := settingsGroup.Group("/advanced")
			advancedGroup.Use(middleware.RequireCapability(runtimeInfo, platform.CapabilitySecurityPolicy))
			{
				// CORS 配置
				advancedGroup.GET("/cors", securityHandler.GetCORSConfig)
				advancedGroup.POST("/cors", securityHandler.SaveCORSConfig)

				// 速率限制配置
				advancedGroup.GET("/ratelimit", securityHandler.GetRateLimitConfig)
				advancedGroup.POST("/ratelimit", securityHandler.SaveRateLimitConfig)

				// Cookie 配置
				advancedGroup.GET("/cookie", securityHandler.GetCookieConfig)
				advancedGroup.POST("/cookie", securityHandler.SaveCookieConfig)
			}

			// AI配置
			aiGroup := settingsGroup.Group("/ai")
			{
				aiGroup.GET("/system", aiConfigHandler.GetSystemAIConfig)
				aiGroup.POST("/system", aiConfigHandler.SaveSystemAIConfig)
				aiGroup.POST("/system/models", aiConfigHandler.ProbeSystemAIModels)
			}
		}

		// AI聊天路由（需要认证）
		aiChatRoutes := v1.Group("/ai")
		aiChatRoutes.Use(middleware.RequireCapability(runtimeInfo, platform.CapabilityAI))
		aiChatRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo, runtimeInfo))
		{
			aiChatRoutes.GET("/config", aiRuntimeConfigHandler.GetConfig)
			aiChatRoutes.GET("/sessions", aiSessionHandler.ListSessions)
			aiChatRoutes.GET("/sessions/latest", aiSessionHandler.GetLatestSession)
			aiChatRoutes.POST("/sessions", aiSessionHandler.CreateSession)
			aiChatRoutes.GET("/sessions/:session_id", aiSessionHandler.GetSession)
			aiChatRoutes.PATCH("/sessions/:session_id", aiSessionHandler.RenameSession)
			aiChatRoutes.POST("/sessions/:session_id/messages", aiSessionHandler.SendMessage)
			aiChatRoutes.POST("/sessions/:session_id/cancel", aiSessionHandler.CancelSession)
			aiChatRoutes.GET("/sessions/:session_id/events", aiSessionHandler.StreamEvents)
			aiChatRoutes.POST("/sessions/:session_id/tasks/:task_id/confirm", aiSessionHandler.ConfirmTask)
			aiChatRoutes.DELETE("/sessions/:session_id", aiSessionHandler.DeleteSession)
			aiChatRoutes.GET("/sessions/:session_id/ws", aiSessionWSHandler.HandleSession)
		}

		// 备份恢复路由（需要认证）
		backupRoutes := v1.Group("/backup")
		backupRoutes.Use(middleware.RequireCapability(runtimeInfo, platform.CapabilityBackup))
		backupRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo, runtimeInfo))
		{
			backupRoutes.GET("/export", backupHandler.ExportBackup)             // 导出统一备份
			backupRoutes.POST("/restore", backupHandler.RestoreBackup)          // 恢复统一备份
			backupRoutes.GET("/export-config", backupHandler.ExportConfig)      // 导出配置
			backupRoutes.POST("/import-config", backupHandler.ImportConfig)     // 导入配置
			backupRoutes.GET("/export-database", backupHandler.ExportDatabase)  // 导出数据库
			backupRoutes.POST("/import-database", backupHandler.ImportDatabase) // 导入数据库
		}

		// SSH密钥路由（需要认证）
		sshKeyRoutes := v1.Group("/ssh-keys")
		sshKeyRoutes.Use(middleware.RequireCapability(runtimeInfo, platform.CapabilityTerminal))
		sshKeyRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo, runtimeInfo))
		{
			sshKeyRoutes.GET("", sshKeyHandler.GetSSHKeys)               // 获取密钥列表
			sshKeyRoutes.POST("/generate", sshKeyHandler.GenerateSSHKey) // 生成密钥
			sshKeyRoutes.POST("/import", sshKeyHandler.ImportSSHKey)     // 导入密钥
			sshKeyRoutes.DELETE("/:id", sshKeyHandler.DeleteSSHKey)      // 删除密钥
		}

		// 头像生成路由（需要认证）
		avatarRoutes := v1.Group("/avatar")
		avatarRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo, runtimeInfo))
		{
			avatarRoutes.POST("/generate", avatarHandler.GenerateAvatar) // 生成头像
		}

		// 桌面本地数据目录路由（需要认证，仅 desktop profile 可用）
		desktopRoutes := v1.Group("/desktop")
		desktopRoutes.Use(middleware.RequireCapability(runtimeInfo, platform.CapabilityDesktopDataDir))
		desktopRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo, runtimeInfo))
		{
			desktopRoutes.GET("/data-dir", desktopHandler.GetDataDir)
			desktopRoutes.POST("/open-data-dir", middleware.RequireCapability(runtimeInfo, platform.CapabilityOpenDataDir), desktopHandler.OpenDataDir)
			desktopRoutes.POST("/reset-data", desktopHandler.ScheduleResetData)
		}
	}

	registerStaticRoutes(r, opts.StaticFS, staticDir)

	// 创建 HTTP 服务器
	listenHost := strings.TrimSpace(opts.ListenHost)
	addr := net.JoinHostPort(listenHost, fmt.Sprintf("%d", cfg.Server.Port))
	srv := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  60 * time.Second,  // 读取请求超时
		WriteTimeout: 300 * time.Second, // 写入响应超时（5分钟，用于长时间操作如删除大目录）
		IdleTimeout:  120 * time.Second, // 空闲连接超时
	}

	return &Runtime{
		cfg:                   cfg,
		database:              database,
		srv:                   srv,
		addr:                  addr,
		listenAddr:            addr,
		runtimeInfo:           runtimeInfo,
		taskScheduler:         taskScheduler,
		trashCleaner:          trashCleaner,
		sftpHandler:           sftpHandler,
		monitorConnectionPool: monitorConnectionPool,
	}, nil
}

func (rt *Runtime) Start() error {
	listener, err := net.Listen("tcp", rt.listenAddr)
	if err != nil {
		return fmt.Errorf("failed to listen on %s: %w", rt.listenAddr, err)
	}
	rt.addr = listener.Addr().String()

	go func() {
		log.Printf("🚀 Server starting on http://%s", rt.addr)
		log.Printf("📝 Environment: %s", rt.cfg.Server.Env)
		log.Printf("🔗 Health check: http://%s/api/v1/health", rt.addr)

		if err := rt.srv.Serve(listener); err != nil && err != http.ErrServerClosed {
			log.Printf("❌ Failed to start server: %v", err)
		}
	}()

	return nil
}

func (rt *Runtime) URL() string {
	return "http://" + rt.addr
}

func (rt *Runtime) Shutdown(ctx context.Context) error {
	var shutdownErr error
	rt.shutdownOnce.Do(func() {
		log.Println("🛑 Shutting down server...")

		if rt.taskScheduler != nil {
			rt.taskScheduler.Stop()
			log.Println("✅ Task scheduler stopped")
		}

		if rt.trashCleaner != nil {
			rt.trashCleaner.Stop()
			log.Println("✅ Trash cleaner stopped")
		}

		if rt.sftpHandler != nil {
			rt.sftpHandler.Close()
			log.Println("✅ SFTP connection pool closed")
		}

		if rt.monitorConnectionPool != nil {
			rt.monitorConnectionPool.Close()
			log.Println("✅ Monitor connection pool closed")
		}

		if rt.srv != nil {
			shutdownErr = rt.srv.Shutdown(ctx)
		}

		if rt.database != nil {
			db.Close(rt.database)
			log.Println("✅ Database connection closed")
		}

		if shutdownErr == nil {
			log.Println("✅ Server exited properly")
		}
	})

	return shutdownErr
}
