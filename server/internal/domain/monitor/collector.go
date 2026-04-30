package monitor

import (
	"bytes"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	sshDomain "github.com/easyssh/server/internal/domain/ssh"
	pb "github.com/easyssh/server/internal/proto"
)

const (
	dockerStatsRefreshInterval = 15 * time.Second
	dockerStatsRetryInterval   = 3 * time.Second
	dockerStatsCommandTimeout  = 6 * time.Second
)

// Collector 系统指标采集器
type Collector struct {
	client           *sshDomain.Client // SSH 客户端（直接使用）
	prevCPU          *CPUStat
	prevNet          map[string]NetStat
	prevTime         time.Time
	sshLatencyMs     int64 // SSH 命令延迟（毫秒）
	staticSystemInfo *pb.SystemInfo
	dockerMu         sync.RWMutex
	dockerStats      *pb.DockerStats
	dockerCheckedAt  time.Time
	dockerRefreshing bool
}

// NewCollector 创建采集器（使用 SSH Client）
func NewCollector(client *sshDomain.Client) *Collector {
	now := time.Now()
	return &Collector{
		client:   client,
		prevCPU:  nil,
		prevNet:  make(map[string]NetStat),
		prevTime: now,
	}
}

// CPUStat CPU 统计数据
type CPUStat struct {
	User      uint64
	Nice      uint64
	System    uint64
	Idle      uint64
	IOWait    uint64
	IRQ       uint64
	SoftIRQ   uint64
	Steal     uint64
	Guest     uint64
	GuestNice uint64
}

// Total 计算总时间
func (c *CPUStat) Total() uint64 {
	return c.User + c.Nice + c.System + c.Idle + c.IOWait +
		c.IRQ + c.SoftIRQ + c.Steal + c.Guest + c.GuestNice
}

// NetStat 网络统计数据
type NetStat struct {
	RxBytes uint64
	TxBytes uint64
}

// sshExec 执行 SSH 命令
func (c *Collector) sshExec(cmd string) (string, error) {
	start := time.Now()

	// 通过 SSH Client 创建新会话执行命令
	session, err := c.client.NewSession()
	if err != nil {
		return "", fmt.Errorf("failed to create session: %w", err)
	}
	defer session.Close()

	output, err := session.CombinedOutput(cmd)

	// 记录 SSH 命令延迟
	c.sshLatencyMs = time.Since(start).Milliseconds()

	if err != nil {
		return "", fmt.Errorf("failed to execute command: %w", err)
	}

	return string(output), nil
}

// sshExecWithTimeout 执行可能阻塞的辅助命令，超时后主动关闭 session。
func (c *Collector) sshExecWithTimeout(cmd string, timeout time.Duration) (string, error) {
	session, err := c.client.NewSession()
	if err != nil {
		return "", fmt.Errorf("failed to create session: %w", err)
	}
	defer session.Close()

	var output bytes.Buffer
	session.Stdout = &output
	session.Stderr = &output

	if err := session.Start(cmd); err != nil {
		return "", fmt.Errorf("failed to start command: %w", err)
	}

	done := make(chan error, 1)
	go func() {
		done <- session.Wait()
	}()

	select {
	case err := <-done:
		if err != nil {
			return output.String(), fmt.Errorf("failed to execute command: %w", err)
		}
		return output.String(), nil
	case <-time.After(timeout):
		_ = session.Close()
		return output.String(), fmt.Errorf("command timeout after %s", timeout)
	}
}

func (c *Collector) buildMetricsScript(includeStaticInfo bool) string {
	script := `
LC_ALL=C
export LC_ALL

echo "=== CPU ==="
awk '/^cpu / { print; exit }' /proc/stat

echo "=== MEMORY ==="
awk '/^(MemTotal|MemFree|MemAvailable|Buffers|Cached|SwapTotal|SwapFree):/ { print }' /proc/meminfo

echo "=== NETWORK ==="
awk 'NR > 2 { print }' /proc/net/dev

echo "=== DISK ==="
df_output=""
if command -v timeout >/dev/null 2>&1; then
  df_output=$(timeout 1s df -P -B1 -l --total \
    -x tmpfs -x devtmpfs -x squashfs -x overlay -x aufs 2>/dev/null | tail -n 1)
else
  df_output=$(df -P -B1 -l --total \
    -x tmpfs -x devtmpfs -x squashfs -x overlay -x aufs 2>/dev/null | tail -n 1)
fi
if [ -z "$df_output" ] || [ "$(printf '%s\n' "$df_output" | awk '{ print NF }')" -lt 6 ]; then
  if command -v timeout >/dev/null 2>&1; then
    df_output=$(timeout 1s sh -c 'df -kP -l 2>/dev/null || df -kP 2>/dev/null' | awk 'NR > 1 && $2 ~ /^[0-9]+$/ { total += $2; used += $3 } END { if (total > 0) printf "total %.0f %.0f %.0f 0%% -", total * 1024, used * 1024, (total - used) * 1024 }')
  else
    df_output=$( (df -kP -l 2>/dev/null || df -kP 2>/dev/null) | awk 'NR > 1 && $2 ~ /^[0-9]+$/ { total += $2; used += $3 } END { if (total > 0) printf "total %.0f %.0f %.0f 0%% -", total * 1024, used * 1024, (total - used) * 1024 }')
  fi
fi
printf '%s\n' "$df_output"

echo "=== LOAD ==="
cat /proc/loadavg

echo "=== UPTIME ==="
cut -d' ' -f1 /proc/uptime
`

	if includeStaticInfo {
		script += `
echo "=== SYSINFO ==="
awk -F= '/^PRETTY_NAME=/ { gsub(/^"|"$/, "", $2); print $2; found=1; exit } END { if (!found) print "" }' /etc/os-release 2>/dev/null
hostname 2>/dev/null || cat /proc/sys/kernel/hostname 2>/dev/null
awk -F: '/model name|Hardware|Processor/ { gsub(/^[ \t]+/, "", $2); if ($2 != "") { print $2; exit } }' /proc/cpuinfo 2>/dev/null
uname -m
getconf _NPROCESSORS_ONLN 2>/dev/null || nproc 2>/dev/null || awk -F: '/^processor/ { n++ } END { print n + 0 }' /proc/cpuinfo 2>/dev/null
`
	}

	return script
}

// Collect 采集所有系统指标
func (c *Collector) Collect() (*pb.SystemMetrics, error) {
	// 使用批量采集脚本减少 SSH 往返次数
	script := c.buildMetricsScript(c.staticSystemInfo == nil)

	output, err := c.sshExec(script)
	if err != nil {
		return nil, fmt.Errorf("failed to collect metrics: %w", err)
	}
	coreLatencyMs := c.sshLatencyMs

	// 解析输出
	sections := c.parseSections(output)

	metrics := &pb.SystemMetrics{
		Timestamp: time.Now().Unix(),
	}

	// 解析各个指标
	if cpuData, ok := sections["CPU"]; ok {
		metrics.Cpu = c.parseCPU(cpuData)
	}

	if memData, ok := sections["MEMORY"]; ok {
		metrics.Memory = c.parseMemory(memData)
	}

	if netData, ok := sections["NETWORK"]; ok {
		metrics.Network = c.parseNetwork(netData)
	}

	if diskData, ok := sections["DISK"]; ok {
		metrics.Disks = c.parseDisk(diskData)
		// 计算磁盘总使用率
		metrics.DiskTotalPercent = c.calculateTotalDiskPercent(metrics.Disks)
	}

	metrics.SystemInfo = c.parseSystemInfo(sections["SYSINFO"], sections["LOAD"], sections["UPTIME"])

	if metrics.Cpu != nil && metrics.SystemInfo != nil {
		metrics.Cpu.CoreCount = metrics.SystemInfo.CpuCores
	}

	metrics.Docker = c.getDockerStats()

	// 设置核心采集 SSH 延迟。Docker 统计低频单独采集，不计入图表数据链路延迟。
	metrics.SshLatencyMs = coreLatencyMs

	return metrics, nil
}

// parseSections 解析脚本输出的各个部分
func (c *Collector) parseSections(output string) map[string]string {
	sections := make(map[string]string)
	lines := strings.Split(output, "\n")

	var currentSection string
	var sectionLines []string

	for _, line := range lines {
		if strings.HasPrefix(line, "=== ") && strings.HasSuffix(line, " ===") {
			// 保存上一个 section
			if currentSection != "" {
				sections[currentSection] = strings.Join(sectionLines, "\n")
			}
			// 开始新的 section
			currentSection = strings.Trim(line, "= ")
			sectionLines = []string{}
		} else if currentSection != "" {
			sectionLines = append(sectionLines, line)
		}
	}

	// 保存最后一个 section
	if currentSection != "" {
		sections[currentSection] = strings.Join(sectionLines, "\n")
	}

	return sections
}

// parseCPU 解析 CPU 数据
func (c *Collector) parseCPU(data string) *pb.CPUMetrics {
	fields := strings.Fields(data)
	if len(fields) < 9 {
		return &pb.CPUMetrics{UsagePercent: 0.0}
	}

	curr := &CPUStat{
		User:    parseUint64(fields[1]),
		Nice:    parseUint64(fields[2]),
		System:  parseUint64(fields[3]),
		Idle:    parseUint64(fields[4]),
		IOWait:  parseUint64(fields[5]),
		IRQ:     parseUint64(fields[6]),
		SoftIRQ: parseUint64(fields[7]),
		Steal:   parseUint64(fields[8]),
	}

	if len(fields) >= 11 {
		curr.Guest = parseUint64(fields[9])
		curr.GuestNice = parseUint64(fields[10])
	}

	var usage float64
	if c.prevCPU != nil {
		usage = c.calculateCPUUsage(c.prevCPU, curr)
	}

	c.prevCPU = curr

	return &pb.CPUMetrics{
		UsagePercent: usage,
	}
}

// calculateCPUUsage 计算 CPU 使用率
func (c *Collector) calculateCPUUsage(prev, curr *CPUStat) float64 {
	prevIdle := prev.Idle + prev.IOWait
	currIdle := curr.Idle + curr.IOWait

	prevTotal := prev.Total()
	currTotal := curr.Total()

	totalDelta := subtractUint64(currTotal, prevTotal)
	idleDelta := subtractUint64(currIdle, prevIdle)

	if totalDelta == 0 {
		return 0.0
	}

	return (1.0 - float64(idleDelta)/float64(totalDelta)) * 100.0
}

// parseMemory 解析内存数据
func (c *Collector) parseMemory(data string) *pb.MemoryMetrics {
	lines := strings.Split(data, "\n")
	memData := make(map[string]uint64)

	for _, line := range lines {
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) >= 2 {
			key := strings.TrimSuffix(fields[0], ":")
			value := parseUint64(fields[1])
			memData[key] = value * 1024 // kB to bytes
		}
	}

	// 计算实际使用量 (Linux 方式)
	ramTotal := memData["MemTotal"]
	ramUsed := uint64(0)
	if available, ok := memData["MemAvailable"]; ok {
		ramUsed = subtractUint64(ramTotal, available)
	} else {
		reclaimable := memData["MemFree"] + memData["Buffers"] + memData["Cached"]
		ramUsed = subtractUint64(ramTotal, reclaimable)
	}
	swapTotal := memData["SwapTotal"]
	swapUsed := subtractUint64(swapTotal, memData["SwapFree"])

	return &pb.MemoryMetrics{
		RamUsedBytes:   ramUsed,
		RamTotalBytes:  ramTotal,
		SwapUsedBytes:  swapUsed,
		SwapTotalBytes: swapTotal,
	}
}

// parseNetwork 解析网络数据
func (c *Collector) parseNetwork(data string) *pb.NetworkMetrics {
	lines := strings.Split(data, "\n")
	currStats := make(map[string]NetStat)

	for _, line := range lines {
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) < 10 {
			continue
		}

		iface := strings.TrimSuffix(fields[0], ":")
		// 跳过 lo (本地回环)
		if iface == "lo" {
			continue
		}

		currStats[iface] = NetStat{
			RxBytes: parseUint64(fields[1]),
			TxBytes: parseUint64(fields[9]),
		}
	}

	// 计算总速率
	var totalRx, totalTx uint64
	now := time.Now()

	if len(c.prevNet) > 0 {
		duration := now.Sub(c.prevTime).Seconds()

		for iface, curr := range currStats {
			if prev, ok := c.prevNet[iface]; ok && duration > 0 {
				rxDelta := subtractUint64(curr.RxBytes, prev.RxBytes)
				txDelta := subtractUint64(curr.TxBytes, prev.TxBytes)

				totalRx += uint64(float64(rxDelta) / duration)
				totalTx += uint64(float64(txDelta) / duration)
			}
		}
	}

	c.prevNet = currStats
	c.prevTime = now

	return &pb.NetworkMetrics{
		BytesRecvPerSec: totalRx,
		BytesSentPerSec: totalTx,
	}
}

// parseDisk 解析磁盘数据
func (c *Collector) parseDisk(data string) []*pb.DiskMetrics {
	lines := strings.Split(data, "\n")
	var disks []*pb.DiskMetrics

	for _, line := range lines {
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) < 6 {
			continue
		}

		fsName := fields[0]
		total := parseUint64(fields[1])
		used := parseUint64(fields[2])
		mountPoint := fields[5]

		// 当使用 df --total 时, 聚合行的挂载点通常为 "-" 或 "total"
		// 将其归一为 "/" 以便前端显示更友好
		if fsName == "total" || mountPoint == "-" {
			mountPoint = "/"
		}

		// 跳过过小的分区 (< 100MB)
		if total < 100*1024*1024 {
			continue
		}

		disks = append(disks, &pb.DiskMetrics{
			MountPoint: mountPoint,
			TotalBytes: total,
			UsedBytes:  used,
		})
	}

	return disks
}

// parseSystemInfo 解析系统信息
func (c *Collector) parseSystemInfo(sysData, loadData, uptimeData string) *pb.SystemInfo {
	if strings.TrimSpace(sysData) != "" {
		sysLines := strings.Split(strings.TrimSpace(sysData), "\n")
		staticInfo := &pb.SystemInfo{}

		if len(sysLines) >= 1 {
			staticInfo.Os = strings.TrimSpace(sysLines[0])
		}
		if len(sysLines) >= 2 {
			staticInfo.Hostname = strings.TrimSpace(sysLines[1])
		}
		if len(sysLines) >= 3 {
			staticInfo.CpuModel = strings.TrimSpace(sysLines[2])
		}
		if len(sysLines) >= 4 {
			staticInfo.Arch = strings.TrimSpace(sysLines[3])
		}
		if len(sysLines) >= 5 {
			staticInfo.CpuCores = uint32(parseUint64(strings.TrimSpace(sysLines[4])))
		}

		if staticInfo.Os != "" || staticInfo.Hostname != "" || staticInfo.CpuModel != "" || staticInfo.Arch != "" || staticInfo.CpuCores > 0 {
			c.staticSystemInfo = staticInfo
		}
	}

	// 解析负载
	loadFields := strings.Fields(strings.TrimSpace(loadData))
	loadAvg := ""
	if len(loadFields) >= 3 {
		loadAvg = fmt.Sprintf("%s, %s, %s", loadFields[0], loadFields[1], loadFields[2])
	}

	// 解析运行时间
	uptimeFields := strings.Fields(strings.TrimSpace(uptimeData))
	uptimeSeconds := uint64(0)
	if len(uptimeFields) >= 1 {
		uptime, _ := strconv.ParseFloat(uptimeFields[0], 64)
		uptimeSeconds = uint64(uptime)
	}

	staticInfo := c.staticSystemInfo
	if staticInfo == nil {
		staticInfo = &pb.SystemInfo{}
	}

	return &pb.SystemInfo{
		Os:            staticInfo.Os,
		Hostname:      staticInfo.Hostname,
		CpuModel:      staticInfo.CpuModel,
		Arch:          staticInfo.Arch,
		LoadAvg:       loadAvg,
		UptimeSeconds: uptimeSeconds,
		CpuCores:      staticInfo.CpuCores,
	}
}

// parseUint64 解析 uint64
func parseUint64(s string) uint64 {
	val, _ := strconv.ParseUint(s, 10, 64)
	return val
}

func subtractUint64(a, b uint64) uint64 {
	if b > a {
		return 0
	}
	return a - b
}

// calculateTotalDiskPercent 计算磁盘总使用率
func (c *Collector) calculateTotalDiskPercent(disks []*pb.DiskMetrics) float64 {
	if len(disks) == 0 {
		return 0.0
	}

	var totalUsed, totalSize uint64
	for _, disk := range disks {
		totalUsed += disk.UsedBytes
		totalSize += disk.TotalBytes
	}

	if totalSize == 0 {
		return 0.0
	}

	return (float64(totalUsed) / float64(totalSize)) * 100.0
}

func (c *Collector) getDockerStats() *pb.DockerStats {
	now := time.Now()

	c.dockerMu.RLock()
	stats := cloneDockerStats(c.dockerStats)
	checkedAt := c.dockerCheckedAt
	c.dockerMu.RUnlock()

	refreshInterval := dockerStatsRefreshInterval
	if stats == nil {
		refreshInterval = dockerStatsRetryInterval
	}

	needsRefresh := checkedAt.IsZero() || now.Sub(checkedAt) >= refreshInterval
	if needsRefresh {
		c.startDockerStatsRefresh()
	}

	return stats
}

func (c *Collector) startDockerStatsRefresh() {
	c.dockerMu.Lock()
	if c.dockerRefreshing {
		c.dockerMu.Unlock()
		return
	}
	c.dockerRefreshing = true
	c.dockerMu.Unlock()

	go func() {
		stats, err := c.collectDockerStats()

		c.dockerMu.Lock()
		defer c.dockerMu.Unlock()
		c.dockerRefreshing = false
		c.dockerCheckedAt = time.Now()
		if err != nil {
			return
		}
		c.dockerStats = stats
	}()
}

func cloneDockerStats(stats *pb.DockerStats) *pb.DockerStats {
	if stats == nil {
		return nil
	}

	clone := *stats
	return &clone
}

func (c *Collector) collectDockerStats() (*pb.DockerStats, error) {
	script := `
if command -v curl >/dev/null 2>&1; then
  docker_json=$(curl -sS --fail --max-time 5 --unix-socket /var/run/docker.sock "http://localhost/containers/json?all=1" 2>/dev/null)
  if [ -n "$docker_json" ]; then
    running=$(printf '%s' "$docker_json" | grep -o '"State"[[:space:]]*:[[:space:]]*"running"' | wc -l | awk '{ print $1 + 0 }')
    total=$(printf '%s' "$docker_json" | grep -o '"Id"[[:space:]]*:' | wc -l | awk '{ print $1 + 0 }')
    echo "installed"
    echo "${running:-0}"
    echo "${total:-0}"
    exit 0
  fi
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "not_installed"
  echo "0"
  echo "0"
  exit 0
fi

running_ids=$(docker ps -q 2>/dev/null)
running_status=$?
total_ids=$(docker ps -aq 2>/dev/null)
total_status=$?
if [ "$running_status" -ne 0 ] || [ "$total_status" -ne 0 ]; then
  exit 1
fi

running=$(printf '%s\n' "$running_ids" | awk 'NF { n++ } END { print n + 0 }')
total=$(printf '%s\n' "$total_ids" | awk 'NF { n++ } END { print n + 0 }')
echo "installed"
echo "${running:-0}"
echo "${total:-0}"
`

	output, err := c.sshExecWithTimeout(script, dockerStatsCommandTimeout)
	output = strings.TrimSpace(output)
	if err != nil && output == "" {
		return nil, err
	}

	lines := strings.Split(output, "\n")
	if len(lines) < 3 {
		return nil, fmt.Errorf("invalid docker stats output: %q", output)
	}

	status := strings.TrimSpace(lines[0])
	if status != "installed" && status != "not_installed" {
		return nil, fmt.Errorf("invalid docker stats status: %q", status)
	}

	return c.parseDocker(output), nil
}

// parseDocker 解析 Docker 统计数据
func (c *Collector) parseDocker(data string) *pb.DockerStats {
	lines := strings.Split(strings.TrimSpace(data), "\n")
	if len(lines) < 3 {
		return &pb.DockerStats{DockerInstalled: false}
	}

	installed := strings.TrimSpace(lines[0]) == "installed"
	running := uint32(parseUint64(strings.TrimSpace(lines[1])))
	total := uint32(parseUint64(strings.TrimSpace(lines[2])))

	return &pb.DockerStats{
		DockerInstalled:   installed,
		ContainersRunning: running,
		ContainersTotal:   total,
	}
}
