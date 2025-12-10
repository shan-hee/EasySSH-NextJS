package monitoring

import (
	"context"
)

// DataSourceProvider 数据源提供者接口
// 用于抽象不同的监控数据来源（EasySSH、Nezha、Komari）
type DataSourceProvider interface {
	// GetServersResources 获取所有服务器资源概览
	GetServersResources(ctx context.Context) ([]*ServerResourceSummary, error)

	// StreamServersResources 流式获取服务器资源（每台服务器采集完成立即通过 channel 返回）
	StreamServersResources(ctx context.Context, resultChan chan<- *ServerResourceSummary) error

	// TestConnection 测试数据源连接
	TestConnection(ctx context.Context) error

	// Name 返回数据源名称
	Name() string
}

// DataSourceConfig 数据源配置
type DataSourceConfig struct {
	Type     string // 数据源类型: easyssh, nezha, komari
	Endpoint string // API 端点（用于外部数据源）
	Token    string // API Token（用于外部数据源）
}
