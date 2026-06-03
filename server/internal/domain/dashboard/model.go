package dashboard

import "time"

// MetricWithTrend 带趋势的指标
// Value 当前值，ChangePct 与上一周期相比的环比变化（百分比，可正可负），Spark 近 N 天迷你序列
type MetricWithTrend struct {
	Value     float64   `json:"value"`
	ChangePct float64   `json:"change_pct"`
	Spark     []float64 `json:"spark"`
}

// StatsBlock 顶部统计卡片数据块
// 平均 CPU / 平均内存为实时值，由前端 SSE 流计算后自行合并，后端不下发。
type StatsBlock struct {
	OnlineServers MetricWithTrend `json:"online_servers"` // 在线服务器数（趋势暂用今日值占位）
	TotalServers  int             `json:"total_servers"`  // 服务器总数
	ActiveConns   MetricWithTrend `json:"active_conns"`   // 活跃连接数（来自 operation_records running connection）
	TodayCommands MetricWithTrend `json:"today_commands"` // 今日命令数（来自活动记录）
}

// TrendBlock 近 N 天趋势数据块
// Dates 为连续日期（YYYY-MM-DD），Series 按指标维度分组，每个 value 数组与 Dates 等长。
type TrendBlock struct {
	Dates  []string           `json:"dates"`
	Series map[string][]int64 `json:"series"` // 维度 key: connections / commands / uploads / total
}

// RegionCount 服务器区域分布项
type RegionCount struct {
	Region      string `json:"region"`       // 展示名（优先 country，回退 region）
	CountryCode string `json:"country_code"` // 国家代码，用于前端地图打点
	Count       int    `json:"count"`
}

// ActivityItem 最近活动项（取自活动记录）
type ActivityItem struct {
	ID        string    `json:"id"`
	Action    string    `json:"action"`
	Username  string    `json:"username"`
	Resource  string    `json:"resource"`
	Status    string    `json:"status"`
	IP        string    `json:"ip"`
	CreatedAt time.Time `json:"created_at"`
}

// Overview 仪表盘聚合响应
type Overview struct {
	Stats           StatsBlock     `json:"stats"`
	ConnectionTrend TrendBlock     `json:"connection_trend"`
	Distribution    []RegionCount  `json:"distribution"`
	RecentActivity  []ActivityItem `json:"recent_activity"`
}

// activityLogRow 内部查询用的轻量行结构（仅取聚合所需字段，避免拉全表大字段）
type activityLogRow struct {
	ID        string
	Action    string
	Username  string
	Resource  string
	Status    string
	IP        string
	CreatedAt time.Time
}

// operationTrendRow 是 operation_records 趋势聚合所需的轻量行。
type operationTrendRow struct {
	Type      string
	Action    string
	StartedAt *time.Time
	CreatedAt time.Time
}

func (row operationTrendRow) occurredAt() time.Time {
	if row.StartedAt != nil && !row.StartedAt.IsZero() {
		return *row.StartedAt
	}
	return row.CreatedAt
}
