package batchtask

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/easyssh/server/internal/domain/scheduledtask"
	"github.com/easyssh/server/internal/domain/taskexecutor"
	"github.com/google/uuid"
)

// TaskExecutor 任务执行器接口
type TaskExecutor interface {
	Execute(ctx context.Context, task *scheduledtask.ScheduledTask, trigger taskexecutor.TriggerType)
}

var (
	ErrBatchTaskNotFound    = errors.New("batch task not found")
	ErrInvalidBatchTaskData = errors.New("invalid batch task data")
	ErrUnauthorized         = errors.New("unauthorized access to batch task")
)

// Service 批量任务业务逻辑接口
type Service interface {
	CreateBatchTask(userID uuid.UUID, req *CreateBatchTaskRequest) (*BatchTask, error)
	UpdateBatchTask(userID uuid.UUID, id uuid.UUID, req *UpdateBatchTaskRequest) (*BatchTask, error)
	DeleteBatchTask(userID uuid.UUID, id uuid.UUID) error
	GetBatchTask(userID uuid.UUID, id uuid.UUID) (*BatchTask, error)
	ListBatchTasks(userID uuid.UUID, req *ListBatchTasksRequest) (*ListBatchTasksResponse, error)
	GetStatistics(userID uuid.UUID) (*BatchTaskStatistics, error)
	StartBatchTask(userID uuid.UUID, id uuid.UUID) error
	UpdateTaskProgress(id uuid.UUID, successCount, failedCount int) error
	CompleteBatchTask(id uuid.UUID, status string) error
	SetExecutor(executor TaskExecutor)
}

type service struct {
	repo     Repository
	executor TaskExecutor
}

// NewService 创建批量任务服务实例
func NewService(repo Repository) Service {
	return &service{repo: repo}
}

// SetExecutor 设置任务执行器
func (s *service) SetExecutor(executor TaskExecutor) {
	s.executor = executor
}

// CreateBatchTask 创建批量任务
func (s *service) CreateBatchTask(userID uuid.UUID, req *CreateBatchTaskRequest) (*BatchTask, error) {
	// 验证必填字段
	if req.TaskName == "" {
		return nil, ErrInvalidBatchTaskData
	}

	if len(req.ServerIDs) == 0 {
		return nil, errors.New("server_ids cannot be empty")
	}

	// 验证任务类型
	validTaskTypes := map[string]bool{"command": true, "script": true, "file": true}
	if !validTaskTypes[req.TaskType] {
		return nil, errors.New("invalid task_type, must be one of: command, script, file")
	}

	// 验证执行模式
	if req.ExecutionMode == "" {
		req.ExecutionMode = "parallel"
	}
	validExecutionModes := map[string]bool{"parallel": true, "sequential": true}
	if !validExecutionModes[req.ExecutionMode] {
		return nil, errors.New("invalid execution_mode, must be one of: parallel, sequential")
	}

	// 转换 ScriptID
	var scriptID *uuid.UUID
	if req.ScriptID != nil && *req.ScriptID != "" {
		sid, err := uuid.Parse(*req.ScriptID)
		if err != nil {
			return nil, errors.New("invalid script_id format")
		}
		scriptID = &sid
	}

	// 构建批量任务
	task := &BatchTask{
		UserID:        userID,
		TaskName:      req.TaskName,
		TaskType:      req.TaskType,
		Content:       req.Content,
		ScriptID:      scriptID,
		ServerIDs:     req.ServerIDs,
		ExecutionMode: req.ExecutionMode,
		Status:        "pending",
		SuccessCount:  0,
		FailedCount:   0,
	}

	if err := s.repo.Create(task); err != nil {
		return nil, err
	}

	return task, nil
}

// UpdateBatchTask 更新批量任务
func (s *service) UpdateBatchTask(userID uuid.UUID, id uuid.UUID, req *UpdateBatchTaskRequest) (*BatchTask, error) {
	// 获取现有任务
	existingTask, err := s.repo.GetByID(id)
	if err != nil {
		return nil, ErrBatchTaskNotFound
	}

	// 验证所有权
	if existingTask.UserID != userID {
		return nil, ErrUnauthorized
	}

	// 不允许修改正在运行的任务
	if existingTask.Status == "running" {
		return nil, errors.New("cannot update running task")
	}

	// 构建更新字段
	updates := make(map[string]interface{})

	if req.TaskName != "" {
		updates["task_name"] = req.TaskName
	}

	if req.Content != "" {
		updates["content"] = req.Content
	}

	if req.ExecutionMode != "" {
		validExecutionModes := map[string]bool{"parallel": true, "sequential": true}
		if !validExecutionModes[req.ExecutionMode] {
			return nil, errors.New("invalid execution_mode")
		}
		updates["execution_mode"] = req.ExecutionMode
	}

	if len(req.ServerIDs) > 0 {
		updates["server_ids"] = req.ServerIDs
	}

	if len(updates) == 0 {
		return existingTask, nil
	}

	// 执行更新
	if err := s.repo.Update(id, updates); err != nil {
		return nil, err
	}

	// 返回更新后的任务
	return s.repo.GetByID(id)
}

// DeleteBatchTask 删除批量任务
func (s *service) DeleteBatchTask(userID uuid.UUID, id uuid.UUID) error {
	// 获取现有任务
	existingTask, err := s.repo.GetByID(id)
	if err != nil {
		return ErrBatchTaskNotFound
	}

	// 验证所有权
	if existingTask.UserID != userID {
		return ErrUnauthorized
	}

	// 不允许删除正在运行的任务
	if existingTask.Status == "running" {
		return errors.New("cannot delete running task")
	}

	return s.repo.Delete(id)
}

// GetBatchTask 获取批量任务详情
func (s *service) GetBatchTask(userID uuid.UUID, id uuid.UUID) (*BatchTask, error) {
	task, err := s.repo.GetByID(id)
	if err != nil {
		return nil, ErrBatchTaskNotFound
	}

	// 验证所有权
	if task.UserID != userID {
		return nil, ErrUnauthorized
	}

	return task, nil
}

// ListBatchTasks 获取批量任务列表
func (s *service) ListBatchTasks(userID uuid.UUID, req *ListBatchTasksRequest) (*ListBatchTasksResponse, error) {
	// 设置默认值
	if req.Page < 1 {
		req.Page = 1
	}
	if req.Limit < 1 {
		req.Limit = 20
	}

	tasks, total, err := s.repo.List(userID, req)
	if err != nil {
		return nil, err
	}

	// 计算总页数
	totalPages := int(total) / req.Limit
	if int(total)%req.Limit > 0 {
		totalPages++
	}

	return &ListBatchTasksResponse{
		Data:       tasks,
		Total:      total,
		Page:       req.Page,
		PageSize:   req.Limit,
		TotalPages: totalPages,
	}, nil
}

// GetStatistics 获取批量任务统计信息
func (s *service) GetStatistics(userID uuid.UUID) (*BatchTaskStatistics, error) {
	return s.repo.GetStatistics(userID)
}

// StartBatchTask 启动批量任务
func (s *service) StartBatchTask(userID uuid.UUID, id uuid.UUID) error {
	// 获取任务
	task, err := s.repo.GetByID(id)
	if err != nil {
		return ErrBatchTaskNotFound
	}

	// 验证所有权
	if task.UserID != userID {
		return ErrUnauthorized
	}

	// 验证状态
	if task.Status != "pending" {
		return errors.New("task is not in pending status")
	}

	// 更新状态为运行中
	now := time.Now()
	updates := map[string]interface{}{
		"status":     "running",
		"started_at": now,
	}

	if err := s.repo.Update(id, updates); err != nil {
		return err
	}

	// 如果有执行器，异步执行任务
	if s.executor != nil {
		// 将批量任务转换为定时任务格式以便执行
		scheduledTask := &scheduledtask.ScheduledTask{
			ID:        task.ID,
			UserID:    task.UserID,
			TaskName:  task.TaskName,
			TaskType:  task.TaskType,
			Command:   task.Content,
			ScriptID:  task.ScriptID,
			ServerIDs: task.ServerIDs,
			Enabled:   true,
		}

		// 异步执行任务
		go func() {
			log.Printf("[BatchTask] 开始执行批量任务: taskID=%s, type=%s", task.ID, task.TaskType)
			s.executor.Execute(context.Background(), scheduledTask, taskexecutor.TriggerManual)

			// 执行完成后更新批量任务状态；详细执行结果由 taskexecutor 写入统一操作记录。
			s.CompleteBatchTask(task.ID, "completed")
			log.Printf("[BatchTask] 批量任务执行完成: taskID=%s", task.ID)
		}()
	} else {
		log.Printf("[BatchTask] 警告: 没有设置执行器，任务 %s 只更新了状态但未实际执行", id)
	}

	return nil
}

// UpdateTaskProgress 更新任务进度
func (s *service) UpdateTaskProgress(id uuid.UUID, successCount, failedCount int) error {
	return s.repo.UpdateProgress(id, successCount, failedCount)
}

// CompleteBatchTask 完成批量任务
func (s *service) CompleteBatchTask(id uuid.UUID, status string) error {
	// 验证状态
	validStatuses := map[string]bool{"completed": true, "failed": true}
	if !validStatuses[status] {
		return errors.New("invalid completion status")
	}

	// 获取任务以计算执行时长
	task, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}

	now := time.Now()
	var duration int
	if task.StartedAt != nil {
		duration = int(now.Sub(*task.StartedAt).Seconds())
	}

	updates := map[string]interface{}{
		"status":       status,
		"completed_at": now,
		"duration":     duration,
	}

	return s.repo.Update(id, updates)
}
