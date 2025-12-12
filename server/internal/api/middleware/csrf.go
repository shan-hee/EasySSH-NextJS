package middleware

import (
	"crypto/subtle"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

const (
	accessTokenCookieName = "easyssh_access_token"
	csrfTokenCookieName   = "easyssh_csrf_token"
	csrfHeaderName        = "X-CSRF-Token"
)

func shouldSkipCSRF(c *gin.Context) bool {
	// 仅对“可能产生副作用”的方法启用
	switch c.Request.Method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return true
	}

	// OAuth 相关端点：避免在认证握手阶段阻塞
	path := c.FullPath()
	if path == "" {
		path = c.Request.URL.Path
	}
	if strings.HasPrefix(path, "/api/v1/oauth/") {
		return true
	}

	// Bearer 鉴权：不需要 CSRF（不依赖 Cookie 自动发送）
	if authHeader := c.GetHeader("Authorization"); authHeader != "" {
		return true
	}

	return false
}

// CSRFMiddleware 双提交 CSRF 防护：
// - 服务端设置 easyssh_csrf_token（非 HttpOnly Cookie）
// - 客户端对非安全方法必须附带 header: X-CSRF-Token 或表单字段 csrf_token
// - 仅在使用 Cookie 鉴权时生效（Bearer 模式跳过）
func CSRFMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if shouldSkipCSRF(c) {
			c.Next()
			return
		}

		// 仅当存在 access_token Cookie 时才启用 CSRF 校验（否则视为 Bearer/未登录请求）
		accessToken, err := c.Cookie(accessTokenCookieName)
		if err != nil || strings.TrimSpace(accessToken) == "" {
			c.Next()
			return
		}

		csrfCookie, err := c.Cookie(csrfTokenCookieName)
		if err != nil || strings.TrimSpace(csrfCookie) == "" {
			c.JSON(http.StatusForbidden, gin.H{"error": "csrf_missing", "message": "Missing CSRF token"})
			c.Abort()
			return
		}

		csrfProvided := strings.TrimSpace(c.GetHeader(csrfHeaderName))
		if csrfProvided == "" {
			// 支持表单提交（隐藏 input），用于 batch-download 等原生流式下载场景
			csrfProvided = strings.TrimSpace(c.PostForm("csrf_token"))
		}

		if csrfProvided == "" ||
			subtle.ConstantTimeCompare([]byte(csrfProvided), []byte(csrfCookie)) != 1 {
			c.JSON(http.StatusForbidden, gin.H{"error": "csrf_invalid", "message": "Invalid CSRF token"})
			c.Abort()
			return
		}

		c.Next()
	}
}

