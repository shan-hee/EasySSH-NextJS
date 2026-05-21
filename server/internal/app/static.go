package app

import (
	"io/fs"
	"log"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

func registerStaticRoutes(r *gin.Engine, staticFS fs.FS, staticDir string) {
	if staticFS != nil {
		if _, err := fs.Stat(staticFS, "index.html"); err == nil {
			log.Println("✅ Serving embedded static files")
			r.NoRoute(func(c *gin.Context) {
				serveStaticFromFS(c, staticFS)
			})
			return
		}
		log.Println("⚠️  Embedded static files not found (frontend not built)")
	}

	if _, err := os.Stat(staticDir); err == nil {
		log.Printf("✅ Serving static files from %s", staticDir)

		r.Static("/_next", filepath.Join(staticDir, "_next"))
		r.StaticFile("/favicon.ico", filepath.Join(staticDir, "favicon.ico"))
		r.NoRoute(func(c *gin.Context) {
			serveStaticFromDir(c, staticDir)
		})
		return
	}

	log.Printf("⚠️  Static directory not found: %s (frontend not built)", staticDir)
}

func serveStaticFromFS(c *gin.Context, staticFS fs.FS) {
	requestPath := c.Request.URL.Path
	if strings.HasPrefix(requestPath, "/api") {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found", "message": "API endpoint not found"})
		return
	}

	cleanPath := cleanStaticPath(requestPath)
	if cleanPath == "" {
		serveFileFS(c, staticFS, "index.html")
		return
	}

	if info, err := fs.Stat(staticFS, cleanPath); err == nil {
		if !info.IsDir() {
			serveFileFS(c, staticFS, cleanPath)
			return
		}

		indexPath := path.Join(cleanPath, "index.html")
		if _, err := fs.Stat(staticFS, indexPath); err == nil {
			serveFileFS(c, staticFS, indexPath)
			return
		}
	}

	serveFileFS(c, staticFS, "index.html")
}

func serveStaticFromDir(c *gin.Context, staticDir string) {
	requestPath := c.Request.URL.Path
	if strings.HasPrefix(requestPath, "/api") {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found", "message": "API endpoint not found"})
		return
	}

	cleanPath := cleanStaticPath(requestPath)
	if cleanPath == "" {
		c.File(filepath.Join(staticDir, "index.html"))
		return
	}

	filePath := filepath.Join(staticDir, filepath.FromSlash(cleanPath))
	if info, err := os.Stat(filePath); err == nil {
		if !info.IsDir() {
			c.File(filePath)
			return
		}

		indexPath := filepath.Join(filePath, "index.html")
		if _, err := os.Stat(indexPath); err == nil {
			c.File(indexPath)
			return
		}
	}

	c.File(filepath.Join(staticDir, "index.html"))
}

func cleanStaticPath(requestPath string) string {
	cleanPath := path.Clean(requestPath)
	if cleanPath == "/" || cleanPath == "." {
		return ""
	}
	return strings.TrimPrefix(cleanPath, "/")
}

func serveFileFS(c *gin.Context, staticFS fs.FS, name string) {
	http.ServeFileFS(c.Writer, c.Request, staticFS, name)
}
