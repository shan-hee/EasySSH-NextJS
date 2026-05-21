package middleware

import (
	"crypto/sha256"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"

	csrf "filippo.io/csrf/gorilla"
	"github.com/easyssh/server/internal/infra/config"
	"github.com/gin-gonic/gin"
)

const CSRFTokenHeader = "X-CSRF-Token"

func CSRFMiddleware(cfg *config.Config) gin.HandlerFunc {
	key := sha256.Sum256([]byte(cfg.JWT.Secret + ":" + cfg.Server.EncryptionKey))
	secure, domain, sameSite := csrfCookieConfig(cfg)
	protect := csrf.Protect(
		key[:],
		csrf.CookieName("easyssh_csrf_token"),
		csrf.RequestHeader(CSRFTokenHeader),
		csrf.TrustedOrigins(csrfTrustedOrigins(cfg)),
		csrf.Path("/api/v1"),
		csrf.Secure(secure),
		csrf.Domain(domain),
		csrf.SameSite(sameSite),
		csrf.ErrorHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			reason := ""
			if err := csrf.FailureReason(r); err != nil {
				reason = err.Error()
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusForbidden)
			if reason != "" {
				_, _ = w.Write([]byte(fmt.Sprintf(`{"error":"csrf_token_invalid","message":"Invalid CSRF token","reason":%q}`, reason)))
				return
			}
			_, _ = w.Write([]byte(`{"error":"csrf_token_invalid","message":"Invalid CSRF token"}`))
		})),
	)

	return func(c *gin.Context) {
		if isPlaintextHTTPRequest(c.Request) {
			c.Request = csrf.PlaintextHTTPRequest(c.Request)
		}
		if shouldSkipUnsafeCSRF(c.Request) {
			c.Request = csrf.UnsafeSkipCheck(c.Request)
		}

		handler := protect(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			c.Request = r
			token := csrf.Token(r)
			if token != "" && shouldExposeCSRFToken(r) {
				c.Header(CSRFTokenHeader, token)
			}
			c.Next()
		}))
		handler.ServeHTTP(c.Writer, c.Request)

		if c.Writer.Written() {
			c.Abort()
		}
	}
}

func isPlaintextHTTPRequest(r *http.Request) bool {
	if r == nil {
		return false
	}
	if r.TLS != nil {
		return false
	}

	if proto := forwardedProto(r); proto != "" {
		return proto == "http"
	}

	return true
}

func forwardedProto(r *http.Request) string {
	if value := strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")); value != "" {
		if idx := strings.IndexByte(value, ','); idx >= 0 {
			value = value[:idx]
		}
		return strings.ToLower(strings.TrimSpace(value))
	}

	if value := strings.TrimSpace(r.Header.Get("Forwarded")); value != "" {
		for _, item := range strings.Split(value, ";") {
			parts := strings.SplitN(strings.TrimSpace(item), "=", 2)
			if len(parts) == 2 && strings.EqualFold(parts[0], "proto") {
				return strings.ToLower(strings.Trim(strings.TrimSpace(parts[1]), `"`))
			}
		}
	}

	return ""
}

func shouldExposeCSRFToken(r *http.Request) bool {
	if r == nil || r.URL == nil {
		return false
	}
	if r.URL.Path == "/api/v1/auth/csrf" {
		return true
	}
	if isSafeMethod(r.Method) {
		return false
	}
	return !shouldSkipUnsafeCSRF(r)
}

func GetCSRFToken(r *http.Request) string {
	return csrf.Token(r)
}

func csrfCookieConfig(cfg *config.Config) (bool, string, csrf.SameSiteMode) {
	secure := cfg.Server.Env == "production"
	if value := strings.ToLower(strings.TrimSpace(os.Getenv("COOKIE_SECURE"))); value != "" {
		switch value {
		case "true", "1", "yes", "on":
			secure = true
		case "false", "0", "no", "off":
			secure = false
		}
	}

	sameSite := csrf.SameSiteLaxMode
	switch strings.ToLower(strings.TrimSpace(os.Getenv("COOKIE_SAMESITE"))) {
	case "none":
		sameSite = csrf.SameSiteNoneMode
	case "strict":
		sameSite = csrf.SameSiteStrictMode
	case "lax", "":
		sameSite = csrf.SameSiteLaxMode
	default:
		sameSite = csrf.SameSiteLaxMode
	}

	return secure, strings.TrimSpace(os.Getenv("COOKIE_DOMAIN")), sameSite
}

func csrfTrustedOrigins(cfg *config.Config) []string {
	origins := []string{
		fmt.Sprintf("http://localhost:%d", cfg.Server.WebDevPort),
		fmt.Sprintf("http://127.0.0.1:%d", cfg.Server.WebDevPort),
		"http://" + net.JoinHostPort("::1", fmt.Sprintf("%d", cfg.Server.WebDevPort)),
	}

	for _, item := range strings.Split(os.Getenv("CSRF_TRUSTED_ORIGINS"), ",") {
		origin := csrfTrustedOrigin(item)
		if origin == "" {
			continue
		}
		origins = append(origins, origin)
	}

	return origins
}

func csrfTrustedOrigin(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}

	if strings.Contains(raw, "://") {
		parsed, err := url.Parse(raw)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" {
			return ""
		}
		if parsed.Path != "" && parsed.Path != "/" {
			return ""
		}
		if parsed.RawQuery != "" || parsed.Fragment != "" {
			return ""
		}
		return strings.ToLower(parsed.Scheme) + "://" + parsed.Host
	}

	parsed, err := url.Parse("https://" + raw)
	if err != nil || parsed.Host == "" || parsed.Path != "" || parsed.RawQuery != "" || parsed.Fragment != "" {
		return ""
	}
	return "https://" + parsed.Host
}

func shouldSkipUnsafeCSRF(r *http.Request) bool {
	if r == nil {
		return true
	}
	if isSafeMethod(r.Method) {
		return false
	}

	path := r.URL.Path
	if path == "/api/v1/oauth/token" || path == "/api/v1/oauth/logout" || path == "/api/v1/auth/logout" {
		return false
	}

	if path == "/api/v1/oauth/google/verify" && strings.EqualFold(r.Method, http.MethodPost) {
		return false
	}
	if path == "/api/v1/users/me/oauth/google/link" && (strings.EqualFold(r.Method, http.MethodPost) || strings.EqualFold(r.Method, http.MethodDelete)) {
		return false
	}

	return true
}

func isSafeMethod(method string) bool {
	return method == http.MethodGet || method == http.MethodHead || method == http.MethodOptions
}
