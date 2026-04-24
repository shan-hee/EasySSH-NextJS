package rest

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/easyssh/server/internal/domain/aichat/provider"
	"github.com/easyssh/server/internal/domain/aichat/registry"
	"github.com/easyssh/server/internal/domain/aichat/runtime"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

type restFakeResolver struct {
	config provider.Config
}

func (r restFakeResolver) Resolve(ctx context.Context, userID uuid.UUID) (provider.Config, error) {
	return r.config, nil
}

type restFakeTurnScript struct {
	deltas []string
	result provider.TurnResult
	err    error
}

type restFakeTurnRunner struct {
	mu      sync.Mutex
	scripts []restFakeTurnScript
	calls   []provider.TurnRequest
}

func (r *restFakeTurnRunner) StreamTurn(ctx context.Context, config provider.Config, req provider.TurnRequest, onEvent func(provider.Event) error) (provider.TurnResult, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	index := len(r.calls)
	if index >= len(r.scripts) {
		return provider.TurnResult{}, errors.New("unexpected StreamTurn call")
	}

	r.calls = append(r.calls, req)
	script := r.scripts[index]
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

func (r *restFakeTurnRunner) snapshotCalls() []provider.TurnRequest {
	r.mu.Lock()
	defer r.mu.Unlock()

	calls := make([]provider.TurnRequest, len(r.calls))
	copy(calls, r.calls)
	return calls
}

func newTestAISessionRouter(userID uuid.UUID, handler *AISessionHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", userID.String())
	})
	router.GET("/sessions", handler.ListSessions)
	router.GET("/sessions/latest", handler.GetLatestSession)
	router.POST("/sessions", handler.CreateSession)
	router.GET("/sessions/:session_id", handler.GetSession)
	router.PATCH("/sessions/:session_id", handler.RenameSession)
	router.POST("/sessions/:session_id/messages", handler.SendMessage)
	router.POST("/sessions/:session_id/cancel", handler.CancelSession)
	router.POST("/sessions/:session_id/tasks/:task_id/confirm", handler.ConfirmTask)
	router.DELETE("/sessions/:session_id", handler.DeleteSession)
	return router
}

func performJSONRequest(t *testing.T, router http.Handler, method, path string, body interface{}) *httptest.ResponseRecorder {
	t.Helper()

	var requestBody []byte
	if body != nil {
		var err error
		requestBody, err = json.Marshal(body)
		require.NoError(t, err)
	}

	req := httptest.NewRequest(method, path, bytes.NewReader(requestBody))
	req.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	return recorder
}

func waitForRuntimeEvent(t *testing.T, events <-chan runtime.Event, match func(runtime.Event) bool) runtime.Event {
	t.Helper()

	timeout := time.After(2 * time.Second)
	for {
		select {
		case event, ok := <-events:
			require.True(t, ok, "event channel closed before target event")
			if match(event) {
				return event
			}
		case <-timeout:
			t.Fatal("timed out waiting for runtime event")
		}
	}
}

func TestAISessionHandlerCreateSendConfirmAndClose(t *testing.T) {
	userID := uuid.New()
	runner := &restFakeTurnRunner{
		scripts: []restFakeTurnScript{
			{
				deltas: []string{"正在准备执行"},
				result: provider.TurnResult{
					ToolCalls: []registry.ToolCall{
						{
							ID:        "call-1",
							Name:      "execute_command",
							Arguments: json.RawMessage(`{"server_id":"srv-1","command":"uptime"}`),
						},
					},
				},
			},
			{
				result: provider.TurnResult{
					Content: "命令执行完成，系统负载正常。",
				},
			},
		},
	}

	manager := runtime.NewManager(
		restFakeResolver{config: provider.Config{Model: "fake-model"}},
		runner,
		registry.NewToolRegistry([]registry.ToolSpec{
			{
				Name:            "execute_command",
				DisplayName:     "执行命令",
				Description:     "执行命令",
				Dangerous:       true,
				ConfirmStrategy: registry.ConfirmUser,
				SupportedModes:  []string{"balanced", "privileged"},
				Executor: func(ctx context.Context, userID uuid.UUID, args json.RawMessage) (registry.ExecutionResult, error) {
					return registry.ExecutionResult{Content: "load average: 0.12 0.18 0.22"}, nil
				},
			},
		}),
		time.Minute,
	)

	handler := NewAISessionHandler(manager)
	router := newTestAISessionRouter(userID, handler)

	createResp := performJSONRequest(t, router, http.MethodPost, "/sessions", map[string]interface{}{
		"model":           "gpt-test",
		"permission_mode": "balanced",
	})
	require.Equal(t, http.StatusCreated, createResp.Code)

	var created struct {
		Data CreateAISessionResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(createResp.Body.Bytes(), &created))
	require.NotEmpty(t, created.Data.SessionID)
	require.Equal(t, runtime.TransportWS, created.Data.DefaultTransport)

	events, unsubscribe, err := manager.Subscribe(userID, created.Data.SessionID)
	require.NoError(t, err)
	defer unsubscribe()

	waitForRuntimeEvent(t, events, func(event runtime.Event) bool {
		return event.Type == runtime.EventSessionStarted
	})

	sendResp := performJSONRequest(t, router, http.MethodPost, "/sessions/"+created.Data.SessionID+"/messages", map[string]interface{}{
		"content": "执行 uptime",
		"context": "请只返回摘要，不要贴满屏原始输出。",
	})
	require.Equal(t, http.StatusAccepted, sendResp.Code)

	confirmation := waitForRuntimeEvent(t, events, func(event runtime.Event) bool {
		return event.Type == runtime.EventConfirmationRequested && event.Confirmation != nil
	})

	secondSendResp := performJSONRequest(t, router, http.MethodPost, "/sessions/"+created.Data.SessionID+"/messages", map[string]interface{}{
		"content": "再检查一次",
	})
	require.Equal(t, http.StatusConflict, secondSendResp.Code)

	var sendConflict ErrorResponse
	require.NoError(t, json.Unmarshal(secondSendResp.Body.Bytes(), &sendConflict))
	require.Equal(t, "session_conflict", sendConflict.Error)

	confirmResp := performJSONRequest(t, router, http.MethodPost, "/sessions/"+created.Data.SessionID+"/tasks/"+confirmation.Confirmation.TaskID+"/confirm", map[string]interface{}{
		"decision": "confirm",
	})
	require.Equal(t, http.StatusAccepted, confirmResp.Code)

	completed := waitForRuntimeEvent(t, events, func(event runtime.Event) bool {
		return event.Type == runtime.EventSessionCompleted && event.Session != nil
	})

	require.Equal(t, runtime.SessionStatusIdle, completed.Session.Status)
	require.Len(t, completed.Session.Tasks, 1)
	require.Equal(t, runtime.TaskStatusSucceeded, completed.Session.Tasks[0].Status)
	require.Equal(t, "命令执行完成，系统负载正常。", completed.Session.Messages[len(completed.Session.Messages)-1].Content)

	calls := runner.snapshotCalls()
	require.Len(t, calls, 2)
	require.Len(t, calls[0].Messages, 2)
	require.Contains(t, calls[0].Messages[1].Content, "执行 uptime")
	require.Contains(t, calls[0].Messages[1].Content, "请只返回摘要")

	closeResp := performJSONRequest(t, router, http.MethodDelete, "/sessions/"+created.Data.SessionID, nil)
	require.Equal(t, http.StatusNoContent, closeResp.Code)

	_, err = manager.GetSession(userID, created.Data.SessionID)
	require.ErrorIs(t, err, runtime.ErrSessionNotFound)
}

func TestAISessionHandlerReturnsNotFoundForUnknownSession(t *testing.T) {
	userID := uuid.New()
	manager := runtime.NewManager(
		restFakeResolver{config: provider.Config{Model: "fake-model"}},
		nil,
		registry.NewToolRegistry(nil),
		time.Minute,
	)

	handler := NewAISessionHandler(manager)
	router := newTestAISessionRouter(userID, handler)

	resp := performJSONRequest(t, router, http.MethodPost, "/sessions/not-found/messages", map[string]interface{}{
		"content": "hello",
	})
	require.Equal(t, http.StatusNotFound, resp.Code)

	var errorResponse ErrorResponse
	require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &errorResponse))
	require.Equal(t, "session_not_found", errorResponse.Error)
}
