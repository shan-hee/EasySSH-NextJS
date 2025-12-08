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
	"github.com/easyssh/server/internal/domain/scheduledtask"
	"github.com/easyssh/server/internal/domain/script"
	"github.com/easyssh/server/internal/domain/taskexecution"
	"github.com/easyssh/server/internal/domain/taskexecutor"
	"github.com/easyssh/server/internal/domain/taskscheduler"
	"github.com/easyssh/server/internal/domain/security"
	"github.com/easyssh/server/internal/domain/server"
	"github.com/easyssh/server/internal/domain/ssh"
	"github.com/easyssh/server/internal/domain/sshhostkey"
	"github.com/easyssh/server/internal/domain/sshkey"
	"github.com/easyssh/server/internal/domain/sshsession"
	"github.com/easyssh/server/internal/domain/systemconfig"
	"github.com/easyssh/server/internal/domain/user"
	"github.com/easyssh/server/internal/domain/useraiconfig"
	"github.com/easyssh/server/internal/domain/verification"
	"github.com/easyssh/server/internal/infra/cache"
	"github.com/easyssh/server/internal/infra/config"
	"github.com/easyssh/server/internal/infra/db"
	"github.com/easyssh/server/internal/pkg/crypto"
	"github.com/easyssh/server/internal/pkg/geoip"
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

	// 初始化数据库
	database, err := db.NewPostgresDB(&cfg.Database)
	if err != nil {
		log.Fatalf("❌ Failed to connect to database: %v", err)
	}
	defer db.Close(database)

	// 初始化 Redis
	redisClient, err := cache.NewRedisClient(&cfg.Redis)
	if err != nil {
		log.Fatalf("❌ Failed to connect to Redis: %v", err)
	}
	defer redisClient.Close()

	// 初始化 GeoIP 客户端并设置 Redis 缓存
	geoip.SetRedisClient(redisClient)
	log.Println("✅ GeoIP client initialized with Redis cache")

	// 数据库迁移（自动迁移）
	if err := database.AutoMigrate(
		&auth.User{},
		&auth.Session{},          // 用户会话表
		// Authorization Code 已迁移到 Redis，不再需要数据库表
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
	); err != nil {
		log.Fatalf("❌ Failed to migrate database: %v", err)
	}
	log.Println("✅ Database migrated successfully")

	// 初始化服务层
	// JWT 服务
	accessTokenDuration := time.Duration(cfg.JWT.AccessExpireMinutes) * time.Minute
	refreshIdleDuration := time.Duration(cfg.JWT.RefreshIdleExpireDays) * 24 * time.Hour
	refreshAbsoluteDuration := time.Duration(cfg.JWT.RefreshAbsoluteExpireDays) * 24 * time.Hour

	jwtService := auth.NewJWTService(auth.JWTConfig{
		SecretKey:                     cfg.JWT.Secret,
		AccessTokenDuration:           accessTokenDuration,
		RefreshIdleExpireDuration:     refreshIdleDuration,
		RefreshAbsoluteExpireDuration: refreshAbsoluteDuration,
		RefreshRotate:                 cfg.JWT.RefreshRotate,
		RefreshReuseDetection:         cfg.JWT.RefreshReuseDetection,
	}, redisClient.GetClient())

	// 认证服务（会话过期时间与 JWT 刷新闲置过期时间保持一致）
	authRepo := auth.NewRepository(database)
	authService := auth.NewService(authRepo, jwtService, refreshIdleDuration, redisClient.GetClient())

	// 新的配置服务
	// 系统配置服务
	systemConfigRepo := systemconfig.NewRepository(database)
	systemConfigService := systemconfig.NewService(systemConfigRepo)

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

	// 验证码服务（需要 Redis）
	var verificationService verification.Service
	if redisClient != nil {
		verificationService = verification.NewService(redisClient.GetClient())
		log.Println("✅ Verification service initialized")
	} else {
		log.Println("⚠️  Warning: Verification service is disabled (Redis not available)")
	}

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

	// SSH密钥服务
	sshKeyRepo := sshkey.NewRepository(database)
	sshKeyService := sshkey.NewService(sshKeyRepo, cfg.Server.EncryptionKey)

	// SFTP 上传 WebSocket 处理器
	sftpUploadWSHandler := ws.NewSFTPUploadHandler(securityService)

	// SFTP 跨服务器传输 WebSocket 处理器
	sftpTransferWSHandler := ws.NewSFTPTransferHandler(
		serverService,
		serverRepo,
		encryptor,
		securityService,
		sshHostKeyService.GetHostKeyCallback(),
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
	sftpHandler := rest.NewSFTPHandler(serverService, serverRepo, encryptor, sftpUploadWSHandler, sshHostKeyService.GetHostKeyCallback())
	sftpHandler.SetTransferHandler(sftpTransferWSHandler) // 注入跨服务器传输处理器
	terminalHandler := ws.NewTerminalHandler(serverService, serverRepo, sessionManager, encryptor, sshSessionService, sshHostKeyService.GetHostKeyCallback(), securityService, completionService)
	monitorHandler := ws.NewMonitorHandler(monitorConnectionPool, securityService)
	auditLogHandler := rest.NewAuditLogHandler(auditLogService)
	monitoringHandler := rest.NewMonitoringHandler(monitoringService)
	scriptHandler := rest.NewScriptHandler(scriptService)
	batchTaskHandler := rest.NewBatchTaskHandler(batchTaskService)
	scheduledTaskHandler := rest.NewScheduledTaskHandler(scheduledTaskService)
	taskExecutionHandler := rest.NewTaskExecutionHandler(taskExecutionService)
	sshSessionHandler := rest.NewSSHSessionHandler(sshSessionService)
	fileTransferHandler := rest.NewFileTransferHandler(fileTransferService)
	userHandler := rest.NewUserHandler(userService)
	// 新的配置处理器
	securityHandler := rest.NewSecurityHandler(securityService)
	systemConfigHandler := rest.NewSystemConfigHandler(systemConfigService)
	notificationConfigHandler := rest.NewNotificationConfigHandler(notificationConfigService)
	aiConfigHandler := rest.NewAIConfigHandler(aiConfigService)
	userAIConfigHandler := rest.NewUserAIConfigHandler(userAIConfigService)
	// 其他处理器
	sshKeyHandler := rest.NewSSHKeyHandler(sshKeyService)
	avatarHandler := rest.NewAvatarHandler()
	backupHandler := rest.NewBackupHandler(
		database,
		cfg.Database.Host,
		fmt.Sprintf("%d", cfg.Database.Port),
		cfg.Database.DBName,
		cfg.Database.User,
		cfg.Database.Password,
	)

	// 创建 Gin 路由
	r := gin.New()

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
	r.Use(middleware.AuditLogMiddleware(auditLogService, nil))       // 审计日志（使用默认配置）
	r.Use(middleware.OptionalIPWhitelistMiddleware(securityService)) // IP 访问控制验证（可选）

	// OAuth 2.0 相关端点（Authorization Code + PKCE）
	oauth := r.Group("/oauth")
	{
		oauth.POST("/authorize", authHandler.OAuthAuthorize)
		oauth.POST("/token", authHandler.OAuthToken)
		// Google OAuth ID Token 验证（与 /api/v1/oauth/google/verify 保持一致，方便前端通过 /oauth 路径访问）
		oauth.POST("/google/verify", oauthHandler.GoogleVerify)
	}

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

			// 检查 Redis 连接
			redisStatus := "ok"
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			if err := redisClient.HealthCheck(ctx); err != nil {
				redisStatus = "error: " + err.Error()
			}

			c.JSON(http.StatusOK, gin.H{
				"status":  "ok",
				"service": "easyssh-api",
				"version": "1.0.0",
				"dependencies": gin.H{
					"database": dbStatus,
					"redis":    redisStatus,
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
			authRoutes.GET("/status", middleware.OptionalAuth(jwtService), authHandler.CheckStatus) // 检查系统和认证状态
			// 初始化管理员接口应用速率限制（支持动态配置）
			authRoutes.POST("/initialize-admin", middleware.LoginRateLimitMiddleware(securityService), authHandler.InitializeAdmin)
			authRoutes.POST("/2fa/verify", authHandler.Verify2FACode) // 验证 2FA 代码（登录时）
		}

		// OAuth 路由（公开）
		oauthRoutes := v1.Group("/oauth")
		{
			oauthRoutes.POST("/google/verify", oauthHandler.GoogleVerify) // 验证 Google ID Token
		}

		// 用户路由（需要认证）
		userRoutes := v1.Group("/users")
		userRoutes.Use(middleware.AuthMiddleware(jwtService))
		{
			userRoutes.GET("/me", authHandler.GetCurrentUser)
			userRoutes.PUT("/me", authHandler.UpdateProfile)
			userRoutes.PUT("/me/password", authHandler.ChangePassword)

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

			// 用户AI配置路由
			userRoutes.GET("/me/ai-config", userAIConfigHandler.GetUserAIConfig)       // 获取用户AI配置
			userRoutes.PUT("/me/ai-config", userAIConfigHandler.SaveUserAIConfig)      // 保存用户AI配置
			userRoutes.DELETE("/me/ai-config", userAIConfigHandler.DeleteUserAIConfig) // 删除用户AI配置
		}

		// 用户管理路由（需要认证）
		userManagementRoutes := v1.Group("/users")
		userManagementRoutes.Use(middleware.AuthMiddleware(jwtService))
		{
			userManagementRoutes.GET("", userHandler.ListUsers)                    // 获取用户列表
			userManagementRoutes.GET("/statistics", userHandler.GetStatistics)     // 获取统计信息
			userManagementRoutes.GET("/:id", userHandler.GetUser)                  // 获取用户详情
			userManagementRoutes.POST("", userHandler.CreateUser)                  // 创建用户
			userManagementRoutes.PUT("/:id", userHandler.UpdateUser)               // 更新用户
			userManagementRoutes.DELETE("/:id", userHandler.DeleteUser)            // 删除用户
			userManagementRoutes.POST("/:id/password", userHandler.ChangePassword) // 修改密码
		}

		// 服务器路由（需要认证）
		serverRoutes := v1.Group("/servers")
		serverRoutes.Use(middleware.AuthMiddleware(jwtService))
		{
			serverRoutes.GET("", serverHandler.List)                     // 列表
			serverRoutes.POST("", serverHandler.Create)                  // 创建
			serverRoutes.GET("/statistics", serverHandler.GetStatistics) // 统计
			serverRoutes.PATCH("/reorder", serverHandler.Reorder)        // 批量更新排序
			serverRoutes.GET("/:id", serverHandler.GetByID)              // 详情
			serverRoutes.PUT("/:id", serverHandler.Update)               // 更新
			serverRoutes.DELETE("/:id", serverHandler.Delete)            // 删除
		}

		// SSH 路由（需要认证）
		sshRoutes := v1.Group("/ssh")
		sshRoutes.Use(middleware.AuthMiddleware(jwtService))
		{
			// WebSocket 终端
			sshRoutes.GET("/terminal/:server_id", terminalHandler.HandleSSH)

			// 会话管理 REST API
			sshRoutes.GET("/sessions", sshHandler.ListSessions)        // 会话列表
			sshRoutes.GET("/sessions/:id", sshHandler.GetSession)      // 会话详情
			sshRoutes.DELETE("/sessions/:id", sshHandler.CloseSession) // 关闭会话
			sshRoutes.GET("/statistics", sshHandler.GetStatistics)     // 统计信息
		}

		// 监控 WebSocket 路由（需要认证）
		monitorRoutes := v1.Group("/monitor")
		monitorRoutes.Use(middleware.AuthMiddleware(jwtService))
		{
			// WebSocket 实时监控 - 使用 server_id 查找活跃会话
			monitorRoutes.GET("/server/:server_id", monitorHandler.HandleMonitor) // 实时监控 WebSocket
		}

		// SFTP 路由（需要认证）
		sftpRoutes := v1.Group("/sftp/:server_id")
		sftpRoutes.Use(middleware.AuthMiddleware(jwtService))
		{
			// 文件浏览
			sftpRoutes.GET("/list", sftpHandler.ListDirectory)      // 列出目录
			sftpRoutes.GET("/stat", sftpHandler.GetFileInfo)        // 文件信息
			sftpRoutes.GET("/disk-usage", sftpHandler.GetDiskUsage) // 磁盘使用

			// 文件传输
			sftpRoutes.POST("/upload", sftpHandler.UploadFile)    // 上传文件
			sftpRoutes.GET("/download", sftpHandler.DownloadFile) // 下载文件

			// 文件操作
			sftpRoutes.POST("/mkdir", sftpHandler.CreateDirectory) // 创建目录
			sftpRoutes.DELETE("/delete", sftpHandler.Delete)       // 删除
			sftpRoutes.POST("/rename", sftpHandler.Rename)         // 重命名
			sftpRoutes.POST("/chmod", sftpHandler.Chmod)           // 修改权限

			// 批量操作
			sftpRoutes.POST("/batch-delete", sftpHandler.BatchDelete)     // 批量删除
			sftpRoutes.POST("/batch-download", sftpHandler.BatchDownload) // 批量下载

			// 文件内容
			sftpRoutes.GET("/read", sftpHandler.ReadFile)    // 读取文件
			sftpRoutes.POST("/write", sftpHandler.WriteFile) // 写入文件
		}

		// SFTP 上传进度 WebSocket 路由（需要认证）
		sftpWSRoutes := v1.Group("/sftp/upload/ws")
		sftpWSRoutes.Use(middleware.AuthMiddleware(jwtService))
		{
			sftpWSRoutes.GET("/:task_id", sftpUploadWSHandler.HandleUploadWebSocket) // 上传进度 WebSocket
		}

		// SFTP 跨服务器传输路由（需要认证）
		sftpTransferRoutes := v1.Group("/sftp")
		sftpTransferRoutes.Use(middleware.AuthMiddleware(jwtService))
		{
			sftpTransferRoutes.POST("/transfer", sftpHandler.Transfer)              // 跨服务器文件传输（流式中转）
			sftpTransferRoutes.POST("/transfer/direct", sftpHandler.DirectTransfer) // 跨服务器直连传输（rsync/scp）
			sftpTransferRoutes.POST("/transfer/:task_id/cancel", sftpHandler.CancelTransfer) // 取消传输任务
		}

		// SFTP 跨服务器传输进度 WebSocket 路由（需要认证）
		sftpTransferWSRoutes := v1.Group("/sftp/transfer/ws")
		sftpTransferWSRoutes.Use(middleware.AuthMiddleware(jwtService))
		{
			sftpTransferWSRoutes.GET("/:task_id", sftpTransferWSHandler.HandleTransferWebSocket) // 传输进度 WebSocket
		}

		// 监控路由（需要认证）
		monitoringRoutes := v1.Group("/monitoring")
		monitoringRoutes.Use(middleware.AuthMiddleware(jwtService))
		{
			monitoringRoutes.GET("/resources", monitoringHandler.GetAllResources)        // 所有服务器资源概览
			monitoringRoutes.GET("/resources/stream", monitoringHandler.StreamResources) // 流式获取服务器资源（SSE）
		}

		// 审计日志路由（需要认证）
		auditLogRoutes := v1.Group("/audit-logs")
		auditLogRoutes.Use(middleware.AuthMiddleware(jwtService))
		{
			auditLogRoutes.GET("", auditLogHandler.List)                      // 查询日志列表
			auditLogRoutes.GET("/me", auditLogHandler.GetMyLogs)              // 我的日志
			auditLogRoutes.GET("/statistics", auditLogHandler.GetStatistics)  // 统计信息
			auditLogRoutes.GET("/:id", auditLogHandler.GetByID)               // 日志详情
			auditLogRoutes.DELETE("/cleanup", auditLogHandler.CleanupOldLogs) // 清理旧日志（管理员）
		}

		// 脚本管理路由（需要认证）
		scriptRoutes := v1.Group("/scripts")
		scriptRoutes.Use(middleware.AuthMiddleware(jwtService))
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
		batchTaskRoutes.Use(middleware.AuthMiddleware(jwtService))
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
		scheduledTaskRoutes.Use(middleware.AuthMiddleware(jwtService))
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
		taskExecutionRoutes.Use(middleware.AuthMiddleware(jwtService))
		{
			taskExecutionRoutes.GET("", taskExecutionHandler.List)                     // 执行历史列表
			taskExecutionRoutes.GET("/statistics", taskExecutionHandler.GetStatistics) // 统计信息
			taskExecutionRoutes.GET("/:id", taskExecutionHandler.GetByID)              // 执行详情
			taskExecutionRoutes.GET("/:id/results", taskExecutionHandler.GetResults)   // 服务器执行结果
		}

		// SSH会话路由（需要认证）
		sshSessionRoutes := v1.Group("/ssh-sessions")
		sshSessionRoutes.Use(middleware.AuthMiddleware(jwtService))
		{
			sshSessionRoutes.GET("", sshSessionHandler.List)                     // 会话列表
			sshSessionRoutes.GET("/statistics", sshSessionHandler.GetStatistics) // 统计信息
			sshSessionRoutes.GET("/:id", sshSessionHandler.GetByID)              // 会话详情
			sshSessionRoutes.DELETE("/:id", sshSessionHandler.Delete)            // 删除会话
			sshSessionRoutes.POST("/:id/close", sshSessionHandler.Close)         // 关闭会话
		}

		// 文件传输路由（需要认证）
		fileTransferRoutes := v1.Group("/file-transfers")
		fileTransferRoutes.Use(middleware.AuthMiddleware(jwtService))
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
		settingsGroup.Use(middleware.AuthMiddleware(jwtService))
		{
			// 系统配置
			settingsGroup.GET("/system", systemConfigHandler.GetSystemConfig)
			settingsGroup.POST("/system", systemConfigHandler.SaveSystemConfig)
			// 系统配置 - 分组部分更新
			settingsGroup.PATCH("/system/basic", systemConfigHandler.PatchBasicInfo)
			settingsGroup.PATCH("/system/file-transfer", systemConfigHandler.PatchFileTransferConfig)
			settingsGroup.PATCH("/system/completion", systemConfigHandler.PatchCompletionConfig)

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
			}
		}

		// 备份恢复路由（需要认证）
		backupRoutes := v1.Group("/backup")
		backupRoutes.Use(middleware.AuthMiddleware(jwtService))
		{
			backupRoutes.GET("/export-config", backupHandler.ExportConfig)       // 导出配置
			backupRoutes.POST("/import-config", backupHandler.ImportConfig)      // 导入配置
			backupRoutes.GET("/export-database", backupHandler.ExportDatabase)   // 导出数据库
			backupRoutes.POST("/import-database", backupHandler.ImportDatabase)  // 导入数据库
		}

		// SSH密钥路由（需要认证）
		sshKeyRoutes := v1.Group("/ssh-keys")
		sshKeyRoutes.Use(middleware.AuthMiddleware(jwtService))
		{
			sshKeyRoutes.GET("", sshKeyHandler.GetSSHKeys)               // 获取密钥列表
			sshKeyRoutes.POST("/generate", sshKeyHandler.GenerateSSHKey) // 生成密钥
			sshKeyRoutes.POST("/import", sshKeyHandler.ImportSSHKey)     // 导入密钥
			sshKeyRoutes.DELETE("/:id", sshKeyHandler.DeleteSSHKey)      // 删除密钥
		}

		// 头像生成路由（需要认证）
		avatarRoutes := v1.Group("/avatar")
		avatarRoutes.Use(middleware.AuthMiddleware(jwtService))
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

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("❌ Server forced to shutdown:", err)
	}

	log.Println("✅ Server exited properly")
}
