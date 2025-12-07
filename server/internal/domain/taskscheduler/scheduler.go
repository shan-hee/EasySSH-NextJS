package taskscheduler

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/easyssh/server/internal/domain/scheduledtask"
	"github.com/easyssh/server/internal/domain/taskexecutor"
	"github.com/google/uuid"
	"github.com/robfig/cron/v3"
)

// Scheduler 定时任务调度器
type Scheduler struct {
	cron        *cron.Cron
	taskRepo    scheduledtask.Repository
	executor    *taskexecutor.Executor
	taskEntries map[uuid.UUID]cron.EntryID
	mu          sync.RWMutex
	ctx         context.Context
	cancel      context.CancelFunc
	started     bool
}

// NewScheduler 创建调度器
func NewScheduler(
	taskRepo scheduledtask.Repository,
	executor *taskexecutor.Executor,
) *Scheduler {
	ctx, cancel := context.WithCancel(context.Background())

	// 创建 cron 调度器（标准5字段格式: 分 时 日 月 周）
	c := cron.New(cron.WithParser(cron.NewParser(
		cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow,
	)))

	return &Scheduler{
		cron:        c,
		taskRepo:    taskRepo,
		executor:    executor,
		taskEntries: make(map[uuid.UUID]cron.EntryID),
		ctx:         ctx,
		cancel:      cancel,
		started:     false,
	}
}

// Start 启动调度器
func (s *Scheduler) Start() error {
	log.Println("[TaskScheduler] 启动定时任务调度器...")

	// 加载所有启用的任务
	tasks, err := s.taskRepo.GetEnabledTasks()
	if err != nil {
		return fmt.Errorf("failed to load enabled tasks: %w", err)
	}

	log.Printf("[TaskScheduler] 加载了 %d 个启用的定时任务", len(tasks))

	// 添加所有任务到调度器
	for _, task := range tasks {
		taskCopy := task // 避免闭包问题
		if err := s.addTask(&taskCopy); err != nil {
			log.Printf("[TaskScheduler] 添加任务失败: taskID=%s, name=%s, error=%v",
				task.ID, task.TaskName, err)
			continue
		}
	}

	// 启动 cron 调度器
	s.cron.Start()
	s.started = true
	log.Println("[TaskScheduler] 调度器已启动")

	return nil
}

// Stop 停止调度器
func (s *Scheduler) Stop() {
	log.Println("[TaskScheduler] 停止定时任务调度器...")
	s.cancel()

	if s.cron != nil {
		// 等待所有任务完成，最多等待30秒
		ctx := s.cron.Stop()
		select {
		case <-ctx.Done():
			log.Println("[TaskScheduler] 所有任务已完成")
		case <-time.After(30 * time.Second):
			log.Println("[TaskScheduler] 等待超时，强制停止")
		}
	}
	s.started = false
}

// addTask 添加任务到调度器（内部方法）
func (s *Scheduler) addTask(task *scheduledtask.ScheduledTask) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 如果已存在，先移除
	if entryID, exists := s.taskEntries[task.ID]; exists {
		s.cron.Remove(entryID)
		delete(s.taskEntries, task.ID)
	}

	// 加载时区
	loc, err := time.LoadLocation(task.Timezone)
	if err != nil {
		log.Printf("[TaskScheduler] 无法加载时区 %s，使用UTC: %v", task.Timezone, err)
		loc = time.UTC
	}

	// 创建任务执行函数
	taskID := task.ID
	entryID, err := s.cron.AddFunc(task.CronExpression, func() {
		s.executeTask(taskID)
	})
	if err != nil {
		return fmt.Errorf("failed to add cron job: %w", err)
	}

	s.taskEntries[task.ID] = entryID

	// 计算并更新下次运行时间
	entry := s.cron.Entry(entryID)
	nextRun := entry.Next.In(loc)
	if err := s.taskRepo.Update(task.ID, map[string]interface{}{
		"next_run_at": nextRun,
	}); err != nil {
		log.Printf("[TaskScheduler] 更新下次运行时间失败: %v", err)
	}

	log.Printf("[TaskScheduler] 任务已添加: taskID=%s, name=%s, cron=%s, nextRun=%s",
		task.ID, task.TaskName, task.CronExpression, nextRun.Format(time.RFC3339))

	return nil
}

// executeTask 执行任务
func (s *Scheduler) executeTask(taskID uuid.UUID) {
	log.Printf("[TaskScheduler] 触发任务执行: taskID=%s", taskID)

	// 获取最新的任务配置
	task, err := s.taskRepo.GetByID(taskID)
	if err != nil {
		log.Printf("[TaskScheduler] 获取任务失败: taskID=%s, error=%v", taskID, err)
		return
	}

	// 检查任务是否仍然启用
	if !task.Enabled {
		log.Printf("[TaskScheduler] 任务已禁用，跳过执行: taskID=%s", taskID)
		return
	}

	// 更新下次运行时间
	s.updateNextRunTime(taskID)

	// 调用执行引擎（异步执行）
	go s.executor.Execute(s.ctx, task, taskexecutor.TriggerSchedule)
}

// updateNextRunTime 更新下次运行时间
func (s *Scheduler) updateNextRunTime(taskID uuid.UUID) {
	s.mu.RLock()
	entryID, exists := s.taskEntries[taskID]
	s.mu.RUnlock()

	if !exists {
		return
	}

	entry := s.cron.Entry(entryID)
	if entry.ID == 0 {
		return
	}

	task, err := s.taskRepo.GetByID(taskID)
	if err != nil {
		return
	}

	loc, _ := time.LoadLocation(task.Timezone)
	if loc == nil {
		loc = time.UTC
	}

	nextRun := entry.Next.In(loc)
	s.taskRepo.Update(taskID, map[string]interface{}{
		"next_run_at": nextRun,
	})
}

// AddTask 动态添加任务（外部调用）
func (s *Scheduler) AddTask(task *scheduledtask.ScheduledTask) error {
	if !task.Enabled {
		return nil
	}
	if !s.started {
		return nil // 调度器未启动，不添加
	}
	return s.addTask(task)
}

// RemoveTask 移除任务
func (s *Scheduler) RemoveTask(taskID uuid.UUID) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if entryID, exists := s.taskEntries[taskID]; exists {
		s.cron.Remove(entryID)
		delete(s.taskEntries, taskID)
		log.Printf("[TaskScheduler] 任务已移除: taskID=%s", taskID)
	}
}

// UpdateTask 更新任务（移除后重新添加）
func (s *Scheduler) UpdateTask(task *scheduledtask.ScheduledTask) error {
	s.RemoveTask(task.ID)
	if task.Enabled && s.started {
		return s.addTask(task)
	}
	return nil
}

// TriggerTaskManually 手动触发任务
func (s *Scheduler) TriggerTaskManually(taskID uuid.UUID) error {
	task, err := s.taskRepo.GetByID(taskID)
	if err != nil {
		return fmt.Errorf("task not found: %w", err)
	}

	// 异步执行
	go s.executor.Execute(s.ctx, task, taskexecutor.TriggerManual)

	return nil
}

// GetTaskStatus 获取任务调度状态
func (s *Scheduler) GetTaskStatus(taskID uuid.UUID) (nextRun time.Time, isScheduled bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	entryID, exists := s.taskEntries[taskID]
	if !exists {
		return time.Time{}, false
	}

	entry := s.cron.Entry(entryID)
	return entry.Next, true
}

// GetScheduledTaskCount 获取已调度的任务数量
func (s *Scheduler) GetScheduledTaskCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.taskEntries)
}

// IsStarted 检查调度器是否已启动
func (s *Scheduler) IsStarted() bool {
	return s.started
}
