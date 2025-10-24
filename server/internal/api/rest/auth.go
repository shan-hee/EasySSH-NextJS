package rest

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/easyssh/server/internal/domain/auth"
)

// AuthHandler 认证处理器
type AuthHandler struct {
	authService auth.Service
	jwtService  auth.JWTService
}

// NewAuthHandler 创建认证处理器
func NewAuthHandler(authService auth.Service, jwtService auth.JWTService) *AuthHandler {
	return &AuthHandler{
		authService: authService,
		jwtService:  jwtService,
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
	Email  string `json:"email,omitempty"`
	Avatar string `json:"avatar,omitempty"`
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
		if errors.Is(err, auth.ErrInvalidCredentials) {
			RespondError(c, http.StatusUnauthorized, "invalid_credentials", "Invalid username or password")
			return
		}
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to login")
		return
	}

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
	// 从请求头获取 token
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		RespondError(c, http.StatusUnauthorized, "missing_token", "Authorization header is required")
		return
	}

	// 解析 Bearer token
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || parts[0] != "Bearer" {
		RespondError(c, http.StatusUnauthorized, "invalid_token", "Invalid authorization header format")
		return
	}

	accessToken := parts[1]

	// 将 token 加入黑名单
	if err := h.authService.Logout(c.Request.Context(), accessToken); err != nil {
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to logout")
		return
	}

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

	newAccessToken, err := h.authService.RefreshAccessToken(c.Request.Context(), req.RefreshToken)
	if err != nil {
		if errors.Is(err, auth.ErrInvalidToken) || errors.Is(err, auth.ErrExpiredToken) {
			RespondError(c, http.StatusUnauthorized, "invalid_token", "Invalid or expired refresh token")
			return
		}
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to refresh token")
		return
	}

	RespondSuccess(c, gin.H{
		"access_token": newAccessToken,
		"token_type":   "Bearer",
		"expires_in":   3600,
	})
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

	// 更新资料
	if err := h.authService.UpdateProfile(c.Request.Context(), parsedUID, req.Email, req.Avatar); err != nil {
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
