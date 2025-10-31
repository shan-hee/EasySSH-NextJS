package sftp

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/easyssh/server/internal/domain/server"
	sshDomain "github.com/easyssh/server/internal/domain/ssh"
	"github.com/pkg/sftp"
)

// Client SFTP 客户端封装
type Client struct {
	sftpClient *sftp.Client
	sshClient  *sshDomain.Client
	serverID   string
}

// NewClient 创建 SFTP 客户端
func NewClient(sshClient *sshDomain.Client, srv *server.Server) (*Client, error) {
	if !sshClient.IsConnected() {
		return nil, fmt.Errorf("SSH client not connected")
	}

	// 获取 SSH 连接
	// 注意：需要从 sshClient 中导出底层连接
	// 这里假设我们可以通过某种方式获取
	sftpClient, err := sftp.NewClient(sshClient.GetRawConnection())
	if err != nil {
		return nil, fmt.Errorf("failed to create SFTP client: %w", err)
	}

	return &Client{
		sftpClient: sftpClient,
		sshClient:  sshClient,
		serverID:   srv.ID.String(),
	}, nil
}

// Close 关闭 SFTP 连接
func (c *Client) Close() error {
	if c.sftpClient != nil {
		return c.sftpClient.Close()
	}
	return nil
}

// ListDirectory 列出目录
func (c *Client) ListDirectory(path string) (*DirectoryListing, error) {
	// 读取目录
	entries, err := c.sftpClient.ReadDir(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read directory: %w", err)
	}

	files := make([]*FileInfo, 0, len(entries))
	for _, entry := range entries {
		fileInfo := &FileInfo{
			Name:       entry.Name(),
			Path:       filepath.Join(path, entry.Name()),
			Size:       entry.Size(),
			Mode:       entry.Mode(),
			IsDir:      entry.IsDir(),
			ModTime:    entry.ModTime(),
			Permission: entry.Mode().String(),
		}

		// 尝试获取 Unix 权限信息
		if sys := entry.Sys(); sys != nil {
			// 可以从 sys 中提取 owner 和 group 信息
			// 但需要类型断言，这里简化处理
		}

		files = append(files, fileInfo)
	}

	return &DirectoryListing{
		Path:    path,
		Files:   files,
		Total:   len(files),
		CanRead: true,
	}, nil
}

// GetFileInfo 获取文件信息
func (c *Client) GetFileInfo(path string) (*FileInfo, error) {
	stat, err := c.sftpClient.Stat(path)
	if err != nil {
		return nil, fmt.Errorf("failed to stat file: %w", err)
	}

	return &FileInfo{
		Name:       stat.Name(),
		Path:       path,
		Size:       stat.Size(),
		Mode:       stat.Mode(),
		IsDir:      stat.IsDir(),
		ModTime:    stat.ModTime(),
		Permission: stat.Mode().String(),
	}, nil
}

// UploadFile 上传文件
func (c *Client) UploadFile(localReader io.Reader, remotePath string) error {
	return c.UploadFileWithProgress(localReader, remotePath, nil)
}

// UploadFileWithProgress 上传文件并报告进度
// onProgress: 进度回调函数，参数为已传输字节数
func (c *Client) UploadFileWithProgress(localReader io.Reader, remotePath string, onProgress func(loaded int64)) error {
	// 创建远程文件
	remoteFile, err := c.sftpClient.Create(remotePath)
	if err != nil {
		return fmt.Errorf("failed to create remote file: %w", err)
	}
	defer remoteFile.Close()

	// 如果没有进度回调，直接复制
	if onProgress == nil {
		_, err = io.Copy(remoteFile, localReader)
		if err != nil {
			return fmt.Errorf("failed to upload file: %w", err)
		}
		return nil
	}

	// 使用带进度跟踪的复制
	reader := &progressReader{
		reader:     localReader,
		onProgress: onProgress,
		lastReport: 0,
		reportEvery: 65536, // 每 64KB 报告一次进度
	}

	_, err = io.Copy(remoteFile, reader)
	if err != nil {
		return fmt.Errorf("failed to upload file: %w", err)
	}

	// 最后报告一次完整进度
	onProgress(reader.loaded)

	return nil
}

// progressReader 包装 io.Reader 以跟踪读取进度
type progressReader struct {
	reader      io.Reader
	onProgress  func(loaded int64)
	loaded      int64
	lastReport  int64
	reportEvery int64
}

func (r *progressReader) Read(p []byte) (n int, err error) {
	n, err = r.reader.Read(p)
	r.loaded += int64(n)

	// 每隔 reportEvery 字节报告一次进度，避免过度频繁
	if r.loaded-r.lastReport >= r.reportEvery {
		r.onProgress(r.loaded)
		r.lastReport = r.loaded
	}

	return n, err
}

// DownloadFile 下载文件
func (c *Client) DownloadFile(remotePath string, localWriter io.Writer) error {
	// 打开远程文件
	remoteFile, err := c.sftpClient.Open(remotePath)
	if err != nil {
		return fmt.Errorf("failed to open remote file: %w", err)
	}
	defer remoteFile.Close()

	// 复制数据
	_, err = io.Copy(localWriter, remoteFile)
	if err != nil {
		return fmt.Errorf("failed to download file: %w", err)
	}

	return nil
}

// CreateDirectory 创建目录
func (c *Client) CreateDirectory(path string) error {
	err := c.sftpClient.Mkdir(path)
	if err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}
	return nil
}

// CreateDirectories 创建多级目录
func (c *Client) CreateDirectories(path string) error {
	err := c.sftpClient.MkdirAll(path)
	if err != nil {
		return fmt.Errorf("failed to create directories: %w", err)
	}
	return nil
}

// DeleteFile 删除文件
func (c *Client) DeleteFile(path string) error {
	err := c.sftpClient.Remove(path)
	if err != nil {
		return fmt.Errorf("failed to delete file: %w", err)
	}
	return nil
}

// DeleteDirectory 删除目录
func (c *Client) DeleteDirectory(path string) error {
	// 递归删除目录
	err := c.removeAll(path)
	if err != nil {
		return fmt.Errorf("failed to delete directory: %w", err)
	}
	return nil
}

// removeAll 递归删除目录（类似 os.RemoveAll）
func (c *Client) removeAll(path string) error {
	// 获取目录内容
	entries, err := c.sftpClient.ReadDir(path)
	if err != nil {
		return err
	}

	// 递归删除所有子项
	for _, entry := range entries {
		childPath := filepath.Join(path, entry.Name())
		if entry.IsDir() {
			if err := c.removeAll(childPath); err != nil {
				return err
			}
		} else {
			if err := c.sftpClient.Remove(childPath); err != nil {
				return err
			}
		}
	}

	// 删除空目录
	return c.sftpClient.RemoveDirectory(path)
}

// RenameFile 重命名文件或目录
func (c *Client) RenameFile(oldPath, newPath string) error {
	err := c.sftpClient.Rename(oldPath, newPath)
	if err != nil {
		return fmt.Errorf("failed to rename: %w", err)
	}
	return nil
}

// CopyFile 复制文件
func (c *Client) CopyFile(srcPath, dstPath string) error {
	// 打开源文件
	srcFile, err := c.sftpClient.Open(srcPath)
	if err != nil {
		return fmt.Errorf("failed to open source file: %w", err)
	}
	defer srcFile.Close()

	// 创建目标文件
	dstFile, err := c.sftpClient.Create(dstPath)
	if err != nil {
		return fmt.Errorf("failed to create destination file: %w", err)
	}
	defer dstFile.Close()

	// 复制数据
	_, err = io.Copy(dstFile, srcFile)
	if err != nil {
		return fmt.Errorf("failed to copy file: %w", err)
	}

	return nil
}

// MoveFile 移动文件
func (c *Client) MoveFile(srcPath, dstPath string) error {
	return c.RenameFile(srcPath, dstPath)
}

// GetWorkingDirectory 获取当前工作目录
func (c *Client) GetWorkingDirectory() (string, error) {
	wd, err := c.sftpClient.Getwd()
	if err != nil {
		return "", fmt.Errorf("failed to get working directory: %w", err)
	}
	return wd, nil
}

// ChangeDirectory 切换目录
func (c *Client) ChangeDirectory(path string) error {
	// SFTP 客户端没有 Chdir 方法，我们可以验证目录存在
	stat, err := c.sftpClient.Stat(path)
	if err != nil {
		return fmt.Errorf("failed to change directory: %w", err)
	}

	if !stat.IsDir() {
		return fmt.Errorf("not a directory: %s", path)
	}

	return nil
}

// ReadFile 读取文件内容
func (c *Client) ReadFile(path string) ([]byte, error) {
	file, err := c.sftpClient.Open(path)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	return io.ReadAll(file)
}

// WriteFile 写入文件内容
func (c *Client) WriteFile(path string, data []byte, perm os.FileMode) error {
	file, err := c.sftpClient.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC)
	if err != nil {
		return fmt.Errorf("failed to open file for writing: %w", err)
	}
	defer file.Close()

	_, err = file.Write(data)
	if err != nil {
		return fmt.Errorf("failed to write file: %w", err)
	}

	// 设置权限
	if perm != 0 {
		err = c.sftpClient.Chmod(path, perm)
		if err != nil {
			return fmt.Errorf("failed to set permissions: %w", err)
		}
	}

	return nil
}

// Exists 检查文件或目录是否存在
func (c *Client) Exists(path string) (bool, error) {
	_, err := c.sftpClient.Stat(path)
	if err != nil {
		if strings.Contains(err.Error(), "not exist") || strings.Contains(err.Error(), "no such file") {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// GetDiskUsage 获取磁盘使用情况
func (c *Client) GetDiskUsage(path string) (*DiskUsage, error) {
	// SFTP 协议没有直接获取磁盘使用情况的方法
	// 需要通过 SSH 执行命令获取
	// 这里返回一个简化的实现
	statvfs, err := c.sftpClient.StatVFS(path)
	if err != nil {
		return nil, fmt.Errorf("failed to get disk usage: %w", err)
	}

	total := statvfs.Blocks * statvfs.Bsize
	available := statvfs.Bavail * statvfs.Bsize
	used := total - available
	usedPercent := float64(used) / float64(total) * 100

	return &DiskUsage{
		Path:        path,
		Total:       total,
		Used:        used,
		Available:   available,
		UsedPercent: usedPercent,
	}, nil
}
