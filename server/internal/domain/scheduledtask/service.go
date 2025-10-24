package scheduledtask

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/robfig/cron/v3"
)

var (
	ErrScheduledTaskNotFound    = errors.New("scheduled task not found")
	ErrInvalidScheduledTaskData = errors.New("invalid scheduled task data")
	ErrUnauthorized             = errors.New("unauthorized access to scheduled task")
	ErrInvalidCronExpression    = errors.New("invalid cron expression")
)

// Service 定时任务业务逻辑接口
type Service interface {
	CreateScheduledTask(userID uuid.UUID, req *CreateScheduledTaskRequest) (*ScheduledTask, error)
	UpdateScheduledTask(userID uuid.UUID, id uuid.UUID, req *UpdateScheduledTaskRequest) (*ScheduledTask, error)
	DeleteScheduledTask(userID uuid.UUID, id uuid.UUID) error
	GetScheduledTask(userID uuid.UUID, id uuid.UUID) (*ScheduledTask, error)
	ListScheduledTasks(userID uuid.UUID, req *ListScheduledTasksRequest) (*ListScheduledTasksResponse, error)
	GetStatistics(userID uuid.UUID) (*ScheduledTaskStatistics, error)
	ToggleTask(userID uuid.UUID, id uuid.UUID, enabled bool) error
	TriggerTask(userID uuid.UUID, id uuid.UUID) error
}

type service struct {
	repo Repository
}

// NewService 创建定时任务服务实例
func NewService(repo Repository) Service {
	return &service{repo: repo}
}

// validateCronExpression 验证Cron表达式
func (s *service) validateCronExpression(expr string) error {
	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	_, err := parser.Parse(expr)
	if err != nil {
		return ErrInvalidCronExpression
	}
	return nil
}

// calculateNextRunTime 计算下次运行时间
func (s *service) calculateNextRunTime(cronExpr, timezone string) (*time.Time, error) {
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		loc = time.UTC
	}

	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	schedule, err := parser.Parse(cronExpr)
	if err != nil {
		return nil, err
	}

	nextTime := schedule.Next(time.Now().In(loc))
	return &nextTime, nil
}

// CreateScheduledTask 创建定时任务
func (s *service) CreateScheduledTask(userID uuid.UUID, req *CreateScheduledTaskRequest) (*ScheduledTask, error) {
	// 验证必填字段
	if req.TaskName == "" || req.CronExpression == "" {
		return nil, ErrInvalidScheduledTaskData
	}

	// 验证任务类型
	validTaskTypes := map[string]bool{"command": true, "script": true, "batch": true}
	if !validTaskTypes[req.TaskType] {
		return nil, errors.New("invalid task_type, must be one of: command, script, batch")
	}

	// 验证Cron表达式
	if err := s.validateCronExpression(req.CronExpression); err != nil {
		return nil, err
	}

	// 设置默认值
	timezone := req.Timezone
	if timezone == "" {
		timezone = "UTC"
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	// 转换ID
	var scriptID *uuid.UUID
	if req.ScriptID != nil && *req.ScriptID != "" {
		sid, err := uuid.Parse(*req.ScriptID)
		if err != nil {
			return nil, errors.New("invalid script_id format")
		}
		scriptID = &sid
	}

	var batchTaskID *uuid.UUID
	if req.BatchTaskID != nil && *req.BatchTaskID != "" {
		bid, err := uuid.Parse(*req.BatchTaskID)
		if err != nil {
			return nil, errors.New("invalid batch_task_id format")
		}
		batchTaskID = &bid
	}

	// 计算下次运行时间
	nextRunAt, err := s.calculateNextRunTime(req.CronExpression, timezone)
	if err != nil {
		return nil, err
	}

	// 构建定时任务
	task := &ScheduledTask{
		UserID:         userID,
		TaskName:       req.TaskName,
		TaskType:       req.TaskType,
		ScriptID:       scriptID,
		BatchTaskID:    batchTaskID,
		Command:        req.Command,
		ServerIDs:      req.ServerIDs,
		CronExpression: req.CronExpression,
		Timezone:       timezone,
		Enabled:        enabled,
		NextRunAt:      nextRunAt,
		RunCount:       0,
		FailureCount:   0,
		Description:    req.Description,
	}

	if err := s.repo.Create(task); err != nil {
		return nil, err
	}

	return task, nil
}

// UpdateScheduledTask 更新定时任务
func (s *service) UpdateScheduledTask(userID uuid.UUID, id uuid.UUID, req *UpdateScheduledTaskRequest) (*ScheduledTask, error) {
	// 获取现有任务
	existingTask, err := s.repo.GetByID(id)
	if err != nil {
		return nil, ErrScheduledTaskNotFound
	}

	// 验证所有权
	if existingTask.UserID != userID {
		return nil, ErrUnauthorized
	}

	// 构建更新字段
	updates := make(map[string]interface{})

	if req.TaskName != "" {
		updates["task_name"] = req.TaskName
	}

	if req.Command != "" {
		updates["command"] = req.Command
	}

	if len(req.ServerIDs) > 0 {
		updates["server_ids"] = req.ServerIDs
	}

	if req.CronExpression != "" {
		if err := s.validateCronExpression(req.CronExpression); err != nil {
			return nil, err
		}
		updates["cron_expression"] = req.CronExpression

		// 重新计算下次运行时间
		timezone := existingTask.Timezone
		if req.Timezone != "" {
			timezone = req.Timezone
			updates["timezone"] = timezone
		}
		nextRunAt, err := s.calculateNextRunTime(req.CronExpression, timezone)
		if err != nil {
			return nil, err
		}
		updates["next_run_at"] = nextRunAt
	}

	if req.Timezone != "" {
		updates["timezone"] = req.Timezone
	}

	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}

	if req.Description != "" {
		updates["description"] = req.Description
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

// DeleteScheduledTask 删除定时任务
func (s *service) DeleteScheduledTask(userID uuid.UUID, id uuid.UUID) error {
	// 获取现有任务
	existingTask, err := s.repo.GetByID(id)
	if err != nil {
		return ErrScheduledTaskNotFound
	}

	// 验证所有权
	if existingTask.UserID != userID {
		return ErrUnauthorized
	}

	return s.repo.Delete(id)
}

// GetScheduledTask 获取定时任务详情
func (s *service) GetScheduledTask(userID uuid.UUID, id uuid.UUID) (*ScheduledTask, error) {
	task, err := s.repo.GetByID(id)
	if err != nil {
		return nil, ErrScheduledTaskNotFound
	}

	// 验证所有权
	if task.UserID != userID {
		return nil, ErrUnauthorized
	}

	return task, nil
}

// ListScheduledTasks 获取定时任务列表
func (s *service) ListScheduledTasks(userID uuid.UUID, req *ListScheduledTasksRequest) (*ListScheduledTasksResponse, error) {
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

	return &ListScheduledTasksResponse{
		Data:       tasks,
		Total:      total,
		Page:       req.Page,
		PageSize:   req.Limit,
		TotalPages: totalPages,
	}, nil
}

// GetStatistics 获取定时任务统计信息
func (s *service) GetStatistics(userID uuid.UUID) (*ScheduledTaskStatistics, error) {
	return s.repo.GetStatistics(userID)
}

// ToggleTask 启用/禁用定时任务
func (s *service) ToggleTask(userID uuid.UUID, id uuid.UUID, enabled bool) error {
	// 获取任务
	task, err := s.repo.GetByID(id)
	if err != nil {
		return ErrScheduledTaskNotFound
	}

	// 验证所有权
	if task.UserID != userID {
		return ErrUnauthorized
	}

	updates := map[string]interface{}{
		"enabled": enabled,
	}

	// 如果启用，重新计算下次运行时间
	if enabled {
		nextRunAt, err := s.calculateNextRunTime(task.CronExpression, task.Timezone)
		if err != nil {
			return err
		}
		updates["next_run_at"] = nextRunAt
	}

	return s.repo.Update(id, updates)
}

// TriggerTask 手动触发定时任务
func (s *service) TriggerTask(userID uuid.UUID, id uuid.UUID) error {
	// 获取任务
	task, err := s.repo.GetByID(id)
	if err != nil {
		return ErrScheduledTaskNotFound
	}

	// 验证所有权
	if task.UserID != userID {
		return ErrUnauthorized
	}

	// TODO: 这里应该调用实际的任务执行逻辑
	// 现在只更新最后运行时间
	now := time.Now()
	updates := map[string]interface{}{
		"last_run_at": now,
		"run_count":   task.RunCount + 1,
	}

	return s.repo.Update(id, updates)
}
