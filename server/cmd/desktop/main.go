package main

import (
	"context"
	"crypto/rand"
	"embed"
	"encoding/base64"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/adrg/xdg"
	easysshapp "github.com/easyssh/server/internal/app"
	"github.com/easyssh/server/internal/infra/config"
	"github.com/joho/godotenv"
	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:assets
var embeddedAssets embed.FS

const desktopAppDir = "EasySSH"

func main() {
	if err := prepareDesktopEnvironment(); err != nil {
		log.Fatalf("❌ Failed to prepare desktop environment: %v", err)
	}

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("❌ Failed to load desktop config: %v", err)
	}

	staticFS, err := desktopStaticFS()
	if err != nil {
		log.Fatalf("❌ Failed to load embedded static files: %v", err)
	}

	runtime, err := easysshapp.New(easysshapp.Options{
		Config:     cfg,
		ListenHost: "127.0.0.1",
		StaticFS:   staticFS,
	})
	if err != nil {
		log.Fatalf("❌ Failed to initialize desktop server: %v", err)
	}
	if err := runtime.Start(); err != nil {
		log.Fatalf("❌ Failed to start desktop server: %v", err)
	}
	shutdownRuntime := func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := runtime.Shutdown(ctx); err != nil {
			log.Printf("❌ Failed to shutdown desktop server: %v", err)
		}
	}
	defer shutdownRuntime()

	wailsApp := application.New(application.Options{
		Name:        "EasySSH",
		Description: "EasySSH desktop application",
		Assets: application.AssetOptions{
			Handler: http.NotFoundHandler(),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
		OnShutdown: shutdownRuntime,
	})

	wailsApp.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:                      "EasySSH",
		Width:                      1280,
		Height:                     820,
		MinWidth:                   960,
		MinHeight:                  640,
		URL:                        runtime.URL(),
		BackgroundColour:           application.NewRGB(10, 10, 10),
		ZoomControlEnabled:         true,
		DefaultContextMenuDisabled: true,
	})

	if err := wailsApp.Run(); err != nil {
		shutdownRuntime()
		log.Fatalf("❌ Wails application failed: %v", err)
	}
}

func prepareDesktopEnvironment() error {
	dataDir := filepath.Join(xdg.DataHome, desktopAppDir)
	backupDir := filepath.Join(dataDir, "backups")
	dbPath := filepath.Join(dataDir, "easyssh.db")
	envPath := filepath.Join(dataDir, "desktop.env")

	if err := os.MkdirAll(backupDir, 0750); err != nil {
		return fmt.Errorf("create desktop data directory: %w", err)
	}

	persistedEnv, err := loadDesktopEnv(envPath)
	if err != nil {
		return err
	}
	for key, value := range persistedEnv {
		setDefaultEnv(key, value)
	}

	setDefaultEnv("ENV", "production")
	setDefaultEnv("NEXT_PUBLIC_BACKEND_URL", "http://127.0.0.1:0")
	setDefaultEnv("WEB_PORT", "0")
	setDefaultEnv("DB_DRIVER", "sqlite")
	setDefaultEnv("DB_DSN", dbPath)
	setDefaultEnv("BACKUP_DIR", backupDir)
	setDefaultEnv("COOKIE_SECURE", "false")
	setDefaultEnv("COOKIE_SAMESITE", "lax")
	setDefaultEnv("CONTENT_SECURITY_POLICY", desktopContentSecurityPolicy())

	if err := ensurePersistentSecretEnv(envPath, persistedEnv, "JWT_SECRET", 48); err != nil {
		return err
	}
	if err := ensurePersistentSecretEnv(envPath, persistedEnv, "ENCRYPTION_KEY", 32); err != nil {
		return err
	}

	return nil
}

func desktopStaticFS() (fs.FS, error) {
	for _, dir := range []string{"assets/export", "assets/placeholder"} {
		staticFS, err := fs.Sub(embeddedAssets, dir)
		if err != nil {
			continue
		}
		if _, err := fs.Stat(staticFS, "index.html"); err == nil {
			return staticFS, nil
		}
	}

	return nil, fmt.Errorf("desktop static index.html not found")
}

func setDefaultEnv(key, value string) {
	if strings.TrimSpace(os.Getenv(key)) == "" {
		_ = os.Setenv(key, value)
	}
}

func ensurePersistentSecretEnv(envPath string, persistedEnv map[string]string, key string, size int) error {
	if strings.TrimSpace(os.Getenv(key)) != "" {
		return nil
	}

	value, err := randomBase64(size)
	if err != nil {
		return fmt.Errorf("generate %s: %w", key, err)
	}
	if err := os.Setenv(key, value); err != nil {
		return err
	}

	persistedEnv[key] = value
	return writeDesktopEnv(envPath, persistedEnv)
}

func loadDesktopEnv(path string) (map[string]string, error) {
	if _, err := os.Stat(path); err != nil {
		if os.IsNotExist(err) {
			return map[string]string{}, nil
		}
		return nil, fmt.Errorf("stat desktop env file: %w", err)
	}

	values, err := godotenv.Read(path)
	if err != nil {
		return nil, fmt.Errorf("read desktop env file: %w", err)
	}
	return values, nil
}

func writeDesktopEnv(path string, values map[string]string) error {
	envValues := make(map[string]string, len(values))
	for key, value := range values {
		if strings.TrimSpace(key) != "" && strings.TrimSpace(value) != "" {
			envValues[key] = value
		}
	}

	content, err := godotenv.Marshal(envValues)
	if err != nil {
		return fmt.Errorf("marshal desktop env file: %w", err)
	}

	var builder strings.Builder
	builder.WriteString("# EasySSH desktop runtime secrets.\n")
	builder.WriteString("# Keep this file with the desktop data directory; deleting it will make encrypted data unreadable.\n")
	builder.WriteString(content)
	builder.WriteByte('\n')

	if err := os.MkdirAll(filepath.Dir(path), 0750); err != nil {
		return fmt.Errorf("create desktop env directory: %w", err)
	}
	if err := os.WriteFile(path, []byte(builder.String()), 0600); err != nil {
		return fmt.Errorf("write desktop env file: %w", err)
	}
	if err := os.Chmod(path, 0600); err != nil {
		return fmt.Errorf("secure desktop env file: %w", err)
	}
	return nil
}

func randomBase64(size int) (string, error) {
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(buf), nil
}

func desktopContentSecurityPolicy() string {
	return "default-src 'self'; " +
		"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://accounts.google.com https://apis.google.com blob:; " +
		"worker-src 'self' blob:; " +
		"style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://accounts.google.com; " +
		"img-src 'self' data: https:; " +
		"font-src 'self' data: https://fonts.gstatic.com; " +
		"connect-src 'self' ws: wss: http://127.0.0.1:* http://localhost:* https://cdn.jsdelivr.net https://api.dicebear.com https://accounts.google.com https://oauth2.googleapis.com; " +
		"frame-src 'self' https://accounts.google.com"
}
