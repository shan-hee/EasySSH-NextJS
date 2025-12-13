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
	IsLink     bool        `json:"is_link"`
	LinkTarget string      `json:"link_target,omitempty"`
	ModTime    time.Time   `json:"mod_time"`
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
	Path        string  `json:"path"`
	Total       uint64  `json:"total"`
	Used        uint64  `json:"used"`
	Available   uint64  `json:"available"`
	UsedPercent float64 `json:"used_percent"`
}

// TrashEntry 回收站条目（.trash 下的文件/目录）
type TrashEntry struct {
	TrashName    string      `json:"trash_name"`
	TrashPath    string      `json:"trash_path"`
	OriginalName string      `json:"original_name"`
	RestorePath  string      `json:"restore_path"`
	Size         int64       `json:"size"`
	Mode         os.FileMode `json:"mode"`
	IsDir        bool        `json:"is_dir"`
	IsLink       bool        `json:"is_link"`
	ModTime      time.Time   `json:"mod_time"`
	Permission   string      `json:"permission"`
}

// TrashListing 回收站列表响应
type TrashListing struct {
	ParentDir string       `json:"parent_dir"`
	TrashDir  string       `json:"trash_dir"`
	Items     []TrashEntry `json:"items"`
	Total     int          `json:"total"`
}
