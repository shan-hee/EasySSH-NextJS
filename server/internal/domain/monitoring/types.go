package monitoring

import "time"

// ServerResourceSummary 单台服务器资源概览
type ServerResourceSummary struct {
	ServerID    string           `json:"server_id"`            // 服务器 ID
	Name        string           `json:"name"`                 // 服务器名称
	Host        string           `json:"host"`                 // 主机地址
	Port        int              `json:"port"`                 // 端口
	Status      string           `json:"status"`               // 状态: online, offline, error
	Location    *LocationSummary `json:"location,omitempty"`   // 地理位置
	CPU         *CPUSummary      `json:"cpu"`                  // CPU 概览
	Memory      *MemorySummary   `json:"memory"`               // 内存概览
	Disk        *DiskSummary     `json:"disk"`                 // 磁盘概览（汇总）
	Network     *NetworkSummary  `json:"network"`              // 网络概览（汇总）
	Uptime      uint64           `json:"uptime"`               // 运行时间 (秒)
	CollectedAt time.Time        `json:"collected_at"`         // 采集时间
	Error       string           `json:"error,omitempty"`      // 错误信息（如果有）
}

// CPUSummary CPU 概览
type CPUSummary struct {
	Cores        int       `json:"cores"`         // 核心数
	UsagePercent float64   `json:"usage_percent"` // 使用率
	LoadAverage  []float64 `json:"load_average"`  // 负载
}

// MemorySummary 内存概览
type MemorySummary struct {
	Total       uint64  `json:"total"`        // 总量 (bytes)
	Used        uint64  `json:"used"`         // 已用 (bytes)
	UsedPercent float64 `json:"used_percent"` // 使用率
}

// DiskSummary 磁盘概览（汇总所有磁盘）
type DiskSummary struct {
	Total       uint64  `json:"total"`        // 总量 (bytes)
	Used        uint64  `json:"used"`         // 已用 (bytes)
	UsedPercent float64 `json:"used_percent"` // 使用率
}

// NetworkSummary 网络概览（汇总所有接口）
type NetworkSummary struct {
	RxBytes uint64 `json:"rx_bytes"` // 接收字节数
	TxBytes uint64 `json:"tx_bytes"` // 发送字节数
}

// LocationSummary 地理位置概览
type LocationSummary struct {
	Country     string `json:"country"`      // 国家
	CountryCode string `json:"country_code"` // 国家代码
	Region      string `json:"region"`       // 地区/省份
	City        string `json:"city"`         // 城市
}

// AllServersResources 所有服务器资源概览
type AllServersResources struct {
	Servers     []*ServerResourceSummary `json:"servers"`      // 服务器列表
	CollectedAt time.Time                `json:"collected_at"` // 采集时间
}
