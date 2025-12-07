package taskexecutor

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/easyssh/server/internal/domain/scheduledtask"
	"github.com/easyssh/server/internal/domain/script"
	"github.com/easyssh/server/internal/domain/server"
	"github.com/easyssh/server/internal/domain/ssh"
	"github.com/easyssh/server/internal/domain/taskexecution"
	"github.com/easyssh/server/internal/pkg/crypto"
	"github.com/google/uuid"
	gossh "golang.org/x/crypto/ssh"
)

// TriggerType 触发类型
type TriggerType string

const (
	TriggerSchedule TriggerType = "schedule"
	TriggerManual   TriggerType = "manual"
)

// Executor 任务执行引擎
type Executor struct {
	serverService   server.Service
	scriptService   script.Service
	taskRepo        scheduledtask.Repository
	executionRepo   taskexecution.Repository
	encryptor       *crypto.Encryptor
	hostKeyCallback gossh.HostKeyCallback
	maxConcurrency  int
}

// NewExecutor 创建执行引擎
func NewExecutor(
	serverService server.Service,
	scriptService script.Service,
	taskRepo scheduledtask.Repository,
	executionRepo taskexecution.Repository,
	encryptor *crypto.Encryptor,
	maxConcurrency int,
) *Executor {
	if maxConcurrency <= 0 {
		maxConcurrency = 10
	}
	return &Executor{
		serverService:  serverService,
		scriptService:  scriptService,
		taskRepo:       taskRepo,
		executionRepo:  executionRepo,
		encryptor:      encryptor,
		maxConcurrency: maxConcurrency,
	}
}

// SetHostKeyCallback 设置主机密钥验证回调
func (e *Executor) SetHostKeyCallback(callback gossh.HostKeyCallback) {
	e.hostKeyCallback = callback
}

// Execute 执行任务
func (e *Executor) Execute(ctx context.Context, task *scheduledtask.ScheduledTask, trigger TriggerType) {
	log.Printf("[TaskExecutor] 开始执行任务: taskID=%s, type=%s, trigger=%s",
		task.ID, task.TaskType, trigger)

	startTime := time.Now()

	// 创建执行记录
	execution := &taskexecution.TaskExecution{
		ScheduledTaskID: task.ID,
		UserID:          task.UserID,
		TaskName:        task.TaskName,
		TaskType:        task.TaskType,
		TriggerType:     taskexecution.TriggerType(trigger),
		Command:         task.Command,
		Status:          taskexecution.StatusRunning,
		TotalServers:    len(task.ServerIDs),
		StartTime:       startTime,
	}

	if err := e.executionRepo.Create(execution); err != nil {
		log.Printf("[TaskExecutor] 创建执行记录失败: %v", err)
		return
	}

	// 根据任务类型获取要执行的命令
	command, err := e.resolveCommand(ctx, task)
	if err != nil {
		log.Printf("[TaskExecutor] 解析命令失败: %v", err)
		e.completeExecution(execution, taskexecution.StatusFailed, err.Error(), 0, 0)
		e.updateTaskStatus(task.ID, "failed")
		return
	}
	execution.Command = command

	// 更新执行记录的命令
	e.executionRepo.Update(execution.ID, map[string]interface{}{
		"command": command,
	})

	// 并发执行到所有服务器
	results := e.executeOnServers(ctx, task.UserID, task.ServerIDs, command)

	// 统计结果
	successCount := 0
	failedCount := 0
	var serverResults []taskexecution.TaskExecutionServer

	for _, result := range results {
		serverResult := taskexecution.TaskExecutionServer{
			ExecutionID:  execution.ID,
			ServerID:     result.ServerID,
			ServerName:   result.ServerName,
			ServerHost:   result.ServerHost,
			Status:       result.Status,
			ExitCode:     result.ExitCode,
			Output:       result.Output,
			ErrorMessage: result.ErrorMessage,
			StartTime:    result.StartTime,
			EndTime:      result.EndTime,
			Duration:     result.Duration,
		}
		serverResults = append(serverResults, serverResult)

		if result.Status == taskexecution.StatusSuccess {
			successCount++
		} else {
			failedCount++
		}
	}

	// 保存服务器执行结果
	for _, sr := range serverResults {
		if err := e.executionRepo.CreateServerResult(&sr); err != nil {
			log.Printf("[TaskExecutor] 保存服务器执行结果失败: %v", err)
		}
	}

	// 确定最终状态
	var finalStatus taskexecution.ExecutionStatus
	if failedCount == 0 && successCount > 0 {
		finalStatus = taskexecution.StatusSuccess
	} else if successCount == 0 {
		finalStatus = taskexecution.StatusFailed
	} else {
		finalStatus = taskexecution.StatusPartial
	}

	// 完成执行记录
	e.completeExecution(execution, finalStatus, "", successCount, failedCount)

	// 更新任务状态
	taskStatus := "success"
	if finalStatus != taskexecution.StatusSuccess {
		taskStatus = "failed"
	}
	e.updateTaskStatus(task.ID, taskStatus)

	log.Printf("[TaskExecutor] 任务执行完成: taskID=%s, status=%s, success=%d, failed=%d",
		task.ID, finalStatus, successCount, failedCount)
}

// ServerExecutionResult 服务器执行结果
type ServerExecutionResult struct {
	ServerID     uuid.UUID
	ServerName   string
	ServerHost   string
	Status       taskexecution.ExecutionStatus
	ExitCode     *int
	Output       string
	ErrorMessage string
	StartTime    time.Time
	EndTime      *time.Time
	Duration     int64
}

// resolveCommand 解析要执行的命令
func (e *Executor) resolveCommand(ctx context.Context, task *scheduledtask.ScheduledTask) (string, error) {
	switch task.TaskType {
	case "command":
		if task.Command == "" {
			return "", fmt.Errorf("command is empty")
		}
		return task.Command, nil

	case "script":
		if task.ScriptID == nil {
			return "", fmt.Errorf("script_id is required for script type")
		}
		scriptObj, err := e.scriptService.GetScript(task.UserID, *task.ScriptID)
		if err != nil {
			return "", fmt.Errorf("failed to get script: %w", err)
		}
		return scriptObj.Content, nil

	case "batch":
		// 批量任务暂不支持，使用命令模式
		if task.Command == "" {
			return "", fmt.Errorf("command is empty for batch type")
		}
		return task.Command, nil

	default:
		return "", fmt.Errorf("unknown task type: %s", task.TaskType)
	}
}

// executeOnServers 并发执行到多个服务器
func (e *Executor) executeOnServers(
	ctx context.Context,
	userID uuid.UUID,
	serverIDs []string,
	command string,
) []ServerExecutionResult {
	if len(serverIDs) == 0 {
		return nil
	}

	results := make([]ServerExecutionResult, len(serverIDs))

	// 使用信号量控制并发
	sem := make(chan struct{}, e.maxConcurrency)
	var wg sync.WaitGroup
	var mu sync.Mutex

	for i, serverIDStr := range serverIDs {
		wg.Add(1)
		go func(index int, sidStr string) {
			defer wg.Done()

			// 获取信号量
			sem <- struct{}{}
			defer func() { <-sem }()

			result := e.executeOnSingleServer(ctx, userID, sidStr, command)

			mu.Lock()
			results[index] = result
			mu.Unlock()
		}(i, serverIDStr)
	}

	wg.Wait()
	return results
}

// executeOnSingleServer 在单个服务器上执行命令
func (e *Executor) executeOnSingleServer(
	ctx context.Context,
	userID uuid.UUID,
	serverIDStr string,
	command string,
) ServerExecutionResult {
	startTime := time.Now()
	result := ServerExecutionResult{
		StartTime: startTime,
		Status:    taskexecution.StatusFailed,
	}

	// 解析服务器ID
	serverID, err := uuid.Parse(serverIDStr)
	if err != nil {
		result.ErrorMessage = fmt.Sprintf("invalid server id: %v", err)
		endTime := time.Now()
		result.EndTime = &endTime
		result.Duration = endTime.Sub(startTime).Milliseconds()
		return result
	}
	result.ServerID = serverID

	// 获取服务器信息
	srv, err := e.serverService.GetByID(ctx, userID, serverID)
	if err != nil {
		result.ErrorMessage = fmt.Sprintf("failed to get server: %v", err)
		endTime := time.Now()
		result.EndTime = &endTime
		result.Duration = endTime.Sub(startTime).Milliseconds()
		return result
	}
	result.ServerName = srv.Name
	result.ServerHost = fmt.Sprintf("%s:%d", srv.Host, srv.Port)

	// 创建SSH客户端
	client, err := ssh.NewClient(srv, e.encryptor, e.hostKeyCallback)
	if err != nil {
		result.ErrorMessage = fmt.Sprintf("failed to create ssh client: %v", err)
		endTime := time.Now()
		result.EndTime = &endTime
		result.Duration = endTime.Sub(startTime).Milliseconds()
		return result
	}
	defer client.Close()

	// 连接服务器
	if err := client.Connect(srv.Host, srv.Port); err != nil {
		result.ErrorMessage = fmt.Sprintf("failed to connect: %v", err)
		endTime := time.Now()
		result.EndTime = &endTime
		result.Duration = endTime.Sub(startTime).Milliseconds()
		return result
	}

	// 执行命令
	output, err := client.ExecuteCommand(command)
	endTime := time.Now()
	result.EndTime = &endTime
	result.Duration = endTime.Sub(startTime).Milliseconds()
	result.Output = output

	if err != nil {
		result.ErrorMessage = err.Error()
		// 尝试从错误中提取退出码
		exitCode := 1
		result.ExitCode = &exitCode
		result.Status = taskexecution.StatusFailed
	} else {
		exitCode := 0
		result.ExitCode = &exitCode
		result.Status = taskexecution.StatusSuccess
	}

	return result
}

// completeExecution 完成执行记录
func (e *Executor) completeExecution(
	execution *taskexecution.TaskExecution,
	status taskexecution.ExecutionStatus,
	errorMsg string,
	successCount, failedCount int,
) {
	endTime := time.Now()
	duration := endTime.Sub(execution.StartTime).Milliseconds()

	updates := map[string]interface{}{
		"status":        status,
		"end_time":      endTime,
		"duration":      duration,
		"success_count": successCount,
		"failed_count":  failedCount,
	}

	if errorMsg != "" {
		updates["error_message"] = errorMsg
	}

	if err := e.executionRepo.Update(execution.ID, updates); err != nil {
		log.Printf("[TaskExecutor] 更新执行记录失败: %v", err)
	}
}

// updateTaskStatus 更新任务状态
func (e *Executor) updateTaskStatus(taskID uuid.UUID, status string) {
	now := time.Now()

	// 获取当前任务
	task, err := e.taskRepo.GetByID(taskID)
	if err != nil {
		log.Printf("[TaskExecutor] 获取任务失败: %v", err)
		return
	}

	updates := map[string]interface{}{
		"last_run_at": now,
		"last_status": status,
		"run_count":   task.RunCount + 1,
	}

	if status == "failed" {
		updates["failure_count"] = task.FailureCount + 1
	}

	if err := e.taskRepo.Update(taskID, updates); err != nil {
		log.Printf("[TaskExecutor] 更新任务状态失败: %v", err)
	}
}
