package runtime

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/easyssh/server/internal/domain/aichat/provider"
	"github.com/easyssh/server/internal/domain/aichat/registry"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

type fakeResolver struct {
	config provider.Config
}

func (r fakeResolver) Resolve(ctx context.Context, userID uuid.UUID) (provider.Config, error) {
	return r.config, nil
}

type fakeTurnScript struct {
	deltas []string
	result provider.TurnResult
	err    error
}

type fakeTurnRunner struct {
	mu      sync.Mutex
	scripts []fakeTurnScript
	calls   []provider.TurnRequest
}

func (r *fakeTurnRunner) StreamTurn(ctx context.Context, config provider.Config, req provider.TurnRequest, onEvent func(provider.Event) error) (provider.TurnResult, error) {
	r.mu.Lock()
	index := len(r.calls)
	r.calls = append(r.calls, req)
	script := r.scripts[index]
	r.mu.Unlock()

	for _, delta := range script.deltas {
		if err := onEvent(provider.Event{
			Type:  provider.EventTextDelta,
			Delta: delta,
		}); err != nil {
			return provider.TurnResult{}, err
		}
	}

	return script.result, script.err
}

func (r *fakeTurnRunner) callCount() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return len(r.calls)
}

func waitForEvent(t *testing.T, events <-chan Event, match func(Event) bool) Event {
	t.Helper()

	timeout := time.After(2 * time.Second)
	for {
		select {
		case evt, ok := <-events:
			require.True(t, ok, "event channel closed before target event")
			if match(evt) {
				return evt
			}
		case <-timeout:
			t.Fatal("timed out waiting for event")
		}
	}
}

func TestManagerAutoExecutesSafeTaskAndCompletesSession(t *testing.T) {
	t.Parallel()

	userID := uuid.New()
	runner := &fakeTurnRunner{
		scripts: []fakeTurnScript{
			{
				deltas: []string{"正在查询"},
				result: provider.TurnResult{
					ToolCalls: []registry.ToolCall{
						{
							ID:        "call-safe-1",
							Name:      "list_servers",
							Arguments: json.RawMessage(`{}`),
						},
					},
				},
			},
			{
				deltas: []string{"已完成分析"},
				result: provider.TurnResult{
					Content: "服务器检查完成。",
				},
			},
		},
	}

	executed := 0
	manager := NewManager(
		fakeResolver{config: provider.Config{Model: "fake-model"}},
		runner,
		registry.NewToolRegistry([]registry.ToolSpec{
			{
				Name:            "list_servers",
				Description:     "列出服务器",
				ConfirmStrategy: registry.ConfirmNone,
				Executor: func(ctx context.Context, userID uuid.UUID, args json.RawMessage) (registry.ExecutionResult, error) {
					executed++
					return registry.ExecutionResult{Content: "共 3 台服务器"}, nil
				},
			},
		}),
		time.Minute,
	)

	session, err := manager.CreateSession(context.Background(), userID, CreateSessionInput{
		PermissionMode: "balanced",
	})
	require.NoError(t, err)

	events, unsubscribe, err := manager.Subscribe(userID, session.ID)
	require.NoError(t, err)
	defer unsubscribe()

	require.NoError(t, manager.SendUserMessage(context.Background(), userID, session.ID, "帮我看一下服务器情况"))

	completed := waitForEvent(t, events, func(evt Event) bool {
		return evt.Type == EventSessionCompleted && evt.Session != nil && evt.Session.Status == SessionStatusIdle && len(evt.Session.Tasks) == 1
	})

	require.Equal(t, 1, executed)
	require.Equal(t, 2, runner.callCount())
	require.Equal(t, SessionStatusIdle, completed.Session.Status)
	require.Len(t, completed.Session.Tasks, 1)
	require.Equal(t, TaskStatusSucceeded, completed.Session.Tasks[0].Status)
	require.Equal(t, "共 3 台服务器", completed.Session.Tasks[0].Result)
	require.Len(t, completed.Session.Messages, 3)
	require.Equal(t, "user", completed.Session.Messages[0].Role)
	require.Equal(t, "assistant", completed.Session.Messages[1].Role)
	require.Equal(t, "正在查询", completed.Session.Messages[1].Content)
	require.Equal(t, "assistant", completed.Session.Messages[2].Role)
	require.Equal(t, "服务器检查完成。", completed.Session.Messages[2].Content)
}

func TestManagerWaitsForConfirmationAndContinuesAfterConfirm(t *testing.T) {
	t.Parallel()

	userID := uuid.New()
	runner := &fakeTurnRunner{
		scripts: []fakeTurnScript{
			{
				result: provider.TurnResult{
					ToolCalls: []registry.ToolCall{
						{
							ID:        "call-danger-1",
							Name:      "execute_command",
							Arguments: json.RawMessage(`{"server_id":"srv-1","command":"uptime"}`),
						},
					},
				},
			},
			{
				result: provider.TurnResult{
					Content: "命令执行完成，负载正常。",
				},
			},
		},
	}

	executed := 0
	manager := NewManager(
		fakeResolver{config: provider.Config{Model: "fake-model"}},
		runner,
		registry.NewToolRegistry([]registry.ToolSpec{
			{
				Name:            "execute_command",
				Description:     "执行命令",
				Dangerous:       true,
				ConfirmStrategy: registry.ConfirmUser,
				Executor: func(ctx context.Context, userID uuid.UUID, args json.RawMessage) (registry.ExecutionResult, error) {
					executed++
					return registry.ExecutionResult{Content: "load average: 0.10 0.20 0.30"}, nil
				},
			},
		}),
		time.Minute,
	)

	session, err := manager.CreateSession(context.Background(), userID, CreateSessionInput{
		PermissionMode: "balanced",
	})
	require.NoError(t, err)

	events, unsubscribe, err := manager.Subscribe(userID, session.ID)
	require.NoError(t, err)
	defer unsubscribe()

	require.NoError(t, manager.SendUserMessage(context.Background(), userID, session.ID, "执行 uptime"))

	confirmation := waitForEvent(t, events, func(evt Event) bool {
		return evt.Type == EventConfirmationRequested && evt.Confirmation != nil
	})

	require.NoError(t, manager.ConfirmTask(
		context.Background(),
		userID,
		session.ID,
		confirmation.Confirmation.TaskID,
		DecisionConfirm,
	))

	completed := waitForEvent(t, events, func(evt Event) bool {
		return evt.Type == EventSessionCompleted && evt.Session != nil && evt.Session.Status == SessionStatusIdle && len(evt.Session.Tasks) == 1
	})

	require.Equal(t, 1, executed)
	require.Equal(t, 2, runner.callCount())
	require.Equal(t, SessionStatusIdle, completed.Session.Status)
	require.Equal(t, TaskStatusSucceeded, completed.Session.Tasks[0].Status)
	require.Equal(t, "load average: 0.10 0.20 0.30", completed.Session.Tasks[0].Result)
	require.Equal(t, "命令执行完成，负载正常。", completed.Session.Messages[len(completed.Session.Messages)-1].Content)
}

func TestManagerContinuesAfterRejectingDangerousTask(t *testing.T) {
	t.Parallel()

	userID := uuid.New()
	runner := &fakeTurnRunner{
		scripts: []fakeTurnScript{
			{
				result: provider.TurnResult{
					ToolCalls: []registry.ToolCall{
						{
							ID:        "call-danger-2",
							Name:      "delete_file",
							Arguments: json.RawMessage(`{"server_id":"srv-1","path":"/tmp/demo.log"}`),
						},
					},
				},
			},
			{
				result: provider.TurnResult{
					Content: "已根据拒绝结果停止删除操作。",
				},
			},
		},
	}

	manager := NewManager(
		fakeResolver{config: provider.Config{Model: "fake-model"}},
		runner,
		registry.NewToolRegistry([]registry.ToolSpec{
			{
				Name:            "delete_file",
				Description:     "删除文件",
				Dangerous:       true,
				ConfirmStrategy: registry.ConfirmUser,
				Executor: func(ctx context.Context, userID uuid.UUID, args json.RawMessage) (registry.ExecutionResult, error) {
					return registry.ExecutionResult{Content: "should not execute"}, nil
				},
			},
		}),
		time.Minute,
	)

	session, err := manager.CreateSession(context.Background(), userID, CreateSessionInput{
		PermissionMode: "balanced",
	})
	require.NoError(t, err)

	events, unsubscribe, err := manager.Subscribe(userID, session.ID)
	require.NoError(t, err)
	defer unsubscribe()

	require.NoError(t, manager.SendUserMessage(context.Background(), userID, session.ID, "删除日志文件"))

	confirmation := waitForEvent(t, events, func(evt Event) bool {
		return evt.Type == EventConfirmationRequested && evt.Confirmation != nil
	})

	require.NoError(t, manager.ConfirmTask(
		context.Background(),
		userID,
		session.ID,
		confirmation.Confirmation.TaskID,
		DecisionReject,
	))

	completed := waitForEvent(t, events, func(evt Event) bool {
		return evt.Type == EventSessionCompleted && evt.Session != nil && evt.Session.Status == SessionStatusIdle && len(evt.Session.Tasks) == 1
	})

	require.Equal(t, 2, runner.callCount())
	require.Equal(t, TaskStatusCancelled, completed.Session.Tasks[0].Status)
	require.Equal(t, "用户已拒绝执行该操作。", completed.Session.Tasks[0].Result)
	require.Equal(t, "已根据拒绝结果停止删除操作。", completed.Session.Messages[len(completed.Session.Messages)-1].Content)
}

func TestManagerMarksTaskFailedWhenToolExecutionFails(t *testing.T) {
	t.Parallel()

	userID := uuid.New()
	runner := &fakeTurnRunner{
		scripts: []fakeTurnScript{
			{
				result: provider.TurnResult{
					ToolCalls: []registry.ToolCall{
						{
							ID:        "call-failed-1",
							Name:      "read_file",
							Arguments: json.RawMessage(`{"server_id":"srv-1","path":"/etc/demo.conf"}`),
						},
					},
				},
			},
			{
				result: provider.TurnResult{
					Content: "读取失败，文件不存在。",
				},
			},
		},
	}

	manager := NewManager(
		fakeResolver{config: provider.Config{Model: "fake-model"}},
		runner,
		registry.NewToolRegistry([]registry.ToolSpec{
			{
				Name:            "read_file",
				Description:     "读取文件",
				ConfirmStrategy: registry.ConfirmNone,
				Executor: func(ctx context.Context, userID uuid.UUID, args json.RawMessage) (registry.ExecutionResult, error) {
					return registry.ExecutionResult{}, errors.New("文件不存在")
				},
			},
		}),
		time.Minute,
	)

	session, err := manager.CreateSession(context.Background(), userID, CreateSessionInput{
		PermissionMode: "balanced",
	})
	require.NoError(t, err)

	events, unsubscribe, err := manager.Subscribe(userID, session.ID)
	require.NoError(t, err)
	defer unsubscribe()

	require.NoError(t, manager.SendUserMessage(context.Background(), userID, session.ID, "读取配置文件"))

	completed := waitForEvent(t, events, func(evt Event) bool {
		return evt.Type == EventSessionCompleted && evt.Session != nil && len(evt.Session.Tasks) == 1
	})

	require.Equal(t, 2, runner.callCount())
	require.Equal(t, TaskStatusFailed, completed.Session.Tasks[0].Status)
	require.Equal(t, "文件不存在", completed.Session.Tasks[0].Error)
	require.Equal(t, "读取失败，文件不存在。", completed.Session.Messages[len(completed.Session.Messages)-1].Content)
}
