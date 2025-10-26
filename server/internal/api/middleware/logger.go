package middleware

import (
	"log"
	"time"

	"github.com/gin-gonic/gin"
)

// Logger 日志中间件
func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 开始时间
		startTime := time.Now()

		// 处理请求
		c.Next()

		// 过滤健康检查和ping请求，避免日志污染
		reqURI := c.Request.RequestURI
		if reqURI == "/api/v1/ping" || reqURI == "/api/v1/health" {
			return
		}

		// 结束时间
		endTime := time.Now()
		latencyTime := endTime.Sub(startTime)

		// 请求方式
		reqMethod := c.Request.Method

		// 状态码
		statusCode := c.Writer.Status()

		// 请求 IP
		clientIP := c.ClientIP()

		// 日志格式
		log.Printf("[GIN] %s | %3d | %13v | %15s | %-7s %s",
			endTime.Format("2006/01/02 - 15:04:05"),
			statusCode,
			latencyTime,
			clientIP,
			reqMethod,
			reqURI,
		)
	}
}
