package middleware

import (
	"os"

	"github.com/gin-gonic/gin"
	"github.com/unrolled/secure"
)

// SecurityHeaders 安全响应头中间件
// 设置常见的安全 HTTP 响应头,防止 XSS、点击劫持等攻击
func SecurityHeaders() gin.HandlerFunc {
	secureMiddleware := secure.New(secure.Options{
		BrowserXssFilter:          true,
		ContentTypeNosniff:        true,
		FrameDeny:                 true,
		IsDevelopment:             os.Getenv("ENV") != "production",
		STSSeconds:                31536000,
		STSIncludeSubdomains:      true,
		ReferrerPolicy:            "strict-origin-when-cross-origin",
		PermissionsPolicy:         "geolocation=(), microphone=(), camera=()",
		CrossOriginOpenerPolicy:   "unsafe-none",
		CrossOriginEmbedderPolicy: "unsafe-none",
	})

	return func(c *gin.Context) {
		if err := secureMiddleware.Process(c.Writer, c.Request); err != nil {
			c.Abort()
			return
		}

		// 内容安全策略 (CSP)
		// 默认策略: 仅允许同源资源, 但为 Monaco Editor 放行 jsDelivr CDN
		// 如需更严格或自定义策略, 可通过 CONTENT_SECURITY_POLICY 环境变量覆盖
		csp := os.Getenv("CONTENT_SECURITY_POLICY")
		if csp == "" {
			csp = "default-src 'self'; " +
				// 允许从 jsDelivr 加载 Monaco 相关脚本, 并允许 blob: 用于 Worker
				// 允许 Google OAuth 相关脚本
				"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://accounts.google.com https://apis.google.com blob:; " +
				// 显式允许 Web Worker / blob: Worker, 避免回退到 script-src 限制
				"worker-src 'self' blob:; " +
				// 允许从 jsDelivr 加载 Monaco 所需的样式
				"style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://accounts.google.com; " +
				"img-src 'self' data: https:; " +
				"font-src 'self' data: https://fonts.gstatic.com; " +
				// 允许连接到 Google OAuth 相关域名
				"connect-src 'self' https://cdn.jsdelivr.net https://api.dicebear.com https://accounts.google.com https://oauth2.googleapis.com; " +
				// 允许 Google OAuth iframe
				"frame-src 'self' https://accounts.google.com"
		}
		c.Header("Content-Security-Policy", csp)

		c.Next()
	}
}
