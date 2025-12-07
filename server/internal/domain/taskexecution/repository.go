package taskexecution

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Repository 执行历史数据访问接口
type Repository interface {
	Create(execution *TaskExecution) error
	Update(id uuid.UUID, updates map[string]interface{}) error
	GetByID(id uuid.UUID) (*TaskExecution, error)
	GetByIDWithResults(id uuid.UUID) (*TaskExecution, error)
	List(userID uuid.UUID, req *ListExecutionsRequest) ([]TaskExecution, int64, error)
	CreateServerResult(result *TaskExecutionServer) error
	GetServerResults(executionID uuid.UUID) ([]TaskExecutionServer, error)
	GetStatistics(userID uuid.UUID, days int) (*ExecutionStatistics, error)
	CleanupOldRecords(retentionDays int) (int64, error)
}

type repository struct {
	db *gorm.DB
}

// NewRepository 创建仓储实例
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) Create(execution *TaskExecution) error {
	return r.db.Create(execution).Error
}

func (r *repository) Update(id uuid.UUID, updates map[string]interface{}) error {
	return r.db.Model(&TaskExecution{}).Where("id = ?", id).Updates(updates).Error
}

func (r *repository) GetByID(id uuid.UUID) (*TaskExecution, error) {
	var execution TaskExecution
	err := r.db.Where("id = ?", id).First(&execution).Error
	return &execution, err
}

func (r *repository) GetByIDWithResults(id uuid.UUID) (*TaskExecution, error) {
	var execution TaskExecution
	err := r.db.Preload("ServerResults").Where("id = ?", id).First(&execution).Error
	return &execution, err
}

func (r *repository) List(userID uuid.UUID, req *ListExecutionsRequest) ([]TaskExecution, int64, error) {
	var executions []TaskExecution
	var total int64

	query := r.db.Model(&TaskExecution{}).Where("user_id = ?", userID)

	// 筛选条件
	if req.ScheduledTaskID != nil {
		query = query.Where("scheduled_task_id = ?", *req.ScheduledTaskID)
	}
	if req.Status != "" {
		query = query.Where("status = ?", req.Status)
	}
	if req.TriggerType != "" {
		query = query.Where("trigger_type = ?", req.TriggerType)
	}
	if req.TaskType != "" {
		query = query.Where("task_type = ?", req.TaskType)
	}
	if req.StartTime != nil {
		query = query.Where("start_time >= ?", *req.StartTime)
	}
	if req.EndTime != nil {
		query = query.Where("start_time <= ?", *req.EndTime)
	}

	// 统计总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页
	offset := (req.Page - 1) * req.Limit
	if err := query.Order("start_time DESC").
		Offset(offset).
		Limit(req.Limit).
		Find(&executions).Error; err != nil {
		return nil, 0, err
	}

	return executions, total, nil
}

func (r *repository) CreateServerResult(result *TaskExecutionServer) error {
	return r.db.Create(result).Error
}

func (r *repository) GetServerResults(executionID uuid.UUID) ([]TaskExecutionServer, error) {
	var results []TaskExecutionServer
	err := r.db.Where("execution_id = ?", executionID).
		Order("start_time ASC").
		Find(&results).Error
	return results, err
}

func (r *repository) GetStatistics(userID uuid.UUID, days int) (*ExecutionStatistics, error) {
	stats := &ExecutionStatistics{
		ByStatus:   make(map[ExecutionStatus]int64),
		ByTaskType: make(map[string]int64),
	}

	// 时间范围
	since := time.Now().AddDate(0, 0, -days)
	baseQuery := r.db.Model(&TaskExecution{}).
		Where("user_id = ? AND start_time >= ?", userID, since)

	// 总执行次数
	baseQuery.Count(&stats.TotalExecutions)

	// 按状态统计
	r.db.Model(&TaskExecution{}).
		Where("user_id = ? AND start_time >= ? AND status = ?", userID, since, StatusSuccess).
		Count(&stats.SuccessCount)
	r.db.Model(&TaskExecution{}).
		Where("user_id = ? AND start_time >= ? AND status = ?", userID, since, StatusFailed).
		Count(&stats.FailedCount)
	r.db.Model(&TaskExecution{}).
		Where("user_id = ? AND start_time >= ? AND status = ?", userID, since, StatusPartial).
		Count(&stats.PartialCount)
	r.db.Model(&TaskExecution{}).
		Where("user_id = ? AND start_time >= ? AND status = ?", userID, since, StatusRunning).
		Count(&stats.RunningCount)

	stats.ByStatus[StatusSuccess] = stats.SuccessCount
	stats.ByStatus[StatusFailed] = stats.FailedCount
	stats.ByStatus[StatusPartial] = stats.PartialCount
	stats.ByStatus[StatusRunning] = stats.RunningCount

	// 平均执行时长
	var avgDuration struct {
		Avg float64
	}
	r.db.Model(&TaskExecution{}).
		Where("user_id = ? AND start_time >= ? AND duration > 0", userID, since).
		Select("COALESCE(AVG(duration), 0) as avg").
		Scan(&avgDuration)
	stats.AverageDuration = int64(avgDuration.Avg)

	// 按任务类型统计
	var typeStats []struct {
		TaskType string
		Count    int64
	}
	r.db.Model(&TaskExecution{}).
		Select("task_type, count(*) as count").
		Where("user_id = ? AND start_time >= ?", userID, since).
		Group("task_type").
		Scan(&typeStats)
	for _, ts := range typeStats {
		stats.ByTaskType[ts.TaskType] = ts.Count
	}

	// 最近执行记录
	r.db.Where("user_id = ?", userID).
		Order("start_time DESC").
		Limit(10).
		Find(&stats.RecentExecutions)

	return stats, nil
}

func (r *repository) CleanupOldRecords(retentionDays int) (int64, error) {
	before := time.Now().AddDate(0, 0, -retentionDays)

	// 先删除服务器执行结果
	r.db.Where("execution_id IN (SELECT id FROM task_executions WHERE start_time < ?)", before).
		Delete(&TaskExecutionServer{})

	// 删除执行记录
	result := r.db.Where("start_time < ?", before).Delete(&TaskExecution{})
	return result.RowsAffected, result.Error
}
