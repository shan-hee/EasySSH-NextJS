package monitoring

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/easyssh/server/internal/domain/server"
	sshDomain "github.com/easyssh/server/internal/domain/ssh"
	"github.com/easyssh/server/internal/pkg/crypto"
	"github.com/google/uuid"
)

// Service 监控服务接口
type Service interface {
	// GetSystemInfo 获取系统综合信息
	GetSystemInfo(ctx context.Context, serverID string) (*SystemInfo, error)

	// GetCPUInfo 获取 CPU 信息
	GetCPUInfo(ctx context.Context, serverID string) (*CPUInfo, error)

	// GetMemoryInfo 获取内存信息
	GetMemoryInfo(ctx context.Context, serverID string) (*MemoryInfo, error)

	// GetDiskInfo 获取磁盘信息
	GetDiskInfo(ctx context.Context, serverID string) ([]*DiskInfo, error)

	// GetNetworkInfo 获取网络信息
	GetNetworkInfo(ctx context.Context, serverID string) ([]*NetworkInfo, error)

	// GetTopProcesses 获取资源占用最高的进程
	GetTopProcesses(ctx context.Context, serverID string, limit int) ([]*ProcessInfo, error)
}

// service 监控服务实现
type service struct {
	serverService server.Service
	encryptor     *crypto.Encryptor
}

// NewService 创建监控服务
func NewService(serverService server.Service, encryptor *crypto.Encryptor) Service {
	return &service{
		serverService: serverService,
		encryptor:     encryptor,
	}
}

// executeSSHCommand 执行 SSH 命令的辅助方法
func (s *service) executeSSHCommand(ctx context.Context, serverID, command string) (string, error) {
	// 获取服务器信息 (需要从 context 获取用户 ID)
	// 这里简化处理，实际应该从 context 中获取
	userIDValue, ok := ctx.Value("user_id").(string)
	if !ok {
		return "", fmt.Errorf("user_id not found in context")
	}

	userID, err := uuid.Parse(userIDValue)
	if err != nil {
		return "", fmt.Errorf("invalid user_id: %w", err)
	}

	// 解析服务器 ID
	srvUUID, err := uuid.Parse(serverID)
	if err != nil {
		return "", fmt.Errorf("invalid server_id: %w", err)
	}

	// 获取服务器
	srv, err := s.serverService.GetByID(ctx, userID, srvUUID)
	if err != nil {
		return "", fmt.Errorf("failed to get server: %w", err)
	}

	// 创建 SSH 客户端（监控命令使用不安全模式以避免阻塞）
	sshClient, err := sshDomain.NewClient(srv, s.encryptor, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create SSH client: %w", err)
	}

	// 连接
	if err := sshClient.Connect(srv.Host, srv.Port); err != nil {
		return "", fmt.Errorf("failed to connect: %w", err)
	}
	defer sshClient.Close()

	// 执行命令
	output, err := sshClient.ExecuteCommand(command)
	if err != nil {
		return "", fmt.Errorf("failed to execute command: %w", err)
	}

	return output, nil
}

// GetSystemInfo 获取系统综合信息
func (s *service) GetSystemInfo(ctx context.Context, serverID string) (*SystemInfo, error) {
	// 并发获取各项信息
	cpuInfoCh := make(chan *CPUInfo)
	memInfoCh := make(chan *MemoryInfo)
	diskInfoCh := make(chan []*DiskInfo)
	netInfoCh := make(chan []*NetworkInfo)
	errCh := make(chan error, 4)

	go func() {
		info, err := s.GetCPUInfo(ctx, serverID)
		if err != nil {
			errCh <- err
			return
		}
		cpuInfoCh <- info
	}()

	go func() {
		info, err := s.GetMemoryInfo(ctx, serverID)
		if err != nil {
			errCh <- err
			return
		}
		memInfoCh <- info
	}()

	go func() {
		info, err := s.GetDiskInfo(ctx, serverID)
		if err != nil {
			errCh <- err
			return
		}
		diskInfoCh <- info
	}()

	go func() {
		info, err := s.GetNetworkInfo(ctx, serverID)
		if err != nil {
			errCh <- err
			return
		}
		netInfoCh <- info
	}()

	// 获取基本系统信息
	hostnameCmd := "hostname"
	hostname, _ := s.executeSSHCommand(ctx, serverID, hostnameCmd)
	hostname = strings.TrimSpace(hostname)

	osCmd := "uname -s"
	osName, _ := s.executeSSHCommand(ctx, serverID, osCmd)
	osName = strings.TrimSpace(osName)

	platformCmd := "uname -r"
	platform, _ := s.executeSSHCommand(ctx, serverID, platformCmd)
	platform = strings.TrimSpace(platform)

	archCmd := "uname -m"
	arch, _ := s.executeSSHCommand(ctx, serverID, archCmd)
	arch = strings.TrimSpace(arch)

	uptimeCmd := "cat /proc/uptime | awk '{print $1}'"
	uptimeStr, _ := s.executeSSHCommand(ctx, serverID, uptimeCmd)
	uptime, _ := strconv.ParseFloat(strings.TrimSpace(uptimeStr), 64)

	// 收集结果
	systemInfo := &SystemInfo{
		Hostname:     hostname,
		OS:           osName,
		Platform:     platform,
		Architecture: arch,
		Uptime:       uint64(uptime),
		BootTime:     uint64(time.Now().Unix() - int64(uptime)),
		Timestamp:    time.Now(),
	}

	// 等待所有 goroutine 完成
	for i := 0; i < 4; i++ {
		select {
		case cpu := <-cpuInfoCh:
			systemInfo.CPU = cpu
		case mem := <-memInfoCh:
			systemInfo.Memory = mem
		case disks := <-diskInfoCh:
			systemInfo.Disks = disks
		case networks := <-netInfoCh:
			systemInfo.Networks = networks
		case err := <-errCh:
			return nil, err
		case <-time.After(30 * time.Second):
			return nil, fmt.Errorf("timeout waiting for system info")
		}
	}

	return systemInfo, nil
}

// GetCPUInfo 获取 CPU 信息
func (s *service) GetCPUInfo(ctx context.Context, serverID string) (*CPUInfo, error) {
	// 获取 CPU 核心数
	coresCmd := "nproc"
	coresStr, err := s.executeSSHCommand(ctx, serverID, coresCmd)
	if err != nil {
		return nil, err
	}
	cores, _ := strconv.Atoi(strings.TrimSpace(coresStr))

	// 获取 CPU 使用率 (使用 top 命令)
	usageCmd := "top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | sed 's/%us,//'"
	usageStr, err := s.executeSSHCommand(ctx, serverID, usageCmd)
	if err != nil {
		return nil, err
	}
	usage, _ := strconv.ParseFloat(strings.TrimSpace(usageStr), 64)

	// 获取负载平均值
	loadCmd := "cat /proc/loadavg | awk '{print $1,$2,$3}'"
	loadStr, err := s.executeSSHCommand(ctx, serverID, loadCmd)
	if err != nil {
		return nil, err
	}

	loadParts := strings.Fields(strings.TrimSpace(loadStr))
	loadAvg := make([]float64, 0, 3)
	for _, part := range loadParts {
		if val, err := strconv.ParseFloat(part, 64); err == nil {
			loadAvg = append(loadAvg, val)
		}
	}

	return &CPUInfo{
		Cores:        cores,
		UsagePercent: usage,
		LoadAverage:  loadAvg,
	}, nil
}

// GetMemoryInfo 获取内存信息
func (s *service) GetMemoryInfo(ctx context.Context, serverID string) (*MemoryInfo, error) {
	// 使用 free 命令获取内存信息
	cmd := "free -b | grep Mem | awk '{print $2,$3,$4,$7}' && free -b | grep Mem | awk '{print $6,$5}'"
	output, err := s.executeSSHCommand(ctx, serverID, cmd)
	if err != nil {
		return nil, err
	}

	lines := strings.Split(strings.TrimSpace(output), "\n")
	if len(lines) < 2 {
		return nil, fmt.Errorf("invalid memory info output")
	}

	// 解析第一行: total used free available
	parts1 := strings.Fields(lines[0])
	if len(parts1) < 4 {
		return nil, fmt.Errorf("invalid memory info format")
	}

	total, _ := strconv.ParseUint(parts1[0], 10, 64)
	used, _ := strconv.ParseUint(parts1[1], 10, 64)
	free, _ := strconv.ParseUint(parts1[2], 10, 64)
	available, _ := strconv.ParseUint(parts1[3], 10, 64)

	// 解析第二行: cached buffers
	parts2 := strings.Fields(lines[1])
	var cached, buffers uint64
	if len(parts2) >= 2 {
		cached, _ = strconv.ParseUint(parts2[0], 10, 64)
		buffers, _ = strconv.ParseUint(parts2[1], 10, 64)
	}

	usedPercent := float64(used) / float64(total) * 100

	return &MemoryInfo{
		Total:       total,
		Used:        used,
		Free:        free,
		Available:   available,
		UsedPercent: usedPercent,
		Cached:      cached,
		Buffers:     buffers,
	}, nil
}

// GetDiskInfo 获取磁盘信息
func (s *service) GetDiskInfo(ctx context.Context, serverID string) ([]*DiskInfo, error) {
	// 使用 df 命令获取磁盘信息
	cmd := "df -B1 -x tmpfs -x devtmpfs | tail -n +2 | awk '{print $1,$2,$3,$4,$5,$6}'"
	output, err := s.executeSSHCommand(ctx, serverID, cmd)
	if err != nil {
		return nil, err
	}

	lines := strings.Split(strings.TrimSpace(output), "\n")
	disks := make([]*DiskInfo, 0, len(lines))

	for _, line := range lines {
		parts := strings.Fields(line)
		if len(parts) < 6 {
			continue
		}

		total, _ := strconv.ParseUint(parts[1], 10, 64)
		used, _ := strconv.ParseUint(parts[2], 10, 64)
		free, _ := strconv.ParseUint(parts[3], 10, 64)
		usedPercentStr := strings.TrimSuffix(parts[4], "%")
		usedPercent, _ := strconv.ParseFloat(usedPercentStr, 64)

		disk := &DiskInfo{
			Path:        parts[5],
			Total:       total,
			Used:        used,
			Free:        free,
			UsedPercent: usedPercent,
			FileSystem:  parts[0],
			MountPoint:  parts[5],
		}
		disks = append(disks, disk)
	}

	return disks, nil
}

// GetNetworkInfo 获取网络信息
func (s *service) GetNetworkInfo(ctx context.Context, serverID string) ([]*NetworkInfo, error) {
	// 使用 /proc/net/dev 获取网络统计信息
	cmd := "cat /proc/net/dev | tail -n +3 | awk '{print $1,$2,$3,$10,$11}'"
	output, err := s.executeSSHCommand(ctx, serverID, cmd)
	if err != nil {
		return nil, err
	}

	lines := strings.Split(strings.TrimSpace(output), "\n")
	networks := make([]*NetworkInfo, 0, len(lines))

	for _, line := range lines {
		parts := strings.Fields(line)
		if len(parts) < 5 {
			continue
		}

		iface := strings.TrimSuffix(parts[0], ":")
		bytesRecv, _ := strconv.ParseUint(parts[1], 10, 64)
		packetsRecv, _ := strconv.ParseUint(parts[2], 10, 64)
		bytesSent, _ := strconv.ParseUint(parts[3], 10, 64)
		packetsSent, _ := strconv.ParseUint(parts[4], 10, 64)

		network := &NetworkInfo{
			Interface:   iface,
			BytesSent:   bytesSent,
			BytesRecv:   bytesRecv,
			PacketsSent: packetsSent,
			PacketsRecv: packetsRecv,
		}
		networks = append(networks, network)
	}

	return networks, nil
}

// GetTopProcesses 获取资源占用最高的进程
func (s *service) GetTopProcesses(ctx context.Context, serverID string, limit int) ([]*ProcessInfo, error) {
	if limit <= 0 {
		limit = 10
	}

	// 使用 ps 命令获取进程信息
	cmd := fmt.Sprintf("ps aux --sort=-%cmem | head -n %d | tail -n +2 | awk '{print $2,$11,$3,$4}'", '%', limit+1)
	output, err := s.executeSSHCommand(ctx, serverID, cmd)
	if err != nil {
		return nil, err
	}

	lines := strings.Split(strings.TrimSpace(output), "\n")
	processes := make([]*ProcessInfo, 0, len(lines))

	for _, line := range lines {
		parts := strings.Fields(line)
		if len(parts) < 4 {
			continue
		}

		pid, _ := strconv.ParseInt(parts[0], 10, 32)
		cpuPercent, _ := strconv.ParseFloat(parts[2], 64)
		memPercent, _ := strconv.ParseFloat(parts[3], 64)

		process := &ProcessInfo{
			PID:           int32(pid),
			Name:          parts[1],
			CPUPercent:    cpuPercent,
			MemoryPercent: memPercent,
		}
		processes = append(processes, process)
	}

	return processes, nil
}
