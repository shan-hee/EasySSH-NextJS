package rest

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/easyssh/server/internal/api/middleware"
	"github.com/easyssh/server/internal/domain/auth"
	"github.com/easyssh/server/internal/domain/notification"
	"github.com/easyssh/server/internal/domain/security"
	"github.com/easyssh/server/internal/domain/systemconfig"
	"github.com/easyssh/server/internal/domain/verification"
	"github.com/easyssh/server/internal/pkg/password"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Cookie 配置常量
const (
	RefreshTokenCookieName = "easyssh_refresh_token"
	AccessTokenCookieName  = "easyssh_access_token"
)

// CookieConfig Cookie 配置（用于类型断言）
type CookieConfig struct {
	Secure bool
	Domain string
}

// getCookieConfig 从安全配置服务获取 Cookie 配置
func getCookieConfig(c *gin.Context, securityService security.Service) (secure bool, domain string, sameSite http.SameSite) {
	// 默认值
	secure = true
	domain = ""
	sameSite = http.SameSiteLaxMode

	// 从安全配置服务获取配置
	if securityService != nil {
		if config, err := securityService.GetCookieConfig(c.Request.Context()); err == nil {
			secure = config.Secure
			domain = config.Domain
		}
	}

	// 环境变量覆盖（可选）：COOKIE_SECURE, COOKIE_DOMAIN
	if v := strings.ToLower(strings.TrimSpace(os.Getenv("COOKIE_SECURE"))); v != "" {
		if v == "true" || v == "1" || v == "yes" || v == "on" {
			secure = true
		} else if v == "false" || v == "0" || v == "no" || v == "off" {
			secure = false
		}
	}
	if v := strings.TrimSpace(os.Getenv("COOKIE_DOMAIN")); v != "" {
		domain = v
	}

	// 允许通过环境变量覆盖 SameSite 策略：COOKIE_SAMESITE=none|lax|strict
	switch strings.ToLower(strings.TrimSpace(os.Getenv("COOKIE_SAMESITE"))) {
	case "none":
		sameSite = http.SameSiteNoneMode
	case "strict":
		sameSite = http.SameSiteStrictMode
	case "lax", "":
		sameSite = http.SameSiteLaxMode
	default:
		sameSite = http.SameSiteLaxMode
	}

	return secure, domain, sameSite
}

// setAuthCookies 设置认证相关的 HttpOnly Cookie（仅用于 refresh_token）
func setAuthCookies(c *gin.Context, refreshToken string, securityService security.Service, refreshTokenMaxAge int) {
	secure, domain, sameSite := getCookieConfig(c, securityService)

	http.SetCookie(c.Writer, &http.Cookie{
		Name:  RefreshTokenCookieName,
		Value: refreshToken,
		// 将 refresh_token Cookie 限定在 /api/v1/oauth 路径下，仅用于令牌刷新相关端点
		Path:     "/api/v1/oauth",
		Domain:   domain,
		MaxAge:   refreshTokenMaxAge,
		Secure:   secure,
		HttpOnly: true,
		SameSite: sameSite,
	})
}

// clearAuthCookies 清除认证相关的 Cookie（仅清理当前版本使用的路径）
func clearAuthCookies(c *gin.Context, securityService security.Service) {
	secure, domain, sameSite := getCookieConfig(c, securityService)

	// 清理当前使用的 /api/v1/oauth 路径上的 refresh_token Cookie
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     RefreshTokenCookieName,
		Value:    "",
		Path:     "/api/v1/oauth",
		Domain:   domain,
		MaxAge:   -1,
		Secure:   secure,
		HttpOnly: true,
		SameSite: sameSite,
	})
}

func clearAccessTokenCookie(c *gin.Context, securityService security.Service) {
	secure, domain, sameSite := getCookieConfig(c, securityService)
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     AccessTokenCookieName,
		Value:    "",
		Path:     "/api/v1",
		Domain:   domain,
		MaxAge:   -1,
		Secure:   secure,
		HttpOnly: true,
		SameSite: sameSite,
	})
}

// extractDeviceInfo 从请求中提取设备信息
func extractDeviceInfo(c *gin.Context) (deviceType, deviceName, ipAddress, userAgent string) {
	// 获取 User-Agent
	userAgent = c.GetHeader("User-Agent")
	if userAgent == "" {
		userAgent = "Unknown"
	}

	// 解析设备类型和名称
	ua := strings.ToLower(userAgent)

	// 判断设备类型
	if strings.Contains(ua, "mobile") || strings.Contains(ua, "android") || strings.Contains(ua, "iphone") {
		deviceType = "mobile"
	} else if strings.Contains(ua, "tablet") || strings.Contains(ua, "ipad") {
		deviceType = "tablet"
	} else {
		deviceType = "desktop"
	}

	// 解析浏览器/设备名称
	switch {
	case strings.Contains(ua, "edg/") || strings.Contains(ua, "edge"):
		deviceName = "Microsoft Edge"
	case strings.Contains(ua, "chrome") && !strings.Contains(ua, "edg"):
		deviceName = "Google Chrome"
	case strings.Contains(ua, "firefox"):
		deviceName = "Mozilla Firefox"
	case strings.Contains(ua, "safari") && !strings.Contains(ua, "chrome"):
		deviceName = "Safari"
	case strings.Contains(ua, "opera") || strings.Contains(ua, "opr/"):
		deviceName = "Opera"
	default:
		deviceName = "Unknown Browser"
	}

	// 获取 IP 地址（考虑代理）
	ipAddress = c.ClientIP()
	if ipAddress == "" {
		ipAddress = "Unknown"
	}

	return deviceType, deviceName, ipAddress, userAgent
}

// AuthHandler 认证处理器
type AuthHandler struct {
	authService            auth.Service
	jwtService             auth.JWTService
	securityService        security.Service          // 安全配置服务
	accessTokenTTLSeconds  int                       // Access Token 有效期（秒）
	refreshTokenTTLSeconds int                       // Refresh Token Cookie 有效期（秒）
	systemConfigService    systemconfig.Service      // 系统配置服务（用于在 /auth/status 中返回公共配置）
	verificationService    verification.Service      // 验证码服务
	emailService           notification.EmailService // 邮件服务
}

// NewAuthHandler 创建认证处理器
func NewAuthHandler(
	authService auth.Service,
	jwtService auth.JWTService,
	securityService security.Service,
	accessTokenTTLSeconds, refreshTokenTTLSeconds int,
	systemConfigService systemconfig.Service,
	verificationService verification.Service,
	emailService notification.EmailService,
) *AuthHandler {
	return &AuthHandler{
		authService:            authService,
		jwtService:             jwtService,
		securityService:        securityService,
		accessTokenTTLSeconds:  accessTokenTTLSeconds,
		refreshTokenTTLSeconds: refreshTokenTTLSeconds,
		systemConfigService:    systemConfigService,
		verificationService:    verificationService,
		emailService:           emailService,
	}
}

// RunMode 运行模式类型
type RunMode string

const (
	RunModeDemo        RunMode = "demo"
	RunModeDevelopment RunMode = "development"
	RunModeProduction  RunMode = "production"
)

// RegisterRequest 注册请求
type RegisterRequest struct {
	Username         string  `json:"username"` // 可选，为空时自动生成
	Email            string  `json:"email" binding:"required,email"`
	Password         string  `json:"password" binding:"required,min=6"`
	VerificationCode string  `json:"verification_code" binding:"required,len=6"` // 邮箱验证码
	RunMode          RunMode `json:"run_mode,omitempty"`                         // 运行模式（可选，仅用于初始化管理员）
}

// InitializeAdminRequest 初始化管理员请求
type InitializeAdminRequest struct {
	Username string  `json:"username" binding:"required"`
	Email    string  `json:"email" binding:"required,email"`
	Password string  `json:"password" binding:"required,min=6"`
	RunMode  RunMode `json:"run_mode,omitempty"`
}

// ChangePasswordRequest 修改密码请求
type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=6"`
}

// ResetPasswordRequest 重置密码请求
type ResetPasswordRequest struct {
	Email            string `json:"email" binding:"required,email"`
	VerificationCode string `json:"verification_code" binding:"required,len=6"`
	NewPassword      string `json:"new_password" binding:"required,min=6"`
}

// UpdateProfileRequest 更新资料请求
type UpdateProfileRequest struct {
	Username         string  `json:"username,omitempty"`          // 用户名（可修改）
	Email            string  `json:"email,omitempty"`             // 新邮箱地址
	VerificationCode string  `json:"verification_code,omitempty"` // 邮箱验证码（修改邮箱时必需）
	Avatar           *string `json:"avatar"`                      // 使用指针类型区分"未提供"和"空字符串"
	Language         string  `json:"language,omitempty"`          // 用户界面语言偏好，如 zh-CN、en-US
	Timezone         string  `json:"timezone,omitempty"`          // 用户时区偏好，如 Asia/Shanghai
}

// AuthResponse 认证响应
type AuthResponse struct {
	User        interface{} `json:"user"`
	AccessToken string      `json:"access_token"`
	TokenType   string      `json:"token_type"`
	ExpiresIn   int         `json:"expires_in"` // 秒
}

// OAuthAuthorizeRequest PKCE 授权请求（开发版：采用 JSON 提交邮箱密码）
type OAuthAuthorizeRequest struct {
	ResponseType        string `json:"response_type" binding:"required"` // 期望为 "code"
	ClientID            string `json:"client_id" binding:"required"`
	RedirectURI         string `json:"redirect_uri" binding:"required"`
	Scope               string `json:"scope"`
	CodeChallenge       string `json:"code_challenge" binding:"required"`
	CodeChallengeMethod string `json:"code_challenge_method" binding:"required"` // 期望为 "S256"
	State               string `json:"state"`

	// 登录凭证（邮箱 + 密码）
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// OAuthAuthorizeResponse 授权码响应
type OAuthAuthorizeResponse struct {
	Code  string `json:"code"`
	State string `json:"state"`
}

// OAuthTokenRequest Token 请求
type OAuthTokenRequest struct {
	GrantType    string `json:"grant_type" binding:"required"` // authorization_code 或 refresh_token
	Code         string `json:"code,omitempty"`
	RedirectURI  string `json:"redirect_uri,omitempty"`
	ClientID     string `json:"client_id,omitempty"`
	CodeVerifier string `json:"code_verifier,omitempty"`
}

// OAuthTokenResponse Token 响应（不返回 refresh_token，本身仅存在于 HttpOnly Cookie）
type OAuthTokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
}

// SendPasswordResetCode 发送密码重置验证码
// POST /api/v1/auth/send-password-reset-code
func (h *AuthHandler) SendPasswordResetCode(c *gin.Context) {
	// 定义请求结构
	type SendPasswordResetCodeRequest struct {
		Email string `json:"email" binding:"required,email"`
	}

	var req SendPasswordResetCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 检查验证码服务是否可用
	if h.verificationService == nil {
		c.Error(fmt.Errorf("verification service is nil"))
		RespondError(c, http.StatusServiceUnavailable, "service_unavailable", "Verification service is not available. Please contact administrator.")
		return
	}

	// 检查邮件服务是否可用
	if h.emailService == nil {
		c.Error(fmt.Errorf("email service is nil - SMTP not configured"))
		RespondError(c, http.StatusServiceUnavailable, "email_not_configured", "Email service is not configured. Please configure SMTP settings in: Settings > Integrations > Email Notifications")
		return
	}

	// 检查用户是否存在
	user, err := h.authService.GetUserByEmail(c.Request.Context(), req.Email)
	if err != nil {
		// 为了安全，不透露用户是否存在，统一返回成功
		RespondSuccess(c, gin.H{
			"message":    "If the email exists, a password reset code has been sent",
			"expires_in": 300, // 5分钟
		})
		return
	}

	// 使用密码重置验证码类型
	codeType := verification.TypePasswordReset

	// 检查是否可以发送（频率限制）
	canSend, err := h.verificationService.CanSendWithType(c.Request.Context(), req.Email, codeType)
	if err != nil {
		c.Error(err)
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to check send status")
		return
	}
	if !canSend {
		RespondError(c, http.StatusTooManyRequests, "too_frequent", "Please wait 60 seconds before requesting another code")
		return
	}

	// 生成并存储验证码
	if err := h.verificationService.GenerateAndSendWithType(c.Request.Context(), req.Email, codeType); err != nil {
		c.Error(err)
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to generate verification code")
		return
	}

	// 获取验证码
	code, err := h.verificationService.GetCodeWithType(c.Request.Context(), req.Email, codeType)
	if err != nil {
		c.Error(err)
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to get verification code")
		return
	}

	// 发送密码重置验证码邮件
	if err := h.emailService.SendPasswordResetCode(c.Request.Context(), user.Email, code); err != nil {
		c.Error(err)
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to send password reset code email")
		return
	}

	// 返回成功响应
	RespondSuccess(c, gin.H{
		"message":    "Password reset code sent successfully",
		"expires_in": 300, // 5分钟
	})
}

// SendVerificationCode 发送邮箱验证码
// POST /api/v1/auth/send-verification-code
func (h *AuthHandler) SendVerificationCode(c *gin.Context) {
	// 定义请求结构
	type SendVerificationCodeRequest struct {
		Email string `json:"email" binding:"required,email"`
		Type  string `json:"type,omitempty"` // 验证码类型: register, password_reset, email_change
	}

	var req SendVerificationCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 检查验证码服务是否可用
	if h.verificationService == nil {
		c.Error(fmt.Errorf("verification service is nil"))
		RespondError(c, http.StatusServiceUnavailable, "service_unavailable", "Verification service is not available. Please contact administrator.")
		return
	}

	// 检查邮件服务是否可用
	if h.emailService == nil {
		c.Error(fmt.Errorf("email service is nil - SMTP not configured"))
		RespondError(c, http.StatusServiceUnavailable, "email_not_configured", "Email service is not configured. Please configure SMTP settings in: Settings > Integrations > Email Notifications")
		return
	}

	// 根据请求中的 type 参数确定验证码类型
	var codeType verification.VerificationCodeType
	switch req.Type {
	case "password_reset":
		codeType = verification.TypePasswordReset
	case "email_change":
		codeType = verification.TypeEmailChange
	default:
		codeType = verification.TypeRegister
	}

	// 检查是否可以发送（频率限制）
	canSend, err := h.verificationService.CanSendWithType(c.Request.Context(), req.Email, codeType)
	if err != nil {
		c.Error(err)
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to check send status")
		return
	}
	if !canSend {
		RespondError(c, http.StatusTooManyRequests, "too_frequent", "Please wait 60 seconds before requesting another code")
		return
	}

	// 生成并存储验证码
	if err := h.verificationService.GenerateAndSendWithType(c.Request.Context(), req.Email, codeType); err != nil {
		c.Error(err)
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to generate verification code")
		return
	}

	// 获取验证码
	code, err := h.verificationService.GetCodeWithType(c.Request.Context(), req.Email, codeType)
	if err != nil {
		c.Error(err)
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to get verification code")
		return
	}

	// 发送验证码邮件
	if err := h.emailService.SendVerificationCode(c.Request.Context(), req.Email, code); err != nil {
		c.Error(err)
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to send verification code email")
		return
	}

	// 返回成功响应
	RespondSuccess(c, gin.H{
		"message":    "Verification code sent successfully",
		"expires_in": 300, // 5分钟
	})
}

// Register 注册新用户
// POST /api/v1/auth/register
func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 验证密码强度
	if err := password.ValidateWithDefault(req.Password); err != nil {
		if password.IsValidationError(err) {
			RespondError(c, http.StatusBadRequest, "password_policy_error", err.Error())
			return
		}
		RespondError(c, http.StatusBadRequest, "validation_error", "Invalid password")
		return
	}

	// 检查是否允许注册
	if h.systemConfigService != nil {
		config, err := h.systemConfigService.Get(c.Request.Context())
		if err == nil && config != nil && !config.AllowRegistration {
			RespondError(c, http.StatusForbidden, "registration_disabled", "User registration is currently disabled")
			return
		}
	}

	// 验证邮箱验证码
	if h.verificationService != nil {
		if err := h.verificationService.VerifyWithType(c.Request.Context(), req.Email, req.VerificationCode, verification.TypeRegister); err != nil {
			// 根据错误类型返回不同的错误信息
			errMsg := "Invalid or expired verification code"
			if err.Error() == "verification code not found" {
				errMsg = "Verification code not found, please request a new one"
			} else if err.Error() == "too many verification attempts" {
				errMsg = "Too many failed attempts, please request a new code"
			} else if err.Error() == "verification code invalid" {
				errMsg = "Invalid verification code"
			}
			RespondError(c, http.StatusBadRequest, "verification_failed", errMsg)
			return
		}
	}

	// 从系统配置获取默认角色
	defaultRole := auth.RoleUser
	if h.systemConfigService != nil {
		sysConfig, err := h.systemConfigService.Get(c.Request.Context())
		if err == nil && sysConfig.DefaultRole != "" {
			switch sysConfig.DefaultRole {
			case "viewer":
				defaultRole = auth.RoleViewer
			case "user":
				defaultRole = auth.RoleUser
			}
		}
	}

	// 注册用户（使用系统配置的默认角色，username 自动生成）
	user, err := h.authService.Register(c.Request.Context(), req.Email, req.Password, defaultRole)
	if err != nil {
		if errors.Is(err, auth.ErrUserAlreadyExists) {
			RespondError(c, http.StatusConflict, "user_exists", "Email already exists")
			return
		}
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to register user")
		return
	}

	// 提取设备信息，用于创建会话
	deviceType, deviceName, ipAddress, userAgent := extractDeviceInfo(c)
	sessionInfo := &auth.SessionInfo{
		DeviceType: deviceType,
		DeviceName: deviceName,
		IPAddress:  ipAddress,
		UserAgent:  userAgent,
	}

	// 创建会话并生成令牌（带 session_id）
	accessToken, refreshToken, err := h.authService.CreateSessionWithTokens(c.Request.Context(), user, sessionInfo)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to generate tokens")
		return
	}

	// 设置 HttpOnly refresh_token Cookie（与登录流程保持一致）
	if strings.TrimSpace(refreshToken) != "" {
		setAuthCookies(c, refreshToken, h.securityService, h.refreshTokenTTLSeconds)
	}
	clearAccessTokenCookie(c, h.securityService)

	// 在上下文中记录用户信息，便于审计日志使用
	c.Set("user_id", user.ID.String())
	c.Set("username", user.Username)

	RespondCreated(c, AuthResponse{
		User:        user.ToPublic(),
		AccessToken: accessToken,
		TokenType:   "Bearer",
		ExpiresIn:   h.accessTokenTTLSeconds,
	})
}

// OAuthAuthorize 使用邮箱密码 + PKCE 创建授权码（开发版：JSON 接口，不做浏览器跳转）
// POST /api/v1/oauth/authorize
func (h *AuthHandler) OAuthAuthorize(c *gin.Context) {
	var req OAuthAuthorizeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 基本参数校验
	if strings.ToLower(strings.TrimSpace(req.ResponseType)) != "code" {
		RespondError(c, http.StatusBadRequest, "invalid_request", "response_type must be 'code'")
		return
	}

	if strings.TrimSpace(req.ClientID) == "" || strings.TrimSpace(req.RedirectURI) == "" {
		RespondError(c, http.StatusBadRequest, "invalid_request", "client_id and redirect_uri are required")
		return
	}

	if !strings.EqualFold(req.ClientID, "easyssh-web") {
		// 开发版：仅接受内置 SPA 客户端
		RespondError(c, http.StatusBadRequest, "invalid_client", "unsupported client_id")
		return
	}

	// 仅支持 S256
	if !strings.EqualFold(req.CodeChallengeMethod, "S256") {
		RespondError(c, http.StatusBadRequest, "invalid_request", "code_challenge_method must be 'S256'")
		return
	}

	// 获取客户端 IP 和 User-Agent
	clientIP := c.ClientIP()
	userAgent := c.GetHeader("User-Agent")

	// 认证用户（使用邮箱，支持账户锁定检查）
	result, err := h.authService.AuthenticateUserWithContext(c.Request.Context(), req.Email, req.Password, clientIP, userAgent)
	if err != nil {
		// 处理 IP 锁定
		if errors.Is(err, auth.ErrIPLocked) {
			response := gin.H{
				"error":   "ip_locked",
				"message": "Too many failed login attempts from this IP address. Please try again later.",
			}
			if result != nil && result.UnlockAt != nil {
				response["unlock_at"] = result.UnlockAt.Format(time.RFC3339)
			}
			c.JSON(http.StatusTooManyRequests, response)
			return
		}
		// 处理账户锁定
		if errors.Is(err, auth.ErrAccountLocked) {
			response := gin.H{
				"error":   "account_locked",
				"message": "Account is temporarily locked due to too many failed login attempts. Please try again later.",
			}
			if result != nil && result.UnlockAt != nil {
				response["unlock_at"] = result.UnlockAt.Format(time.RFC3339)
			}
			c.JSON(http.StatusTooManyRequests, response)
			return
		}
		// 处理无效凭证
		if errors.Is(err, auth.ErrInvalidCredentials) {
			RespondError(c, http.StatusUnauthorized, "invalid_credentials", "Invalid email or password")
			return
		}
		RespondError(c, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	user := result.User

	// 登录成功,设置用户信息到上下文,以便审计日志记录
	c.Set("user_id", user.ID.String())
	c.Set("username", user.Username)

	// 如果启用了 2FA：先返回临时令牌，前端再走 /auth/2fa/verify 完成 2FA + 授权码签发
	if user.TwoFactorEnabled {
		tempToken, err := h.jwtService.GenerateTempToken(user.ID.String())
		if err != nil {
			RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to generate temp token")
			return
		}

		RespondSuccess(c, gin.H{
			"requires_2fa": true,
			"temp_token":   tempToken,
			"state":        req.State,
		})
		return
	}

	// 生成授权码，有效期 5 分钟
	code, err := h.authService.CreateAuthorizationCode(
		c.Request.Context(),
		user.ID,
		req.ClientID,
		req.RedirectURI,
		req.Scope,
		req.CodeChallenge,
		req.CodeChallengeMethod,
		5*time.Minute,
	)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	// 为审计日志记录用户信息
	c.Set("user_id", user.ID.String())
	c.Set("username", user.Username)

	RespondSuccess(c, OAuthAuthorizeResponse{
		Code:  code,
		State: req.State,
	})
}

// OAuthToken OAuth Token 端点
// POST /api/v1/oauth/token
func (h *AuthHandler) OAuthToken(c *gin.Context) {
	var req OAuthTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}

	grantType := strings.ToLower(strings.TrimSpace(req.GrantType))

	switch grantType {
	case "authorization_code":
		// 授权码模式
		if strings.TrimSpace(req.Code) == "" ||
			strings.TrimSpace(req.RedirectURI) == "" ||
			strings.TrimSpace(req.ClientID) == "" ||
			strings.TrimSpace(req.CodeVerifier) == "" {
			RespondError(c, http.StatusBadRequest, "invalid_request", "code, redirect_uri, client_id and code_verifier are required")
			return
		}

		// 提取设备信息用于会话记录
		deviceType, deviceName, ipAddress, userAgent := extractDeviceInfo(c)
		sessionInfo := &auth.SessionInfo{
			DeviceType: deviceType,
			DeviceName: deviceName,
			IPAddress:  ipAddress,
			UserAgent:  userAgent,
		}

		user, accessToken, refreshToken, err := h.authService.ExchangeAuthorizationCodeForTokens(
			c.Request.Context(),
			req.ClientID,
			req.RedirectURI,
			req.Code,
			req.CodeVerifier,
			sessionInfo,
		)
		if err != nil {
			RespondError(c, http.StatusBadRequest, "invalid_grant", err.Error())
			return
		}

		// 设置 HttpOnly refresh_token Cookie
		if refreshToken != "" {
			setAuthCookies(c, refreshToken, h.securityService, h.refreshTokenTTLSeconds)
		}

		// access_token 仅通过响应体返回，前端仅存内存；清理历史遗留的 access_token Cookie
		clearAccessTokenCookie(c, h.securityService)

		// 在上下文中记录用户信息，便于审计日志使用
		c.Set("user_id", user.ID.String())
		c.Set("username", user.Username)

		RespondSuccess(c, OAuthTokenResponse{
			AccessToken: accessToken,
			TokenType:   "Bearer",
			ExpiresIn:   h.accessTokenTTLSeconds,
		})

	case "refresh_token":
		// 刷新模式：从 HttpOnly Cookie 读取 refresh_token
		refreshToken, err := c.Cookie(RefreshTokenCookieName)
		if err == nil {
			refreshToken = strings.TrimSpace(refreshToken)
		}

		if refreshToken == "" {
			clearAuthCookies(c, h.securityService)
			clearAccessTokenCookie(c, h.securityService)
			RespondError(c, http.StatusUnauthorized, "invalid_token", "Missing refresh token")
			return
		}

		newAccessToken, newRefreshToken, err := h.authService.RefreshAccessToken(c.Request.Context(), refreshToken)
		if err != nil {
			if errors.Is(err, auth.ErrInvalidToken) ||
				errors.Is(err, auth.ErrExpiredToken) ||
				errors.Is(err, auth.ErrTokenFamilyRevoked) ||
				errors.Is(err, auth.ErrTokenReuseDetected) ||
				errors.Is(err, auth.ErrSessionNotFound) ||
				errors.Is(err, auth.ErrSessionExpired) ||
				errors.Is(err, auth.ErrSessionSyncFailed) {
				clearAuthCookies(c, h.securityService)
				clearAccessTokenCookie(c, h.securityService)
				RespondError(c, http.StatusUnauthorized, "invalid_token", "Invalid or expired refresh token")
				return
			}
			RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to refresh token")
			return
		}

		// 如有轮换，更新 refresh_token Cookie
		if newRefreshToken != "" {
			setAuthCookies(c, newRefreshToken, h.securityService, h.refreshTokenTTLSeconds)
		}

		// access_token 仅通过响应体返回，前端仅存内存；清理历史遗留的 access_token Cookie
		clearAccessTokenCookie(c, h.securityService)

		RespondSuccess(c, OAuthTokenResponse{
			AccessToken: newAccessToken,
			TokenType:   "Bearer",
			ExpiresIn:   h.accessTokenTTLSeconds,
		})

	default:
		RespondError(c, http.StatusBadRequest, "unsupported_grant_type", "grant_type must be 'authorization_code' or 'refresh_token'")
	}
}

// Logout 用户登出
// POST /api/v1/oauth/logout
// POST /api/v1/auth/logout
func (h *AuthHandler) Logout(c *gin.Context) {
	// 从 Authorization 头获取 access_token（Bearer）
	var accessToken string
	if authHeader := c.GetHeader("Authorization"); authHeader != "" {
		parts := strings.Fields(authHeader)
		if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
			accessToken = strings.TrimSpace(parts[1])
		}
	}

	// 从 Cookie 获取 refresh_token（用于完全失效）
	var refreshToken string
	if cookieToken, err := c.Cookie(RefreshTokenCookieName); err == nil {
		refreshToken = strings.TrimSpace(cookieToken)
	}

	// 如果没有任何 token, 视为幂等登出（仅清理 Cookie）
	if accessToken == "" && refreshToken == "" {
		clearAuthCookies(c, h.securityService)
		clearAccessTokenCookie(c, h.securityService)
		RespondSuccessWithMessage(c, nil, "Logged out successfully")
		return
	}

	// 优先尝试根据 access_token 中的 session_id 撤销当前会话（不会阻止后续流程）
	if accessToken != "" {
		if claims, err := h.jwtService.ValidateToken(accessToken); err == nil {
			if claims.SessionID != uuid.Nil {
				_ = h.authService.RevokeSession(c.Request.Context(), claims.UserID, claims.SessionID)
			}
		}
	} else if refreshToken != "" {
		if claims, err := h.jwtService.ValidateToken(refreshToken); err == nil {
			if claims.SessionID != uuid.Nil {
				_ = h.authService.RevokeSession(c.Request.Context(), claims.UserID, claims.SessionID)
			}
		}
	}

	// 将 access_token 和 refresh_token 同时加入黑名单（忽略错误以保持幂等性）
	// 使用 LogoutWithRefreshToken 确保 refresh_token 也完全失效
	if err := h.authService.LogoutWithRefreshToken(c.Request.Context(), accessToken, refreshToken); err != nil {
		// 记录错误但不阻止后续清理
		// 为避免泄露细节，这里不返回错误给客户端
	}

	// 清除 HttpOnly Cookie
	clearAuthCookies(c, h.securityService)
	clearAccessTokenCookie(c, h.securityService)

	RespondSuccessWithMessage(c, nil, "Logged out successfully")
}

// GetCurrentUser 获取当前用户信息
// GET /api/v1/users/me
func (h *AuthHandler) GetCurrentUser(c *gin.Context) {
	// 从上下文获取用户 ID（由认证中间件设置）
	userID, exists := c.Get("user_id")
	if !exists {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "User not authenticated")
		return
	}

	// 类型断言
	uid, ok := userID.(string)
	if !ok {
		RespondError(c, http.StatusInternalServerError, "internal_error", "Invalid user ID format")
		return
	}

	// 解析 UUID
	parsedUID, err := parseUUID(uid)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_user_id", "Invalid user ID")
		return
	}

	// 查询用户
	user, err := h.authService.GetUserByID(c.Request.Context(), parsedUID)
	if err != nil {
		if errors.Is(err, auth.ErrUserNotFound) {
			RespondError(c, http.StatusNotFound, "user_not_found", "User not found")
			return
		}
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to get user")
		return
	}

	RespondSuccess(c, user.ToPublic())
}

// ChangePassword 修改密码
// PUT /api/v1/users/me/password
func (h *AuthHandler) ChangePassword(c *gin.Context) {
	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 验证新密码强度
	if err := password.ValidateWithDefault(req.NewPassword); err != nil {
		if password.IsValidationError(err) {
			RespondError(c, http.StatusBadRequest, "password_policy_error", err.Error())
			return
		}
		RespondError(c, http.StatusBadRequest, "validation_error", "Invalid password")
		return
	}

	// 从上下文获取用户 ID
	userID, exists := c.Get("user_id")
	if !exists {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "User not authenticated")
		return
	}

	uid, _ := userID.(string)
	parsedUID, _ := parseUUID(uid)

	// 修改密码
	if err := h.authService.ChangePassword(c.Request.Context(), parsedUID, req.OldPassword, req.NewPassword); err != nil {
		RespondError(c, http.StatusBadRequest, "change_password_failed", err.Error())
		return
	}

	RespondSuccessWithMessage(c, nil, "Password changed successfully")
}

// ResetPassword 重置密码（忘记密码）
// POST /api/v1/auth/reset-password
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 验证新密码强度
	if err := password.ValidateWithDefault(req.NewPassword); err != nil {
		if password.IsValidationError(err) {
			RespondError(c, http.StatusBadRequest, "password_policy_error", err.Error())
			return
		}
		RespondError(c, http.StatusBadRequest, "validation_error", "Invalid password")
		return
	}

	// 检查验证码服务是否可用
	if h.verificationService == nil {
		c.Error(fmt.Errorf("verification service is nil"))
		RespondError(c, http.StatusServiceUnavailable, "service_unavailable", "Verification service is not available. Please contact administrator.")
		return
	}

	// 验证密码重置验证码
	codeType := verification.TypePasswordReset
	if err := h.verificationService.VerifyWithType(c.Request.Context(), req.Email, req.VerificationCode, codeType); err != nil {
		// 记录错误以便调试
		c.Error(fmt.Errorf("verification failed: %w", err))

		// 根据错误类型返回不同的错误信息
		errMsg := "Invalid or expired verification code"
		errStr := err.Error()
		if errStr == "verification code not found" {
			errMsg = "Verification code not found, please request a new one"
		} else if errStr == "too many verification attempts" {
			errMsg = "Too many failed attempts, please request a new code"
		} else if errStr == "verification code invalid" {
			errMsg = "Invalid verification code"
		}
		RespondError(c, http.StatusBadRequest, "verification_failed", errMsg)
		return
	}

	// 获取用户
	user, err := h.authService.GetUserByEmail(c.Request.Context(), req.Email)
	if err != nil {
		if errors.Is(err, auth.ErrUserNotFound) {
			RespondError(c, http.StatusNotFound, "user_not_found", "User not found")
			return
		}
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to get user")
		return
	}

	// 重置密码（直接设置新密码，不需要旧密码）
	if err := h.authService.ResetPassword(c.Request.Context(), user.ID, req.NewPassword); err != nil {
		c.Error(fmt.Errorf("reset password failed: %w", err))
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to reset password")
		return
	}

	RespondSuccessWithMessage(c, nil, "Password reset successfully")
}

// UpdateProfile 更新用户资料
// PUT /api/v1/users/me
func (h *AuthHandler) UpdateProfile(c *gin.Context) {
	var req UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 从上下文获取用户 ID
	userID, exists := c.Get("user_id")
	if !exists {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "User not authenticated")
		return
	}

	uid, _ := userID.(string)
	parsedUID, _ := parseUUID(uid)

	// 如果用户尝试修改邮箱，需要验证验证码
	if req.Email != "" {
		// 获取当前用户信息
		currentUser, err := h.authService.GetUserByID(c.Request.Context(), parsedUID)
		if err != nil {
			RespondError(c, http.StatusInternalServerError, "user_not_found", "Failed to get user information")
			return
		}

		// 如果新邮箱与当前邮箱不同，需要验证验证码
		if req.Email != currentUser.Email {
			if req.VerificationCode == "" {
				RespondError(c, http.StatusBadRequest, "verification_required", "Verification code is required when changing email")
				return
			}

			// 验证邮箱验证码（使用新邮箱地址验证）
			if h.verificationService != nil {
				if err := h.verificationService.VerifyWithType(c.Request.Context(), req.Email, req.VerificationCode, verification.TypeEmailChange); err != nil {
					// 根据错误类型返回不同的错误信息
					errMsg := "Invalid or expired verification code"
					if err.Error() == "verification code not found" {
						errMsg = "Verification code not found, please request a new one"
					} else if err.Error() == "too many verification attempts" {
						errMsg = "Too many failed attempts, please request a new code"
					} else if err.Error() == "verification code invalid" {
						errMsg = "Invalid verification code"
					}
					RespondError(c, http.StatusBadRequest, "verification_failed", errMsg)
					return
				}
			}
		}
	}

	// 处理 avatar 参数：如果提供了指针，使用其值（可能是空字符串）；否则使用特殊标记表示不更新
	avatarValue := "\x00" // 特殊标记，表示不更新头像
	if req.Avatar != nil {
		avatarValue = *req.Avatar
	}

	// 更新资料
	if err := h.authService.UpdateProfile(
		c.Request.Context(),
		parsedUID,
		req.Username,
		req.Email,
		avatarValue,
		req.Language,
		req.Timezone,
	); err != nil {
		RespondError(c, http.StatusInternalServerError, "update_failed", "Failed to update profile")
		return
	}

	RespondSuccessWithMessage(c, nil, "Profile updated successfully")
}

// CheckStatus 检查系统和认证状态
// GET /api/v1/auth/status
func (h *AuthHandler) CheckStatus(c *gin.Context) {
	// 检查是否需要初始化
	hasAdmin, err := h.authService.HasAdmin(c.Request.Context())
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "check_failed", "Failed to check system status")
		return
	}

	response := gin.H{
		"need_init":                !hasAdmin,
		"is_authenticated":         false,
		"access_token_ttl_seconds": h.accessTokenTTLSeconds, // 统一配置的TTL
	}

	// 检查账户是否被锁定（由 OptionalAuth 中间件设置）
	if accountLocked, exists := c.Get("account_locked"); exists && accountLocked.(bool) {
		response["account_locked"] = true
		if lockedUntil, exists := c.Get("locked_until"); exists && lockedUntil != nil {
			response["locked_until"] = lockedUntil
		}
		if lockReason, exists := c.Get("lock_reason"); exists && lockReason != "" {
			response["lock_reason"] = lockReason
		}
	}

	// 如果已有管理员，检查当前用户是否已认证
	if hasAdmin {
		// 1. 使用 OptionalAuth 中间件在上下文中解析的用户信息（Authorization: Bearer）
		userIDStr, exists := c.Get("user_id")
		if exists && userIDStr != "" {
			// 解析 UUID
			userID, err := uuid.Parse(userIDStr.(string))
			if err == nil {
				// 用户已认证，获取用户信息
				user, err := h.authService.GetUserByID(c.Request.Context(), userID)
				if err == nil && user != nil {
					response["is_authenticated"] = true
					// 与 /users/me 保持一致，返回公开用户信息
					response["user"] = user.ToPublic()

					// 尝试根据 Authorization 头中的 Bearer Token 计算剩余有效期
					if authHeader := c.GetHeader("Authorization"); authHeader != "" {
						parts := strings.Fields(authHeader)
						if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
							tokenString := strings.TrimSpace(parts[1])
							if claims, err := h.jwtService.ValidateToken(tokenString); err == nil && claims.ExpiresAt != nil {
								now := time.Now()
								remaining := claims.ExpiresAt.Time.Sub(now).Seconds()
								if remaining < 0 {
									remaining = 0
								}
								response["access_token_expires_in"] = int(remaining)
							}
						}
					}
				}
			}
		}

		// 刷新逻辑由前端 apiFetch 统一处理:
		// 收到 401 时自动调用 /api/v1/oauth/token (grant_type=refresh_token) 并重放原请求，
		// 因此此处不再直接读取 refresh_token Cookie。
	}

	// 附带公共系统配置（未登录场景下也可使用）
	if h.systemConfigService != nil {
		if cfg, err := h.systemConfigService.Get(c.Request.Context()); err == nil && cfg != nil {
			completionProviders := systemconfig.DefaultCompletionProviders()
			if cfg.CompletionProviders != "" {
				var parsed systemconfig.CompletionProvidersConfig
				if unmarshalErr := json.Unmarshal([]byte(cfg.CompletionProviders), &parsed); unmarshalErr == nil {
					completionProviders = &parsed
				}
			}

			completionQuotas := systemconfig.DefaultCompletionQuotas()
			if cfg.CompletionQuotas != "" {
				var parsed systemconfig.CompletionQuotasConfig
				if unmarshalErr := json.Unmarshal([]byte(cfg.CompletionQuotas), &parsed); unmarshalErr == nil {
					completionQuotas = &parsed
				}
			}

			completionCache := systemconfig.DefaultCompletionCache()
			if cfg.CompletionCache != "" {
				var parsed systemconfig.CompletionCacheConfig
				if unmarshalErr := json.Unmarshal([]byte(cfg.CompletionCache), &parsed); unmarshalErr == nil {
					completionCache = &parsed
				}
			}

			response["system_config"] = gin.H{
				"system_name":               cfg.SystemName,
				"system_logo":               cfg.SystemLogo,
				"system_favicon":            cfg.SystemFavicon,
				"default_language":          cfg.DefaultLanguage,
				"default_timezone":          cfg.DefaultTimezone,
				"date_format":               cfg.DateFormat,
				"download_exclude_patterns": cfg.DownloadExcludePatterns,
				"default_download_mode":     cfg.DefaultDownloadMode,
				"skip_excluded_on_upload":   cfg.SkipExcludedOnUpload,
				"max_file_upload_size":      cfg.MaxFileUploadSize,
				"completion_enabled":        cfg.CompletionEnabled,
				"completion_providers":      completionProviders,
				"completion_quotas":         completionQuotas,
				"completion_cache":          completionCache,
				"allow_registration":        cfg.AllowRegistration,
				"oauth_enabled":             cfg.OAuthEnabled,
				"google_client_id":          cfg.GoogleClientID,
			}

			if h.securityService != nil {
				if securityCfg, err := h.securityService.Get(c.Request.Context()); err == nil && securityCfg != nil {
					response["system_config"].(gin.H)["tab_session"] = gin.H{
						"max_tabs":         securityCfg.MaxTabs,
						"inactive_minutes": securityCfg.InactiveMinutes,
						"hibernate":        securityCfg.Hibernate,
						"session_timeout":  securityCfg.SessionTimeout,
						"remember_login":   securityCfg.RememberLogin,
					}
				}
			}
		}
	}

	RespondSuccess(c, response)
}

// CSRFToken 返回当前请求可用的 CSRF token
// GET /api/v1/auth/csrf
func (h *AuthHandler) CSRFToken(c *gin.Context) {
	token := middleware.GetCSRFToken(c.Request)
	if token != "" {
		c.Header(middleware.CSRFTokenHeader, token)
	}
	RespondSuccess(c, gin.H{"csrf_token": token})
}

// InitializeAdmin 初始化管理员账户
// POST /api/v1/auth/initialize-admin
func (h *AuthHandler) InitializeAdmin(c *gin.Context) {
	var req InitializeAdminRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 验证密码强度
	if err := password.ValidateWithDefault(req.Password); err != nil {
		if password.IsValidationError(err) {
			RespondError(c, http.StatusBadRequest, "password_policy_error", err.Error())
			return
		}
		RespondError(c, http.StatusBadRequest, "validation_error", "Invalid password")
		return
	}

	// 如果未指定运行模式，默认使用生产模式
	runMode := req.RunMode
	if runMode == "" {
		runMode = RunModeProduction
	}

	// 提取设备信息
	deviceType, deviceName, ipAddress, userAgent := extractDeviceInfo(c)
	sessionInfo := &auth.SessionInfo{
		DeviceType: deviceType,
		DeviceName: deviceName,
		IPAddress:  ipAddress,
		UserAgent:  userAgent,
	}

	// 初始化管理员
	user, accessToken, refreshToken, err := h.authService.InitializeAdmin(
		c.Request.Context(),
		req.Username,
		req.Email,
		req.Password,
		string(runMode),
		sessionInfo,
	)
	if err != nil {
		if err.Error() == "admin already exists" {
			RespondError(c, http.StatusConflict, "admin_exists", "Admin already exists")
			return
		}
		RespondError(c, http.StatusInternalServerError, "init_failed", err.Error())
		return
	}

	// 设置 HttpOnly Cookie
	setAuthCookies(c, refreshToken, h.securityService, h.refreshTokenTTLSeconds)
	clearAccessTokenCookie(c, h.securityService)

	// 返回用户信息和令牌
	RespondSuccess(c, AuthResponse{
		User:        user,
		AccessToken: accessToken,
		TokenType:   "Bearer",
		ExpiresIn:   h.accessTokenTTLSeconds,
	})
}

// parseUUID 解析 UUID 字符串
func parseUUID(s string) (uuid.UUID, error) {
	return uuid.Parse(s)
}

// ============= 2FA 相关 API =============

// Enable2FARequest 启用 2FA 请求
type Enable2FARequest struct {
	Code string `json:"code" binding:"required,len=6"` // TOTP 6位数字
}

// Disable2FARequest 禁用 2FA 请求
type Disable2FARequest struct {
	Code string `json:"code" binding:"required"` // 需要验证码确认
}

// Verify2FACodeRequest 验证 2FA 代码请求
type Verify2FACodeRequest struct {
	TempToken string `json:"temp_token" binding:"required"` // 临时令牌
	Code      string `json:"code" binding:"required"`       // 2FA 代码

	// PKCE + OAuth 相关字段（用于登录场景下在通过 2FA 后签发授权码）
	ClientID            string `json:"client_id" binding:"required"`
	RedirectURI         string `json:"redirect_uri" binding:"required"`
	Scope               string `json:"scope"`
	CodeChallenge       string `json:"code_challenge" binding:"required"`
	CodeChallengeMethod string `json:"code_challenge_method" binding:"required"` // 期望为 "S256"
	State               string `json:"state"`
}

// Generate2FAResponse 生成 2FA secret 响应
type Generate2FAResponse struct {
	Secret    string `json:"secret"`
	QRCodeURL string `json:"qr_code_url"`
}

// Enable2FAResponse 启用 2FA 响应
type Enable2FAResponse struct {
	BackupCodes []string `json:"backup_codes"`
	Message     string   `json:"message"`
}

// Generate2FASecret 生成 2FA secret（第一步）
// GET /api/v1/users/me/2fa/generate
func (h *AuthHandler) Generate2FASecret(c *gin.Context) {
	// 从上下文获取用户 ID
	userIDStr, exists := c.Get("user_id")
	if !exists {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "User not authenticated")
		return
	}

	uid, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "internal_error", "Invalid user ID format")
		return
	}

	// 生成 2FA secret
	secret, qrCodeURL, err := h.authService.Generate2FASecret(c.Request.Context(), uid)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	RespondSuccess(c, Generate2FAResponse{
		Secret:    secret,
		QRCodeURL: qrCodeURL,
	})
}

// Enable2FA 启用双因子认证（第二步）
// POST /api/v1/users/me/2fa/enable
func (h *AuthHandler) Enable2FA(c *gin.Context) {
	// 从上下文获取用户 ID
	userIDStr, exists := c.Get("user_id")
	if !exists {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "User not authenticated")
		return
	}

	uid, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "internal_error", "Invalid user ID format")
		return
	}

	var req Enable2FARequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 启用 2FA
	backupCodes, err := h.authService.Enable2FA(c.Request.Context(), uid, req.Code)
	if err != nil {
		if strings.Contains(err.Error(), "invalid 2FA code") {
			RespondError(c, http.StatusBadRequest, "invalid_code", "验证码无效，请重试")
			return
		}
		if strings.Contains(err.Error(), "already enabled") {
			RespondError(c, http.StatusBadRequest, "already_enabled", "双因子认证已启用")
			return
		}
		RespondError(c, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	RespondSuccess(c, Enable2FAResponse{
		BackupCodes: backupCodes,
		Message:     "双因子认证已启用，请妥善保管备份码",
	})
}

// Disable2FA 禁用双因子认证
// POST /api/v1/users/me/2fa/disable
func (h *AuthHandler) Disable2FA(c *gin.Context) {
	// 从上下文获取用户 ID
	userIDStr, exists := c.Get("user_id")
	if !exists {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "User not authenticated")
		return
	}

	uid, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "internal_error", "Invalid user ID format")
		return
	}

	var req Disable2FARequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 禁用 2FA
	if err := h.authService.Disable2FA(c.Request.Context(), uid, req.Code); err != nil {
		if strings.Contains(err.Error(), "invalid code") || strings.Contains(err.Error(), "验证码") {
			RespondError(c, http.StatusBadRequest, "invalid_code", "验证码错误")
			return
		}
		RespondError(c, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	RespondSuccess(c, gin.H{
		"message": "双因子认证已禁用",
	})
}

// Verify2FACode 验证 2FA 代码（用于登录）
// POST /api/v1/auth/2fa/verify
func (h *AuthHandler) Verify2FACode(c *gin.Context) {
	var req Verify2FACodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 验证临时令牌并获取用户 ID
	userIDStr, err := h.jwtService.ValidateTempToken(req.TempToken)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "invalid_temp_token", "临时令牌无效或已过期")
		return
	}

	// 解析用户 ID
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "internal_error", "Invalid user ID")
		return
	}

	// 验证 2FA 代码
	valid, err := h.authService.Verify2FACode(c.Request.Context(), userID, req.Code)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	if !valid {
		RespondError(c, http.StatusBadRequest, "invalid_code", "验证码无效")
		return
	}

	// 基本参数校验（PKCE + OAuth）
	if !strings.EqualFold(req.ClientID, "easyssh-web") {
		RespondError(c, http.StatusBadRequest, "invalid_client", "unsupported client_id")
		return
	}
	if strings.TrimSpace(req.RedirectURI) == "" {
		RespondError(c, http.StatusBadRequest, "invalid_request", "redirect_uri is required")
		return
	}
	if strings.TrimSpace(req.CodeChallenge) == "" || !strings.EqualFold(req.CodeChallengeMethod, "S256") {
		RespondError(c, http.StatusBadRequest, "invalid_request", "code_challenge and S256 code_challenge_method are required")
		return
	}

	// 生成授权码（5 分钟有效）
	code, err := h.authService.CreateAuthorizationCode(
		c.Request.Context(),
		userID,
		req.ClientID,
		req.RedirectURI,
		req.Scope,
		req.CodeChallenge,
		req.CodeChallengeMethod,
		5*time.Minute,
	)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	// 获取用户信息以便审计日志等使用
	user, err := h.authService.GetUserByID(c.Request.Context(), userID)
	if err == nil && user != nil {
		c.Set("user_id", user.ID.String())
		c.Set("username", user.Username)
	}

	// 返回授权码和 state，由前端继续调用 /api/v1/oauth/token 换取 access_token
	RespondSuccess(c, OAuthAuthorizeResponse{
		Code:  code,
		State: req.State,
	})
}

// === Session Management ===

// SessionResponse 会话响应
type SessionResponse struct {
	ID           string `json:"id"`
	DeviceType   string `json:"device_type"`
	DeviceName   string `json:"device_name"`
	IPAddress    string `json:"ip_address"`
	Location     string `json:"location"`
	LastActivity string `json:"last_activity"`
	CreatedAt    string `json:"created_at"`
	IsCurrent    bool   `json:"is_current"` // 是否为当前会话
}

// RevokeSessionRequest 撤销会话请求
type RevokeSessionRequest struct {
	SessionID string `json:"session_id" binding:"required"`
}

// ListSessions 获取用户的所有活跃会话
// GET /api/v1/users/me/sessions
func (h *AuthHandler) ListSessions(c *gin.Context) {
	// 从上下文获取用户 ID
	userIDStr, exists := c.Get("user_id")
	if !exists {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "User ID not found")
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_user_id", "Invalid user ID")
		return
	}

	// 获取用户所有活跃会话
	sessions, err := h.authService.ListUserSessions(c.Request.Context(), userID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to list sessions")
		return
	}

	// 从上下文获取当前会话ID（由 JWT 中的 session_id 提供）
	var currentSessionID uuid.UUID
	if sidValue, exists := c.Get("session_id"); exists {
		if sidStr, ok := sidValue.(string); ok {
			if sid, err := uuid.Parse(sidStr); err == nil {
				currentSessionID = sid
			}
		}
	}

	// 转换为响应格式
	var response []SessionResponse
	for _, session := range sessions {
		isCurrent := currentSessionID != uuid.Nil && session.ID == currentSessionID

		response = append(response, SessionResponse{
			ID:           session.ID.String(),
			DeviceType:   session.DeviceType,
			DeviceName:   session.DeviceName,
			IPAddress:    session.IPAddress,
			Location:     session.Location,
			LastActivity: session.LastActivity.Format("2006-01-02 15:04:05"),
			CreatedAt:    session.CreatedAt.Format("2006-01-02 15:04:05"),
			IsCurrent:    isCurrent,
		})
	}

	RespondSuccess(c, gin.H{
		"sessions": response,
		"total":    len(response),
	})
}

// RevokeSession 撤销指定会话
// DELETE /api/v1/users/me/sessions/:session_id
func (h *AuthHandler) RevokeSession(c *gin.Context) {
	// 从上下文获取用户 ID
	userIDStr, exists := c.Get("user_id")
	if !exists {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "User ID not found")
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_user_id", "Invalid user ID")
		return
	}

	// 从路径参数获取 session ID
	sessionIDStr := c.Param("session_id")
	sessionID, err := uuid.Parse(sessionIDStr)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_session_id", "Invalid session ID")
		return
	}

	// 撤销会话
	if err := h.authService.RevokeSession(c.Request.Context(), userID, sessionID); err != nil {
		if err.Error() == "session not found or does not belong to user" {
			RespondError(c, http.StatusNotFound, "session_not_found", err.Error())
			return
		}
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to revoke session")
		return
	}

	RespondSuccess(c, gin.H{
		"message": "Session revoked successfully",
	})
}

// RevokeAllOtherSessions 撤销除当前会话外的所有其他会话
// POST /api/v1/users/me/sessions/revoke-others
func (h *AuthHandler) RevokeAllOtherSessions(c *gin.Context) {
	// 从上下文获取用户 ID
	userIDStr, exists := c.Get("user_id")
	if !exists {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "User ID not found")
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_user_id", "Invalid user ID")
		return
	}

	// 优先从上下文获取当前会话ID（由 JWT 中的 session_id 提供）
	var currentSessionID uuid.UUID
	if sidValue, exists := c.Get("session_id"); exists {
		if sidStr, ok := sidValue.(string); ok {
			if sid, err := uuid.Parse(sidStr); err == nil {
				currentSessionID = sid
			}
		}
	}

	// 如果无法从 JWT 获取当前会话ID，则回退到“最近活动会话”方案
	if currentSessionID == uuid.Nil {
		sessions, err := h.authService.ListUserSessions(c.Request.Context(), userID)
		if err != nil || len(sessions) == 0 {
			RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to get current session")
			return
		}
		currentSessionID = sessions[0].ID
	}

	// 撤销所有其他会话
	if err := h.authService.RevokeAllOtherSessions(c.Request.Context(), userID, currentSessionID); err != nil {
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to revoke sessions")
		return
	}

	RespondSuccess(c, gin.H{
		"message": "All other sessions revoked successfully",
	})
}

// === Notification Settings ===

// UpdateNotificationSettingsRequest 更新通知设置请求
type UpdateNotificationSettingsRequest struct {
	EmailLogin  *bool `json:"email_login"`
	EmailAlert  *bool `json:"email_alert"`
	Browser     *bool `json:"browser"`
	NewDevice   *bool `json:"new_device"`   // 新设备登录通知
	NewLocation *bool `json:"new_location"` // 新地点登录通知
	Suspicious  *bool `json:"suspicious"`   // 可疑登录通知
}

// UpdateNotificationSettings - PUT /api/v1/users/me/notifications
//
// @Summary 更新通知设置
// @Description 更新用户的通知偏好设置
// @Tags 用户
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body UpdateNotificationSettingsRequest true "通知设置"
// @Success 200 {object} SuccessResponse "更新成功"
// @Failure 400 {object} ErrorResponse "请求参数错误"
// @Failure 401 {object} ErrorResponse "未授权"
// @Failure 500 {object} ErrorResponse "内部错误"
// @Router /users/me/notifications [put]
func (h *AuthHandler) UpdateNotificationSettings(c *gin.Context) {
	// 从上下文获取用户 ID
	userIDStr, exists := c.Get("user_id")
	if !exists {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "User ID not found")
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_user_id", "Invalid user ID")
		return
	}

	// 解析请求
	var req UpdateNotificationSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_request", "Invalid request body: "+err.Error())
		return
	}

	// 更新通知设置
	if err := h.authService.UpdateNotificationSettings(
		c.Request.Context(),
		userID,
		req.EmailLogin,
		req.EmailAlert,
		req.Browser,
		req.NewDevice,
		req.NewLocation,
		req.Suspicious,
	); err != nil {
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to update notification settings: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{
		"message": "Notification settings updated successfully",
	})
}

// UpdateMonitorDataSourceRequest 更新监控数据源请求
type UpdateMonitorDataSourceRequest struct {
	DataSource string `json:"data_source"` // easyssh, nezha, komari
	Endpoint   string `json:"endpoint"`    // API 端点
	Token      string `json:"token"`       // API Token
	SetActive  *bool  `json:"set_active"`  // 是否设为当前激活的数据源（必须显式传入）
}

// UpdateMonitorDataSource 更新监控数据源设置
// PUT /api/v1/users/me/monitor-datasource
func (h *AuthHandler) UpdateMonitorDataSource(c *gin.Context) {
	// 从上下文获取用户 ID
	userIDStr, exists := c.Get("user_id")
	if !exists {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "User ID not found")
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_user_id", "Invalid user ID")
		return
	}

	// 解析请求
	var req UpdateMonitorDataSourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_request", "Invalid request body: "+err.Error())
		return
	}

	// 验证数据源类型
	validTypes := map[string]bool{
		"easyssh":     true,
		"nezha":       true,
		"komari":      true,
		"komari-rpc2": true,
	}
	if req.DataSource != "" && !validTypes[req.DataSource] {
		RespondError(c, http.StatusBadRequest, "invalid_data_source", "Invalid data source type. Must be one of: easyssh, nezha, komari, komari-rpc2")
		return
	}

	// 更新监控数据源设置
	if req.SetActive == nil {
		RespondError(c, http.StatusBadRequest, "validation_error", "set_active is required")
		return
	}

	if err := h.authService.UpdateMonitorDataSource(
		c.Request.Context(),
		userID,
		req.DataSource,
		req.Endpoint,
		req.Token,
		*req.SetActive,
	); err != nil {
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to update monitor data source: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{
		"message": "Monitor data source updated successfully",
	})
}
