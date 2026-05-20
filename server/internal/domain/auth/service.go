package auth

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/easyssh/server/internal/pkg/ttlcache"
	"github.com/google/uuid"
)

// SessionInfo 会话信息
type SessionInfo struct {
	DeviceType string
	DeviceName string
	IPAddress  string
	UserAgent  string
}

// AuthenticateResult 认证结果
type AuthenticateResult struct {
	User          *User      // 认证成功时返回用户
	IPLocked      bool       // IP 是否被锁定
	AccountLocked bool       // 账户是否被锁定
	UnlockAt      *time.Time // 解锁时间
	IsNewDevice   bool       // 是否为新设备
	IsNewLocation bool       // 是否为新地点
	Location      string     // 地理位置
}

// Service 认证服务接口
type Service interface {
	// Register 注册新用户（username 自动生成）
	Register(ctx context.Context, email, password string, role UserRole) (*User, error)

	// AuthenticateUser 验证邮箱和密码，返回用户（不创建会话或令牌）
	AuthenticateUser(ctx context.Context, email, password string) (*User, error)

	// AuthenticateUserWithContext 验证邮箱和密码，支持账户锁定检查和登录检测
	// ip 和 userAgent 用于账户锁定和登录检测
	AuthenticateUserWithContext(ctx context.Context, email, password, ip, userAgent string) (*AuthenticateResult, error)

	// CreateSessionWithTokens 为已认证用户创建会话并生成访问令牌/刷新令牌
	CreateSessionWithTokens(ctx context.Context, user *User, sessionInfo *SessionInfo) (accessToken, refreshToken string, err error)

	// Logout 用户登出
	Logout(ctx context.Context, accessToken string) error

	// LogoutWithRefreshToken 登出时同时将 Access Token 和 Refresh Token 加入黑名单
	LogoutWithRefreshToken(ctx context.Context, accessToken, refreshToken string) error

	// GetUserByID 根据 ID 获取用户
	GetUserByID(ctx context.Context, userID uuid.UUID) (*User, error)

	// GetUserByEmail 根据邮箱获取用户
	GetUserByEmail(ctx context.Context, email string) (*User, error)

	// GetUserByGoogleSub 根据 Google OIDC subject 获取用户
	GetUserByGoogleSub(ctx context.Context, googleSub string) (*User, error)

	// BindGoogleSub 绑定 Google OIDC subject 到已有用户
	BindGoogleSub(ctx context.Context, userID uuid.UUID, googleSub string) (*User, error)

	// UnbindGoogleSub 解除当前用户的 Google OIDC 绑定
	UnbindGoogleSub(ctx context.Context, userID uuid.UUID) (*User, error)

	// RegisterOAuthUser 通过 OAuth 注册用户（不需要密码）
	RegisterOAuthUser(ctx context.Context, username, email, avatar, googleSub string, role UserRole) (*User, error)

	// RefreshAccessToken 刷新访问令牌（返回新的访问令牌和刷新令牌）
	RefreshAccessToken(ctx context.Context, refreshToken string) (accessToken, newRefreshToken string, err error)

	// ChangePassword 修改密码
	ChangePassword(ctx context.Context, userID uuid.UUID, oldPassword, newPassword string) error

	// ResetPassword 重置密码（忘记密码，不需要旧密码）
	ResetPassword(ctx context.Context, userID uuid.UUID, newPassword string) error

	// UpdateProfile 更新用户资料（包含用户名）
	UpdateProfile(ctx context.Context, userID uuid.UUID, username, email, avatar, language, timezone string) error

	// ListUsers 获取用户列表（管理员功能）
	ListUsers(ctx context.Context, limit, offset int) ([]*User, int64, error)

	// DeleteUser 删除用户（管理员功能）
	DeleteUser(ctx context.Context, userID uuid.UUID) error

	// HasAdmin 检查是否存在管理员
	HasAdmin(ctx context.Context) (bool, error)

	// InitializeAdmin 初始化管理员账户（仅在没有管理员时）
	InitializeAdmin(ctx context.Context, username, email, password, runMode string, sessionInfo *SessionInfo) (*User, string, string, error)

	// 2FA 相关方法

	// Enable2FA 启用双因子认证
	Enable2FA(ctx context.Context, userID uuid.UUID, code string) ([]string, error)

	// Disable2FA 禁用双因子认证
	Disable2FA(ctx context.Context, userID uuid.UUID, code string) error

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
	UpdateNotificationSettings(ctx context.Context, userID uuid.UUID, emailLogin, emailAlert, browser, newDevice, newLocation, suspicious *bool) error

	// Monitor Data Source settings

	// UpdateMonitorDataSource 更新监控数据源设置
	// setActive: 是否将此数据源设为当前激活的数据源
	UpdateMonitorDataSource(ctx context.Context, userID uuid.UUID, dataSource, endpoint, token string, setActive bool) error

	// Authorization Code + PKCE

	// CreateAuthorizationCode 为指定用户创建授权码
	CreateAuthorizationCode(ctx context.Context, userID uuid.UUID, clientID, redirectURI, scope, codeChallenge, codeChallengeMethod string, expiresIn time.Duration) (string, error)

	// ExchangeAuthorizationCodeForTokens 使用授权码和 PKCE code_verifier 换取访问令牌和刷新令牌
	ExchangeAuthorizationCodeForTokens(ctx context.Context, clientID, redirectURI, code, codeVerifier string, sessionInfo *SessionInfo) (*User, string, string, error)
}

// authService 认证服务实现
type authService struct {
	repo                  Repository
	jwtService            JWTService
	totpService           TOTPService
	emailService          EmailService          // 可选的邮件服务
	accountLockService    AccountLockService    // 账户锁定服务（可选）
	loginDetectionService LoginDetectionService // 登录检测服务（可选）
	runMode               string                // 存储运行模式
	sessionIdleDuration   time.Duration         // 会话闲置过期时间（用于 user_sessions.ExpiresAt）
	refreshGraceDuration  time.Duration         // refresh token 轮换后的短暂并发宽限窗口
	refreshLocks          map[string]*refreshLock
	refreshLocksMu        sync.Mutex
	authCodes             *ttlcache.Cache[authorizationCodeRecord]
}

type refreshLock struct {
	mu   sync.Mutex
	refs int
}

type authorizationCodeRecord struct {
	UserID              uuid.UUID
	ClientID            string
	RedirectURI         string
	Scope               string
	CodeChallenge       string
	CodeChallengeMethod string
	CreatedAt           time.Time
}

// EmailService 邮件服务接口（可选依赖）
type EmailService interface {
	SendLoginNotification(ctx context.Context, email, username, ipAddress, location, deviceInfo string, loginTime time.Time) error
	Send2FAEnabledNotification(ctx context.Context, email, username string) error
	SendPasswordChangedNotification(ctx context.Context, email, username string, changeTime time.Time) error
	// 登录告警相关方法
	SendNewDeviceAlert(ctx context.Context, email, username, deviceName, ip, location string, loginTime time.Time) error
	SendNewLocationAlert(ctx context.Context, email, username, location, ip string, loginTime time.Time) error
	SendSuspiciousLoginAlert(ctx context.Context, email, username, reason, ip, location string, loginTime time.Time) error
	SendAccountLockedAlert(ctx context.Context, email, username, reason string, unlockTime time.Time) error
}

// NewService 创建认证服务
// sessionIdleDuration 用于 user_sessions.ExpiresAt，通常应与 JWT 刷新闲置过期时间保持一致
func NewService(repo Repository, jwtService JWTService, sessionIdleDuration time.Duration) Service {
	return &authService{
		repo:                  repo,
		jwtService:            jwtService,
		totpService:           NewTOTPService(),
		emailService:          nil, // 默认不启用邮件服务
		accountLockService:    nil, // 默认不启用账户锁定
		loginDetectionService: nil, // 默认不启用登录检测
		runMode:               "production",
		sessionIdleDuration:   sessionIdleDuration,
		refreshGraceDuration:  30 * time.Second,
		refreshLocks:          make(map[string]*refreshLock),
		authCodes:             ttlcache.New[authorizationCodeRecord](time.Minute),
	}
}

// SetEmailService 设置邮件服务（可选）
func (s *authService) SetEmailService(emailService EmailService) {
	s.emailService = emailService
}

// SetAccountLockService 设置账户锁定服务（可选）
func (s *authService) SetAccountLockService(accountLockService AccountLockService) {
	s.accountLockService = accountLockService
}

// SetLoginDetectionService 设置登录检测服务（可选）
func (s *authService) SetLoginDetectionService(loginDetectionService LoginDetectionService) {
	s.loginDetectionService = loginDetectionService
}

func (s *authService) Register(ctx context.Context, email, password string, role UserRole) (*User, error) {
	// 参数验证
	if email == "" || password == "" {
		return nil, errors.New("email and password are required")
	}

	// 密码策略验证
	if err := ValidatePasswordWithDefault(password); err != nil {
		return nil, err
	}

	// 自动生成用户名：使用邮箱前缀 + 随机后缀
	username := s.generateUsername(email)

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

// AuthenticateUser 验证邮箱和密码，返回用户信息（不创建会话或令牌）
func (s *authService) AuthenticateUser(ctx context.Context, email, password string) (*User, error) {
	// 使用邮箱查找用户
	user, err := s.repo.FindByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}

	// 验证密码
	if !user.CheckPassword(password) {
		return nil, ErrInvalidCredentials
	}

	return user, nil
}

// AuthenticateUserWithContext 验证邮箱和密码，支持账户锁定检查和登录检测
func (s *authService) AuthenticateUserWithContext(ctx context.Context, email, password, ip, userAgent string) (*AuthenticateResult, error) {
	result := &AuthenticateResult{}

	// 1. 检查 IP 是否被锁定
	if s.accountLockService != nil {
		ipLocked, unlockAt, err := s.accountLockService.CheckIPLock(ctx, ip)
		if err != nil {
			// 记录错误但不阻止登录流程
			fmt.Printf("Warning: failed to check IP lock: %v\n", err)
		} else if ipLocked {
			result.IPLocked = true
			result.UnlockAt = unlockAt
			return result, ErrIPLocked
		}
	}

	// 2. 检查账户是否被锁定
	if s.accountLockService != nil {
		accountLocked, unlockAt, err := s.accountLockService.CheckAccountLock(ctx, email)
		if err != nil {
			fmt.Printf("Warning: failed to check account lock: %v\n", err)
		} else if accountLocked {
			result.AccountLocked = true
			result.UnlockAt = unlockAt
			return result, ErrAccountLocked
		}
	}

	// 3. 使用邮箱查找用户
	user, err := s.repo.FindByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			// 记录失败尝试（即使用户不存在也记录，防止用户枚举）
			if s.accountLockService != nil {
				s.accountLockService.RecordFailedLogin(ctx, email, ip, userAgent, "user_not_found")
			}
			return result, ErrInvalidCredentials
		}
		return result, err
	}

	// 4. 验证密码
	if !user.CheckPassword(password) {
		// 记录失败尝试
		if s.accountLockService != nil {
			ipLocked, accountLocked, err := s.accountLockService.RecordFailedLogin(ctx, email, ip, userAgent, "invalid_password")
			if err != nil {
				fmt.Printf("Warning: failed to record failed login: %v\n", err)
			}
			if ipLocked {
				result.IPLocked = true
				return result, ErrIPLocked
			}
			if accountLocked {
				result.AccountLocked = true
				return result, ErrAccountLocked
			}
		}
		return result, ErrInvalidCredentials
	}

	// 5. 登录成功，清除失败计数
	if s.accountLockService != nil {
		if err := s.accountLockService.RecordSuccessLogin(ctx, email, ip, userAgent); err != nil {
			fmt.Printf("Warning: failed to record success login: %v\n", err)
		}
	}

	// 6. 登录检测（新设备/新地点）
	if s.loginDetectionService != nil {
		// 检查是否为新地点
		isNewLocation, location, err := s.loginDetectionService.CheckNewLocation(ctx, user.ID, ip)
		if err != nil {
			fmt.Printf("Warning: failed to check new location: %v\n", err)
		} else {
			result.IsNewLocation = isNewLocation
			result.Location = location
		}
	}

	result.User = user
	return result, nil
}

// CreateSessionWithTokens 为已认证用户创建会话并生成访问/刷新令牌
func (s *authService) CreateSessionWithTokens(ctx context.Context, user *User, sessionInfo *SessionInfo) (string, string, error) {
	// 为当前登录生成会话ID，用于 access_token 中标记当前会话
	sessionID := uuid.New()

	// 生成令牌（在 access_token 中嵌入 session_id）
	accessToken, refreshToken, err := s.jwtService.GenerateTokensForSession(user, sessionID)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate tokens: %w", err)
	}

	// 创建会话记录
	if sessionInfo != nil {
		session := &Session{
			ID:           sessionID,
			UserID:       user.ID,
			RefreshToken: s.hashToken(refreshToken), // 存储哈希值
			DeviceType:   sessionInfo.DeviceType,
			DeviceName:   sessionInfo.DeviceName,
			IPAddress:    sessionInfo.IPAddress,
			Location:     "", // TODO: 可以集成 IP 地理位置服务
			UserAgent:    sessionInfo.UserAgent,
			LastActivity: time.Now(),
			ExpiresAt:    time.Now().Add(s.sessionIdleDuration),
		}

		if err := s.repo.CreateSession(ctx, session); err != nil {
			// 会话创建失败不应阻止登录，记录错误
			fmt.Printf("Failed to create session: %v\n", err)
		}
	}

	// 异步发送登录通知邮件（不影响登录流程）
	if s.emailService != nil && user.NotifyEmailLogin && sessionInfo != nil {
		go func() {
			// 使用新的上下文，避免影响主流程
			notifyCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()

			// 发送邮件
			if err := s.emailService.SendLoginNotification(
				notifyCtx,
				user.Email,
				user.Username,
				sessionInfo.IPAddress,
				"", // location
				sessionInfo.DeviceName,
				time.Now(),
			); err != nil {
				// 记录错误但不影响登录
				fmt.Printf("Failed to send login notification email: %v\n", err)
			}
		}()
	}

	return accessToken, refreshToken, nil
}

// hashToken 对 token 进行哈希处理
func (s *authService) hashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return fmt.Sprintf("%x", hash)
}

func (s *authService) lockRefreshToken(tokenHash string) func() {
	s.refreshLocksMu.Lock()
	lock := s.refreshLocks[tokenHash]
	if lock == nil {
		lock = &refreshLock{}
		s.refreshLocks[tokenHash] = lock
	}
	lock.refs++
	s.refreshLocksMu.Unlock()

	lock.mu.Lock()

	return func() {
		lock.mu.Unlock()

		s.refreshLocksMu.Lock()
		lock.refs--
		if lock.refs == 0 {
			delete(s.refreshLocks, tokenHash)
		}
		s.refreshLocksMu.Unlock()
	}
}

func (s *authService) Logout(ctx context.Context, accessToken string) error {
	// 将 Access Token 加入黑名单
	// 设置过期时间为令牌的剩余有效时间
	if err := s.jwtService.BlacklistToken(accessToken, 24*time.Hour); err != nil {
		return fmt.Errorf("failed to blacklist access token: %w", err)
	}
	return nil
}

// LogoutWithRefreshToken 登出时同时将 Access Token 和 Refresh Token 加入黑名单
// 确保被撤销的 Refresh Token 无法再用于获取新的 Access Token
func (s *authService) LogoutWithRefreshToken(ctx context.Context, accessToken, refreshToken string) error {
	// 将 Access Token 加入黑名单
	if accessToken != "" {
		if err := s.jwtService.BlacklistToken(accessToken, 24*time.Hour); err != nil {
			// 记录错误但不阻止后续操作
			fmt.Printf("Warning: failed to blacklist access token: %v\n", err)
		}
	}

	// 将 Refresh Token 加入黑名单
	// Refresh Token 的有效期较长，需要使用更长的黑名单过期时间
	if refreshToken != "" {
		// 尝试解析 Refresh Token 获取其绝对过期时间
		claims, err := s.jwtService.ValidateToken(refreshToken)
		if err == nil && claims.AbsoluteExpiry > 0 {
			// 使用 Refresh Token 的绝对过期时间作为黑名单过期时间
			ttl := time.Until(time.Unix(claims.AbsoluteExpiry, 0))
			if ttl > 0 {
				if err := s.jwtService.BlacklistToken(refreshToken, ttl); err != nil {
					fmt.Printf("Warning: failed to blacklist refresh token: %v\n", err)
				}
			}
		} else {
			// 如果无法解析，使用默认的 30 天（通常 Refresh Token 的最大有效期）
			if err := s.jwtService.BlacklistToken(refreshToken, 30*24*time.Hour); err != nil {
				fmt.Printf("Warning: failed to blacklist refresh token: %v\n", err)
			}
		}
	}

	return nil
}

func (s *authService) GetUserByID(ctx context.Context, userID uuid.UUID) (*User, error) {
	return s.repo.FindByID(ctx, userID)
}

func (s *authService) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	return s.repo.FindByEmail(ctx, email)
}

func (s *authService) GetUserByGoogleSub(ctx context.Context, googleSub string) (*User, error) {
	return s.repo.FindByGoogleSub(ctx, googleSub)
}

func (s *authService) BindGoogleSub(ctx context.Context, userID uuid.UUID, googleSub string) (*User, error) {
	if googleSub == "" {
		return nil, errors.New("google sub is required")
	}

	existingUser, err := s.repo.FindByGoogleSub(ctx, googleSub)
	if err == nil && existingUser != nil && existingUser.ID != userID {
		return nil, ErrUserAlreadyExists
	}
	if err != nil && !errors.Is(err, ErrUserNotFound) {
		return nil, err
	}

	user, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	if user.GoogleSub != nil && *user.GoogleSub != "" && *user.GoogleSub != googleSub {
		return nil, ErrUserAlreadyExists
	}

	user.GoogleSub = &googleSub
	if err := s.repo.Update(ctx, user); err != nil {
		return nil, err
	}

	return user, nil
}

func (s *authService) UnbindGoogleSub(ctx context.Context, userID uuid.UUID) (*User, error) {
	user, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	if user.Password == "" {
		return nil, ErrLastLoginMethod
	}

	user.GoogleSub = nil
	if err := s.repo.Update(ctx, user); err != nil {
		return nil, err
	}

	return user, nil
}

func (s *authService) RegisterOAuthUser(ctx context.Context, username, email, avatar, googleSub string, role UserRole) (*User, error) {
	// 参数验证
	if email == "" {
		return nil, errors.New("email is required")
	}
	if googleSub == "" {
		return nil, errors.New("google sub is required")
	}

	// 检查邮箱是否已存在
	existingUser, err := s.repo.FindByEmail(ctx, email)
	if err == nil && existingUser != nil {
		return nil, ErrUserAlreadyExists
	}
	if err != nil && !errors.Is(err, ErrUserNotFound) {
		return nil, err
	}

	// 检查 Google subject 是否已存在
	existingUser, err = s.repo.FindByGoogleSub(ctx, googleSub)
	if err == nil && existingUser != nil {
		return nil, ErrUserAlreadyExists
	}
	if err != nil && !errors.Is(err, ErrUserNotFound) {
		return nil, err
	}

	// 如果没有提供用户名，使用邮箱前缀生成
	if username == "" {
		username = s.generateUsername(email)
	}

	// 如果没有提供头像，生成默认头像
	if avatar == "" {
		avatar, err = s.generateAvatarForUser(username, email)
		if err != nil {
			return nil, fmt.Errorf("failed to generate avatar: %w", err)
		}
	}

	// 创建用户（OAuth 用户不需要密码）
	user := &User{
		ID:        uuid.New(),
		Username:  username,
		Email:     email,
		Password:  "", // OAuth 用户不设置密码
		Role:      role,
		Avatar:    avatar,
		GoogleSub: &googleSub,
	}

	if err := s.repo.Create(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return user, nil
}

func (s *authService) RefreshAccessToken(ctx context.Context, refreshToken string) (string, string, error) {
	tokenHashToFind := s.hashToken(refreshToken)
	unlock := s.lockRefreshToken(tokenHashToFind)
	defer unlock()

	session, matchedPreviousToken, err := s.repo.FindSessionByRefreshTokenWithGrace(ctx, tokenHashToFind)
	if err != nil || session == nil {
		return "", "", ErrSessionNotFound
	}

	// 检查会话是否过期
	if session.IsExpired() {
		// 会话已过期，删除并拒绝刷新
		_ = s.repo.DeleteSession(ctx, session.ID)
		return "", "", ErrSessionExpired
	}

	var newAccessToken, newRefreshToken string
	if matchedPreviousToken {
		newAccessToken, err = s.jwtService.RefreshTokenWithinGrace(refreshToken)
		if err != nil {
			return "", "", err
		}
	} else {
		newAccessToken, newRefreshToken, err = s.jwtService.RefreshToken(refreshToken)
		if err != nil {
			if errors.Is(err, ErrTokenFamilyRevoked) || errors.Is(err, ErrTokenReuseDetected) {
				_ = s.repo.DeleteSession(ctx, session.ID)
			}
			return "", "", err
		}
	}

	// 更新会话活动时间 + 滑动闲置过期
	session.UpdateActivity()
	// 与 JWT 刷新闲置窗口对齐：每次刷新将会话过期时间顺延
	session.ExpiresAt = time.Now().Add(s.sessionIdleDuration)

	// 如果生成了新的 refresh token，更新会话中的 token 哈希
	if newRefreshToken != "" {
		previousTokenValidUntil := time.Now().Add(s.refreshGraceDuration)
		session.PreviousRefreshToken = tokenHashToFind
		session.PreviousRefreshTokenValidUntil = &previousTokenValidUntil
		session.RefreshToken = s.hashToken(newRefreshToken)
	} else if matchedPreviousToken {
		// 如果禁用轮换但命中旧 token 宽限，清理宽限字段，避免长期保留旧哈希。
		session.PreviousRefreshToken = ""
		session.PreviousRefreshTokenValidUntil = nil
	}

	if err := s.repo.UpdateSession(ctx, session); err != nil {
		return "", "", fmt.Errorf("%w: %v", ErrSessionSyncFailed, err)
	}

	return newAccessToken, newRefreshToken, nil
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

	// 验证新密码策略
	if err := ValidatePasswordWithDefault(newPassword); err != nil {
		return err
	}

	// 设置新密码
	if err := user.SetPassword(newPassword); err != nil {
		return fmt.Errorf("failed to hash new password: %w", err)
	}

	// 更新用户
	if err := s.repo.Update(ctx, user); err != nil {
		return err
	}

	// 安全措施：密码修改后撤销所有会话，强制用户重新登录
	if err := s.repo.DeleteAllUserSessions(ctx, userID); err != nil {
		// 记录错误但不阻止密码修改成功
		fmt.Printf("Warning: failed to revoke all sessions after password change for user %s: %v\n", userID, err)
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

// ResetPassword 重置密码（忘记密码，不需要旧密码）
func (s *authService) ResetPassword(ctx context.Context, userID uuid.UUID, newPassword string) error {
	// 查找用户
	user, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("find user failed: %w", err)
	}

	// 验证新密码策略
	if err := ValidatePasswordWithDefault(newPassword); err != nil {
		return fmt.Errorf("password validation failed: %w", err)
	}

	// 设置新密码
	if err := user.SetPassword(newPassword); err != nil {
		return fmt.Errorf("failed to hash new password: %w", err)
	}

	// 更新用户
	if err := s.repo.Update(ctx, user); err != nil {
		return fmt.Errorf("update user failed: %w", err)
	}

	// 安全措施：密码重置后撤销所有会话，强制用户重新登录
	// 这确保了即使攻击者有之前的有效会话，也无法继续使用
	if err := s.repo.DeleteAllUserSessions(ctx, userID); err != nil {
		// 记录错误但不阻止密码重置成功
		fmt.Printf("Warning: failed to revoke all sessions after password reset for user %s: %v\n", userID, err)
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

func (s *authService) UpdateProfile(ctx context.Context, userID uuid.UUID, username, email, avatar, language, timezone string) error {
	// 查找用户
	user, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return err
	}

	// 更新用户名（仅当非空时）
	if username != "" {
		user.Username = username
	}

	// 更新邮箱（仅当非空时）
	if email != "" {
		user.Email = email
	}

	// 更新头像（\x00 表示不更新，空字符串表示移除，其他值表示设置新头像）
	if avatar != "\x00" {
		user.Avatar = avatar
	}

	// 更新语言偏好（仅当非空时）
	if language != "" {
		user.Language = language
	}

	// 更新时区偏好（仅当非空时）
	if timezone != "" {
		user.Timezone = timezone
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
func (s *authService) InitializeAdmin(ctx context.Context, username, email, password, runMode string, sessionInfo *SessionInfo) (*User, string, string, error) {
	// 检查是否已存在管理员
	hasAdmin, err := s.repo.HasAdmin(ctx)
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to check admin existence: %w", err)
	}

	if hasAdmin {
		return nil, "", "", errors.New("admin already exists")
	}

	// 参数验证：邮箱和密码是必须的，用户名可选（为空则自动生成）
	if email == "" || password == "" {
		return nil, "", "", errors.New("email and password are required")
	}

	// 如果没有提供用户名，自动生成
	if username == "" {
		username = s.generateUsername(email)
	}

	// 密码策略验证
	if err := ValidatePasswordWithDefault(password); err != nil {
		return nil, "", "", err
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

	// 生成会话ID并创建令牌（在 access_token 中嵌入 session_id）
	sessionID := uuid.New()
	accessToken, refreshToken, err := s.jwtService.GenerateTokensForSession(user, sessionID)
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to generate tokens: %w", err)
	}

	// 创建会话记录
	if sessionInfo != nil {
		session := &Session{
			ID:           sessionID,
			UserID:       user.ID,
			RefreshToken: s.hashToken(refreshToken), // 存储哈希值
			DeviceType:   sessionInfo.DeviceType,
			DeviceName:   sessionInfo.DeviceName,
			IPAddress:    sessionInfo.IPAddress,
			Location:     "", // TODO: 可以集成 IP 地理位置服务
			UserAgent:    sessionInfo.UserAgent,
			LastActivity: time.Now(),
			ExpiresAt:    time.Now().Add(s.sessionIdleDuration), // 使用统一的会话闲置过期时间
		}

		if err := s.repo.CreateSession(ctx, session); err != nil {
			// 会话创建失败不应阻止初始化，记录错误
			fmt.Printf("Failed to create session: %v\n", err)
		}
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

func (s *authService) resolveTwoFactorSecret(user *User) (string, error) {
	return DecryptTOTPSecret(user.TwoFactorSecret)
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

	encryptedSecret, err := EncryptTOTPSecret(secret)
	if err != nil {
		return "", "", fmt.Errorf("failed to encrypt TOTP secret: %w", err)
	}

	// 临时保存 secret 到数据库（此时还未启用 2FA）
	user.TwoFactorSecret = encryptedSecret
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

	secret, err := s.resolveTwoFactorSecret(user)
	if err != nil {
		return nil, fmt.Errorf("failed to load TOTP secret: %w", err)
	}

	// 验证 TOTP 代码
	if !s.totpService.ValidateCode(secret, code) {
		return nil, errors.New("invalid 2FA code")
	}

	// 生成备份码
	backupCodes, err := s.totpService.GenerateBackupCodes()
	if err != nil {
		return nil, fmt.Errorf("failed to generate backup codes: %w", err)
	}

	// 备份码采用不可逆哈希存储
	hashedBackupCodes, err := HashBackupCodes(backupCodes)
	if err != nil {
		return nil, fmt.Errorf("failed to hash backup codes: %w", err)
	}

	// 启用 2FA
	user.TwoFactorEnabled = true
	user.BackupCodes = hashedBackupCodes

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

	secret, err := s.resolveTwoFactorSecret(user)
	if err != nil {
		return fmt.Errorf("failed to load TOTP secret: %w", err)
	}

	// 验证 2FA 代码
	if !s.totpService.ValidateCode(secret, code) {
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

	secret, err := s.resolveTwoFactorSecret(user)
	if err != nil {
		return false, fmt.Errorf("failed to load TOTP secret: %w", err)
	}

	// 首先尝试验证 TOTP 代码
	if s.totpService.ValidateCode(secret, code) {
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

// === Authorization Code + PKCE ===

// CreateAuthorizationCode 为指定用户创建授权码（单实例内存存储）
func (s *authService) CreateAuthorizationCode(
	ctx context.Context,
	userID uuid.UUID,
	clientID, redirectURI, scope, codeChallenge, codeChallengeMethod string,
	expiresIn time.Duration,
) (string, error) {
	if clientID == "" || redirectURI == "" || codeChallenge == "" || codeChallengeMethod == "" {
		return "", errors.New("missing required parameters for authorization code")
	}

	// 目前仅支持 S256
	if strings.ToUpper(codeChallengeMethod) != "S256" {
		return "", errors.New("unsupported code_challenge_method, only S256 is supported")
	}

	// 生成高熵随机授权码
	codeUUID, err := uuid.NewRandom()
	if err != nil {
		return "", fmt.Errorf("failed to generate authorization code: %w", err)
	}
	code := codeUUID.String()

	if expiresIn <= 0 {
		expiresIn = 5 * time.Minute
	}

	s.authCodes.Set(code, authorizationCodeRecord{
		UserID:              userID,
		ClientID:            clientID,
		RedirectURI:         redirectURI,
		Scope:               scope,
		CodeChallenge:       codeChallenge,
		CodeChallengeMethod: strings.ToUpper(codeChallengeMethod),
		CreatedAt:           time.Now(),
	}, expiresIn)

	return code, nil
}

// ExchangeAuthorizationCodeForTokens 使用授权码和 PKCE code_verifier 换取访问令牌和刷新令牌
func (s *authService) ExchangeAuthorizationCodeForTokens(
	ctx context.Context,
	clientID, redirectURI, code, codeVerifier string,
	sessionInfo *SessionInfo,
) (*User, string, string, error) {
	if clientID == "" || redirectURI == "" || code == "" || codeVerifier == "" {
		return nil, "", "", errors.New("missing required parameters for token exchange")
	}

	record, ok := s.authCodes.Consume(code)
	if !ok {
		return nil, "", "", errors.New("invalid or expired authorization code")
	}

	// 检查 client_id 和 redirect_uri 是否匹配
	if record.ClientID != clientID {
		return nil, "", "", errors.New("client_id does not match authorization code")
	}
	if record.RedirectURI != redirectURI {
		return nil, "", "", errors.New("redirect_uri does not match authorization code")
	}

	// PKCE 验证：目前仅支持 S256
	if strings.ToUpper(record.CodeChallengeMethod) != "S256" {
		return nil, "", "", errors.New("unsupported code_challenge_method in stored authorization code")
	}

	// 计算 code_verifier 的 S256 摘要并进行 Base64URL 编码
	verifierHash := sha256.Sum256([]byte(codeVerifier))
	computedChallenge := base64.RawURLEncoding.EncodeToString(verifierHash[:])
	if computedChallenge != record.CodeChallenge {
		return nil, "", "", errors.New("code_verifier does not match code_challenge")
	}

	// 获取用户信息
	user, err := s.repo.FindByID(ctx, record.UserID)
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to load user for authorization code: %w", err)
	}

	// 为用户创建会话并生成令牌
	accessToken, refreshToken, err := s.CreateSessionWithTokens(ctx, user, sessionInfo)
	if err != nil {
		return nil, "", "", err
	}

	return user, accessToken, refreshToken, nil
}

// === Session Management ===

// ListUserSessions 获取用户的所有活跃会话
func (s *authService) ListUserSessions(ctx context.Context, userID uuid.UUID) ([]*Session, error) {
	return s.repo.ListUserSessions(ctx, userID)
}

// RevokeSession 撤销指定会话
func (s *authService) RevokeSession(ctx context.Context, userID uuid.UUID, sessionID uuid.UUID) error {
	// 首先验证会话属于该用户，并获取会话信息
	sessions, err := s.repo.ListUserSessions(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to list user sessions: %w", err)
	}

	// 检查会话是否属于该用户，并保存会话信息
	var targetSession *Session
	for _, session := range sessions {
		if session.ID == sessionID {
			targetSession = session
			break
		}
	}

	if targetSession == nil {
		return errors.New("session not found or does not belong to user")
	}

	// 注意：refresh token 在数据库中存储的是哈希值，无法直接加入黑名单
	// 但是当用户尝试使用该 refresh token 时，会在 RefreshAccessToken 中检查会话是否存在
	// 所以只需要删除会话记录即可

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
func (s *authService) UpdateNotificationSettings(ctx context.Context, userID uuid.UUID, emailLogin, emailAlert, browser, newDevice, newLocation, suspicious *bool) error {
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
	if newDevice != nil {
		user.NotifyNewDevice = *newDevice
	}
	if newLocation != nil {
		user.NotifyNewLocation = *newLocation
	}
	if suspicious != nil {
		user.NotifySuspicious = *suspicious
	}

	return s.repo.Update(ctx, user)
}

// UpdateMonitorDataSource 更新监控数据源设置
// dataSource: 要更新的数据源类型 (easyssh/nezha/komari)
// endpoint: API 端点地址（仅 nezha/komari 有效）
// token: API Token（仅 nezha/komari 有效）
// setActive: 是否将此数据源设为当前激活的数据源
func (s *authService) UpdateMonitorDataSource(ctx context.Context, userID uuid.UUID, dataSource, endpoint, token string, setActive bool) error {
	// 查找用户
	user, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return err
	}

	// 验证数据源类型
	dsType := MonitorDataSourceType(dataSource)
	switch dsType {
	case MonitorDataSourceEasySSH:
		// EasySSH 无需额外配置，只需设置为当前数据源
		if setActive {
			user.MonitorDataSource = dataSource
		}

	case MonitorDataSourceNezha:
		// 更新 Nezha 配置
		if endpoint != "" {
			user.NezhaAPIEndpoint = endpoint
		}
		if token != "" {
			user.NezhaAPIToken = token
		}
		if setActive {
			user.MonitorDataSource = dataSource
		}

	case MonitorDataSourceKomari:
		// 更新 Komari 配置
		if endpoint != "" {
			user.KomariAPIEndpoint = endpoint
		}
		if token != "" {
			user.KomariAPIToken = token
		}
		if setActive {
			user.MonitorDataSource = dataSource
		}

	default:
		return fmt.Errorf("invalid data source type: %s", dataSource)
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

	// 使用SHA-256哈希生成确定性种子
	hash := sha256.Sum256([]byte(seedInput))
	return fmt.Sprintf("%x", hash)
}

// generateDiceBearAvatar 生成DiceBear头像
func (s *authService) generateDiceBearAvatar(seed string) (string, error) {
	// DiceBear API URL - 使用notionists-neutral风格
	dicebearUrl := fmt.Sprintf("https://api.dicebear.com/7.x/notionists-neutral/svg?seed=%s", seed)

	// 创建带超时的 HTTP 客户端
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	// 发起HTTP请求获取SVG
	resp, err := client.Get(dicebearUrl)
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

// generateUsername 根据邮箱自动生成用户名
func (s *authService) generateUsername(email string) string {
	// 提取邮箱前缀（@之前的部分）
	parts := strings.Split(email, "@")
	prefix := parts[0]

	// 限制前缀长度（最多20个字符）
	if len(prefix) > 20 {
		prefix = prefix[:20]
	}

	// 生成6位随机后缀
	randomSuffix := fmt.Sprintf("%06d", time.Now().UnixNano()%1000000)

	return fmt.Sprintf("%s_%s", prefix, randomSuffix)
}
