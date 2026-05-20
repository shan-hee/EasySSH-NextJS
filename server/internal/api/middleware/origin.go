package middleware

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/easyssh/server/internal/domain/security"
)

func IsAllowedOrigin(r *http.Request, securityService security.Service, webDevPort int) bool {
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if origin == "" {
		return true
	}

	if isConfiguredOriginAllowed(origin, securityService, webDevPort) {
		return true
	}

	originURL, err := url.Parse(origin)
	if err != nil || originURL.Hostname() == "" {
		return false
	}

	host := requestHost(r)
	return host != "" && strings.EqualFold(host, originURL.Hostname())
}

func IsConfiguredOriginAllowed(origin string, securityService security.Service, webDevPort int) bool {
	origin = strings.TrimSpace(origin)
	if origin == "" {
		return false
	}
	return isConfiguredOriginAllowed(origin, securityService, webDevPort)
}

func isConfiguredOriginAllowed(origin string, securityService security.Service, webDevPort int) bool {
	allowedOrigins := []string{
		fmt.Sprintf("http://localhost:%d", webDevPort),
	}

	if securityService != nil {
		corsConfig, err := securityService.GetCORSConfig(context.Background())
		if err == nil && corsConfig != nil {
			allowedOrigins = append(allowedOrigins, corsConfig.AllowedOrigins...)
		}
	}

	for _, allowedOrigin := range allowedOrigins {
		allowedOrigin = strings.TrimSpace(allowedOrigin)
		if allowedOrigin == "" {
			continue
		}
		if allowedOrigin == "*" {
			continue
		}
		if origin == allowedOrigin {
			return true
		}
	}
	return false
}

func requestHost(r *http.Request) string {
	if r == nil {
		return ""
	}
	host := r.Host
	if host == "" {
		return ""
	}
	if parsedHost, _, found := strings.Cut(host, ":"); found {
		return parsedHost
	}
	return host
}
