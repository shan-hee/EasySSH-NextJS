package middleware

import (
	"os"

	"github.com/gin-gonic/gin"
)

// SecurityHeaders 安全响应头中间件
// 设置常见的安全 HTTP 响应头,防止 XSS、点击劫持等攻击
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 防止 MIME 类型嗅探
		c.Header("X-Content-Type-Options", "nosniff")

		// 防止点击劫持攻击
		c.Header("X-Frame-Options", "DENY")

		// 启用浏览器 XSS 过滤器
		c.Header("X-XSS-Protection", "1; mode=block")

		// 内容安全策略 (CSP)
		// 默认策略: 仅允许同源资源, 但为 Monaco Editor 放行 jsDelivr CDN
		// 如需更严格或自定义策略, 可通过 CONTENT_SECURITY_POLICY 环境变量覆盖
		csp := os.Getenv("CONTENT_SECURITY_POLICY")
		if csp == "" {
			csp = "default-src 'self'; " +
				// 允许从 jsDelivr 加载 Monaco 相关脚本, 并允许 blob: 用于 Worker
				"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net blob:; " +
				// 显式允许 Web Worker / blob: Worker, 避免回退到 script-src 限制
				"worker-src 'self' blob:; " +
				"style-src 'self' 'unsafe-inline'; " +
				"img-src 'self' data: https:; " +
				"font-src 'self' data:; " +
				"connect-src 'self' https://cdn.jsdelivr.net"
		}
		c.Header("Content-Security-Policy", csp)

		// HSTS (HTTP Strict Transport Security)
		// 仅在生产环境且使用 HTTPS 时启用
		env := os.Getenv("ENV")
		if env == "production" {
			// 强制使用 HTTPS 1年,包含子域名
			c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}

		// 引用来源策略
		// strict-origin-when-cross-origin: 同源时发送完整 URL,跨域时仅发送源
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")

		// 权限策略 (Permissions Policy)
		// 限制浏览器功能访问
		c.Header("Permissions-Policy", "geolocation=(), microphone=(), camera=()")

		c.Next()
	}
}
