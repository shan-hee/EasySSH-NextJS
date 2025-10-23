package main

import (
	"log"
	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.Default()

	// API v1 路由组
	v1 := r.Group("/api/v1")
	{
		v1.GET("/health", healthCheck)
		// TODO: 添加其他路由
	}

	// 启动服务器
	log.Println("Server starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}

func healthCheck(c *gin.Context) {
	c.JSON(200, gin.H{
		"status": "ok",
		"service": "easyssh-api",
	})
}
