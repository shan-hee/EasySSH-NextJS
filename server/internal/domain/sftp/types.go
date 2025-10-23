package sftp

import (
	"os"
	"time"
)

// FileInfo 文件信息
type FileInfo struct {
	Name       string      `json:"name"`
	Path       string      `json:"path"`
	Size       int64       `json:"size"`
	Mode       os.FileMode `json:"mode"`
	IsDir      bool        `json:"is_dir"`
	ModTime    time.Time   `json:"mod_time"`
	Owner      string      `json:"owner,omitempty"`
	Group      string      `json:"group,omitempty"`
	Permission string      `json:"permission"`
}

// DirectoryListing 目录列表
type DirectoryListing struct {
	Path    string      `json:"path"`
	Files   []*FileInfo `json:"files"`
	Total   int         `json:"total"`
	CanRead bool        `json:"can_read"`
}

// UploadProgress 上传进度
type UploadProgress struct {
	Filename    string  `json:"filename"`
	Size        int64   `json:"size"`
	Transferred int64   `json:"transferred"`
	Progress    float64 `json:"progress"`
}

// DownloadProgress 下载进度
type DownloadProgress struct {
	Filename    string  `json:"filename"`
	Size        int64   `json:"size"`
	Transferred int64   `json:"transferred"`
	Progress    float64 `json:"progress"`
}

// FileOperationResult 文件操作结果
type FileOperationResult struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Path    string `json:"path,omitempty"`
}

// DiskUsage 磁盘使用情况
type DiskUsage struct {
	Path       string  `json:"path"`
	Total      uint64  `json:"total"`
	Used       uint64  `json:"used"`
	Available  uint64  `json:"available"`
	UsedPercent float64 `json:"used_percent"`
}
