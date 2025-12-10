package monitoring

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/easyssh/server/internal/domain/server"
	sshDomain "github.com/easyssh/server/internal/domain/ssh"
	"github.com/easyssh/server/internal/pkg/crypto"
	"github.com/google/uuid"
)

// EasySSHDataSource EasySSH 数据源（SSH 直连采集）
type EasySSHDataSource struct {
	serverService server.Service
	encryptor     *crypto.Encryptor
	userID        uuid.UUID
}

// NewEasySSHDataSource 创建 EasySSH 数据源
func NewEasySSHDataSource(serverService server.Service, encryptor *crypto.Encryptor, userID uuid.UUID) *EasySSHDataSource {
	return &EasySSHDataSource{
		serverService: serverService,
		encryptor:     encryptor,
		userID:        userID,
	}
}

// Name 返回数据源名称
func (e *EasySSHDataSource) Name() string {
	return "easyssh"
}

// TestConnection 测试连接（对于 EasySSH，始终返回成功）
func (e *EasySSHDataSource) TestConnection(ctx context.Context) error {
	return nil
}

// batchCollectScript 批量采集脚本（一次SSH执行获取所有指标）
const batchCollectScript = `
echo "=== CPU ==="
cat /proc/stat | grep '^cpu '
nproc

echo "=== MEMORY ==="
cat /proc/meminfo | grep -E '^(MemTotal|MemFree|MemAvailable|Buffers|Cached|SwapTotal|SwapFree):'

echo "=== DISK ==="
df -B1 --total -x tmpfs -x devtmpfs -x squashfs -x overlay -x aufs 2>/dev/null | tail -n 1

echo "=== NETWORK ==="
cat /proc/net/dev | tail -n +3

echo "=== LOAD ==="
cat /proc/loadavg

echo "=== UPTIME ==="
cat /proc/uptime
`

// GetServersResources 获取所有服务器资源概览
func (e *EasySSHDataSource) GetServersResources(ctx context.Context) ([]*ServerResourceSummary, error) {
	// 获取用户的所有服务器
	servers, _, err := e.serverService.List(ctx, e.userID, 1000, 0)
	if err != nil {
		return nil, fmt.Errorf("failed to list servers: %w", err)
	}

	// 并行采集所有服务器的资源
	var wg sync.WaitGroup
	results := make([]*ServerResourceSummary, len(servers))

	for i, srv := range servers {
		wg.Add(1)
		go func(index int, srv *server.Server) {
			defer wg.Done()
			results[index] = e.collectServerResource(ctx, srv)
		}(i, srv)
	}

	wg.Wait()
	return results, nil
}

// StreamServersResources 流式获取服务器资源
func (e *EasySSHDataSource) StreamServersResources(ctx context.Context, resultChan chan<- *ServerResourceSummary) error {
	// 获取用户的所有服务器
	servers, _, err := e.serverService.List(ctx, e.userID, 1000, 0)
	if err != nil {
		return fmt.Errorf("failed to list servers: %w", err)
	}

	// 并行采集所有服务器的资源，每台完成后立即发送
	var wg sync.WaitGroup

	for _, srv := range servers {
		wg.Add(1)
		go func(srv *server.Server) {
			defer wg.Done()
			result := e.collectServerResource(ctx, srv)
			select {
			case resultChan <- result:
			case <-ctx.Done():
				return
			}
		}(srv)
	}

	wg.Wait()
	return nil
}

// collectServerResource 采集单台服务器的资源（单次SSH连接）
func (e *EasySSHDataSource) collectServerResource(ctx context.Context, srv *server.Server) *ServerResourceSummary {
	result := &ServerResourceSummary{
		ServerID:    srv.ID.String(),
		Name:        srv.Name,
		Host:        srv.Host,
		Port:        srv.Port,
		Status:      "offline",
		CollectedAt: time.Now(),
	}

	// 从 Server 表读取地理位置信息
	if srv.Country != "" || srv.Region != "" || srv.City != "" {
		result.Location = &LocationSummary{
			Country:     srv.Country,
			CountryCode: srv.CountryCode,
			Region:      srv.Region,
			City:        srv.City,
		}
	}

	// 如果服务器不是 online 状态，直接返回
	if srv.Status != "online" {
		return result
	}

	// 创建 SSH 客户端
	sshClient, err := sshDomain.NewClient(srv, e.encryptor, nil)
	if err != nil {
		result.Status = "error"
		result.Error = fmt.Sprintf("failed to create SSH client: %v", err)
		return result
	}

	// 连接（设置超时）
	connCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	connDone := make(chan error, 1)
	go func() {
		connDone <- sshClient.Connect(srv.Host, srv.Port)
	}()

	select {
	case err = <-connDone:
		if err != nil {
			result.Status = "error"
			result.Error = fmt.Sprintf("failed to connect: %v", err)
			return result
		}
	case <-connCtx.Done():
		result.Status = "error"
		result.Error = "connection timeout"
		return result
	}
	defer sshClient.Close()

	// 执行批量采集脚本
	output, err := sshClient.ExecuteCommand(batchCollectScript)
	if err != nil {
		result.Status = "error"
		result.Error = fmt.Sprintf("failed to execute command: %v", err)
		return result
	}

	// 解析输出
	e.parseBatchOutput(output, result)
	result.Status = "online"

	return result
}

// parseBatchOutput 解析批量采集脚本的输出
func (e *EasySSHDataSource) parseBatchOutput(output string, result *ServerResourceSummary) {
	sections := e.parseSections(output)

	// 解析 CPU
	if cpuData, ok := sections["CPU"]; ok {
		result.CPU = e.parseCPUSummary(cpuData)
	}

	// 解析内存
	if memData, ok := sections["MEMORY"]; ok {
		result.Memory = e.parseMemorySummary(memData)
	}

	// 解析磁盘
	if diskData, ok := sections["DISK"]; ok {
		result.Disk = e.parseDiskSummary(diskData)
	}

	// 解析网络
	if netData, ok := sections["NETWORK"]; ok {
		result.Network = e.parseNetworkSummary(netData)
	}

	// 解析 uptime
	if uptimeData, ok := sections["UPTIME"]; ok {
		parts := strings.Fields(strings.TrimSpace(uptimeData))
		if len(parts) > 0 {
			uptime, _ := strconv.ParseFloat(parts[0], 64)
			result.Uptime = uint64(uptime)
		}
	}

	// 解析负载
	if loadData, ok := sections["LOAD"]; ok && result.CPU != nil {
		parts := strings.Fields(strings.TrimSpace(loadData))
		if len(parts) >= 3 {
			result.CPU.LoadAverage = make([]float64, 0, 3)
			for i := 0; i < 3; i++ {
				if val, err := strconv.ParseFloat(parts[i], 64); err == nil {
					result.CPU.LoadAverage = append(result.CPU.LoadAverage, val)
				}
			}
		}
	}
}

// parseSections 解析输出中的各个 section
func (e *EasySSHDataSource) parseSections(output string) map[string]string {
	sections := make(map[string]string)
	lines := strings.Split(output, "\n")

	var currentSection string
	var sectionContent strings.Builder

	for _, line := range lines {
		if strings.HasPrefix(line, "=== ") && strings.HasSuffix(line, " ===") {
			// 保存上一个 section
			if currentSection != "" {
				sections[currentSection] = strings.TrimSpace(sectionContent.String())
			}
			// 开始新 section
			currentSection = strings.TrimPrefix(strings.TrimSuffix(line, " ==="), "=== ")
			sectionContent.Reset()
		} else if currentSection != "" {
			sectionContent.WriteString(line)
			sectionContent.WriteString("\n")
		}
	}

	// 保存最后一个 section
	if currentSection != "" {
		sections[currentSection] = strings.TrimSpace(sectionContent.String())
	}

	return sections
}

// parseCPUSummary 解析 CPU 概览
func (e *EasySSHDataSource) parseCPUSummary(data string) *CPUSummary {
	lines := strings.Split(strings.TrimSpace(data), "\n")
	if len(lines) < 2 {
		return nil
	}

	result := &CPUSummary{}

	// 第一行: cpu 统计 (cpu user nice system idle iowait irq softirq steal guest guest_nice)
	parts := strings.Fields(lines[0])
	if len(parts) >= 5 && parts[0] == "cpu" {
		user, _ := strconv.ParseUint(parts[1], 10, 64)
		nice, _ := strconv.ParseUint(parts[2], 10, 64)
		system, _ := strconv.ParseUint(parts[3], 10, 64)
		idle, _ := strconv.ParseUint(parts[4], 10, 64)
		iowait := uint64(0)
		if len(parts) > 5 {
			iowait, _ = strconv.ParseUint(parts[5], 10, 64)
		}

		total := user + nice + system + idle + iowait
		if total > 0 {
			result.UsagePercent = float64(user+nice+system) / float64(total) * 100
		}
	}

	// 第二行: nproc 核心数
	if len(lines) >= 2 {
		result.Cores, _ = strconv.Atoi(strings.TrimSpace(lines[1]))
	}

	return result
}

// parseMemorySummary 解析内存概览
func (e *EasySSHDataSource) parseMemorySummary(data string) *MemorySummary {
	result := &MemorySummary{}

	lines := strings.Split(data, "\n")
	memInfo := make(map[string]uint64)

	for _, line := range lines {
		parts := strings.Fields(line)
		if len(parts) >= 2 {
			key := strings.TrimSuffix(parts[0], ":")
			value, _ := strconv.ParseUint(parts[1], 10, 64)
			// /proc/meminfo 的值是 KB
			memInfo[key] = value * 1024
		}
	}

	result.Total = memInfo["MemTotal"]
	available := memInfo["MemAvailable"]
	if result.Total > 0 && available > 0 {
		result.Used = result.Total - available
		result.UsedPercent = float64(result.Used) / float64(result.Total) * 100
	}

	return result
}

// parseDiskSummary 解析磁盘概览
func (e *EasySSHDataSource) parseDiskSummary(data string) *DiskSummary {
	result := &DiskSummary{}

	// df --total 的最后一行是 total
	parts := strings.Fields(strings.TrimSpace(data))
	if len(parts) >= 4 {
		result.Total, _ = strconv.ParseUint(parts[1], 10, 64)
		result.Used, _ = strconv.ParseUint(parts[2], 10, 64)
		if result.Total > 0 {
			result.UsedPercent = float64(result.Used) / float64(result.Total) * 100
		}
	}

	return result
}

// parseNetworkSummary 解析网络概览
func (e *EasySSHDataSource) parseNetworkSummary(data string) *NetworkSummary {
	result := &NetworkSummary{}

	lines := strings.Split(data, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// 格式: iface: rx_bytes rx_packets ... tx_bytes tx_packets ...
		parts := strings.Fields(line)
		if len(parts) < 10 {
			continue
		}

		iface := strings.TrimSuffix(parts[0], ":")
		// 跳过 lo 接口
		if iface == "lo" {
			continue
		}

		rxBytes, _ := strconv.ParseUint(parts[1], 10, 64)
		txBytes, _ := strconv.ParseUint(parts[9], 10, 64)

		result.RxBytes += rxBytes
		result.TxBytes += txBytes
	}

	return result
}
