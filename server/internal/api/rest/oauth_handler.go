package rest

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/easyssh/server/internal/domain/auth"
	"github.com/easyssh/server/internal/domain/oauth"
	"github.com/easyssh/server/internal/domain/security"
	"github.com/easyssh/server/internal/domain/systemconfig"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// OAuthHandler OAuth 处理器
type OAuthHandler struct {
	authService         auth.Service
	systemConfigService systemconfig.Service
	securityService     security.Service // 安全配置服务
	accessTokenTTL      int
	refreshTokenTTL     int
}

// NewOAuthHandler 创建 OAuth 处理器
func NewOAuthHandler(
	authService auth.Service,
	systemConfigService systemconfig.Service,
	securityService security.Service,
	accessTokenTTL, refreshTokenTTL int,
) *OAuthHandler {
	return &OAuthHandler{
		authService:         authService,
		systemConfigService: systemConfigService,
		securityService:     securityService,
		accessTokenTTL:      accessTokenTTL,
		refreshTokenTTL:     refreshTokenTTL,
	}
}

// GoogleVerifyRequest Google 授权码验证请求
type GoogleVerifyRequest struct {
	Code         string `json:"code" binding:"required"`
	CodeVerifier string `json:"code_verifier" binding:"required"`
	RedirectURI  string `json:"redirect_uri" binding:"required"`
}

type GoogleLinkResponse struct {
	Linked bool        `json:"linked"`
	User   interface{} `json:"user"`
}

// GoogleVerifyResponse Google 验证响应
type GoogleVerifyResponse struct {
	AccessToken string      `json:"access_token"`
	TokenType   string      `json:"token_type"`
	ExpiresIn   int         `json:"expires_in"`
	User        interface{} `json:"user"`
}

// GoogleVerify 使用 Google Authorization Code + PKCE 登录/注册用户
// POST /api/v1/oauth/google/verify
func (h *OAuthHandler) GoogleVerify(c *gin.Context) {
	var req GoogleVerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 获取系统配置
	config, err := h.systemConfigService.Get(c.Request.Context())
	if err != nil || config == nil {
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to get system config")
		return
	}

	// 检查 OAuth 是否启用
	if !config.OAuthEnabled {
		RespondError(c, http.StatusForbidden, "oauth_disabled", "Google OAuth is disabled")
		return
	}

	// 检查 Google Client ID 是否配置
	if strings.TrimSpace(config.GoogleClientID) == "" || strings.TrimSpace(config.GoogleClientSecret) == "" {
		RespondError(c, http.StatusInternalServerError, "oauth_not_configured", "Google OAuth is not configured")
		return
	}

	// 创建 Google OAuth 服务
	googleService := oauth.NewGoogleService(
		config.GoogleClientID,
		config.GoogleClientSecret,
		req.RedirectURI,
	)

	// 用授权码和 PKCE verifier 换取并验证 ID Token
	userInfo, err := googleService.ExchangeCode(c.Request.Context(), req.Code, req.CodeVerifier)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "invalid_token", "Failed to verify Google token: "+err.Error())
		return
	}

	// 检查邮箱是否已验证
	if !userInfo.VerifiedEmail {
		RespondError(c, http.StatusBadRequest, "email_not_verified", "Google email is not verified")
		return
	}

	// 查找或创建用户：Google 账户以 OIDC subject 为稳定标识，邮箱仅用于首次绑定和展示。
	user, err := h.authService.GetUserByGoogleSub(c.Request.Context(), userInfo.ID)
	if err != nil {
		if errors.Is(err, auth.ErrUserNotFound) {
			user, err = h.authService.GetUserByEmail(c.Request.Context(), userInfo.Email)
			if err != nil {
				if errors.Is(err, auth.ErrUserNotFound) {
					// 用户不存在，检查是否允许注册
					if !config.AllowRegistration {
						RespondError(c, http.StatusForbidden, "registration_disabled", "User registration is disabled. Please contact administrator.")
						return
					}

					// 自动创建用户
					// 使用 Google 邮箱的本地部分作为用户名，如果冲突则添加随机后缀
					username := userInfo.Email
					if atIndex := len(userInfo.Email); atIndex > 0 {
						for i, ch := range userInfo.Email {
							if ch == '@' {
								username = userInfo.Email[:i]
								break
							}
						}
					}

					// 注册用户（使用随机密码，因为通过 OAuth 登录不需要密码）
					user, err = h.authService.RegisterOAuthUser(
						c.Request.Context(),
						username,
						userInfo.Email,
						userInfo.Picture,
						userInfo.ID,
						auth.RoleUser,
					)
					if err != nil {
						RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to create user: "+err.Error())
						return
					}
				} else {
					RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to get user")
					return
				}
			} else {
				if user.IsLocked() {
					respondGoogleAccountLocked(c, user)
					return
				}

				user, err = h.authService.BindGoogleSub(c.Request.Context(), user.ID, userInfo.ID)
				if err != nil {
					if errors.Is(err, auth.ErrUserAlreadyExists) {
						RespondError(c, http.StatusConflict, "oauth_account_conflict", "This Google account is already linked to another user")
						return
					}
					RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to bind Google account")
					return
				}
			}
		} else {
			RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to get user")
			return
		}
	}

	if user == nil {
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to get user")
		return
	}

	if user.IsLocked() {
		respondGoogleAccountLocked(c, user)
		return
	}

	if user.GoogleSub == nil || *user.GoogleSub == "" {
		user, err = h.authService.BindGoogleSub(c.Request.Context(), user.ID, userInfo.ID)
		if err != nil {
			if errors.Is(err, auth.ErrUserAlreadyExists) {
				RespondError(c, http.StatusConflict, "oauth_account_conflict", "This Google account is already linked to another user")
				return
			}
			RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to bind Google account")
			return
		}
	}

	// 提取设备信息
	deviceType, deviceName, ipAddress, userAgent := extractDeviceInfo(c)
	sessionInfo := &auth.SessionInfo{
		DeviceType: deviceType,
		DeviceName: deviceName,
		IPAddress:  ipAddress,
		UserAgent:  userAgent,
	}

	// 创建会话并生成令牌
	accessToken, refreshToken, err := h.authService.CreateSessionWithTokens(c.Request.Context(), user, sessionInfo)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to generate tokens")
		return
	}

	// 设置 HttpOnly refresh_token Cookie
	if refreshToken != "" {
		setAuthCookies(c, refreshToken, h.securityService, h.refreshTokenTTL)
	}
	clearAccessTokenCookie(c, h.securityService)

	// 在上下文中记录用户信息，便于审计日志使用
	c.Set("user_id", user.ID.String())
	c.Set("username", user.Username)

	RespondSuccess(c, GoogleVerifyResponse{
		AccessToken: accessToken,
		TokenType:   "Bearer",
		ExpiresIn:   h.accessTokenTTL,
		User:        user.ToPublic(),
	})
}

// GoogleLink 将当前已登录用户与 Google 账号绑定
// POST /api/v1/users/me/oauth/google/link
func (h *OAuthHandler) GoogleLink(c *gin.Context) {
	var req GoogleVerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	currentUserID, ok := currentUserIDFromContext(c)
	if !ok {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "User not authenticated")
		return
	}

	userInfo, ok := h.exchangeGoogleCode(c, req)
	if !ok {
		return
	}

	user, err := h.authService.BindGoogleSub(c.Request.Context(), currentUserID, userInfo.ID)
	if err != nil {
		if errors.Is(err, auth.ErrUserAlreadyExists) {
			RespondError(c, http.StatusConflict, "oauth_account_conflict", "This Google account is already linked to another user")
			return
		}
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to bind Google account")
		return
	}

	RespondSuccess(c, GoogleLinkResponse{
		Linked: true,
		User:   user.ToPublic(),
	})
}

// GoogleUnlink 解除当前已登录用户的 Google 账号绑定
// DELETE /api/v1/users/me/oauth/google/link
func (h *OAuthHandler) GoogleUnlink(c *gin.Context) {
	currentUserID, ok := currentUserIDFromContext(c)
	if !ok {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "User not authenticated")
		return
	}

	user, err := h.authService.UnbindGoogleSub(c.Request.Context(), currentUserID)
	if err != nil {
		switch {
		case errors.Is(err, auth.ErrUserNotFound):
			RespondError(c, http.StatusNotFound, "user_not_found", "User not found")
		case errors.Is(err, auth.ErrLastLoginMethod):
			RespondError(c, http.StatusBadRequest, "last_login_method", "Set a password before unlinking Google account")
		default:
			RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to unlink Google account")
		}
		return
	}

	RespondSuccess(c, GoogleLinkResponse{
		Linked: false,
		User:   user.ToPublic(),
	})
}

func (h *OAuthHandler) exchangeGoogleCode(c *gin.Context, req GoogleVerifyRequest) (*oauth.GoogleUserInfo, bool) {
	config, err := h.systemConfigService.Get(c.Request.Context())
	if err != nil || config == nil {
		RespondError(c, http.StatusInternalServerError, "internal_error", "Failed to get system config")
		return nil, false
	}

	if !config.OAuthEnabled {
		RespondError(c, http.StatusForbidden, "oauth_disabled", "Google OAuth is disabled")
		return nil, false
	}

	if strings.TrimSpace(config.GoogleClientID) == "" || strings.TrimSpace(config.GoogleClientSecret) == "" {
		RespondError(c, http.StatusInternalServerError, "oauth_not_configured", "Google OAuth is not configured")
		return nil, false
	}

	googleService := oauth.NewGoogleService(
		config.GoogleClientID,
		config.GoogleClientSecret,
		req.RedirectURI,
	)

	userInfo, err := googleService.ExchangeCode(c.Request.Context(), req.Code, req.CodeVerifier)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "invalid_token", "Failed to verify Google token: "+err.Error())
		return nil, false
	}

	if !userInfo.VerifiedEmail {
		RespondError(c, http.StatusBadRequest, "email_not_verified", "Google email is not verified")
		return nil, false
	}

	return userInfo, true
}

func respondGoogleAccountLocked(c *gin.Context, user *auth.User) {
	response := gin.H{
		"error":   "account_locked",
		"message": "Account is locked. Please contact administrator.",
	}

	if user != nil {
		if user.LockedUntil != nil {
			lockedUntil := user.LockedUntil.Format(time.RFC3339)
			response["locked_until"] = lockedUntil
			response["unlock_at"] = lockedUntil
		}
		if strings.TrimSpace(user.LockReason) != "" {
			response["lock_reason"] = user.LockReason
		}
	}

	c.JSON(http.StatusForbidden, response)
}

func currentUserIDFromContext(c *gin.Context) (uuid.UUID, bool) {
	userID, exists := c.Get("user_id")
	if !exists {
		return uuid.Nil, false
	}

	uid, ok := userID.(string)
	if !ok {
		return uuid.Nil, false
	}

	parsedUID, err := uuid.Parse(uid)
	if err != nil {
		return uuid.Nil, false
	}

	return parsedUID, true
}
