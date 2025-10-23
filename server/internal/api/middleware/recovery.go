package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// RequestID 请求 ID 中间件
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从请求头获取或生成新的请求 ID
		requestID := c.Request.Header.Get("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}

		// 设置到响应头
		c.Writer.Header().Set("X-Request-ID", requestID)

		// 设置到上下文
		c.Set("RequestID", requestID)

		c.Next()
	}
}

// Recovery 恢复中间件（捕获 panic）
func Recovery() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				// 获取请求 ID
				requestID, _ := c.Get("RequestID")

				// 记录错误
				c.JSON(http.StatusInternalServerError, gin.H{
					"error":      "internal_server_error",
					"message":    "Internal server error occurred",
					"request_id": requestID,
				})

				c.Abort()
			}
		}()

		c.Next()
	}
}
