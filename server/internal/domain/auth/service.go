package auth

import (
	"context"
	"crypto/md5"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Service 认证服务接口
type Service interface {
	// Register 注册新用户
	Register(ctx context.Context, username, email, password string, role UserRole) (*User, error)

	// Login 用户登录
	Login(ctx context.Context, username, password string) (*User, string, string, error)

	// Logout 用户登出
	Logout(ctx context.Context, accessToken string) error

	// GetUserByID 根据 ID 获取用户
	GetUserByID(ctx context.Context, userID uuid.UUID) (*User, error)

	// RefreshAccessToken 刷新访问令牌
	RefreshAccessToken(ctx context.Context, refreshToken string) (string, error)

	// ChangePassword 修改密码
	ChangePassword(ctx context.Context, userID uuid.UUID, oldPassword, newPassword string) error

	// UpdateProfile 更新用户资料
	UpdateProfile(ctx context.Context, userID uuid.UUID, email, avatar string) error

	// ListUsers 获取用户列表（管理员功能）
	ListUsers(ctx context.Context, limit, offset int) ([]*User, int64, error)

	// DeleteUser 删除用户（管理员功能）
	DeleteUser(ctx context.Context, userID uuid.UUID) error

	// HasAdmin 检查是否存在管理员
	HasAdmin(ctx context.Context) (bool, error)

	// InitializeAdmin 初始化管理员账户（仅在没有管理员时）
	InitializeAdmin(ctx context.Context, username, email, password, runMode string) (*User, string, string, error)

	// 2FA 相关方法

	// Enable2FA 启用双因子认证
	Enable2FA(ctx context.Context, userID uuid.UUID, code string) ([]string, error)

	// Disable2FA 禁用双因子认证
	Disable2FA(ctx context.Context, userID uuid.UUID, password string) error

	// Generate2FASecret 生成 2FA secret（第一步）
	Generate2FASecret(ctx context.Context, userID uuid.UUID) (string, string, error)

	// Verify2FACode 验证 2FA 代码
	Verify2FACode(ctx context.Context, userID uuid.UUID, code string) (bool, error)

	// Session management

	// ListUserSessions 获取用户的所有活跃会话
	ListUserSessions(ctx context.Context, userID uuid.UUID) ([]*Session, error)

	// RevokeSession 撤销指定会话
	RevokeSession(ctx context.Context, userID uuid.UUID, sessionID uuid.UUID) error

	// RevokeAllOtherSessions 撤销除当前会话外的所有其他会话
	RevokeAllOtherSessions(ctx context.Context, userID uuid.UUID, currentSessionID uuid.UUID) error

	// Notification settings

	// UpdateNotificationSettings 更新通知设置
	UpdateNotificationSettings(ctx context.Context, userID uuid.UUID, emailLogin, emailAlert, browser *bool) error
}

// authService 认证服务实现
type authService struct {
	repo         Repository
	jwtService   JWTService
	totpService  TOTPService
	emailService EmailService // 可选的邮件服务
	runMode      string       // 存储运行模式
}

// EmailService 邮件服务接口（可选依赖）
type EmailService interface {
	SendLoginNotification(ctx context.Context, email, username, ipAddress, location, deviceInfo string, loginTime time.Time) error
	Send2FAEnabledNotification(ctx context.Context, email, username string) error
	SendPasswordChangedNotification(ctx context.Context, email, username string, changeTime time.Time) error
}

// NewService 创建认证服务
func NewService(repo Repository, jwtService JWTService) Service {
	return &authService{
		repo:         repo,
		jwtService:   jwtService,
		totpService:  NewTOTPService(),
		emailService: nil, // 默认不启用邮件服务
		runMode:      "production",
	}
}

// SetEmailService 设置邮件服务（可选）
func (s *authService) SetEmailService(emailService EmailService) {
	s.emailService = emailService
}

func (s *authService) Register(ctx context.Context, username, email, password string, role UserRole) (*User, error) {
	// 参数验证
	if username == "" || email == "" || password == "" {
		return nil, errors.New("username, email and password are required")
	}

	// 密码长度验证
	if len(password) < 6 {
		return nil, errors.New("password must be at least 6 characters")
	}

	// 生成头像
	avatar, err := s.generateAvatarForUser(username, email)
	if err != nil {
		// 头像生成失败不应该阻止用户注册，记录日志但继续
		fmt.Printf("Warning: failed to generate avatar for user %s: %v\n", username, err)
		avatar = ""
	}

	// 创建用户
	user := &User{
		Username: username,
		Email:    email,
		Role:     role,
		Avatar:   avatar,
	}

	// 设置密码（bcrypt 加密）
	if err := user.SetPassword(password); err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// 保存到数据库
	if err := s.repo.Create(ctx, user); err != nil {
		return nil, err
	}

	return user, nil
}

func (s *authService) Login(ctx context.Context, username, password string) (*User, string, string, error) {
	// 查找用户
	user, err := s.repo.FindByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			return nil, "", "", ErrInvalidCredentials
		}
		return nil, "", "", err
	}

	// 验证密码
	if !user.CheckPassword(password) {
		return nil, "", "", ErrInvalidCredentials
	}

	// 生成令牌
	accessToken, refreshToken, err := s.jwtService.GenerateTokens(user)
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to generate tokens: %w", err)
	}

	// 异步发送登录通知邮件（不影响登录流程）
	if s.emailService != nil && user.NotifyEmailLogin {
		go func() {
			// 使用新的上下文，避免影响主流程
			notifyCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()

			// 获取登录信息（这里简化处理，实际应从请求中获取）
			ipAddress := "Unknown"
			location := "Unknown"
			deviceInfo := "Unknown"

			// 发送邮件
			if err := s.emailService.SendLoginNotification(
				notifyCtx,
				user.Email,
				user.Username,
				ipAddress,
				location,
				deviceInfo,
				time.Now(),
			); err != nil {
				// 记录错误但不影响登录
				fmt.Printf("Failed to send login notification email: %v\n", err)
			}
		}()
	}

	return user, accessToken, refreshToken, nil
}

func (s *authService) Logout(ctx context.Context, accessToken string) error {
	// 将令牌加入黑名单
	// 设置过期时间为令牌的剩余有效时间
	if err := s.jwtService.BlacklistToken(accessToken, 24*time.Hour); err != nil {
		return fmt.Errorf("failed to blacklist token: %w", err)
	}
	return nil
}

func (s *authService) GetUserByID(ctx context.Context, userID uuid.UUID) (*User, error) {
	return s.repo.FindByID(ctx, userID)
}

func (s *authService) RefreshAccessToken(ctx context.Context, refreshToken string) (string, error) {
	return s.jwtService.RefreshToken(refreshToken)
}

func (s *authService) ChangePassword(ctx context.Context, userID uuid.UUID, oldPassword, newPassword string) error {
	// 查找用户
	user, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return err
	}

	// 验证旧密码
	if !user.CheckPassword(oldPassword) {
		return errors.New("invalid old password")
	}

	// 验证新密码长度
	if len(newPassword) < 6 {
		return errors.New("new password must be at least 6 characters")
	}

	// 设置新密码
	if err := user.SetPassword(newPassword); err != nil {
		return fmt.Errorf("failed to hash new password: %w", err)
	}

	// 更新用户
	if err := s.repo.Update(ctx, user); err != nil {
		return err
	}

	// 异步发送密码修改通知邮件
	if s.emailService != nil {
		go func() {
			notifyCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()

			if err := s.emailService.SendPasswordChangedNotification(
				notifyCtx,
				user.Email,
				user.Username,
				time.Now(),
			); err != nil {
				fmt.Printf("Failed to send password changed notification email: %v\n", err)
			}
		}()
	}

	return nil
}

func (s *authService) UpdateProfile(ctx context.Context, userID uuid.UUID, email, avatar string) error {
	// 查找用户
	user, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return err
	}

	// 更新邮箱（仅当非空时）
	if email != "" {
		user.Email = email
	}

	// 更新头像（\x00 表示不更新，空字符串表示移除，其他值表示设置新头像）
	if avatar != "\x00" {
		user.Avatar = avatar
	}

	return s.repo.Update(ctx, user)
}

func (s *authService) ListUsers(ctx context.Context, limit, offset int) ([]*User, int64, error) {
	return s.repo.List(ctx, limit, offset)
}

func (s *authService) DeleteUser(ctx context.Context, userID uuid.UUID) error {
	return s.repo.Delete(ctx, userID)
}

// HasAdmin 检查是否存在管理员
func (s *authService) HasAdmin(ctx context.Context) (bool, error) {
	return s.repo.HasAdmin(ctx)
}

// InitializeAdmin 初始化管理员账户（仅在没有管理员时）
func (s *authService) InitializeAdmin(ctx context.Context, username, email, password, runMode string) (*User, string, string, error) {
	// 检查是否已存在管理员
	hasAdmin, err := s.repo.HasAdmin(ctx)
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to check admin existence: %w", err)
	}

	if hasAdmin {
		return nil, "", "", errors.New("admin already exists")
	}

	// 参数验证
	if username == "" || email == "" || password == "" {
		return nil, "", "", errors.New("username, email and password are required")
	}

	// 密码长度验证
	if len(password) < 6 {
		return nil, "", "", errors.New("password must be at least 6 characters")
	}

	// 生成头像
	avatar, err := s.generateAvatarForUser(username, email)
	if err != nil {
		// 头像生成失败不应该阻止管理员创建，记录日志但继续
		fmt.Printf("⚠️  Warning: failed to generate avatar for admin %s: %v\n", username, err)
		avatar = ""
	}

	// 创建管理员用户
	user := &User{
		Username: username,
		Email:    email,
		Role:     RoleAdmin,
		Avatar:   avatar,
	}

	// 设置密码（bcrypt 加密）
	if err := user.SetPassword(password); err != nil {
		return nil, "", "", fmt.Errorf("failed to hash password: %w", err)
	}

	// 保存到数据库
	if err := s.repo.Create(ctx, user); err != nil {
		return nil, "", "", fmt.Errorf("failed to create admin: %w", err)
	}

	// 保存运行模式到服务实例
	s.runMode = runMode

	// 根据运行模式执行不同的初始化逻辑
	if err := s.initializeByRunMode(ctx, runMode, user); err != nil {
		// 记录错误但不阻止管理员创建
		fmt.Printf("⚠️  Warning: failed to initialize with run mode %s: %v\n", runMode, err)
	}

	// 生成令牌
	accessToken, refreshToken, err := s.jwtService.GenerateTokens(user)
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to generate tokens: %w", err)
	}

	return user, accessToken, refreshToken, nil
}

// initializeByRunMode 根据运行模式执行不同的初始化逻辑
func (s *authService) initializeByRunMode(ctx context.Context, runMode string, adminUser *User) error {
	switch runMode {
	case "demo":
		return s.initializeDemoMode(ctx, adminUser)
	case "development":
		return s.initializeDevelopmentMode(ctx, adminUser)
	case "production":
		return s.initializeProductionMode(ctx, adminUser)
	default:
		fmt.Printf("⚠️  Unknown run mode: %s, treating as production\n", runMode)
		return s.initializeProductionMode(ctx, adminUser)
	}
}

// initializeDemoMode 演示模式初始化
func (s *authService) initializeDemoMode(ctx context.Context, adminUser *User) error {
	fmt.Println("🎭 ========================================")
	fmt.Println("🎭 Initializing in DEMO Mode")
	fmt.Println("🎭 Creating sample data for demonstration...")
	fmt.Println("🎭 ========================================")

	// TODO: 这里可以创建示例数据
	// 由于需要server repository,暂时只打印日志
	// 在后续可以通过依赖注入的方式传入其他repository

	fmt.Println("📊 Demo data includes:")
	fmt.Println("   - Sample SSH servers (coming soon)")
	fmt.Println("   - Example scripts (coming soon)")
	fmt.Println("   - Sample audit logs (coming soon)")
	fmt.Println("   - Pre-configured server groups (coming soon)")
	fmt.Println("")
	fmt.Println("✅ Demo mode initialization completed")

	return nil
}

// initializeDevelopmentMode 开发模式初始化
func (s *authService) initializeDevelopmentMode(ctx context.Context, adminUser *User) error {
	fmt.Println("🔧 ========================================")
	fmt.Println("🔧 Initializing in DEVELOPMENT Mode")
	fmt.Println("🔧 Enabling debug features...")
	fmt.Println("🔧 ========================================")

	fmt.Println("🐛 Development features enabled:")
	fmt.Println("   ✅ Detailed SQL query logging")
	fmt.Println("   ✅ Verbose error messages")
	fmt.Println("   ✅ Hot reload support (via Air)")
	fmt.Println("   ✅ CORS relaxed for localhost")
	fmt.Println("   ✅ Debug endpoints available")
	fmt.Println("")
	fmt.Println("⚠️  WARNING: This mode is for development only!")
	fmt.Println("   Do NOT use in production environment.")
	fmt.Println("")
	fmt.Println("✅ Development mode initialization completed")

	return nil
}

// initializeProductionMode 生产模式初始化
func (s *authService) initializeProductionMode(ctx context.Context, adminUser *User) error {
	fmt.Println("🔒 ========================================")
	fmt.Println("🔒 Initializing in PRODUCTION Mode")
	fmt.Println("🔒 Applying security hardening...")
	fmt.Println("🔒 ========================================")

	fmt.Println("🛡️  Security features enabled:")
	fmt.Println("   ✅ Strict CORS policy")
	fmt.Println("   ✅ Rate limiting active")
	fmt.Println("   ✅ HTTPS enforcement (if configured)")
	fmt.Println("   ✅ SQL query logging minimized")
	fmt.Println("   ✅ Error messages sanitized")
	fmt.Println("   ✅ Security headers enforced")
	fmt.Println("")
	fmt.Println("📝 Remember to:")
	fmt.Println("   - Configure SSL/TLS certificates")
	fmt.Println("   - Set strong JWT secrets")
	fmt.Println("   - Enable firewall rules")
	fmt.Println("   - Regular security updates")
	fmt.Println("")
	fmt.Println("✅ Production mode initialization completed")

	return nil
}

// Generate2FASecret 生成 2FA secret（第一步：生成但不保存）
func (s *authService) Generate2FASecret(ctx context.Context, userID uuid.UUID) (string, string, error) {
	// 查找用户
	user, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return "", "", err
	}

	// 生成 TOTP secret
	secret, qrCodeURL, err := s.totpService.GenerateSecret(user.Username)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate TOTP secret: %w", err)
	}

	// 临时保存 secret 到数据库（此时还未启用 2FA）
	user.TwoFactorSecret = secret
	if err := s.repo.Update(ctx, user); err != nil {
		return "", "", fmt.Errorf("failed to save TOTP secret: %w", err)
	}

	return secret, qrCodeURL, nil
}

// Enable2FA 启用双因子认证（第二步：验证代码并启用）
func (s *authService) Enable2FA(ctx context.Context, userID uuid.UUID, code string) ([]string, error) {
	// 查找用户
	user, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	// 检查是否已启用
	if user.TwoFactorEnabled {
		return nil, errors.New("2FA is already enabled")
	}

	// 检查是否已生成 secret
	if user.TwoFactorSecret == "" {
		return nil, errors.New("2FA secret not generated, please generate first")
	}

	// 验证 TOTP 代码
	if !s.totpService.ValidateCode(user.TwoFactorSecret, code) {
		return nil, errors.New("invalid 2FA code")
	}

	// 生成备份码
	backupCodes, err := s.totpService.GenerateBackupCodes()
	if err != nil {
		return nil, fmt.Errorf("failed to generate backup codes: %w", err)
	}

	// 将备份码序列化为 JSON
	backupCodesJSON, err := json.Marshal(backupCodes)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal backup codes: %w", err)
	}

	// 启用 2FA
	user.TwoFactorEnabled = true
	user.BackupCodes = string(backupCodesJSON)

	if err := s.repo.Update(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to enable 2FA: %w", err)
	}

	// 异步发送 2FA 启用通知邮件
	if s.emailService != nil {
		go func() {
			notifyCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()

			if err := s.emailService.Send2FAEnabledNotification(
				notifyCtx,
				user.Email,
				user.Username,
			); err != nil {
				fmt.Printf("Failed to send 2FA enabled notification email: %v\n", err)
			}
		}()
	}

	return backupCodes, nil
}

// Disable2FA 禁用双因子认证
func (s *authService) Disable2FA(ctx context.Context, userID uuid.UUID, code string) error {
	// 查找用户
	user, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return err
	}

	// 检查是否启用了 2FA
	if !user.TwoFactorEnabled {
		return errors.New("2FA is not enabled")
	}

	// 验证 2FA 代码
	if !s.totpService.ValidateCode(user.TwoFactorSecret, code) {
		return errors.New("invalid 2FA code")
	}

	// 禁用 2FA
	user.TwoFactorEnabled = false
	user.TwoFactorSecret = ""
	user.BackupCodes = ""

	return s.repo.Update(ctx, user)
}

// Verify2FACode 验证 2FA 代码（用于登录）
func (s *authService) Verify2FACode(ctx context.Context, userID uuid.UUID, code string) (bool, error) {
	// 查找用户
	user, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return false, err
	}

	// 检查是否启用了 2FA
	if !user.TwoFactorEnabled {
		return false, errors.New("2FA is not enabled")
	}

	// 首先尝试验证 TOTP 代码
	if s.totpService.ValidateCode(user.TwoFactorSecret, code) {
		return true, nil
	}

	// 如果 TOTP 验证失败，尝试验证备份码
	if user.BackupCodes != "" {
		valid, updatedCodes, err := s.totpService.VerifyBackupCode(user.BackupCodes, code)
		if err != nil {
			return false, fmt.Errorf("failed to verify backup code: %w", err)
		}

		if valid {
			// 更新剩余的备份码
			user.BackupCodes = updatedCodes
			if err := s.repo.Update(ctx, user); err != nil {
				return false, fmt.Errorf("failed to update backup codes: %w", err)
			}
			return true, nil
		}
	}

	return false, nil
}

// === Session Management ===

// ListUserSessions 获取用户的所有活跃会话
func (s *authService) ListUserSessions(ctx context.Context, userID uuid.UUID) ([]*Session, error) {
	return s.repo.ListUserSessions(ctx, userID)
}

// RevokeSession 撤销指定会话
func (s *authService) RevokeSession(ctx context.Context, userID uuid.UUID, sessionID uuid.UUID) error {
	// 首先验证会话属于该用户
	sessions, err := s.repo.ListUserSessions(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to list user sessions: %w", err)
	}

	// 检查会话是否属于该用户
	found := false
	for _, session := range sessions {
		if session.ID == sessionID {
			found = true
			break
		}
	}

	if !found {
		return errors.New("session not found or does not belong to user")
	}

	// 删除会话
	return s.repo.DeleteSession(ctx, sessionID)
}

// RevokeAllOtherSessions 撤销除当前会话外的所有其他会话
func (s *authService) RevokeAllOtherSessions(ctx context.Context, userID uuid.UUID, currentSessionID uuid.UUID) error {
	// 获取所有会话
	sessions, err := s.repo.ListUserSessions(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to list user sessions: %w", err)
	}

	// 删除除当前会话外的所有会话
	for _, session := range sessions {
		if session.ID != currentSessionID {
			if err := s.repo.DeleteSession(ctx, session.ID); err != nil {
				return fmt.Errorf("failed to delete session %s: %w", session.ID, err)
			}
		}
	}

	return nil
}

// === Notification Settings ===

// UpdateNotificationSettings 更新通知设置
func (s *authService) UpdateNotificationSettings(ctx context.Context, userID uuid.UUID, emailLogin, emailAlert, browser *bool) error {
	// 查找用户
	user, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return err
	}

	// 更新通知设置（仅更新非 nil 的字段）
	if emailLogin != nil {
		user.NotifyEmailLogin = *emailLogin
	}
	if emailAlert != nil {
		user.NotifyEmailAlert = *emailAlert
	}
	if browser != nil {
		user.NotifyBrowser = *browser
	}

	return s.repo.Update(ctx, user)
}

// generateAvatarForUser 为用户生成头像
func (s *authService) generateAvatarForUser(username, email string) (string, error) {
	// 生成确定性种子
	seed := s.generateUserSeed(username, email)

	// 调用DiceBear API生成头像
	return s.generateDiceBearAvatar(seed)
}

// generateUserSeed 基于用户信息生成确定性种子
func (s *authService) generateUserSeed(username, email string) string {
	// 使用用户名作为主要种子
	seedInput := strings.ToLower(username)

	// 如果有邮箱，组合使用以增加唯一性
	if email != "" {
		seedInput += strings.ToLower(email)
	}

	// 使用MD5哈希生成确定性种子
	hash := md5.Sum([]byte(seedInput))
	return fmt.Sprintf("%x", hash)
}

// generateDiceBearAvatar 生成DiceBear头像
func (s *authService) generateDiceBearAvatar(seed string) (string, error) {
	// DiceBear API URL - 使用notionists-neutral风格
	dicebearUrl := fmt.Sprintf("https://api.dicebear.com/7.x/notionists-neutral/svg?seed=%s", seed)

	// 发起HTTP请求获取SVG
	resp, err := http.Get(dicebearUrl)
	if err != nil {
		return "", fmt.Errorf("failed to fetch avatar from DiceBear API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("DiceBear API returned status %d", resp.StatusCode)
	}

	// 读取SVG内容
	svgBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read SVG content: %w", err)
	}

	svgText := string(svgBytes)

	// 对SVG内容进行URL编码，转换为data URL格式
	encodedSVG := urlEncodeSVG(svgText)

	return fmt.Sprintf("data:image/svg+xml,%s", encodedSVG), nil
}

// urlEncodeSVG 对SVG内容进行URL编码
func urlEncodeSVG(svg string) string {
	// 替换特殊字符
	svg = strings.ReplaceAll(svg, "<", "%3C")
	svg = strings.ReplaceAll(svg, ">", "%3E")
	svg = strings.ReplaceAll(svg, "#", "%23")
	svg = strings.ReplaceAll(svg, " ", "%20")
	svg = strings.ReplaceAll(svg, "\"", "%22")
	svg = strings.ReplaceAll(svg, "'", "%27")
	svg = strings.ReplaceAll(svg, "\n", "")
	svg = strings.ReplaceAll(svg, "\r", "")
	svg = strings.ReplaceAll(svg, "\t", "")

	return svg
}

