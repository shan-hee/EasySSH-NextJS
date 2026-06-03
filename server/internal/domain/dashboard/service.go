package dashboard

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// 趋势窗口天数
const trendDays = 7

// 活动记录 action → 趋势维度的映射
// connections: SSH 连接；commands: 监控/查询类；uploads: 文件传输
var actionDimension = map[string]string{
	"ssh_connect":    "connections",
	"ssh_disconnect": "connections",
	"sftp_upload":    "uploads",
	"sftp_download":  "uploads",
}

// operation_records type → 趋势维度的映射。
var operationDimension = map[string]string{
	"connection": "connections",
	"transfer":   "uploads",
	"execution":  "commands",
}

// Service 仪表盘服务接口
type Service interface {
	// GetOverview 获取仪表盘聚合数据。userID 为 nil 表示管理员（全局统计）。
	GetOverview(ctx context.Context, userID *uuid.UUID) (*Overview, error)
}

type service struct {
	repo Repository
}

// NewService 创建仪表盘服务
func NewService(repo Repository) Service {
	return &service{repo: repo}
}

// GetOverview 聚合仪表盘所需的全部数据
func (s *service) GetOverview(ctx context.Context, userID *uuid.UUID) (*Overview, error) {
	now := time.Now()

	// 趋势需要覆盖「当前周期 + 上一周期」用于环比，故回看 2*trendDays 天
	windowStart := startOfDay(now.AddDate(0, 0, -(2*trendDays - 1)))

	logs, err := s.repo.GetActivityLogsSince(ctx, userID, windowStart)
	if err != nil {
		return nil, err
	}
	operationRows, err := s.repo.GetOperationTrendsSince(ctx, userID, windowStart)
	if err != nil {
		return nil, err
	}

	// 生成近 trendDays 天的连续日期（含今天）
	dates := buildDateRange(now, trendDays)
	dateIndex := make(map[string]int, len(dates))
	for i, d := range dates {
		dateIndex[d] = i
	}

	// 按维度初始化序列
	dimensions := []string{"connections", "commands", "uploads", "total"}
	series := make(map[string][]int64, len(dimensions))
	for _, dim := range dimensions {
		series[dim] = make([]int64, len(dates))
	}

	// 当前周期 / 上一周期 边界
	curPeriodStart := startOfDay(now.AddDate(0, 0, -(trendDays - 1)))
	prevPeriodStart := startOfDay(now.AddDate(0, 0, -(2*trendDays - 1)))
	todayStart := startOfDay(now)

	var curCommands, prevCommands, todayCommands int64
	operationDimsByDay := make(map[string]map[string]bool)

	recordTrendEvent := func(createdAt time.Time, dim string) {
		day := createdAt.Local().Format("2006-01-02")
		// 填充近 trendDays 天的按天序列
		if idx, ok := dateIndex[day]; ok {
			series[dim][idx]++
			series["total"][idx]++
		}

		// 命令数环比：以「commands 维度」计（连接、上传不计入命令数）
		if dim == "commands" {
			t := createdAt
			switch {
			case !t.Before(curPeriodStart):
				curCommands++
			case !t.Before(prevPeriodStart) && t.Before(curPeriodStart):
				prevCommands++
			}
			if !t.Before(todayStart) {
				todayCommands++
			}
		}
	}

	for _, row := range operationRows {
		dim := operationDimension[row.Type]
		if dim == "" {
			dim = "commands"
		}
		occurredAt := row.occurredAt()

		recordTrendEvent(occurredAt, dim)

		day := occurredAt.Local().Format("2006-01-02")
		if operationDimsByDay[day] == nil {
			operationDimsByDay[day] = make(map[string]bool)
		}
		operationDimsByDay[day][dim] = true
	}

	for _, row := range logs {
		day := row.CreatedAt.Local().Format("2006-01-02")
		dim := actionDimension[row.Action]
		if dim == "" {
			dim = "commands" // 其余操作归入「命令/操作」维度
		}

		// 新版本连接/传输已写入 operation_records；同日同维度有记录时，活动日志只做兜底，避免双算。
		if (dim == "connections" || dim == "uploads") && operationDimsByDay[day][dim] {
			continue
		}

		recordTrendEvent(row.CreatedAt, dim)
	}

	// 服务器统计
	total, online, err := s.repo.CountServers(ctx, userID)
	if err != nil {
		return nil, err
	}

	// 活跃连接
	activeConns, err := s.repo.CountActiveSessions(ctx, userID)
	if err != nil {
		return nil, err
	}

	// 区域分布
	distribution, err := s.repo.GetServerDistribution(ctx, userID)
	if err != nil {
		return nil, err
	}

	// 最近活动
	recentRows, err := s.repo.GetRecentActivity(ctx, userID, 8)
	if err != nil {
		return nil, err
	}
	recentActivity := make([]ActivityItem, 0, len(recentRows))
	for _, row := range recentRows {
		recentActivity = append(recentActivity, ActivityItem{
			ID:        row.ID,
			Action:    row.Action,
			Username:  row.Username,
			Resource:  row.Resource,
			Status:    row.Status,
			IP:        row.IP,
			CreatedAt: row.CreatedAt,
		})
	}

	overview := &Overview{
		Stats: StatsBlock{
			OnlineServers: MetricWithTrend{
				Value:     float64(online),
				ChangePct: 0, // 在线数无历史快照，环比留 0
				Spark:     toFloatSlice(series["connections"]),
			},
			TotalServers: int(total),
			ActiveConns: MetricWithTrend{
				Value:     float64(activeConns),
				ChangePct: 0,
				Spark:     toFloatSlice(series["connections"]),
			},
			TodayCommands: MetricWithTrend{
				Value:     float64(todayCommands),
				ChangePct: percentChange(curCommands, prevCommands),
				Spark:     toFloatSlice(series["commands"]),
			},
		},
		ConnectionTrend: TrendBlock{
			Dates:  dates,
			Series: series,
		},
		Distribution:   distribution,
		RecentActivity: recentActivity,
	}

	return overview, nil
}

// startOfDay 返回某时刻当天 00:00:00（本地时区）
func startOfDay(t time.Time) time.Time {
	lt := t.Local()
	y, m, d := lt.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, lt.Location())
}

// buildDateRange 生成截止 now、长度为 days 的连续日期（升序，含今天）
func buildDateRange(now time.Time, days int) []string {
	dates := make([]string, 0, days)
	for i := days - 1; i >= 0; i-- {
		dates = append(dates, now.AddDate(0, 0, -i).Local().Format("2006-01-02"))
	}
	return dates
}

// percentChange 计算环比百分比；prev 为 0 时：cur>0 记 100%，否则 0%
func percentChange(cur, prev int64) float64 {
	if prev == 0 {
		if cur > 0 {
			return 100
		}
		return 0
	}
	return float64(cur-prev) / float64(prev) * 100
}

// toFloatSlice int64 序列转 float64
func toFloatSlice(in []int64) []float64 {
	out := make([]float64, len(in))
	for i, v := range in {
		out[i] = float64(v)
	}
	return out
}
