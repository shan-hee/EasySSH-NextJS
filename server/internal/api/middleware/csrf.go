package middleware

import (
	"crypto/sha256"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/easyssh/server/internal/infra/config"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/csrf"
)

const CSRFTokenHeader = "X-CSRF-Token"

func CSRFMiddleware(cfg *config.Config) gin.HandlerFunc {
	key := sha256.Sum256([]byte(cfg.JWT.Secret + ":" + cfg.Server.EncryptionKey))
	protect := csrf.Protect(
		key[:],
		csrf.CookieName("easyssh_csrf_token"),
		csrf.RequestHeader(CSRFTokenHeader),
		csrf.TrustedOrigins(csrfTrustedOrigins(cfg)),
		csrf.Path("/api/v1"),
		csrf.Secure(cfg.Server.Env == "production"),
		csrf.SameSite(csrf.SameSiteLaxMode),
		csrf.ErrorHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusForbidden)
			_, _ = w.Write([]byte(`{"error":"csrf_token_invalid","message":"Invalid CSRF token"}`))
		})),
	)

	return func(c *gin.Context) {
		if shouldSkipCSRF(c.Request) {
			c.Request = csrf.UnsafeSkipCheck(c.Request)
		}

		handler := protect(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			c.Request = r
			token := csrf.Token(r)
			if token != "" {
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

func csrfTrustedOrigins(cfg *config.Config) []string {
	origins := []string{
		fmt.Sprintf("localhost:%d", cfg.Server.WebDevPort),
		fmt.Sprintf("127.0.0.1:%d", cfg.Server.WebDevPort),
		net.JoinHostPort("::1", fmt.Sprintf("%d", cfg.Server.WebDevPort)),
	}

	for _, item := range strings.Split(os.Getenv("CSRF_TRUSTED_ORIGINS"), ",") {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		if parsed, err := url.Parse(item); err == nil && parsed.Host != "" {
			origins = append(origins, parsed.Host)
			continue
		}
		if host, port, err := net.SplitHostPort(item); err == nil && host != "" && port != "" {
			origins = append(origins, net.JoinHostPort(host, port))
			continue
		}
		origins = append(origins, item)
	}

	return origins
}

func shouldSkipCSRF(r *http.Request) bool {
	if r == nil {
		return true
	}
	if r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions {
		return true
	}

	path := r.URL.Path
	if path == "/api/v1/oauth/token" || path == "/api/v1/oauth/logout" || path == "/api/v1/auth/logout" {
		return false
	}

	if path == "/api/v1/oauth/google/verify" && strings.EqualFold(r.Method, http.MethodPost) {
		return false
	}

	return true
}
