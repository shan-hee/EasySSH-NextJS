package main

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

type DesktopCapability string

type DesktopRuntimeInfo struct {
	Profile      string                     `json:"profile"`
	Version      string                     `json:"version"`
	Platform     string                     `json:"platform"`
	Arch         string                     `json:"arch"`
	DataDir      string                     `json:"dataDir"`
	Capabilities map[DesktopCapability]bool `json:"capabilities"`
}

type DesktopService struct{}

func (s *DesktopService) RuntimeInfo() DesktopRuntimeInfo {
	return DesktopRuntimeInfo{
		Profile:  "desktop",
		Version:  readVersion(),
		Platform: runtime.GOOS,
		Arch:     runtime.GOARCH,
		DataDir:  desktopDataDir(),
		Capabilities: map[DesktopCapability]bool{
			"servers":          true,
			"terminal":         true,
			"sftp":             true,
			"transfers":        true,
			"monitoring":       true,
			"docker":           true,
			"ai":               true,
			"activity_log":     true,
			"settings":         true,
			"desktop_data_dir": true,
			"open_data_dir":    true,
			"portable_mode":    true,
		},
	}
}

func readVersion() string {
	for _, candidate := range []string{"../../VERSION", "../VERSION", "VERSION"} {
		content, err := os.ReadFile(candidate)
		if err != nil {
			continue
		}

		version := strings.TrimSpace(string(content))
		if version != "" {
			return version
		}
	}

	return "0.1.0"
}

func desktopDataDir() string {
	baseDir, err := os.UserConfigDir()
	if err != nil || baseDir == "" {
		baseDir = os.TempDir()
	}

	return filepath.Join(baseDir, "EasySSH", "Desktop")
}
