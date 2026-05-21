package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	easysshapp "github.com/easyssh/server/internal/app"
	"github.com/joho/godotenv"
)

func main() {
	// 加载根目录的 .env 文件
	if err := godotenv.Load("../.env"); err != nil {
		log.Printf("⚠️ Warning: .env file not found, using environment variables")
	}

	runtime, err := easysshapp.New(easysshapp.Options{})
	if err != nil {
		log.Fatalf("❌ Failed to initialize server: %v", err)
	}

	if err := runtime.Start(); err != nil {
		log.Fatalf("❌ Failed to start server: %v", err)
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := runtime.Shutdown(ctx); err != nil {
		log.Fatal("❌ Server forced to shutdown:", err)
	}
}
