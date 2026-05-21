package rest

import (
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/easyssh/server/internal/platform"
	"github.com/gin-gonic/gin"
)

type DesktopHandler struct {
	runtimeInfo platform.RuntimeInfo
}

func NewDesktopHandler(runtimeInfo platform.RuntimeInfo) *DesktopHandler {
	return &DesktopHandler{runtimeInfo: runtimeInfo}
}

func (h *DesktopHandler) GetDataDir(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"profile":  h.runtimeInfo.Profile,
		"portable": h.runtimeInfo.Portable,
		"data_dir": h.runtimeInfo.DataDir,
	})
}

func (h *DesktopHandler) OpenDataDir(c *gin.Context) {
	dataDir := strings.TrimSpace(h.runtimeInfo.DataDir)
	if dataDir == "" {
		RespondError(c, http.StatusBadRequest, "data_dir_unavailable", "Desktop data directory is not configured")
		return
	}

	if err := os.MkdirAll(dataDir, 0750); err != nil {
		RespondError(c, http.StatusInternalServerError, "create_data_dir_failed", err.Error())
		return
	}

	if err := openDirectory(dataDir); err != nil {
		RespondError(c, http.StatusInternalServerError, "open_data_dir_failed", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Data directory opened"})
}

func (h *DesktopHandler) ScheduleResetData(c *gin.Context) {
	dataDir := strings.TrimSpace(h.runtimeInfo.DataDir)
	if dataDir == "" {
		RespondError(c, http.StatusBadRequest, "data_dir_unavailable", "Desktop data directory is not configured")
		return
	}

	if err := os.MkdirAll(dataDir, 0750); err != nil {
		RespondError(c, http.StatusInternalServerError, "create_data_dir_failed", err.Error())
		return
	}

	markerPath := filepath.Join(dataDir, ".reset-on-next-start")
	content := []byte("EasySSH desktop data reset requested at " + time.Now().Format(time.RFC3339) + "\n")
	if err := os.WriteFile(markerPath, content, 0600); err != nil {
		RespondError(c, http.StatusInternalServerError, "schedule_reset_failed", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Desktop data will be reset on next start",
	})
}

func openDirectory(path string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("explorer", path)
	case "darwin":
		cmd = exec.Command("open", path)
	default:
		cmd = exec.Command("xdg-open", path)
	}
	return cmd.Start()
}
