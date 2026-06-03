package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path"
	"path/filepath"
	"strings"
	"syscall"
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
	"github.com/easyssh/server/internal/domain/dashboard"
	"github.com/easyssh/server/internal/domain/monitor"
	"github.com/easyssh/server/internal/domain/monitoring"
	"github.com/easyssh/server/internal/domain/notification"
	"github.com/easyssh/server/internal/domain/notificationconfig"
	"github.com/easyssh/server/internal/domain/operationrecord"
	"github.com/easyssh/server/internal/domain/permission"
	"github.com/easyssh/server/internal/domain/scheduledtask"
	"github.com/easyssh/server/internal/domain/script"
	"github.com/easyssh/server/internal/domain/security"
	"github.com/easyssh/server/internal/domain/server"
	"github.com/easyssh/server/internal/domain/sftp"
	"github.com/easyssh/server/internal/domain/ssh"
	"github.com/easyssh/server/internal/domain/sshhostkey"
	"github.com/easyssh/server/internal/domain/sshkey"
	"github.com/easyssh/server/internal/domain/systemconfig"
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
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// 加载根目录的 .env 文件
	if err := godotenv.Load("../.env"); err != nil {
		log.Printf("⚠️ Warning: .env file not found, using environment variables")
	}

	// 加载配置
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("❌ Failed to load config: %v", err)
	}

	// 设置 Gin 模式
	if cfg.Server.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	runtimeInfo := platform.NewRuntimeInfo(platform.RuntimeOptions{
		Profile: platform.ProfileFromEnvironment(),
		DataDir: runtimeDataDir(cfg.Database.Driver, cfg.Database.DSN),
		Version: readAppVersion(),
	})

	// 初始化数据库
	database, err := db.NewDB(&cfg.Database)
	if err != nil {
		log.Fatalf("❌ Failed to connect to database: %v", err)
	}
	defer db.Close(database)

	log.Println("✅ GeoIP client initialized with in-memory cache")

	// 数据库迁移（自动迁移）
	if err := database.AutoMigrate(
		&auth.User{},
		&auth.Session{}, // 用户会话表
		&server.Server{},
		&auditlog.AuditLog{},
		&script.Script{},                   // 脚本表
		&batchtask.BatchTask{},             // 批量任务表
		&scheduledtask.ScheduledTask{},     // 定时任务表
		&operationrecord.OperationRecord{}, // 统一操作记录表
		// 新的配置表
		&systemconfig.SystemConfig{},             // 系统配置表
		&security.SecurityConfig{},               // 安全配置表
		&notificationconfig.NotificationConfig{}, // 通知配置表
		&aiconfig.AIConfig{},                     // AI配置表
		&useraiconfig.UserAIConfig{},             // 用户AI配置表
		// 其他表
		&sshkey.SSHKey{},         // SSH密钥表
		&sshhostkey.SSHHostKey{}, // SSH主机密钥表（TOFU安全验证）
		// 安全增强相关表
		&auth.LoginAttempt{},       // 登录尝试记录表
		&auth.TrustedDevice{},      // 可信设备表
		&auth.LoginAlert{},         // 登录告警表
		&auth.RSAKeyPair{},         // RSA 密钥对表
		&permission.Permission{},   // 权限定义表
		&runtime.AISessionRecord{}, // AI 会话持久化表
	); err != nil {
		log.Fatalf("❌ Failed to migrate database: %v", err)
	}
	log.Println("✅ Database migrated successfully")

	// 系统配置服务（JWT_SECRET 仍来自 .env，其余 JWT 过期/刷新配置来自系统设置）
	systemConfigRepo := systemconfig.NewRepository(database)
	systemConfigService := systemconfig.NewService(systemConfigRepo)
	systemCfg, err := systemConfigService.Get(context.Background())
	if err != nil {
		log.Fatalf("❌ Failed to load system config: %v", err)
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
		log.Fatalf("❌ Failed to create encryptor: %v", err)
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
	defer monitorConnectionPool.Close() // 程序退出时关闭连接池

	// 审计日志服务
	auditLogRepo := auditlog.NewRepository(database)
	auditLogService := auditlog.NewService(auditLogRepo)

	// 仪表盘聚合服务
	dashboardRepo := dashboard.NewRepository(database)
	dashboardService := dashboard.NewService(dashboardRepo)

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

	// 统一操作记录服务
	operationRecordRepo := operationrecord.NewRepository(database)
	operationRecordService := operationrecord.NewService(operationRecordRepo)

	// 任务执行引擎
	taskExecutor := taskexecutor.NewExecutor(
		serverService,
		scriptService,
		scheduledTaskRepo,
		encryptor,
		10, // 最大并发数
		operationRecordService,
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
		operationRecordService,
	)

	// 令牌有效期（秒），用于 Cookie 和 API 响应
	accessTokenTTLSeconds := int(accessTokenDuration.Seconds())
	refreshTokenTTLSeconds := int(refreshIdleDuration.Seconds())

	// 初始化处理器
	authHandler := rest.NewAuthHandler(
		authService,
		jwtService,
		securityService,
		accessTokenTTLSeconds,
		refreshTokenTTLSeconds,
		systemConfigService,
		verificationService,
		emailService,
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
	sftpPoolConfig := &sftp.PoolConfig{
		MaxIdleTime:            time.Duration(cfg.SFTP.MaxIdleTimeSeconds) * time.Second,
		CleanupInterval:        time.Duration(cfg.SFTP.CleanupIntervalSeconds) * time.Second,
		MaxLifeTime:            time.Duration(cfg.SFTP.MaxLifeTimeMinutes) * time.Minute,
		ConnTimeout:            time.Duration(cfg.SFTP.ConnTimeoutSeconds) * time.Second,
		MaxSFTPSessionsPerConn: cfg.SFTP.MaxSFTPSessionsPerConn,
	}
	sftpHandler := rest.NewSFTPHandler(serverService, serverRepo, encryptor, sftpUploadWSHandler, sshHostKeyService.GetHostKeyCallback(), sftpPoolConfig, operationRecordService)
	sftpHandler.SetTransferHandler(sftpTransferWSHandler) // 注入跨服务器传输处理器

	terminalHandler := ws.NewTerminalHandler(serverService, serverRepo, sessionManager, encryptor, operationRecordService, sshHostKeyService, securityService, cfg.Server.WebDevPort, completionService, systemConfigService)
	monitorHandler := ws.NewMonitorHandler(monitorConnectionPool, securityService, cfg.Server.WebDevPort)
	auditLogHandler := rest.NewAuditLogHandler(auditLogService)
	dashboardHandler := rest.NewDashboardHandler(dashboardService)
	monitoringHandler := rest.NewMonitoringHandler(monitoringService, authService)
	ticketHandler := rest.NewTicketHandler(ticketService)
	scriptHandler := rest.NewScriptHandler(scriptService)
	batchTaskHandler := rest.NewBatchTaskHandler(batchTaskService)
	scheduledTaskHandler := rest.NewScheduledTaskHandler(scheduledTaskService)
	operationRecordHandler := rest.NewOperationRecordHandler(operationRecordService)
	userHandler := rest.NewUserHandler(userService, accountLockService)
	permissionHandler := rest.NewPermissionHandler(permissionService)
	// 新的配置处理器
	securityHandler := rest.NewSecurityHandler(securityService)
	securityHandler.SetSystemConfigService(systemConfigService)
	systemConfigHandler := rest.NewSystemConfigHandler(systemConfigService)
	notificationConfigHandler := rest.NewNotificationConfigHandler(notificationConfigService)
	aiConfigHandler := rest.NewAIConfigHandler(aiConfigService)
	userAIConfigHandler := rest.NewUserAIConfigHandler(userAIConfigService)
	aiRuntimeConfigHandler := rest.NewAIRuntimeConfigHandler(aichat.NewConfigResolver(aiConfigService, userAIConfigService))
	// AI 工具执行器和会话运行时
	aiToolExecutor := aichat.NewToolExecutorService(serverService, sftpHandler.GetPool(), encryptor)
	aiRuntimeManager := aichat.NewRuntimeManager(aiConfigService, userAIConfigService, aiToolExecutor)
	aiRuntimeManager.SetSessionStore(runtime.NewGormSessionStore(database))
	aiSessionHandler := rest.NewAISessionHandler(aiRuntimeManager)
	// Docker 处理器（复用监控连接池）
	dockerHandler := rest.NewDockerHandler(serverService, serverRepo, encryptor, sshHostKeyService.GetHostKeyCallback(), monitorConnectionPool)
	// 其他处理器
	sshKeyHandler := rest.NewSSHKeyHandler(sshKeyService)
	avatarHandler := rest.NewAvatarHandler()
	backupHandler := rest.NewBackupHandler(database)
	runtimeHandler := rest.NewRuntimeHandler(runtimeInfo)

	// 创建 Gin 路由
	r := gin.New()
	if err := r.SetTrustedProxies(cfg.Server.TrustedProxies); err != nil {
		log.Fatalf("❌ Failed to configure trusted proxies: %v", err)
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
	r.Use(middleware.Recovery())                                     // 错误恢复
	r.Use(middleware.Logger())                                       // 日志记录
	r.Use(middleware.RequestID())                                    // 请求 ID
	r.Use(middleware.SecurityHeaders())                              // 安全响应头
	r.Use(middleware.SecurityConfigCache(securityService))           // 安全配置缓存(避免重复查询)
	r.Use(middleware.CORS(cfg, securityService))                     // 跨域（支持动态配置）
	r.Use(middleware.CSRFMiddleware(cfg))                            // Cookie 凭证端点 CSRF 防护
	r.Use(middleware.AuditLogMiddleware(auditLogService, nil))       // 审计日志（使用默认配置）
	r.Use(middleware.OptionalIPWhitelistMiddleware(securityService)) // IP 访问控制验证（可选）

	// API v1 路由组
	v1 := r.Group("/api/v1")
	{
		v1.GET("/runtime", runtimeHandler.GetRuntime)

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
			authRoutes.POST("/send-verification-code", authHandler.SendVerificationCode)
			authRoutes.POST("/send-password-reset-code", authHandler.SendPasswordResetCode)
			authRoutes.POST("/reset-password", authHandler.ResetPassword)
			authRoutes.POST("/register", authHandler.Register)
			authRoutes.POST("/logout", authHandler.Logout)
			// 使用可选认证中间件，支持未登录和已登录状态
			authRoutes.GET("/status", middleware.OptionalAuth(jwtService, ticketService, authRepo), authHandler.CheckStatus) // 检查系统和认证状态
			authRoutes.GET("/csrf", authHandler.CSRFToken)                                                                   // 获取 CSRF token
			// 一次性 Ticket（需认证，用于 WS/下载握手）
			authRoutes.POST("/ticket", middleware.AuthMiddleware(jwtService, ticketService, authRepo), ticketHandler.CreateTicket)
			// 初始化管理员接口应用速率限制（支持动态配置）
			authRoutes.POST("/initialize-admin", middleware.LoginRateLimitMiddleware(securityService), authHandler.InitializeAdmin)
			authRoutes.POST("/2fa/verify", middleware.TwoFARateLimitMiddleware(securityService), authHandler.Verify2FACode) // 验证 2FA 代码（登录时）
		}

		// OAuth 路由（公开）
		oauthRoutes := v1.Group("/oauth")
		{
			// 与 /oauth 前缀下的端点保持一一对应，便于前端统一通过 /api/v1 调用
			oauthRoutes.POST("/authorize", middleware.LoginRateLimitMiddleware(securityService), authHandler.OAuthAuthorize) // 开发版 PKCE 授权码端点（含登录验证）
			oauthRoutes.POST("/token", authHandler.OAuthToken)                                                               // 交换/刷新 access_token
			oauthRoutes.POST("/logout", authHandler.Logout)                                                                  // 推荐登出端点（可携带 refresh_token Cookie）
			oauthRoutes.POST("/google/verify", oauthHandler.GoogleVerify)                                                    // 验证 Google ID Token
		}

		// 用户路由（需要认证）
		userRoutes := v1.Group("/users")
		userRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo))
		{
			userRoutes.GET("/me", authHandler.GetCurrentUser)
			userRoutes.PUT("/me", authHandler.UpdateProfile)
			userRoutes.PUT("/me/password", authHandler.ChangePassword)
			userRoutes.POST("/me/oauth/google/link", oauthHandler.GoogleLink)
			userRoutes.DELETE("/me/oauth/google/link", oauthHandler.GoogleUnlink)

			// 2FA 相关路由
			userRoutes.GET("/me/2fa/generate", authHandler.Generate2FASecret) // 生成 2FA secret
			userRoutes.POST("/me/2fa/enable", authHandler.Enable2FA)          // 启用 2FA
			userRoutes.POST("/me/2fa/disable", authHandler.Disable2FA)        // 禁用 2FA

			// 会话管理路由
			userRoutes.GET("/me/sessions", authHandler.ListSessions)                          // 获取活跃会话列表
			userRoutes.DELETE("/me/sessions/:session_id", authHandler.RevokeSession)          // 撤销指定会话
			userRoutes.POST("/me/sessions/revoke-others", authHandler.RevokeAllOtherSessions) // 撤销所有其他会话

			// 通知设置路由
			userRoutes.PUT("/me/notifications", authHandler.UpdateNotificationSettings) // 更新通知设置

			// 监控数据源设置路由
			userRoutes.PUT("/me/monitor-datasource", authHandler.UpdateMonitorDataSource) // 更新监控数据源设置

			// 用户AI配置路由
			userRoutes.GET("/me/ai-config", userAIConfigHandler.GetUserAIConfig)       // 获取用户AI配置
			userRoutes.PUT("/me/ai-config", userAIConfigHandler.SaveUserAIConfig)      // 保存用户AI配置
			userRoutes.DELETE("/me/ai-config", userAIConfigHandler.DeleteUserAIConfig) // 删除用户AI配置
		}

		// 用户管理路由（需要认证）
		userManagementRoutes := v1.Group("/users")
		userManagementRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo))
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
		permissionRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo))
		permissionRoutes.Use(middleware.RequirePermission(permissionService, "user:manage"))
		{
			permissionRoutes.GET("", permissionHandler.ListPermissions)         // 获取权限列表
			permissionRoutes.POST("", permissionHandler.CreatePermission)       // 创建权限
			permissionRoutes.PUT("/:id", permissionHandler.UpdatePermission)    // 更新权限
			permissionRoutes.DELETE("/:id", permissionHandler.DeletePermission) // 删除权限
		}

		// 服务器路由（需要认证）
		serverRoutes := v1.Group("/servers")
		serverRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo))
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
		sshRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo))
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
		dockerRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo))
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
		monitorRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo))
		{
			// WebSocket 实时监控 - 使用 server_id 查找活跃会话
			monitorRoutes.GET("/server/:server_id", monitorHandler.HandleMonitor) // 实时监控 WebSocket
		}

		// SFTP 路由（需要认证）
		sftpRoutes := v1.Group("/sftp/:server_id")
		sftpRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo))
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

			// 连接管理
			sftpRoutes.POST("/close", middleware.RequirePermission(permissionService, "file:view"), sftpHandler.CloseConnection) // 关闭连接（用户关闭 SFTP 面板时调用）
		}

		// SFTP 连接池统计路由（需要认证）
		sftpPoolRoutes := v1.Group("/sftp/pool")
		sftpPoolRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo))
		sftpPoolRoutes.Use(middleware.RequirePermission(permissionService, "file:view"))
		{
			sftpPoolRoutes.GET("/stats", sftpHandler.GetPoolStats) // 连接池统计
		}

		// SFTP 上传进度 WebSocket 路由（需要认证）
		sftpWSRoutes := v1.Group("/sftp/upload/ws")
		sftpWSRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo))
		sftpWSRoutes.Use(middleware.RequirePermission(permissionService, "file:manage"))
		{
			sftpWSRoutes.GET("/:task_id", sftpUploadWSHandler.HandleUploadWebSocket) // 上传进度 WebSocket
		}

		// SFTP 上传任务路由（需要认证）
		sftpUploadRoutes := v1.Group("/sftp/upload")
		sftpUploadRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo))
		sftpUploadRoutes.Use(middleware.RequirePermission(permissionService, "file:manage"))
		{
			sftpUploadRoutes.POST("/task", sftpHandler.CreateUploadTask)                  // 创建上传任务（服务端生成 task_id）
			sftpUploadRoutes.GET("/tasks", sftpHandler.ListUploadTasks)                   // 上传任务列表（内存运行态）
			sftpUploadRoutes.GET("/tasks/:task_id", sftpHandler.GetUploadTask)            // 上传任务详情（内存运行态）
			sftpUploadRoutes.POST("/tasks/:task_id/cancel", sftpHandler.CancelUploadTask) // 取消上传任务
		}

		// SFTP 跨服务器传输路由（需要认证）
		sftpTransferRoutes := v1.Group("/sftp")
		sftpTransferRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo))
		sftpTransferRoutes.Use(middleware.RequirePermission(permissionService, "file:manage"))
		{
			sftpTransferRoutes.POST("/transfer", sftpHandler.Transfer)                       // 跨服务器文件传输（流式中转）
			sftpTransferRoutes.POST("/transfer/direct", sftpHandler.DirectTransfer)          // 跨服务器直连传输（rsync/scp）
			sftpTransferRoutes.POST("/transfer/:task_id/cancel", sftpHandler.CancelTransfer) // 取消传输任务
		}

		// SFTP 跨服务器传输进度 WebSocket 路由（需要认证）
		sftpTransferWSRoutes := v1.Group("/sftp/transfer/ws")
		sftpTransferWSRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo))
		sftpTransferWSRoutes.Use(middleware.RequirePermission(permissionService, "file:manage"))
		{
			sftpTransferWSRoutes.GET("/:task_id", sftpTransferWSHandler.HandleTransferWebSocket) // 传输进度 WebSocket
		}

		// 监控路由（需要认证）
		monitoringRoutes := v1.Group("/monitoring")
		monitoringRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo))
		{
			monitoringRoutes.GET("/resources", monitoringHandler.GetAllResources)                 // 所有服务器资源概览
			monitoringRoutes.GET("/resources/stream", monitoringHandler.StreamResources)          // 流式获取服务器资源（SSE）
			monitoringRoutes.POST("/datasource/test", monitoringHandler.TestDataSourceConnection) // 测试数据源连接
		}

		// 仪表盘聚合路由（需要认证）
		dashboardRoutes := v1.Group("/dashboard")
		dashboardRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo))
		{
			dashboardRoutes.GET("/overview", dashboardHandler.GetOverview) // 仪表盘聚合概览
		}

		// 全部日志路由（团队治理，需要管理员审计权限）
		logRoutes := v1.Group("/logs")
		logRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo))
		logRoutes.Use(middleware.RequirePermission(permissionService, "audit:view"))
		{
			logRoutes.GET("", auditLogHandler.ListAll)
			logRoutes.GET("/statistics", auditLogHandler.GetAllStatistics)
			logRoutes.DELETE("/cleanup", auditLogHandler.CleanupOldLogs)
			logRoutes.GET("/:id", auditLogHandler.GetAnyByID)
		}

		// 统一操作记录路由：普通用户查看自己的记录，管理员可查看全局记录
		operationRecordRoutes := v1.Group("/operation-records")
		operationRecordRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo))
		{
			operationRecordRoutes.GET("", operationRecordHandler.List)
			operationRecordRoutes.GET("/statistics", operationRecordHandler.GetStatistics)
			operationRecordRoutes.GET("/:id", operationRecordHandler.GetByID)
		}

		// 脚本管理路由（需要认证）
		scriptRoutes := v1.Group("/scripts")
		scriptRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo))
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
		batchTaskRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo))
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
		scheduledTaskRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo))
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

		// 系统设置路由（需要认证）
		settingsGroup := v1.Group("/settings")
		settingsGroup.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo))
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
			settingsGroup.GET("/access-control", securityHandler.GetAccessControlConfig)
			settingsGroup.POST("/access-control", securityHandler.SaveAccessControlConfig)

			// 通知配置 - 统一接口
			settingsGroup.GET("/notifications", notificationConfigHandler.GetAllNotificationConfig)
			settingsGroup.POST("/notifications", notificationConfigHandler.SaveAllNotificationConfig)

			// 通知配置 - SMTP
			settingsGroup.GET("/smtp", notificationConfigHandler.GetSMTPConfig)
			settingsGroup.POST("/smtp", notificationConfigHandler.SaveSMTPConfig)
			settingsGroup.POST("/smtp/test", notificationConfigHandler.TestSMTPConnection)

			// 通知配置 - Webhook
			settingsGroup.GET("/webhook", notificationConfigHandler.GetWebhookConfig)
			settingsGroup.POST("/webhook", notificationConfigHandler.SaveWebhookConfig)
			settingsGroup.POST("/webhook/test", notificationConfigHandler.TestWebhookConnection)

			// 通知配置 - 钉钉
			settingsGroup.GET("/dingtalk", notificationConfigHandler.GetDingTalkConfig)
			settingsGroup.POST("/dingtalk", notificationConfigHandler.SaveDingTalkConfig)
			settingsGroup.POST("/dingtalk/test", notificationConfigHandler.TestDingTalkConnection)

			// 通知配置 - 企业微信
			settingsGroup.GET("/wecom", notificationConfigHandler.GetWeComConfig)
			settingsGroup.POST("/wecom", notificationConfigHandler.SaveWeComConfig)
			settingsGroup.POST("/wecom/test", notificationConfigHandler.TestWeComConnection)

			// 高级配置路由组
			advancedGroup := settingsGroup.Group("/advanced")
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
		aiChatRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo))
		{
			aiChatRoutes.GET("/config", aiRuntimeConfigHandler.GetConfig)
			aiChatRoutes.GET("/sessions", aiSessionHandler.ListSessions)
			aiChatRoutes.GET("/sessions/latest", aiSessionHandler.GetLatestSession)
			aiChatRoutes.POST("/sessions", aiSessionHandler.CreateSession)
			aiChatRoutes.GET("/sessions/:session_id", aiSessionHandler.GetSession)
			aiChatRoutes.PATCH("/sessions/:session_id", aiSessionHandler.RenameSession)
			aiChatRoutes.POST("/sessions/:session_id/chat", aiSessionHandler.Chat)
			aiChatRoutes.POST("/sessions/:session_id/cancel", aiSessionHandler.CancelSession)
			aiChatRoutes.DELETE("/sessions/:session_id", aiSessionHandler.DeleteSession)
		}

		// 备份恢复路由（需要认证）
		backupRoutes := v1.Group("/backup")
		backupRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo))
		{
			backupRoutes.GET("/export", backupHandler.ExportBackup)    // 导出统一备份
			backupRoutes.POST("/restore", backupHandler.RestoreBackup) // 恢复统一备份
		}

		// SSH密钥路由（需要认证）
		sshKeyRoutes := v1.Group("/ssh-keys")
		sshKeyRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo))
		{
			sshKeyRoutes.GET("", sshKeyHandler.GetSSHKeys)               // 获取密钥列表
			sshKeyRoutes.POST("/generate", sshKeyHandler.GenerateSSHKey) // 生成密钥
			sshKeyRoutes.POST("/import", sshKeyHandler.ImportSSHKey)     // 导入密钥
			sshKeyRoutes.DELETE("/:id", sshKeyHandler.DeleteSSHKey)      // 删除密钥
		}

		// 头像生成路由（需要认证）
		avatarRoutes := v1.Group("/avatar")
		avatarRoutes.Use(middleware.AuthMiddleware(jwtService, ticketService, authRepo))
		{
			avatarRoutes.POST("/generate", avatarHandler.GenerateAvatar) // 生成头像
		}
	}

	// 静态文件服务（托管前端构建产物）
	// 注意：必须在所有 API 路由之后注册
	staticDir := "./static"
	if _, err := os.Stat(staticDir); err == nil {
		log.Printf("✅ Serving static files from %s", staticDir)

		// 托管 Next.js 生成的静态资源（_next 等）
		r.Static("/_next", filepath.Join(staticDir, "_next"))
		r.StaticFile("/favicon.ico", filepath.Join(staticDir, "favicon.ico"))

		// 统一处理非 API 路由：
		// 1. 先尝试返回对应的静态文件（包括 /login、/login/index.txt 等）
		// 2. 如果不存在则回退到 index.html（SPA 前端接管路由）
		r.NoRoute(func(c *gin.Context) {
			requestPath := c.Request.URL.Path

			// API 请求返回 404
			if strings.HasPrefix(requestPath, "/api") {
				c.JSON(http.StatusNotFound, gin.H{"error": "not_found", "message": "API endpoint not found"})
				return
			}

			// 规范化路径，防止 ../ 等越界
			cleanPath := path.Clean(requestPath)
			if cleanPath == "/" || cleanPath == "." {
				c.File(filepath.Join(staticDir, "index.html"))
				return
			}

			// 去掉前导 /
			cleanPath = strings.TrimPrefix(cleanPath, "/")

			// 优先尝试直接文件
			filePath := filepath.Join(staticDir, cleanPath)
			if info, err := os.Stat(filePath); err == nil && !info.IsDir() {
				c.File(filePath)
				return
			}

			// 如果是目录，尝试目录下的 index.html（例如 /login -> /static/login/index.html）
			if info, err := os.Stat(filePath); err == nil && info.IsDir() {
				indexPath := filepath.Join(filePath, "index.html")
				if _, err := os.Stat(indexPath); err == nil {
					c.File(indexPath)
					return
				}
			}

			// 最终回退到根 index.html
			c.File(filepath.Join(staticDir, "index.html"))
		})
	} else {
		log.Printf("⚠️  Static directory not found: %s (frontend not built)", staticDir)
	}

	// 创建 HTTP 服务器
	addr := fmt.Sprintf(":%d", cfg.Server.Port)
	srv := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  60 * time.Second,  // 读取请求超时
		WriteTimeout: 300 * time.Second, // 写入响应超时（5分钟，用于长时间操作如删除大目录）
		IdleTimeout:  120 * time.Second, // 空闲连接超时
	}

	// 启动服务器（在 goroutine 中）
	go func() {
		log.Printf("🚀 Server starting on http://localhost%s", addr)
		log.Printf("📝 Environment: %s", cfg.Server.Env)
		log.Printf("🔗 Health check: http://localhost%s/api/v1/health", addr)

		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("❌ Failed to start server: %v", err)
		}
	}()

	// 优雅关闭
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("🛑 Shutting down server...")

	// 停止任务调度器
	taskScheduler.Stop()
	log.Println("✅ Task scheduler stopped")

	// 关闭 SFTP 连接池
	if sftpHandler != nil {
		sftpHandler.Close()
		log.Println("✅ SFTP connection pool closed")
	}

	// 关闭监控/SSH 连接池
	if monitorConnectionPool != nil {
		monitorConnectionPool.Close()
		log.Println("✅ Monitor connection pool closed")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("❌ Server forced to shutdown:", err)
	}

	log.Println("✅ Server exited properly")
}

func readAppVersion() string {
	candidates := []string{"../VERSION", "VERSION"}
	for _, candidate := range candidates {
		content, err := os.ReadFile(candidate)
		if err == nil {
			version := strings.TrimSpace(string(content))
			if version != "" {
				return version
			}
		}
	}
	return "dev"
}

func runtimeDataDir(driver string, dsn string) string {
	if strings.ToLower(strings.TrimSpace(driver)) != "sqlite" {
		return ""
	}

	pathValue := strings.TrimSpace(dsn)
	if pathValue == "" {
		return ""
	}

	if strings.HasPrefix(pathValue, "file:") {
		pathValue = strings.TrimPrefix(pathValue, "file:")
		if index := strings.Index(pathValue, "?"); index >= 0 {
			pathValue = pathValue[:index]
		}
	}

	if pathValue == "" || pathValue == ":memory:" {
		return ""
	}

	if absolutePath, err := filepath.Abs(pathValue); err == nil {
		pathValue = absolutePath
	}

	return filepath.Dir(pathValue)
}
