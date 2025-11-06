package middleware

import (
	"net"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/easyssh/server/internal/domain/settings"
)

// IPWhitelistMiddleware IP 白名单验证中间件
func IPWhitelistMiddleware(ipWhitelistService settings.IPWhitelistService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 获取客户端真实 IP
		clientIP := getClientIP(c)

		// 如果无法获取 IP，则拒绝访问
		if clientIP == "" {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "Unable to determine client IP address",
			})
			c.Abort()
			return
		}

		// 检查 IP 是否被允许
		allowed, err := ipWhitelistService.IsIPAllowed(clientIP)
		if err != nil {
			// 如果检查过程出错，记录错误但允许访问（避免因服务错误导致正常用户无法访问）
			// 在生产环境中，可以根据需要调整这个策略
			c.Error(err) // 记录错误但不中断请求
			c.Next()
			return
		}

		if !allowed {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "IP address not allowed",
				"ip":      clientIP,
			})
			c.Abort()
			return
		}

		// 将客户端 IP 存入上下文，供其他中间件或处理器使用
		c.Set("client_ip", clientIP)
		c.Next()
	}
}

// OptionalIPWhitelistMiddleware 可选的 IP 白名单验证中间件
// 只有在配置了 IP 白名单时才进行验证
func OptionalIPWhitelistMiddleware(ipWhitelistService settings.IPWhitelistService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 获取客户端真实 IP
		clientIP := getClientIP(c)

		// 将客户端 IP 存入上下文
		c.Set("client_ip", clientIP)

		// 获取启用的白名单项
		whitelists, err := ipWhitelistService.GetEnabledIPWhitelists()
		if err != nil {
			// 记录错误但继续处理
			c.Error(err)
			c.Next()
			return
		}

		// 如果没有启用任何白名单项，则跳过验证
		if len(whitelists) == 0 {
			c.Next()
			return
		}

		// 检查 IP 是否被允许
		allowed, err := ipWhitelistService.IsIPAllowed(clientIP)
		if err != nil {
			// 记录错误但允许访问
			c.Error(err)
			c.Next()
			return
		}

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

// getClientIP 获取客户端真实 IP 地址
func getClientIP(c *gin.Context) string {
	// 1. 首先检查 X-Forwarded-For 头
	// 这个头通常包含多个 IP，第一个是客户端真实 IP
	xForwardedFor := c.GetHeader("X-Forwarded-For")
	if xForwardedFor != "" {
		// X-Forwarded-For 可能包含多个 IP，用逗号分隔
		// 格式：client, proxy1, proxy2
		ips := strings.Split(xForwardedFor, ",")
		if len(ips) > 0 {
			ip := strings.TrimSpace(ips[0])
			if isValidIP(ip) {
				return ip
			}
		}
	}

	// 2. 检查 X-Real-IP 头
	xRealIP := c.GetHeader("X-Real-IP")
	if xRealIP != "" {
		if isValidIP(xRealIP) {
			return xRealIP
		}
	}

	// 3. 检查 X-Forwarded 头
	xForwarded := c.GetHeader("X-Forwarded")
	if xForwarded != "" {
		if isValidIP(xForwarded) {
			return xForwarded
		}
	}

	// 4. 检查 CF-Connecting-IP 头（Cloudflare）
	cfConnectingIP := c.GetHeader("CF-Connecting-IP")
	if cfConnectingIP != "" {
		if isValidIP(cfConnectingIP) {
			return cfConnectingIP
		}
	}

	// 5. 检查 True-Client-IP 头（Akamai 和其他 CDN）
	trueClientIP := c.GetHeader("True-Client-IP")
	if trueClientIP != "" {
		if isValidIP(trueClientIP) {
			return trueClientIP
		}
	}

	// 6. 最后使用 RemoteAddr
	// 格式可能是 "ip:port"，需要提取 IP 部分
	ip, _, err := net.SplitHostPort(c.Request.RemoteAddr)
	if err != nil {
		// 如果解析失败，直接返回 RemoteAddr
		return c.Request.RemoteAddr
	}

	return ip
}

// isValidIP 验证 IP 地址是否有效
func isValidIP(ip string) bool {
	if ip == "" {
		return false
	}

	// 尝试解析为 IP 地址
	if net.ParseIP(ip) != nil {
		return true
	}

	return false
}

// IPWhitelistConfig IP 白名单配置
type IPWhitelistConfig struct {
	Enabled          bool     `json:"enabled"`
	AllowedIPs       []string `json:"allowed_ips"`
	BypassPaths      []string `json:"bypass_paths"`      // 跳过验证的路径
	AlwaysAllowIPs   []string `json:"always_allow_ips"`   // 始终允许的 IP（本地地址等）
}

// DefaultIPWhitelistConfig 默认的 IP 白名单配置
var DefaultIPWhitelistConfig = IPWhitelistConfig{
	Enabled: false,
	AllowedIPs: []string{},
	BypassPaths: []string{
		"/api/v1/health",
		"/api/v1/ping",
	},
	AlwaysAllowIPs: []string{
		"127.0.0.1",    // IPv4 localhost
		"::1",          // IPv6 localhost
		"10.0.0.0/8",   // 私有网络 A
		"172.16.0.0/12", // 私有网络 B
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