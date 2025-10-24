package batchtask

import (
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Repository 批量任务数据访问接口
type Repository interface {
	Create(task *BatchTask) error
	Update(id uuid.UUID, updates map[string]interface{}) error
	Delete(id uuid.UUID) error
	GetByID(id uuid.UUID) (*BatchTask, error)
	List(userID uuid.UUID, req *ListBatchTasksRequest) ([]BatchTask, int64, error)
	GetStatistics(userID uuid.UUID) (*BatchTaskStatistics, error)
	UpdateStatus(id uuid.UUID, status string) error
	UpdateProgress(id uuid.UUID, successCount, failedCount int) error
}

type repository struct {
	db *gorm.DB
}

// NewRepository 创建批量任务仓储实例
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// Create 创建批量任务
func (r *repository) Create(task *BatchTask) error {
	return r.db.Create(task).Error
}

// Update 更新批量任务
func (r *repository) Update(id uuid.UUID, updates map[string]interface{}) error {
	return r.db.Model(&BatchTask{}).Where("id = ?", id).Updates(updates).Error
}

// Delete 删除批量任务（软删除）
func (r *repository) Delete(id uuid.UUID) error {
	return r.db.Where("id = ?", id).Delete(&BatchTask{}).Error
}

// GetByID 根据ID获取批量任务
func (r *repository) GetByID(id uuid.UUID) (*BatchTask, error) {
	var task BatchTask
	err := r.db.Where("id = ?", id).First(&task).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}

// List 获取批量任务列表
func (r *repository) List(userID uuid.UUID, req *ListBatchTasksRequest) ([]BatchTask, int64, error) {
	var tasks []BatchTask
	var total int64

	query := r.db.Model(&BatchTask{}).Where("user_id = ?", userID)

	// 状态筛选
	if req.Status != "" {
		query = query.Where("status = ?", req.Status)
	}

	// 类型筛选
	if req.TaskType != "" {
		query = query.Where("task_type = ?", req.TaskType)
	}

	// 统计总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页
	if req.Page < 1 {
		req.Page = 1
	}
	if req.Limit < 1 {
		req.Limit = 20
	}
	offset := (req.Page - 1) * req.Limit

	// 查询数据
	err := query.Order("created_at DESC").
		Offset(offset).
		Limit(req.Limit).
		Find(&tasks).Error

	if err != nil {
		return nil, 0, err
	}

	return tasks, total, nil
}

// GetStatistics 获取批量任务统计信息
func (r *repository) GetStatistics(userID uuid.UUID) (*BatchTaskStatistics, error) {
	stats := &BatchTaskStatistics{
		ByType: make(map[string]int),
	}

	// 总任务数
	r.db.Model(&BatchTask{}).Where("user_id = ?", userID).Count(&stats.TotalTasks)

	// 按状态统计
	r.db.Model(&BatchTask{}).Where("user_id = ? AND status = ?", userID, "pending").Count(&stats.PendingTasks)
	r.db.Model(&BatchTask{}).Where("user_id = ? AND status = ?", userID, "running").Count(&stats.RunningTasks)
	r.db.Model(&BatchTask{}).Where("user_id = ? AND status = ?", userID, "completed").Count(&stats.CompletedTasks)
	r.db.Model(&BatchTask{}).Where("user_id = ? AND status = ?", userID, "failed").Count(&stats.FailedTasks)

	// 按类型统计
	var typeStats []struct {
		TaskType string
		Count    int
	}
	r.db.Model(&BatchTask{}).
		Select("task_type, count(*) as count").
		Where("user_id = ?", userID).
		Group("task_type").
		Scan(&typeStats)

	for _, stat := range typeStats {
		stats.ByType[stat.TaskType] = stat.Count
	}

	return stats, nil
}

// UpdateStatus 更新任务状态
func (r *repository) UpdateStatus(id uuid.UUID, status string) error {
	return r.db.Model(&BatchTask{}).
		Where("id = ?", id).
		Update("status", status).
		Error
}

// UpdateProgress 更新任务进度
func (r *repository) UpdateProgress(id uuid.UUID, successCount, failedCount int) error {
	return r.db.Model(&BatchTask{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"success_count": successCount,
			"failed_count":  failedCount,
		}).Error
}
