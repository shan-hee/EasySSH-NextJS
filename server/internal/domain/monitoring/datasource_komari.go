package monitoring

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// KomariDataSource Komari 数据源 (REST API 版本)
type KomariDataSource struct {
	endpoint string
	token    string
	client   *http.Client
}

// NewKomariDataSource 创建 Komari 数据源
func NewKomariDataSource(endpoint, token string) *KomariDataSource {
	return &KomariDataSource{
		endpoint: strings.TrimSuffix(endpoint, "/"),
		token:    token,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Name 返回数据源名称
func (k *KomariDataSource) Name() string {
	return "komari"
}

// ========== API 响应结构 ==========

// KomariNodesResponse /api/nodes 响应结构
type KomariNodesResponse struct {
	Status  string       `json:"status"`  // "success" 或 "error"
	Message string       `json:"message"` // 消息
	Data    []KomariNode `json:"data"`    // 节点列表
}

// KomariNode 节点元信息（来自 /api/nodes）
type KomariNode struct {
	UUID             string  `json:"uuid"`              // 节点 UUID
	Name             string  `json:"name"`              // 节点名称
	CPUName          string  `json:"cpu_name"`          // CPU 型号
	Virtualization   string  `json:"virtualization"`    // 虚拟化类型
	Arch             string  `json:"arch"`              // 架构
	CPUCores         int     `json:"cpu_cores"`         // CPU 核心数
	OS               string  `json:"os"`                // 操作系统
	KernelVersion    string  `json:"kernel_version"`    // 内核版本
	GPUName          string  `json:"gpu_name"`          // GPU 名称
	Region           string  `json:"region"`            // 区域/国旗
	MemTotal         uint64  `json:"mem_total"`         // 总内存
	SwapTotal        uint64  `json:"swap_total"`        // 总交换空间
	DiskTotal        uint64  `json:"disk_total"`        // 总磁盘空间
	Weight           int     `json:"weight"`            // 权重
	Price            float64 `json:"price"`             // 价格
	BillingCycle     int     `json:"billing_cycle"`     // 计费周期（天）
	AutoRenewal      bool    `json:"auto_renewal"`      // 自动续费
	Currency         string  `json:"currency"`          // 货币
	ExpiredAt        string  `json:"expired_at"`        // 到期时间
	Group            string  `json:"group"`             // 分组
	Tags             string  `json:"tags"`              // 标签
	Hidden           bool    `json:"hidden"`            // 是否隐藏
	TrafficLimit     uint64  `json:"traffic_limit"`     // 流量限制
	TrafficLimitType string  `json:"traffic_limit_type"` // 流量限制类型
	CreatedAt        string  `json:"created_at"`        // 创建时间
	UpdatedAt        string  `json:"updated_at"`        // 更新时间
}

// KomariRecentResponse /api/recent/{uuid} 响应结构
type KomariRecentResponse struct {
	Status  string              `json:"status"`  // "success" 或 "error"
	Message string              `json:"message"` // 消息
	Data    []KomariRecentData `json:"data"`    // 最近状态数据列表
}

// KomariRecentData 节点最近状态数据
type KomariRecentData struct {
	CPU         KomariCPU         `json:"cpu"`
	RAM         KomariRAM         `json:"ram"`
	Swap        KomariSwap        `json:"swap"`
	Load        KomariLoad        `json:"load"`
	Disk        KomariDisk        `json:"disk"`
	Network     KomariNetwork     `json:"network"`
	Connections KomariConnections `json:"connections"`
	Uptime      uint64            `json:"uptime"`     // 运行时间 (秒)
	Process     int               `json:"process"`    // 进程数
	Message     string            `json:"message"`    // 消息
	UpdatedAt   string            `json:"updated_at"` // 更新时间
}

// KomariCPU CPU 信息
type KomariCPU struct {
	Usage float64 `json:"usage"` // CPU 使用率 (百分比)
}

// KomariRAM 内存信息
type KomariRAM struct {
	Total uint64 `json:"total"` // 总内存 (字节)
	Used  uint64 `json:"used"`  // 已用内存 (字节)
}

// KomariSwap 交换空间信息
type KomariSwap struct {
	Total uint64 `json:"total"` // 总交换空间 (字节)
	Used  uint64 `json:"used"`  // 已用交换空间 (字节)
}

// KomariLoad 负载信息
type KomariLoad struct {
	Load1  float64 `json:"load1"`  // 1分钟负载
	Load5  float64 `json:"load5"`  // 5分钟负载
	Load15 float64 `json:"load15"` // 15分钟负载
}

// KomariDisk 磁盘信息
type KomariDisk struct {
	Total uint64 `json:"total"` // 总磁盘 (字节)
	Used  uint64 `json:"used"`  // 已用磁盘 (字节)
}

// KomariNetwork 网络信息
type KomariNetwork struct {
	Up        uint64 `json:"up"`        // 上传速度 (字节/秒)
	Down      uint64 `json:"down"`      // 下载速度 (字节/秒)
	TotalUp   uint64 `json:"totalUp"`   // 总上传流量 (字节)
	TotalDown uint64 `json:"totalDown"` // 总下载流量 (字节)
}

// KomariConnections 连接信息
type KomariConnections struct {
	TCP int `json:"tcp"` // TCP 连接数
	UDP int `json:"udp"` // UDP 连接数
}

// ========== 核心方法实现 ==========

// getHTTPURL 获取 HTTP API URL
func (k *KomariDataSource) getHTTPURL(path string) (string, error) {
	parsed, err := url.Parse(k.endpoint)
	if err != nil {
		return "", fmt.Errorf("invalid endpoint URL: %w", err)
	}

	// 确保使用 HTTP/HTTPS
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		parsed.Scheme = "https"
	}

	parsed.Path = path
	return parsed.String(), nil
}

// TestConnection 测试连接
func (k *KomariDataSource) TestConnection(ctx context.Context) error {
	// 使用 /api/nodes 测试连接
	_, err := k.fetchNodes(ctx)
	return err
}

// fetchNodes 从 /api/nodes 获取节点列表
func (k *KomariDataSource) fetchNodes(ctx context.Context) ([]KomariNode, error) {
	apiURL, err := k.getHTTPURL("/api/nodes")
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	if k.token != "" {
		req.Header.Set("Authorization", "Bearer "+k.token)
	}

	resp, err := k.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch nodes: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("nodes API returned status %d", resp.StatusCode)
	}

	var nodesResp KomariNodesResponse
	if err := json.NewDecoder(resp.Body).Decode(&nodesResp); err != nil {
		return nil, fmt.Errorf("failed to parse nodes response: %w", err)
	}

	if nodesResp.Status != "success" {
		return nil, fmt.Errorf("nodes API returned error: %s", nodesResp.Message)
	}

	return nodesResp.Data, nil
}

// fetchRecentStatus 从 /api/recent/{uuid} 获取节点最近状态
func (k *KomariDataSource) fetchRecentStatus(ctx context.Context, uuid string) (*KomariRecentData, error) {
	apiURL, err := k.getHTTPURL("/api/recent/" + uuid)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	if k.token != "" {
		req.Header.Set("Authorization", "Bearer "+k.token)
	}

	resp, err := k.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch recent status: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("recent API returned status %d", resp.StatusCode)
	}

	var recentResp KomariRecentResponse
	if err := json.NewDecoder(resp.Body).Decode(&recentResp); err != nil {
		return nil, fmt.Errorf("failed to parse recent response: %w", err)
	}

	if recentResp.Status != "success" {
		return nil, fmt.Errorf("recent API returned error: %s", recentResp.Message)
	}

	// 返回最新的一条数据
	if len(recentResp.Data) == 0 {
		return nil, nil // 没有数据
	}

	return &recentResp.Data[0], nil
}

// ========== DataSourceProvider 接口实现 ==========

// GetServersResources 获取所有服务器资源概览
func (k *KomariDataSource) GetServersResources(ctx context.Context) ([]*ServerResourceSummary, error) {
	// 1. 获取所有节点列表
	nodes, err := k.fetchNodes(ctx)
	if err != nil {
		return nil, err
	}

	if len(nodes) == 0 {
		return []*ServerResourceSummary{}, nil
	}

	// 2. 并行获取每个节点的最近状态
	type nodeResult struct {
		node   KomariNode
		status *KomariRecentData
		err    error
	}

	resultChan := make(chan nodeResult, len(nodes))
	var wg sync.WaitGroup

	for _, node := range nodes {
		wg.Add(1)
		go func(n KomariNode) {
			defer wg.Done()
			status, err := k.fetchRecentStatus(ctx, n.UUID)
			resultChan <- nodeResult{node: n, status: status, err: err}
		}(node)
	}

	// 等待所有请求完成
	go func() {
		wg.Wait()
		close(resultChan)
	}()

	// 3. 收集结果并转换
	now := time.Now()
	summaries := make([]*ServerResourceSummary, 0, len(nodes))

	for result := range resultChan {
		summary := k.convertToSummary(result.node, result.status, now)
		summaries = append(summaries, summary)
	}

	return summaries, nil
}

// StreamServersResources 流式获取服务器资源
func (k *KomariDataSource) StreamServersResources(ctx context.Context, resultChan chan<- *ServerResourceSummary) error {
	// 1. 获取所有节点列表
	nodes, err := k.fetchNodes(ctx)
	if err != nil {
		return err
	}

	if len(nodes) == 0 {
		return nil
	}

	// 2. 并行获取每个节点的状态，获取到就立即发送
	var wg sync.WaitGroup
	now := time.Now()

	for _, node := range nodes {
		wg.Add(1)
		go func(n KomariNode) {
			defer wg.Done()
			status, _ := k.fetchRecentStatus(ctx, n.UUID)
			summary := k.convertToSummary(n, status, now)

			select {
			case resultChan <- summary:
			case <-ctx.Done():
				return
			}
		}(node)
	}

	wg.Wait()
	return nil
}

// convertToSummary 将节点和状态转换为通用格式
func (k *KomariDataSource) convertToSummary(node KomariNode, status *KomariRecentData, now time.Time) *ServerResourceSummary {
	summary := &ServerResourceSummary{
		ServerID:    fmt.Sprintf("komari-%s", node.UUID),
		Name:        node.Name,
		Host:        k.endpoint,
		Port:        0,
		CollectedAt: now, // 默认使用当前时间
	}

	// 判断在线状态
	if status == nil {
		summary.Status = "offline"
		summary.Error = "No recent data"
	} else {
		// 检查数据是否过期 (超过 3 分钟视为离线)
		if status.UpdatedAt != "" {
			updatedAt, err := time.Parse(time.RFC3339, status.UpdatedAt)
			if err == nil {
				// 使用 Komari 返回的 updated_at 作为实际采集时间
				summary.CollectedAt = updatedAt
				if time.Since(updatedAt) > 3*time.Minute {
					summary.Status = "offline"
				} else {
					summary.Status = "online"
				}
			} else {
				summary.Status = "online"
			}
		} else {
			summary.Status = "online"
		}
	}

	// CPU 信息
	cpuCores := node.CPUCores
	if cpuCores == 0 {
		cpuCores = 1
	}
	cpuUsage := float64(0)
	loadAvg := []float64{0, 0, 0}
	if status != nil {
		cpuUsage = status.CPU.Usage
		loadAvg = []float64{status.Load.Load1, status.Load.Load5, status.Load.Load15}
	}
	summary.CPU = &CPUSummary{
		Cores:        cpuCores,
		UsagePercent: cpuUsage,
		LoadAverage:  loadAvg,
	}

	// 内存信息
	memTotal := node.MemTotal
	memUsed := uint64(0)
	if status != nil {
		if status.RAM.Total > 0 {
			memTotal = status.RAM.Total
		}
		memUsed = status.RAM.Used
	}
	memUsedPercent := float64(0)
	if memTotal > 0 {
		memUsedPercent = float64(memUsed) / float64(memTotal) * 100
	}
	summary.Memory = &MemorySummary{
		Total:       memTotal,
		Used:        memUsed,
		UsedPercent: memUsedPercent,
	}

	// 磁盘信息
	diskTotal := node.DiskTotal
	diskUsed := uint64(0)
	if status != nil {
		if status.Disk.Total > 0 {
			diskTotal = status.Disk.Total
		}
		diskUsed = status.Disk.Used
	}
	diskUsedPercent := float64(0)
	if diskTotal > 0 {
		diskUsedPercent = float64(diskUsed) / float64(diskTotal) * 100
	}
	summary.Disk = &DiskSummary{
		Total:       diskTotal,
		Used:        diskUsed,
		UsedPercent: diskUsedPercent,
	}

	// 网络信息
	rxBytes := uint64(0)
	txBytes := uint64(0)
	if status != nil {
		rxBytes = status.Network.Down
		txBytes = status.Network.Up
	}
	summary.Network = &NetworkSummary{
		RxBytes: rxBytes,
		TxBytes: txBytes,
	}

	// 运行时间
	if status != nil {
		summary.Uptime = status.Uptime
	}

	// 区域/国旗
	if node.Region != "" {
		summary.Location = &LocationSummary{
			CountryCode: node.Region,
			Country:     node.Region,
		}
	}

	return summary
}
