package middleware

import (
	"net"
	"net/http"

	"github.com/easyssh/server/internal/domain/security"
	"github.com/gin-gonic/gin"
)

// OptionalIPWhitelistMiddleware 可选的 IP 白名单验证中间件
// 只有在配置了 IP 白名单时才进行验证
func OptionalIPWhitelistMiddleware(securityService security.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 由 Gin 根据 TrustedProxies 配置解析客户端 IP，避免无条件信任 X-Forwarded-*。
		clientIP := c.ClientIP()

		// 将客户端 IP 存入上下文
		c.Set("client_ip", clientIP)

		// 优先从上下文缓存获取配置
		var allowed bool
		var err error
		if secConfig, ok := GetSecurityConfigFromContext(c); ok {
			// 使用缓存的配置进行检查,避免重复查询数据库
			allowed = securityService.CheckIPAllowedWithConfig(secConfig, clientIP)
		} else {
			// 缓存未命中,调用服务层的统一检查方法
			allowed, err = securityService.CheckIPAllowed(c.Request.Context(), clientIP)
			if err != nil {
				// 记录错误但继续处理（避免配置错误导致服务不可用）
				c.Error(err)
				c.Next()
				return
			}
		}

		// 如果不允许，返回 403
		if !allowed {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "IP address not allowed",
				"ip":      clientIP,
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// IPWhitelistConfig IP 白名单配置
type IPWhitelistConfig struct {
	Enabled        bool     `json:"enabled"`
	AllowedIPs     []string `json:"allowed_ips"`
	BypassPaths    []string `json:"bypass_paths"`     // 跳过验证的路径
	AlwaysAllowIPs []string `json:"always_allow_ips"` // 始终允许的 IP（本地地址等）
}

// DefaultIPWhitelistConfig 默认的 IP 白名单配置
var DefaultIPWhitelistConfig = IPWhitelistConfig{
	Enabled:    false,
	AllowedIPs: []string{},
	BypassPaths: []string{
		"/api/v1/health",
		"/api/v1/ping",
	},
	AlwaysAllowIPs: []string{
		"127.0.0.1",      // IPv4 localhost
		"::1",            // IPv6 localhost
		"10.0.0.0/8",     // 私有网络 A
		"172.16.0.0/12",  // 私有网络 B
		"192.168.0.0/16", // 私有网络 C
	},
}

// IsPrivateIP 检查是否为私有 IP 地址
func IsPrivateIP(ip string) bool {
	parsedIP := net.ParseIP(ip)
	if parsedIP == nil {
		return false
	}

	// IPv4 私有地址范围
	privateIPv4Ranges := []string{
		"10.0.0.0/8",
		"172.16.0.0/12",
		"192.168.0.0/16",
		"127.0.0.0/8", // localhost
	}

	for _, cidr := range privateIPv4Ranges {
		if parsedIP.To4() != nil {
			_, network, err := net.ParseCIDR(cidr)
			if err != nil {
				continue
			}
			if network.Contains(parsedIP) {
				return true
			}
		}
	}

	// IPv6 私有地址范围
	if parsedIP.To4() == nil {
		// IPv6 localhost
		if parsedIP.IsLoopback() {
			return true
		}
		// IPv6 私有地址
		if parsedIP.IsPrivate() {
			return true
		}
	}

	return false
}
