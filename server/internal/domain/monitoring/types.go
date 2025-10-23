package monitoring

import "time"

// CPUInfo CPU 信息
type CPUInfo struct {
	Cores       int     `json:"cores"`        // CPU 核心数
	UsagePercent float64 `json:"usage_percent"` // 使用率百分比
	LoadAverage  []float64 `json:"load_average"` // 负载平均值 (1, 5, 15分钟)
}

// MemoryInfo 内存信息
type MemoryInfo struct {
	Total       uint64  `json:"total"`        // 总内存 (bytes)
	Used        uint64  `json:"used"`         // 已使用 (bytes)
	Free        uint64  `json:"free"`         // 空闲 (bytes)
	Available   uint64  `json:"available"`    // 可用 (bytes)
	UsedPercent float64 `json:"used_percent"` // 使用率百分比
	Cached      uint64  `json:"cached"`       // 缓存 (bytes)
	Buffers     uint64  `json:"buffers"`      // 缓冲 (bytes)
}

// DiskInfo 磁盘信息
type DiskInfo struct {
	Path        string  `json:"path"`         // 挂载路径
	Total       uint64  `json:"total"`        // 总容量 (bytes)
	Used        uint64  `json:"used"`         // 已使用 (bytes)
	Free        uint64  `json:"free"`         // 空闲 (bytes)
	UsedPercent float64 `json:"used_percent"` // 使用率百分比
	FileSystem  string  `json:"file_system"`  // 文件系统类型
	MountPoint  string  `json:"mount_point"`  // 挂载点
}

// NetworkInfo 网络信息
type NetworkInfo struct {
	Interface   string  `json:"interface"`    // 网络接口名称
	BytesSent   uint64  `json:"bytes_sent"`   // 发送字节数
	BytesRecv   uint64  `json:"bytes_recv"`   // 接收字节数
	PacketsSent uint64  `json:"packets_sent"` // 发送包数
	PacketsRecv uint64  `json:"packets_recv"` // 接收包数
	ErrIn       uint64  `json:"err_in"`       // 接收错误数
	ErrOut      uint64  `json:"err_out"`      // 发送错误数
	DropIn      uint64  `json:"drop_in"`      // 接收丢包数
	DropOut     uint64  `json:"drop_out"`     // 发送丢包数
}

// ProcessInfo 进程信息
type ProcessInfo struct {
	PID         int32   `json:"pid"`          // 进程 ID
	Name        string  `json:"name"`         // 进程名称
	CPUPercent  float64 `json:"cpu_percent"`  // CPU 使用率
	MemoryPercent float64 `json:"memory_percent"` // 内存使用率
	MemoryMB    uint64  `json:"memory_mb"`    // 内存使用量 (MB)
	Status      string  `json:"status"`       // 进程状态
	CreateTime  int64   `json:"create_time"`  // 创建时间 (Unix timestamp)
}

// SystemInfo 综合系统信息
type SystemInfo struct {
	Hostname     string         `json:"hostname"`      // 主机名
	OS           string         `json:"os"`            // 操作系统
	Platform     string         `json:"platform"`      // 平台
	Architecture string         `json:"architecture"`  // 架构
	Uptime       uint64         `json:"uptime"`        // 运行时间 (秒)
	BootTime     uint64         `json:"boot_time"`     // 启动时间 (Unix timestamp)
	CPU          *CPUInfo       `json:"cpu"`           // CPU 信息
	Memory       *MemoryInfo    `json:"memory"`        // 内存信息
	Disks        []*DiskInfo    `json:"disks"`         // 磁盘信息列表
	Networks     []*NetworkInfo `json:"networks"`      // 网络信息列表
	Timestamp    time.Time      `json:"timestamp"`     // 采集时间
}

// MetricsHistory 历史指标记录
type MetricsHistory struct {
	ServerID  string    `json:"server_id"`  // 服务器 ID
	Timestamp time.Time `json:"timestamp"`  // 时间戳
	CPU       float64   `json:"cpu"`        // CPU 使用率
	Memory    float64   `json:"memory"`     // 内存使用率
	DiskUsage float64   `json:"disk_usage"` // 磁盘使用率
	NetworkIn uint64    `json:"network_in"` // 网络入站流量
	NetworkOut uint64   `json:"network_out"` // 网络出站流量
}
