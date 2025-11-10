package rest

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/easyssh/server/internal/domain/auth"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Cookie 配置常量
const (
	AccessTokenCookieName  = "easyssh_access_token"
	RefreshTokenCookieName = "easyssh_refresh_token"
	AccessTokenMaxAge      = 3600        // 1小时
	RefreshTokenMaxAge     = 604800      // 7天
)

// CookieConfig Cookie 配置（用于类型断言）
type CookieConfig struct {
	Secure bool
	Domain string
}

// getCookieConfig 从配置管理器获取 Cookie 配置（带缓存）
func getCookieConfig(c *gin.Context, configManager interface{}) (secure bool, domain string) {
	// 默认值
	secure = true
	domain = ""

	// 尝试从配置管理器获取配置
	if cm, ok := configManager.(interface {
		GetCookieConfig(ctx interface{}) (*CookieConfig, error)
	}); ok {
		if config, err := cm.GetCookieConfig(c.Request.Context()); err == nil {
			secure = config.Secure
			domain = config.Domain
		}
	}

	return secure, domain
}

// setAuthCookies 设置认证相关的 HttpOnly Cookie（支持动态配置）
func setAuthCookies(c *gin.Context, accessToken, refreshToken string, configManager interface{}) {
	secure, domain := getCookieConfig(c, configManager)

	// 设置 Access Token Cookie
	c.SetCookie(
		AccessTokenCookieName,
		accessToken,
		AccessTokenMaxAge,
		"/",
		domain,
		secure,
		true, // HttpOnly
	)

	// 设置 Refresh Token Cookie
	c.SetCookie(
		RefreshTokenCookieName,
		refreshToken,
		RefreshTokenMaxAge,
		"/",
		domain,
		secure,
		true, // HttpOnly
	)

	// 设置 SameSite 属性 (Gin 不直接支持,需要手动设置响应头)
	c.Header("Set-Cookie", c.Writer.Header().Get("Set-Cookie")+"; SameSite=Lax")
}

// clearAuthCookies 清除认证相关的 Cookie（支持动态配置）
func clearAuthCookies(c *gin.Context, configManager interface{}) {
	_, domain := getCookieConfig(c, configManager)

	c.SetCookie(AccessTokenCookieName, "", -1, "/", domain, false, true)
	c.SetCookie(RefreshTokenCookieName, "", -1, "/", domain, false, true)
}

// AuthHandler 认证处理器
type AuthHandler struct {
	authService   auth.Service
	jwtService    auth.JWTService
	configManager interface{} // 配置管理器（用于动态配置）
}

// NewAuthHandler 创建认证处理器
func NewAuthHandler(authService auth.Service, jwtService auth.JWTService, configManager interface{}) *AuthHandler {
	return &AuthHandler{
		authService:   authService,
		jwtService:    jwtService,
		configManager: configManager,
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
	Username string  `json:"username" binding:"required,min=3,max=50"`
	Email    string  `json:"email" binding:"required,email"`
	Password string  `json:"password" binding:"required,min=6"`
	RunMode  RunMode `json:"run_mode,omitempty"` // 运行模式（可选，仅用于初始化管理员）
}

// LoginRequest 登录请求
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// RefreshTokenRequest 刷新令牌请求
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// ChangePasswordRequest 修改密码请求
type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=6"`
}

// UpdateProfileRequest 更新资料请求
type UpdateProfileRequest struct {
	Email  string  `json:"email,omitempty"`
	Avatar *string `json:"avatar"` // 使用指针类型区分"未提供"和"空字符串"
}

// AuthResponse 认证响应
type AuthResponse struct {
	User         interface{} `json:"user"`
	AccessToken  string      `json:"access_token"`
	RefreshToken string      `json:"refresh_token"`
	TokenType    string      `json:"token_type"`
	ExpiresIn    int         `json:"expires_in"` // 秒
}

// Register 注册新用户
// POST /api/v1/auth/register
func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 注册用户（默认角色为 user）
	user, err := h.authService.Register(c.Request.Context(), req.Username, req.Email, req.Password, auth.RoleUser)
	if err != nil {
		if errors.Is(err, auth.ErrUserAlreadyExists) {
			RespondError(c, http.StatusConflict, "user_exists", "Username or email already exists")
			return
		}
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to register user")
		return
	}

	// 生成令牌
	accessToken, refreshToken, err := h.jwtService.GenerateTokens(user)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to generate tokens")
		return
	}

	RespondCreated(c, AuthResponse{
		User:         user.ToPublic(),
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    3600, // 1 小时
	})
}

// Login 用户登录
// POST /api/v1/auth/login
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	user, accessToken, refreshToken, err := h.authService.Login(c.Request.Context(), req.Username, req.Password)
	if err != nil {
		// 登录失败时也设置用户名,以便审计日志记录
		c.Set("username", req.Username)
		if errors.Is(err, auth.ErrInvalidCredentials) {
			RespondError(c, http.StatusUnauthorized, "invalid_credentials", "Invalid username or password")
			return
		}
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to login")
		return
	}

	// 登录成功,设置用户信息到上下文,以便审计日志记录
	c.Set("user_id", user.ID.String())
	c.Set("username", user.Username)

	// 检查是否启用了 2FA
	if user.TwoFactorEnabled {
		// 生成临时令牌（用于 2FA 验证）
		tempToken, err := h.jwtService.GenerateTempToken(user.ID.String())
		if err != nil {
			RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to generate temp token")
			return
		}

		// 返回需要 2FA 验证的响应
		RespondSuccess(c, gin.H{
			"requires_2fa": true,
			"temp_token":   tempToken,
			"message":      "请输入双因子认证代码",
		})
		return
	}

	// 未启用 2FA，设置 HttpOnly Cookie 并返回令牌
	setAuthCookies(c, accessToken, refreshToken, h.configManager)

	RespondSuccess(c, AuthResponse{
		User:         user.ToPublic(),
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    3600,
	})
}

// Logout 用户登出
// POST /api/v1/auth/logout
func (h *AuthHandler) Logout(c *gin.Context) {
	// 从 Cookie 获取 token
	accessToken, err := c.Cookie(AccessTokenCookieName)

	// 如果没有 token,直接清除 Cookie 并返回成功(幂等操作)
	if err != nil || accessToken == "" {
		clearAuthCookies(c, h.configManager)
		RespondSuccessWithMessage(c, nil, "Logged out successfully")
		return
	}

	// 将 token 加入黑名单
	if err := h.authService.Logout(c.Request.Context(), accessToken); err != nil {
		// 即使加入黑名单失败,也清除 Cookie
		clearAuthCookies(c, h.configManager)
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to logout")
		return
	}

	// 清除 HttpOnly Cookie
	clearAuthCookies(c, h.configManager)

	RespondSuccessWithMessage(c, nil, "Logged out successfully")
}

// RefreshToken 刷新访问令牌
// POST /api/v1/auth/refresh
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req RefreshTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	newAccessToken, newRefreshToken, err := h.authService.RefreshAccessToken(c.Request.Context(), req.RefreshToken)
	if err != nil {
		if errors.Is(err, auth.ErrInvalidToken) || errors.Is(err, auth.ErrExpiredToken) {
			// 清除无效的 Cookie
			clearAuthCookies(c, h.configManager)
			RespondError(c, http.StatusUnauthorized, "invalid_token", "Invalid or expired refresh token")
			return
		}
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to refresh token")
		return
	}

	// 更新 Access Token Cookie
	secure, domain := getCookieConfig(c, h.configManager)
	c.SetCookie(
		AccessTokenCookieName,
		newAccessToken,
		AccessTokenMaxAge,
		"/",
		domain,
		secure,
		true, // HttpOnly
	)

	// 如果启用了令牌轮换，更新 Refresh Token Cookie
	if newRefreshToken != "" {
		c.SetCookie(
			RefreshTokenCookieName,
			newRefreshToken,
			RefreshTokenMaxAge,
			"/",
			domain,
			secure,
			true, // HttpOnly
		)
	}

	// 构造响应数据
	response := gin.H{
		"access_token": newAccessToken,
		"token_type":   "Bearer",
		"expires_in":   3600,
	}

	// 如果有新的刷新令牌，也返回给客户端
	if newRefreshToken != "" {
		response["refresh_token"] = newRefreshToken
	}

	RespondSuccess(c, response)
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

	// 处理 avatar 参数：如果提供了指针，使用其值（可能是空字符串）；否则使用特殊标记表示不更新
	avatarValue := "\x00" // 特殊标记，表示不更新头像
	if req.Avatar != nil {
		avatarValue = *req.Avatar
	}

	// 更新资料
	if err := h.authService.UpdateProfile(c.Request.Context(), parsedUID, req.Email, avatarValue); err != nil {
		RespondError(c, http.StatusInternalServerError, "update_failed", "Failed to update profile")
		return
	}

	RespondSuccessWithMessage(c, nil, "Profile updated successfully")
}

// CheckAdminStatus 检查管理员状态
// GET /api/v1/auth/admin-status
func (h *AuthHandler) CheckAdminStatus(c *gin.Context) {
	hasAdmin, err := h.authService.HasAdmin(c.Request.Context())
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "check_failed", "Failed to check admin status")
		return
	}

	RespondSuccess(c, gin.H{
		"has_admin": hasAdmin,
		"need_init": !hasAdmin,
	})
}

// InitializeAdmin 初始化管理员账户
// POST /api/v1/auth/initialize-admin
func (h *AuthHandler) InitializeAdmin(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 如果未指定运行模式，默认使用生产模式
	runMode := req.RunMode
	if runMode == "" {
		runMode = RunModeProduction
	}

	// 初始化管理员
	user, accessToken, refreshToken, err := h.authService.InitializeAdmin(
		c.Request.Context(),
		req.Username,
		req.Email,
		req.Password,
		string(runMode),
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
	setAuthCookies(c, accessToken, refreshToken, h.configManager)

	// 返回用户信息和令牌
	RespondSuccess(c, AuthResponse{
		User:         user,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    3600, // 1小时
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
// GET /api/v1/auth/2fa/generate
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
// POST /api/v1/auth/2fa/enable
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
// POST /api/v1/auth/2fa/disable
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

	// 获取用户信息
	user, err := h.authService.GetUserByID(c.Request.Context(), userID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to get user")
		return
	}

	// 生成正式令牌
	accessToken, refreshToken, err := h.jwtService.GenerateTokens(user)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to generate tokens")
		return
	}

	// 设置 HttpOnly Cookie
	setAuthCookies(c, accessToken, refreshToken, h.configManager)

	RespondSuccess(c, AuthResponse{
		User:         user.ToPublic(),
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    3600, // 1 hour
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

	// 获取当前请求的 token
	authHeader := c.GetHeader("Authorization")
	currentToken := ""
	if authHeader != "" {
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) == 2 && parts[0] == "Bearer" {
			currentToken = parts[1]
		}
	}

	// 转换为响应格式
	var response []SessionResponse
	for _, session := range sessions {
		isCurrent := false
		// 这里可以通过比较 token 或其他方式判断是否为当前会话
		// 简化处理:根据最近活动时间判断(最活跃的会话)
		if currentToken != "" {
			// TODO: 更精确的判断方式是比较 refresh token
			isCurrent = session.LastActivity.After(session.CreatedAt.Add(-1 * time.Minute))
		}

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

	// TODO: 获取当前会话 ID (需要从 refresh token 或其他方式获取)
	// 暂时使用一个临时方案:查找最近活动的会话作为当前会话
	sessions, err := h.authService.ListUserSessions(c.Request.Context(), userID)
	if err != nil || len(sessions) == 0 {
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to get current session")
		return
	}

	// 使用最近活动的会话作为当前会话
	currentSessionID := sessions[0].ID

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
	EmailLogin *bool `json:"email_login"`
	EmailAlert *bool `json:"email_alert"`
	Browser    *bool `json:"browser"`
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
	); err != nil {
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to update notification settings: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{
		"message": "Notification settings updated successfully",
	})
}

