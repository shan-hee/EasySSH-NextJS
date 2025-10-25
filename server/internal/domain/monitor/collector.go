package monitor

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	pb "github.com/easyssh/server/internal/proto"
	sshDomain "github.com/easyssh/server/internal/domain/ssh"
)

// Collector 系统指标采集器
type Collector struct {
	session      *sshDomain.Session
	prevCPU      *CPUStat
	prevNet      map[string]NetStat
	prevTime     time.Time
	sshLatencyMs int64 // SSH 命令延迟（毫秒）
}

// NewCollector 创建采集器
func NewCollector(session *sshDomain.Session) *Collector {
	return &Collector{
		session:  session,
		prevCPU:    nil,
		prevNet:    make(map[string]NetStat),
		prevTime:   time.Now(),
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
	session, err := c.session.Client.NewSession()
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

// Collect 采集所有系统指标
func (c *Collector) Collect() (*pb.SystemMetrics, error) {
	// 使用批量采集脚本减少 SSH 往返次数
	script := `
echo "=== CPU ==="
cat /proc/stat | grep '^cpu '

echo "=== MEMORY ==="
cat /proc/meminfo | grep -E 'MemTotal|MemFree|MemAvailable|Buffers|Cached|SwapTotal|SwapFree'

echo "=== NETWORK ==="
cat /proc/net/dev | tail -n +3

echo "=== DISK ==="
df -B1 -x tmpfs -x devtmpfs 2>/dev/null | tail -n +2

echo "=== LOAD ==="
cat /proc/loadavg

echo "=== UPTIME ==="
cat /proc/uptime

echo "=== SYSINFO ==="
cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'"' -f2
hostname
cat /proc/cpuinfo | grep "model name" | head -n1 | cut -d':' -f2
uname -m
cat /proc/cpuinfo | grep "^processor" | wc -l
`

	output, err := c.sshExec(script)
	if err != nil {
		return nil, fmt.Errorf("failed to collect metrics: %w", err)
	}

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

	if sysData, ok := sections["SYSINFO"]; ok {
		loadData := sections["LOAD"]
		uptimeData := sections["UPTIME"]
		metrics.SystemInfo = c.parseSystemInfo(sysData, loadData, uptimeData)
	}

	// 设置 SSH 延迟
	metrics.SshLatencyMs = c.sshLatencyMs

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

	totalDelta := currTotal - prevTotal
	idleDelta := currIdle - prevIdle

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
	ramUsed := memData["MemTotal"] - memData["MemFree"] - memData["Buffers"] - memData["Cached"]
	swapUsed := memData["SwapTotal"] - memData["SwapFree"]

	return &pb.MemoryMetrics{
		RamUsedBytes:  ramUsed,
		RamTotalBytes: memData["MemTotal"],
		SwapUsedBytes: swapUsed,
		SwapTotalBytes: memData["SwapTotal"],
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

	if len(c.prevNet) > 0 {
		now := time.Now()
		duration := now.Sub(c.prevTime).Seconds()

		for iface, curr := range currStats {
			if prev, ok := c.prevNet[iface]; ok && duration > 0 {
				rxDelta := curr.RxBytes - prev.RxBytes
				txDelta := curr.TxBytes - prev.TxBytes

				totalRx += uint64(float64(rxDelta) / duration)
				totalTx += uint64(float64(txDelta) / duration)
			}
		}

		c.prevTime = now
	}

	c.prevNet = currStats

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

		total := parseUint64(fields[1])
		used := parseUint64(fields[2])
		mountPoint := fields[5]

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
	sysLines := strings.Split(strings.TrimSpace(sysData), "\n")

	os := ""
	hostname := ""
	cpuModel := ""
	arch := ""
	cpuCores := uint32(0)

	if len(sysLines) >= 1 {
		os = strings.TrimSpace(sysLines[0])
	}
	if len(sysLines) >= 2 {
		hostname = strings.TrimSpace(sysLines[1])
	}
	if len(sysLines) >= 3 {
		cpuModel = strings.TrimSpace(sysLines[2])
	}
	if len(sysLines) >= 4 {
		arch = strings.TrimSpace(sysLines[3])
	}
	if len(sysLines) >= 5 {
		cpuCores = uint32(parseUint64(sysLines[4]))
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

	return &pb.SystemInfo{
		Os:            os,
		Hostname:      hostname,
		CpuModel:      cpuModel,
		Arch:          arch,
		LoadAvg:       loadAvg,
		UptimeSeconds: uptimeSeconds,
		CpuCores:      cpuCores,
	}
}

// parseUint64 解析 uint64
func parseUint64(s string) uint64 {
	val, _ := strconv.ParseUint(s, 10, 64)
	return val
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
