package taskexecutor

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/easyssh/server/internal/domain/operationrecord"
	"github.com/easyssh/server/internal/domain/scheduledtask"
	"github.com/easyssh/server/internal/domain/script"
	"github.com/easyssh/server/internal/domain/server"
	"github.com/easyssh/server/internal/domain/ssh"
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

type executionStatus string

const (
	executionStatusPending  executionStatus = "pending"
	executionStatusRunning  executionStatus = "running"
	executionStatusSuccess  executionStatus = "success"
	executionStatusFailed   executionStatus = "failed"
	executionStatusPartial  executionStatus = "partial"
	executionStatusTimeout  executionStatus = "timeout"
	executionStatusCanceled executionStatus = "canceled"
)

// Executor 任务执行引擎
type Executor struct {
	serverService    server.Service
	scriptService    script.Service
	taskRepo         scheduledtask.Repository
	operationRecords operationrecord.Service
	encryptor        *crypto.Encryptor
	hostKeyCallback  gossh.HostKeyCallback
	maxConcurrency   int
}

// NewExecutor 创建执行引擎
func NewExecutor(
	serverService server.Service,
	scriptService script.Service,
	taskRepo scheduledtask.Repository,
	encryptor *crypto.Encryptor,
	maxConcurrency int,
	operationRecords operationrecord.Service,
) *Executor {
	if maxConcurrency <= 0 {
		maxConcurrency = 10
	}
	executor := &Executor{
		serverService:    serverService,
		scriptService:    scriptService,
		taskRepo:         taskRepo,
		encryptor:        encryptor,
		maxConcurrency:   maxConcurrency,
		operationRecords: operationRecords,
	}
	return executor
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
	executionID := uuid.New()

	record := taskExecutionRecord{
		ID:              executionID,
		ScheduledTaskID: task.ID,
		UserID:          task.UserID,
		TaskName:        task.TaskName,
		TaskType:        task.TaskType,
		TriggerType:     trigger,
		Command:         task.Command,
		Status:          executionStatusRunning,
		TotalServers:    len(task.ServerIDs),
		StartTime:       startTime,
	}
	e.upsertOperationRecord(record)

	// 根据任务类型获取要执行的命令
	command, err := e.resolveCommand(ctx, task)
	if err != nil {
		log.Printf("[TaskExecutor] 解析命令失败: %v", err)
		e.completeExecution(&record, executionStatusFailed, err.Error(), 0, 0, nil)
		e.updateTaskStatus(task.ID, "failed")
		return
	}
	record.Command = command
	e.upsertOperationRecord(record)

	// 并发执行到所有服务器
	results := e.executeOnServers(ctx, task.UserID, task.ServerIDs, command)

	// 统计结果
	successCount := 0
	failedCount := 0

	for _, result := range results {
		if result.Status == executionStatusSuccess {
			successCount++
		} else {
			failedCount++
		}
	}

	// 确定最终状态
	var finalStatus executionStatus
	if failedCount == 0 && successCount > 0 {
		finalStatus = executionStatusSuccess
	} else if successCount == 0 {
		finalStatus = executionStatusFailed
	} else {
		finalStatus = executionStatusPartial
	}

	// 完成执行记录
	e.completeExecution(&record, finalStatus, "", successCount, failedCount, results)

	// 更新任务状态
	taskStatus := "success"
	if finalStatus != executionStatusSuccess {
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
	Status       executionStatus
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
		Status:    executionStatusFailed,
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
		result.Status = executionStatusFailed
	} else {
		exitCode := 0
		result.ExitCode = &exitCode
		result.Status = executionStatusSuccess
	}

	return result
}

// completeExecution 完成执行记录
func (e *Executor) completeExecution(
	execution *taskExecutionRecord,
	status executionStatus,
	errorMsg string,
	successCount, failedCount int,
	serverResults []ServerExecutionResult,
) {
	endTime := time.Now()
	duration := endTime.Sub(execution.StartTime).Milliseconds()
	execution.Status = status
	execution.EndTime = &endTime
	execution.Duration = duration
	execution.SuccessCount = successCount
	execution.FailedCount = failedCount
	execution.ErrorMessage = errorMsg
	execution.ServerResults = serverResults
	e.upsertOperationRecord(*execution)
}

type taskExecutionRecord struct {
	ID              uuid.UUID
	ScheduledTaskID uuid.UUID
	UserID          uuid.UUID
	TaskName        string
	TaskType        string
	TriggerType     TriggerType
	Command         string
	Status          executionStatus
	TotalServers    int
	SuccessCount    int
	FailedCount     int
	StartTime       time.Time
	EndTime         *time.Time
	Duration        int64
	ErrorMessage    string
	ServerResults   []ServerExecutionResult
}

func (e *Executor) upsertOperationRecord(execution taskExecutionRecord) {
	if e.operationRecords == nil || execution.UserID == uuid.Nil || execution.ID == uuid.Nil {
		return
	}

	status := operationrecord.StatusRunning
	switch execution.Status {
	case executionStatusPending:
		status = operationrecord.StatusPending
	case executionStatusSuccess:
		status = operationrecord.StatusSuccess
	case executionStatusFailed:
		status = operationrecord.StatusFailure
	case executionStatusPartial:
		status = operationrecord.StatusPartial
	case executionStatusTimeout:
		status = operationrecord.StatusTimeout
	case executionStatusCanceled:
		status = operationrecord.StatusCanceled
	}
	detail, _ := json.Marshal(map[string]interface{}{
		"scheduled_task_id": execution.ScheduledTaskID,
		"task_type":         execution.TaskType,
		"trigger_type":      execution.TriggerType,
		"server_results":    execution.ServerResults,
	})
	now := time.Now()

	record := &operationrecord.OperationRecord{
		UserID:       execution.UserID,
		Type:         operationrecord.TypeExecution,
		Action:       "task_execute",
		Status:       status,
		Title:        execution.TaskName,
		Resource:     execution.Command,
		Source:       string(execution.TriggerType),
		StartedAt:    &execution.StartTime,
		FinishedAt:   execution.EndTime,
		DurationMs:   execution.Duration,
		TotalCount:   execution.TotalServers,
		SuccessCount: execution.SuccessCount,
		FailureCount: execution.FailedCount,
		ErrorMessage: execution.ErrorMessage,
		DetailJSON:   string(detail),
		SourceTable:  "task_runs",
		SourceID:     execution.ID.String(),
		CreatedAt:    execution.StartTime,
		UpdatedAt:    now,
	}

	_ = e.operationRecords.Upsert(context.Background(), record)
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
