package aichat

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/easyssh/server/internal/domain/server"
	"github.com/easyssh/server/internal/domain/sftp"
	sshDomain "github.com/easyssh/server/internal/domain/ssh"
	"github.com/easyssh/server/internal/pkg/crypto"
	"github.com/google/uuid"
)

// ToolExecutorService 工具执行服务
type ToolExecutorService struct {
	serverService server.Service
	sftpPool      *sftp.Pool
	encryptor     *crypto.Encryptor
}

// NewToolExecutorService 创建工具执行服务
func NewToolExecutorService(
	serverService server.Service,
	sftpPool *sftp.Pool,
	encryptor *crypto.Encryptor,
) *ToolExecutorService {
	return &ToolExecutorService{
		serverService: serverService,
		sftpPool:      sftpPool,
		encryptor:     encryptor,
	}
}

// ExecuteTool 执行工具调用
func (s *ToolExecutorService) ExecuteTool(ctx context.Context, userID uuid.UUID, toolCall *ToolCall, permissionMode PermissionMode) (*ToolResult, error) {
	mode := NormalizePermissionMode(string(permissionMode))
	if !IsToolAllowedInMode(mode, toolCall.Name) {
		return nil, &ToolPermissionError{
			Mode:     mode,
			ToolName: toolCall.Name,
		}
	}

	result := &ToolResult{
		ToolCallID: toolCall.ID,
	}

	switch toolCall.Name {
	case "list_servers":
		return s.executeListServers(ctx, userID, toolCall)
	case "get_server_info":
		return s.executeGetServerInfo(ctx, userID, toolCall)
	case "execute_command":
		return s.executeCommand(ctx, userID, toolCall)
	case "list_directory":
		return s.executeListDirectory(ctx, userID, toolCall)
	case "read_file":
		return s.executeReadFile(ctx, userID, toolCall)
	case "write_file":
		return s.executeWriteFile(ctx, userID, toolCall)
	case "create_directory":
		return s.executeCreateDirectory(ctx, userID, toolCall)
	case "delete_file":
		return s.executeDeleteFile(ctx, userID, toolCall)
	case "get_system_info":
		return s.executeGetSystemInfo(ctx, userID, toolCall)
	default:
		result.Content = fmt.Sprintf("未知工具: %s", toolCall.Name)
		result.IsError = true
		return result, nil
	}
}

// executeListServers 列出服务器
func (s *ToolExecutorService) executeListServers(ctx context.Context, userID uuid.UUID, toolCall *ToolCall) (*ToolResult, error) {
	result := &ToolResult{ToolCallID: toolCall.ID}

	servers, _, err := s.serverService.List(ctx, userID, 100, 0)
	if err != nil {
		result.Content = fmt.Sprintf("获取服务器列表失败: %v", err)
		result.IsError = true
		return result, nil
	}

	type serverInfo struct {
		ID     string `json:"id"`
		Name   string `json:"name"`
		Host   string `json:"host"`
		Port   int    `json:"port"`
		Status string `json:"status"`
	}

	serverList := make([]serverInfo, len(servers))
	for i, srv := range servers {
		name := srv.Host
		if srv.Name != "" {
			name = srv.Name
		}
		serverList[i] = serverInfo{
			ID:     srv.ID.String(),
			Name:   name,
			Host:   srv.Host,
			Port:   srv.Port,
			Status: string(srv.Status),
		}
	}

	data, _ := json.MarshalIndent(serverList, "", "  ")
	result.Content = fmt.Sprintf("找到 %d 台服务器:\n%s", len(servers), string(data))
	return result, nil
}

// executeGetServerInfo 获取服务器详情
func (s *ToolExecutorService) executeGetServerInfo(ctx context.Context, userID uuid.UUID, toolCall *ToolCall) (*ToolResult, error) {
	result := &ToolResult{ToolCallID: toolCall.ID}

	var args struct {
		ServerID string `json:"server_id"`
	}
	if err := json.Unmarshal(toolCall.Arguments, &args); err != nil {
		result.Content = fmt.Sprintf("参数解析失败: %v", err)
		result.IsError = true
		return result, nil
	}

	serverID, err := uuid.Parse(args.ServerID)
	if err != nil {
		result.Content = fmt.Sprintf("无效的服务器ID: %v", err)
		result.IsError = true
		return result, nil
	}

	srv, err := s.serverService.GetByID(ctx, userID, serverID)
	if err != nil {
		result.Content = fmt.Sprintf("获取服务器信息失败: %v", err)
		result.IsError = true
		return result, nil
	}

	info := map[string]interface{}{
		"id":             srv.ID.String(),
		"name":           srv.Name,
		"host":           srv.Host,
		"port":           srv.Port,
		"username":       srv.Username,
		"auth_method":    srv.AuthMethod,
		"status":         srv.Status,
		"group":          srv.Group,
		"tags":           srv.Tags,
		"description":    srv.Description,
		"last_connected": srv.LastConnected,
		"country":        srv.Country,
		"city":           srv.City,
	}

	data, _ := json.MarshalIndent(info, "", "  ")
	result.Content = string(data)
	return result, nil
}

// executeCommand 执行命令
func (s *ToolExecutorService) executeCommand(ctx context.Context, userID uuid.UUID, toolCall *ToolCall) (*ToolResult, error) {
	result := &ToolResult{ToolCallID: toolCall.ID}

	var args struct {
		ServerID string `json:"server_id"`
		Command  string `json:"command"`
		Timeout  int    `json:"timeout"`
	}
	if err := json.Unmarshal(toolCall.Arguments, &args); err != nil {
		result.Content = fmt.Sprintf("参数解析失败: %v", err)
		result.IsError = true
		return result, nil
	}

	if args.Timeout <= 0 {
		args.Timeout = 30
	}
	if args.Timeout > 300 {
		args.Timeout = 300
	}

	serverID, err := uuid.Parse(args.ServerID)
	if err != nil {
		result.Content = fmt.Sprintf("无效的服务器ID: %v", err)
		result.IsError = true
		return result, nil
	}

	srv, err := s.serverService.GetByID(ctx, userID, serverID)
	if err != nil {
		result.Content = fmt.Sprintf("获取服务器信息失败: %v", err)
		result.IsError = true
		return result, nil
	}

	// 创建 SSH 客户端
	sshClient, err := sshDomain.NewClient(srv, s.encryptor, nil)
	if err != nil {
		result.Content = fmt.Sprintf("创建SSH客户端失败: %v", err)
		result.IsError = true
		return result, nil
	}

	// 使用带超时的上下文连接
	connectCtx, cancel := context.WithTimeout(ctx, time.Duration(args.Timeout)*time.Second)
	defer cancel()

	if err := sshClient.ConnectContext(connectCtx, srv.Host, srv.Port); err != nil {
		result.Content = fmt.Sprintf("连接服务器失败: %v", err)
		result.IsError = true
		return result, nil
	}
	defer sshClient.Close()

	// 执行命令
	output, err := sshClient.ExecuteCommand(args.Command)
	if err != nil {
		result.Content = fmt.Sprintf("命令执行失败: %v\n输出: %s", err, output)
		result.IsError = true
		return result, nil
	}

	// 限制输出长度
	if len(output) > 10000 {
		output = output[:10000] + "\n... (输出已截断)"
	}

	result.Content = fmt.Sprintf("命令执行成功:\n```\n%s\n```", strings.TrimSpace(output))
	return result, nil
}

// executeListDirectory 列出目录
func (s *ToolExecutorService) executeListDirectory(ctx context.Context, userID uuid.UUID, toolCall *ToolCall) (*ToolResult, error) {
	result := &ToolResult{ToolCallID: toolCall.ID}

	var args struct {
		ServerID string `json:"server_id"`
		Path     string `json:"path"`
	}
	if err := json.Unmarshal(toolCall.Arguments, &args); err != nil {
		result.Content = fmt.Sprintf("参数解析失败: %v", err)
		result.IsError = true
		return result, nil
	}

	if args.Path == "" || args.Path == "~" {
		args.Path = "."
	}

	serverID, err := uuid.Parse(args.ServerID)
	if err != nil {
		result.Content = fmt.Sprintf("无效的服务器ID: %v", err)
		result.IsError = true
		return result, nil
	}

	// 获取 SFTP 客户端
	client, err := s.sftpPool.Get(ctx, userID, serverID)
	if err != nil {
		result.Content = fmt.Sprintf("连接服务器失败: %v", err)
		result.IsError = true
		return result, nil
	}
	defer client.Release()

	// 列出目录
	listing, err := client.ListDirectory(args.Path)
	if err != nil {
		result.Content = fmt.Sprintf("列出目录失败: %v", err)
		result.IsError = true
		return result, nil
	}

	// 格式化输出
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("目录: %s\n共 %d 项:\n\n", listing.Path, listing.Total))

	for _, f := range listing.Files {
		typeStr := "文件"
		if f.IsDir {
			typeStr = "目录"
		} else if f.IsLink {
			typeStr = "链接"
		}
		sb.WriteString(fmt.Sprintf("%s  %10d  %s  %s\n",
			f.Permission,
			f.Size,
			f.ModTime.Format("2006-01-02 15:04"),
			f.Name,
		))
		if f.IsLink && f.LinkTarget != "" {
			sb.WriteString(fmt.Sprintf("    -> %s\n", f.LinkTarget))
		}
		_ = typeStr // 暂时不使用
	}

	result.Content = sb.String()
	return result, nil
}

// executeReadFile 读取文件
func (s *ToolExecutorService) executeReadFile(ctx context.Context, userID uuid.UUID, toolCall *ToolCall) (*ToolResult, error) {
	result := &ToolResult{ToolCallID: toolCall.ID}

	var args struct {
		ServerID string `json:"server_id"`
		Path     string `json:"path"`
		MaxLines int    `json:"max_lines"`
	}
	if err := json.Unmarshal(toolCall.Arguments, &args); err != nil {
		result.Content = fmt.Sprintf("参数解析失败: %v", err)
		result.IsError = true
		return result, nil
	}

	if args.MaxLines <= 0 {
		args.MaxLines = 100
	}
	if args.MaxLines > 500 {
		args.MaxLines = 500
	}

	serverID, err := uuid.Parse(args.ServerID)
	if err != nil {
		result.Content = fmt.Sprintf("无效的服务器ID: %v", err)
		result.IsError = true
		return result, nil
	}

	// 获取 SFTP 客户端
	client, err := s.sftpPool.Get(ctx, userID, serverID)
	if err != nil {
		result.Content = fmt.Sprintf("连接服务器失败: %v", err)
		result.IsError = true
		return result, nil
	}
	defer client.Release()

	// 读取文件
	content, err := client.ReadFile(args.Path)
	if err != nil {
		result.Content = fmt.Sprintf("读取文件失败: %v", err)
		result.IsError = true
		return result, nil
	}

	// 限制行数
	lines := strings.Split(string(content), "\n")
	truncated := false
	if len(lines) > args.MaxLines {
		lines = lines[:args.MaxLines]
		truncated = true
	}

	output := strings.Join(lines, "\n")
	if truncated {
		output += fmt.Sprintf("\n\n... (文件已截断，仅显示前 %d 行)", args.MaxLines)
	}

	result.Content = fmt.Sprintf("文件内容 (%s):\n```\n%s\n```", args.Path, output)
	return result, nil
}

// executeWriteFile 写入文件
func (s *ToolExecutorService) executeWriteFile(ctx context.Context, userID uuid.UUID, toolCall *ToolCall) (*ToolResult, error) {
	result := &ToolResult{ToolCallID: toolCall.ID}

	var args struct {
		ServerID string `json:"server_id"`
		Path     string `json:"path"`
		Content  string `json:"content"`
	}
	if err := json.Unmarshal(toolCall.Arguments, &args); err != nil {
		result.Content = fmt.Sprintf("参数解析失败: %v", err)
		result.IsError = true
		return result, nil
	}

	serverID, err := uuid.Parse(args.ServerID)
	if err != nil {
		result.Content = fmt.Sprintf("无效的服务器ID: %v", err)
		result.IsError = true
		return result, nil
	}

	// 获取 SFTP 客户端
	client, err := s.sftpPool.Get(ctx, userID, serverID)
	if err != nil {
		result.Content = fmt.Sprintf("连接服务器失败: %v", err)
		result.IsError = true
		return result, nil
	}
	defer client.Release()

	// 写入文件
	if err := client.WriteFile(args.Path, []byte(args.Content), 0644); err != nil {
		result.Content = fmt.Sprintf("写入文件失败: %v", err)
		result.IsError = true
		return result, nil
	}

	result.Content = fmt.Sprintf("文件已成功写入: %s (%d 字节)", args.Path, len(args.Content))
	return result, nil
}

// executeCreateDirectory 创建目录
func (s *ToolExecutorService) executeCreateDirectory(ctx context.Context, userID uuid.UUID, toolCall *ToolCall) (*ToolResult, error) {
	result := &ToolResult{ToolCallID: toolCall.ID}

	var args struct {
		ServerID string `json:"server_id"`
		Path     string `json:"path"`
	}
	if err := json.Unmarshal(toolCall.Arguments, &args); err != nil {
		result.Content = fmt.Sprintf("参数解析失败: %v", err)
		result.IsError = true
		return result, nil
	}

	serverID, err := uuid.Parse(args.ServerID)
	if err != nil {
		result.Content = fmt.Sprintf("无效的服务器ID: %v", err)
		result.IsError = true
		return result, nil
	}

	// 获取 SFTP 客户端
	client, err := s.sftpPool.Get(ctx, userID, serverID)
	if err != nil {
		result.Content = fmt.Sprintf("连接服务器失败: %v", err)
		result.IsError = true
		return result, nil
	}
	defer client.Release()

	// 创建目录（递归）
	if err := client.CreateDirectories(args.Path); err != nil {
		result.Content = fmt.Sprintf("创建目录失败: %v", err)
		result.IsError = true
		return result, nil
	}

	result.Content = fmt.Sprintf("目录已成功创建: %s", args.Path)
	return result, nil
}

// executeDeleteFile 删除文件
func (s *ToolExecutorService) executeDeleteFile(ctx context.Context, userID uuid.UUID, toolCall *ToolCall) (*ToolResult, error) {
	result := &ToolResult{ToolCallID: toolCall.ID}

	var args struct {
		ServerID string `json:"server_id"`
		Path     string `json:"path"`
	}
	if err := json.Unmarshal(toolCall.Arguments, &args); err != nil {
		result.Content = fmt.Sprintf("参数解析失败: %v", err)
		result.IsError = true
		return result, nil
	}

	serverID, err := uuid.Parse(args.ServerID)
	if err != nil {
		result.Content = fmt.Sprintf("无效的服务器ID: %v", err)
		result.IsError = true
		return result, nil
	}

	// 获取 SFTP 客户端
	client, err := s.sftpPool.Get(ctx, userID, serverID)
	if err != nil {
		result.Content = fmt.Sprintf("连接服务器失败: %v", err)
		result.IsError = true
		return result, nil
	}
	defer client.Release()

	// 获取文件信息
	info, err := client.GetFileInfo(args.Path)
	if err != nil {
		result.Content = fmt.Sprintf("获取文件信息失败: %v", err)
		result.IsError = true
		return result, nil
	}

	// 删除
	if info.IsDir {
		if err := client.DeleteDirectory(args.Path); err != nil {
			result.Content = fmt.Sprintf("删除目录失败: %v", err)
			result.IsError = true
			return result, nil
		}
		result.Content = fmt.Sprintf("目录已删除: %s", args.Path)
	} else {
		if err := client.DeleteFile(args.Path); err != nil {
			result.Content = fmt.Sprintf("删除文件失败: %v", err)
			result.IsError = true
			return result, nil
		}
		result.Content = fmt.Sprintf("文件已删除: %s", args.Path)
	}

	return result, nil
}

// executeGetSystemInfo 获取系统信息
func (s *ToolExecutorService) executeGetSystemInfo(ctx context.Context, userID uuid.UUID, toolCall *ToolCall) (*ToolResult, error) {
	result := &ToolResult{ToolCallID: toolCall.ID}

	var args struct {
		ServerID string `json:"server_id"`
	}
	if err := json.Unmarshal(toolCall.Arguments, &args); err != nil {
		result.Content = fmt.Sprintf("参数解析失败: %v", err)
		result.IsError = true
		return result, nil
	}

	serverID, err := uuid.Parse(args.ServerID)
	if err != nil {
		result.Content = fmt.Sprintf("无效的服务器ID: %v", err)
		result.IsError = true
		return result, nil
	}

	srv, err := s.serverService.GetByID(ctx, userID, serverID)
	if err != nil {
		result.Content = fmt.Sprintf("获取服务器信息失败: %v", err)
		result.IsError = true
		return result, nil
	}

	// 创建 SSH 客户端
	sshClient, err := sshDomain.NewClient(srv, s.encryptor, nil)
	if err != nil {
		result.Content = fmt.Sprintf("创建SSH客户端失败: %v", err)
		result.IsError = true
		return result, nil
	}

	connectCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	if err := sshClient.ConnectContext(connectCtx, srv.Host, srv.Port); err != nil {
		result.Content = fmt.Sprintf("连接服务器失败: %v", err)
		result.IsError = true
		return result, nil
	}
	defer sshClient.Close()

	// 执行系统信息收集命令
	commands := []struct {
		name string
		cmd  string
	}{
		{"主机名", "hostname"},
		{"系统信息", "uname -a"},
		{"CPU信息", "cat /proc/cpuinfo | grep 'model name' | head -1 | cut -d: -f2"},
		{"CPU核心数", "nproc"},
		{"内存使用", "free -h | grep Mem"},
		{"磁盘使用", "df -h / | tail -1"},
		{"系统负载", "uptime"},
		{"运行时间", "uptime -p 2>/dev/null || uptime"},
	}

	var sb strings.Builder
	sb.WriteString("系统信息:\n\n")

	for _, c := range commands {
		output, err := sshClient.ExecuteCommand(c.cmd)
		if err != nil {
			sb.WriteString(fmt.Sprintf("**%s**: 获取失败\n", c.name))
		} else {
			sb.WriteString(fmt.Sprintf("**%s**: %s\n", c.name, strings.TrimSpace(output)))
		}
	}

	result.Content = sb.String()
	return result, nil
}

// 辅助函数：按行读取并限制行数
func readLines(content string, maxLines int) ([]string, bool) {
	scanner := bufio.NewScanner(strings.NewReader(content))
	var lines []string
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
		if len(lines) >= maxLines {
			return lines, true
		}
	}
	return lines, false
}
