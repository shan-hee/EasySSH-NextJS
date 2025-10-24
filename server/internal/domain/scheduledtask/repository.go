package scheduledtask

import (
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Repository 定时任务数据访问接口
type Repository interface {
	Create(task *ScheduledTask) error
	Update(id uuid.UUID, updates map[string]interface{}) error
	Delete(id uuid.UUID) error
	GetByID(id uuid.UUID) (*ScheduledTask, error)
	List(userID uuid.UUID, req *ListScheduledTasksRequest) ([]ScheduledTask, int64, error)
	GetStatistics(userID uuid.UUID) (*ScheduledTaskStatistics, error)
	UpdateRunStatus(id uuid.UUID, status string, runCount, failureCount int) error
	GetEnabledTasks() ([]ScheduledTask, error)
}

type repository struct {
	db *gorm.DB
}

// NewRepository 创建定时任务仓储实例
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// Create 创建定时任务
func (r *repository) Create(task *ScheduledTask) error {
	return r.db.Create(task).Error
}

// Update 更新定时任务
func (r *repository) Update(id uuid.UUID, updates map[string]interface{}) error {
	return r.db.Model(&ScheduledTask{}).Where("id = ?", id).Updates(updates).Error
}

// Delete 删除定时任务（软删除）
func (r *repository) Delete(id uuid.UUID) error {
	return r.db.Where("id = ?", id).Delete(&ScheduledTask{}).Error
}

// GetByID 根据ID获取定时任务
func (r *repository) GetByID(id uuid.UUID) (*ScheduledTask, error) {
	var task ScheduledTask
	err := r.db.Where("id = ?", id).First(&task).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}

// List 获取定时任务列表
func (r *repository) List(userID uuid.UUID, req *ListScheduledTasksRequest) ([]ScheduledTask, int64, error) {
	var tasks []ScheduledTask
	var total int64

	query := r.db.Model(&ScheduledTask{}).Where("user_id = ?", userID)

	// 筛选条件
	if req.Enabled != nil {
		query = query.Where("enabled = ?", *req.Enabled)
	}

	if req.TaskType != "" {
		query = query.Where("task_type = ?", req.TaskType)
	}

	// 计算总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页
	offset := (req.Page - 1) * req.Limit
	if err := query.Order("created_at DESC").
		Offset(offset).
		Limit(req.Limit).
		Find(&tasks).Error; err != nil {
		return nil, 0, err
	}

	return tasks, total, nil
}

// GetStatistics 获取定时任务统计信息
func (r *repository) GetStatistics(userID uuid.UUID) (*ScheduledTaskStatistics, error) {
	stats := &ScheduledTaskStatistics{
		ByType: make(map[string]int),
	}

	// 总任务数
	r.db.Model(&ScheduledTask{}).Where("user_id = ?", userID).Count(&stats.TotalTasks)

	// 启用的任务数
	r.db.Model(&ScheduledTask{}).Where("user_id = ? AND enabled = ?", userID, true).Count(&stats.EnabledTasks)

	// 禁用的任务数
	r.db.Model(&ScheduledTask{}).Where("user_id = ? AND enabled = ?", userID, false).Count(&stats.DisabledTasks)

	// 总运行次数
	r.db.Model(&ScheduledTask{}).
		Where("user_id = ?", userID).
		Select("COALESCE(SUM(run_count), 0)").
		Scan(&stats.TotalRuns)

	// 按类型统计
	var typeStats []struct {
		TaskType string
		Count    int
	}
	r.db.Model(&ScheduledTask{}).
		Select("task_type, count(*) as count").
		Where("user_id = ?", userID).
		Group("task_type").
		Scan(&typeStats)

	for _, stat := range typeStats {
		stats.ByType[stat.TaskType] = stat.Count
	}

	return stats, nil
}

// UpdateRunStatus 更新任务运行状态
func (r *repository) UpdateRunStatus(id uuid.UUID, status string, runCount, failureCount int) error {
	updates := map[string]interface{}{
		"last_status":   status,
		"run_count":     runCount,
		"failure_count": failureCount,
	}
	return r.db.Model(&ScheduledTask{}).Where("id = ?", id).Updates(updates).Error
}

// GetEnabledTasks 获取所有启用的定时任务（用于调度器）
func (r *repository) GetEnabledTasks() ([]ScheduledTask, error) {
	var tasks []ScheduledTask
	err := r.db.Where("enabled = ?", true).Find(&tasks).Error
	return tasks, err
}
