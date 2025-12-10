package monitoring

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// NezhaDataSource Nezha 数据源
type NezhaDataSource struct {
	endpoint string
	token    string
	client   *http.Client
}

// NewNezhaDataSource 创建 Nezha 数据源
func NewNezhaDataSource(endpoint, token string) *NezhaDataSource {
	return &NezhaDataSource{
		endpoint: strings.TrimSuffix(endpoint, "/"),
		token:    token,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Name 返回数据源名称
func (n *NezhaDataSource) Name() string {
	return "nezha"
}

// NezhaAPIResponse Nezha API 响应结构
type NezhaAPIResponse struct {
	Success bool          `json:"success"`
	Data    []NezhaServer `json:"data"`
	Error   string        `json:"error,omitempty"`
}

// NezhaServer Nezha 服务器数据
type NezhaServer struct {
	ID         int        `json:"id"`          // 服务器 ID
	Name       string     `json:"name"`        // 服务器名称
	Host       NezhaHost  `json:"host"`        // 主机信息
	State      NezhaState `json:"state"`       // 实时状态
	GeoIP      NezhaGeoIP `json:"geoip"`       // 地理位置信息
	LastActive string     `json:"last_active"` // 最后活跃时间 (ISO 8601)
}

// NezhaGeoIP Nezha 地理位置信息
type NezhaGeoIP struct {
	IP          NezhaIP `json:"ip"`
	CountryCode string  `json:"country_code"` // 国家/地区代码
}

// NezhaIP Nezha IP 信息
type NezhaIP struct {
	IPv4Addr string `json:"ipv4_addr,omitempty"`
	IPv6Addr string `json:"ipv6_addr,omitempty"`
}

// NezhaHost Nezha 主机信息
type NezhaHost struct {
	Platform       string   `json:"platform"`        // 操作系统平台
	PlatformVer    string   `json:"platform_version"` // 操作系统版本
	CPU            []string `json:"cpu"`             // CPU 信息数组
	MemTotal       uint64   `json:"mem_total"`       // 总内存 (字节)
	DiskTotal      uint64   `json:"disk_total"`      // 总磁盘空间 (字节)
	SwapTotal      uint64   `json:"swap_total"`      // 总交换空间 (字节)
	Arch           string   `json:"arch"`            // 架构
	Virtualization string   `json:"virtualization"`  // 虚拟化类型
	BootTime       int64    `json:"boot_time"`       // 启动时间戳 (秒)
	Version        string   `json:"version"`         // Agent 版本
}

// NezhaState Nezha 实时状态
type NezhaState struct {
	CPU            float64 `json:"cpu"`              // CPU 使用率 (百分比)
	MemUsed        uint64  `json:"mem_used"`         // 已用内存 (字节)
	SwapUsed       uint64  `json:"swap_used"`        // 已用交换空间 (字节)
	DiskUsed       uint64  `json:"disk_used"`        // 已用磁盘空间 (字节)
	NetInTransfer  uint64  `json:"net_in_transfer"`  // 入站总流量 (字节)
	NetOutTransfer uint64  `json:"net_out_transfer"` // 出站总流量 (字节)
	NetInSpeed     uint64  `json:"net_in_speed"`     // 入站速度 (字节/秒)
	NetOutSpeed    uint64  `json:"net_out_speed"`    // 出站速度 (字节/秒)
	Uptime         uint64  `json:"uptime"`           // 运行时间 (秒)
	Load1          float64 `json:"load_1"`           // 1分钟负载
	Load5          float64 `json:"load_5"`           // 5分钟负载
	Load15         float64 `json:"load_15"`          // 15分钟负载
	TCPConnCount   int     `json:"tcp_conn_count"`   // TCP 连接数
	UDPConnCount   int     `json:"udp_conn_count"`   // UDP 连接数
	ProcessCount   int     `json:"process_count"`    // 进程数
}

// TestConnection 测试连接
func (n *NezhaDataSource) TestConnection(ctx context.Context) error {
	_, err := n.fetchFromAPI(ctx)
	return err
}

// GetServersResources 获取所有服务器资源概览
func (n *NezhaDataSource) GetServersResources(ctx context.Context) ([]*ServerResourceSummary, error) {
	servers, err := n.fetchFromAPI(ctx)
	if err != nil {
		return nil, err
	}

	return n.convertToSummaries(servers), nil
}

// StreamServersResources 流式获取服务器资源
func (n *NezhaDataSource) StreamServersResources(ctx context.Context, resultChan chan<- *ServerResourceSummary) error {
	servers, err := n.fetchFromAPI(ctx)
	if err != nil {
		return err
	}

	summaries := n.convertToSummaries(servers)
	for _, summary := range summaries {
		select {
		case resultChan <- summary:
		case <-ctx.Done():
			return ctx.Err()
		}
	}

	return nil
}

// fetchFromAPI 从 REST API 获取数据
func (n *NezhaDataSource) fetchFromAPI(ctx context.Context) ([]NezhaServer, error) {
	apiURL := n.endpoint + "/api/v1/server"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// 支持两种认证方式：Token 和 Cookie (nz-jwt)
	if n.token != "" {
		// 判断是否是 JWT 格式 (以 eyJ 开头)
		if strings.HasPrefix(n.token, "eyJ") {
			// 使用 Cookie 认证
			req.Header.Set("Cookie", "nz-jwt="+n.token)
		} else {
			// 使用 Token 认证
			req.Header.Set("Authorization", n.token)
		}
	}

	resp, err := n.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch from Nezha API: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// 尝试解析为标准响应
	var response NezhaAPIResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse Nezha response: %w", err)
	}

	// 检查错误
	if response.Error != "" {
		return nil, fmt.Errorf("Nezha API error: %s", response.Error)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Nezha API returned status %d: %s", resp.StatusCode, string(body))
	}

	if !response.Success {
		return nil, fmt.Errorf("Nezha API returned unsuccessful response")
	}

	return response.Data, nil
}

// convertToSummaries 将 Nezha 响应转换为通用格式
func (n *NezhaDataSource) convertToSummaries(servers []NezhaServer) []*ServerResourceSummary {
	now := time.Now()
	summaries := make([]*ServerResourceSummary, 0, len(servers))

	for _, server := range servers {
		summary := &ServerResourceSummary{
			ServerID:    fmt.Sprintf("nezha-%d", server.ID),
			Name:        server.Name,
			Host:        n.endpoint, // 使用端点作为 host 标识
			Port:        0,
			CollectedAt: now, // 默认使用当前时间
		}

		// 判断在线状态（根据 last_active 时间）
		lastActive, err := time.Parse(time.RFC3339, server.LastActive)
		if err == nil {
			// 使用 Nezha 返回的 last_active 作为实际采集时间
			summary.CollectedAt = lastActive
			if now.Sub(lastActive) <= 180*time.Second {
				summary.Status = "online"
			} else {
				summary.Status = "offline"
			}
		} else {
			summary.Status = "offline"
		}

		// 地理位置信息 (从 geoip.country_code 获取)
		if server.GeoIP.CountryCode != "" {
			summary.Location = &LocationSummary{
				CountryCode: strings.ToUpper(server.GeoIP.CountryCode),
			}
		}

		// CPU 信息
		cpuCores := len(server.Host.CPU)
		if cpuCores == 0 {
			cpuCores = 1
		}
		summary.CPU = &CPUSummary{
			Cores:        cpuCores,
			UsagePercent: server.State.CPU,
			LoadAverage:  []float64{server.State.Load1, server.State.Load5, server.State.Load15},
		}

		// 内存信息
		memUsedPercent := float64(0)
		if server.Host.MemTotal > 0 {
			memUsedPercent = float64(server.State.MemUsed) / float64(server.Host.MemTotal) * 100
		}
		summary.Memory = &MemorySummary{
			Total:       server.Host.MemTotal,
			Used:        server.State.MemUsed,
			UsedPercent: memUsedPercent,
		}

		// 磁盘信息
		diskUsedPercent := float64(0)
		if server.Host.DiskTotal > 0 {
			diskUsedPercent = float64(server.State.DiskUsed) / float64(server.Host.DiskTotal) * 100
		}
		summary.Disk = &DiskSummary{
			Total:       server.Host.DiskTotal,
			Used:        server.State.DiskUsed,
			UsedPercent: diskUsedPercent,
		}

		// 网络信息（使用速率而非总量）
		summary.Network = &NetworkSummary{
			RxBytes: server.State.NetInSpeed,
			TxBytes: server.State.NetOutSpeed,
		}

		// 运行时间
		summary.Uptime = server.State.Uptime

		summaries = append(summaries, summary)
	}

	return summaries
}
