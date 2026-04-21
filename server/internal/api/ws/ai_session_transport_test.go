package ws_test

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	restapi "github.com/easyssh/server/internal/api/rest"
	wsapi "github.com/easyssh/server/internal/api/ws"
	"github.com/easyssh/server/internal/domain/aichat/provider"
	"github.com/easyssh/server/internal/domain/aichat/registry"
	"github.com/easyssh/server/internal/domain/aichat/runtime"
	"github.com/easyssh/server/internal/domain/security"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/require"
)

type transportFakeResolver struct {
	config provider.Config
}

func (r transportFakeResolver) Resolve(ctx context.Context, userID uuid.UUID) (provider.Config, error) {
	return r.config, nil
}

type transportFakeTurnScript struct {
	deltas []string
	result provider.TurnResult
	err    error
}

type transportFakeTurnRunner struct {
	mu      sync.Mutex
	scripts []transportFakeTurnScript
	calls   []provider.TurnRequest
}

func (r *transportFakeTurnRunner) StreamTurn(ctx context.Context, config provider.Config, req provider.TurnRequest, onEvent func(provider.Event) error) (provider.TurnResult, error) {
	r.mu.Lock()
	index := len(r.calls)
	if index >= len(r.scripts) {
		r.mu.Unlock()
		return provider.TurnResult{}, errors.New("unexpected StreamTurn call")
	}
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

type transportFakeSecurityService struct{}

func (transportFakeSecurityService) Get(ctx context.Context) (*security.SecurityConfig, error) {
	return &security.SecurityConfig{}, nil
}

func (transportFakeSecurityService) Save(ctx context.Context, config *security.SecurityConfig) error {
	return nil
}

func (transportFakeSecurityService) GetCORSConfig(ctx context.Context) (*security.CORSConfig, error) {
	return security.DefaultCORSConfig(), nil
}

func (transportFakeSecurityService) GetCookieConfig(ctx context.Context) (*security.CookieConfig, error) {
	return security.DefaultCookieConfig(), nil
}

func (transportFakeSecurityService) GetAllConfigs(ctx context.Context) (*security.CORSConfig, *security.CookieConfig, error) {
	return security.DefaultCORSConfig(), security.DefaultCookieConfig(), nil
}

func (transportFakeSecurityService) GetRateLimitConfig(ctx context.Context) (*security.RateLimitConfig, error) {
	return &security.RateLimitConfig{}, nil
}

func (transportFakeSecurityService) GetAccountLockConfig(ctx context.Context) (*security.AccountLockConfig, error) {
	return security.DefaultAccountLockConfig(), nil
}

func (transportFakeSecurityService) CheckIPAllowed(ctx context.Context, ip string) (bool, error) {
	return true, nil
}

func (transportFakeSecurityService) CheckIPAllowedWithConfig(config *security.SecurityConfig, ip string) bool {
	return true
}

func newTransportTestServer(userID uuid.UUID, manager *runtime.Manager) *httptest.Server {
	gin.SetMode(gin.TestMode)

	restHandler := restapi.NewAISessionHandler(manager)
	wsHandler := wsapi.NewAISessionHandler(manager, transportFakeSecurityService{})

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", userID.String())
	})
	router.POST("/sessions", restHandler.CreateSession)
	router.POST("/sessions/:session_id/messages", restHandler.SendMessage)
	router.GET("/sessions/:session_id/events", restHandler.StreamEvents)
	router.POST("/sessions/:session_id/tasks/:task_id/confirm", restHandler.ConfirmTask)
	router.DELETE("/sessions/:session_id", restHandler.CloseSession)
	router.GET("/sessions/:session_id/ws", wsHandler.HandleSession)

	return httptest.NewServer(router)
}

func createTransportSession(t *testing.T, baseURL string) string {
	t.Helper()

	body, err := json.Marshal(map[string]interface{}{
		"permission_mode": "balanced",
	})
	require.NoError(t, err)

	resp, err := http.Post(baseURL+"/sessions", "application/json", bytes.NewReader(body))
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	var payload struct {
		Data restapi.CreateAISessionResponse `json:"data"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&payload))
	require.NotEmpty(t, payload.Data.SessionID)
	return payload.Data.SessionID
}

func postTransportJSON(t *testing.T, url string, body interface{}) *http.Response {
	t.Helper()

	requestBody, err := json.Marshal(body)
	require.NoError(t, err)

	resp, err := http.Post(url, "application/json", bytes.NewReader(requestBody))
	require.NoError(t, err)
	return resp
}

func openSSEEvents(t *testing.T, baseURL, sessionID string) (<-chan runtime.Event, context.CancelFunc) {
	t.Helper()

	ctx, cancel := context.WithCancel(context.Background())
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/sessions/%s/events", baseURL, sessionID), nil)
	require.NoError(t, err)

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	events := make(chan runtime.Event, 32)
	go func() {
		defer close(events)
		defer resp.Body.Close()

		scanner := bufio.NewScanner(resp.Body)
		scanner.Buffer(make([]byte, 0, 1024), 1024*1024)

		var payload strings.Builder
		for scanner.Scan() {
			line := scanner.Text()
			if strings.HasPrefix(line, "data: ") {
				payload.WriteString(line[6:])
				continue
			}
			if line != "" || payload.Len() == 0 {
				continue
			}

			var event runtime.Event
			if err := json.Unmarshal([]byte(payload.String()), &event); err == nil {
				events <- event
			}
			payload.Reset()
		}
	}()

	return events, cancel
}

func waitTransportEvent(t *testing.T, events <-chan runtime.Event) runtime.Event {
	t.Helper()

	select {
	case event, ok := <-events:
		require.True(t, ok, "event stream closed unexpectedly")
		return event
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for transport event")
		return runtime.Event{}
	}
}

func normalizeTransportEvent(event runtime.Event) string {
	switch event.Type {
	case runtime.EventSessionStarted:
		return fmt.Sprintf("%s:%s", event.Type, event.Session.Status)
	case runtime.EventAssistantDelta:
		return fmt.Sprintf("%s:%s", event.Type, event.Assistant.Delta)
	case runtime.EventAssistantCompleted:
		return fmt.Sprintf("%s:%s", event.Type, event.Assistant.Content)
	case runtime.EventTaskCreated, runtime.EventTaskUpdated:
		return fmt.Sprintf("%s:%s:%s", event.Type, event.Task.ToolName, event.Task.Status)
	case runtime.EventConfirmationRequested:
		return fmt.Sprintf("%s:%s", event.Type, event.Confirmation.Status)
	case runtime.EventConfirmationResolved:
		return fmt.Sprintf("%s:%s", event.Type, event.Confirmation.Decision)
	case runtime.EventSessionCompleted:
		return fmt.Sprintf("%s:%s", event.Type, event.Session.Status)
	case runtime.EventError:
		return fmt.Sprintf("%s:%s", event.Type, event.Error.Code)
	default:
		return string(event.Type)
	}
}

func collectSSESequence(t *testing.T, baseURL, sessionID string, message string, confirm bool) []string {
	t.Helper()

	events, cancel := openSSEEvents(t, baseURL, sessionID)
	defer cancel()

	first := waitTransportEvent(t, events)
	require.Equal(t, runtime.EventSessionStarted, first.Type)

	seq := []string{normalizeTransportEvent(first)}

	resp := postTransportJSON(t, fmt.Sprintf("%s/sessions/%s/messages", baseURL, sessionID), map[string]interface{}{
		"content": message,
	})
	defer resp.Body.Close()
	require.Equal(t, http.StatusAccepted, resp.StatusCode)

	for {
		event := waitTransportEvent(t, events)
		seq = append(seq, normalizeTransportEvent(event))

		if event.Type == runtime.EventConfirmationRequested && confirm {
			confirmResp := postTransportJSON(t, fmt.Sprintf("%s/sessions/%s/tasks/%s/confirm", baseURL, sessionID, event.Confirmation.TaskID), map[string]interface{}{
				"decision": "confirm",
			})
			confirmResp.Body.Close()
			require.Equal(t, http.StatusAccepted, confirmResp.StatusCode)
		}

		if event.Type == runtime.EventSessionCompleted {
			return seq
		}
	}
}

func collectWSSequence(t *testing.T, baseURL, sessionID string, message string, confirm bool) []string {
	t.Helper()

	wsURL := "ws" + strings.TrimPrefix(baseURL, "http") + fmt.Sprintf("/sessions/%s/ws", sessionID)
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	require.NoError(t, err)
	defer conn.Close()

	var first runtime.Event
	require.NoError(t, conn.ReadJSON(&first))
	require.Equal(t, runtime.EventSessionStarted, first.Type)

	seq := []string{normalizeTransportEvent(first)}

	require.NoError(t, conn.WriteJSON(map[string]interface{}{
		"type":    "user.message",
		"content": message,
	}))

	for {
		var event runtime.Event
		require.NoError(t, conn.ReadJSON(&event))
		seq = append(seq, normalizeTransportEvent(event))

		if event.Type == runtime.EventConfirmationRequested && confirm {
			require.NoError(t, conn.WriteJSON(map[string]interface{}{
				"type":     "task.confirm",
				"task_id":  event.Confirmation.TaskID,
				"decision": "confirm",
			}))
		}

		if event.Type == runtime.EventSessionCompleted {
			return seq
		}
	}
}

func TestAISessionTransportsProduceEquivalentSafeTaskSequence(t *testing.T) {
	userID := uuid.New()
	scripts := []transportFakeTurnScript{
		{
			deltas: []string{"正在检查服务器"},
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
			deltas: []string{"检查完成"},
			result: provider.TurnResult{
				Content: "服务器状态正常。",
			},
		},
	}

	buildManager := func() *runtime.Manager {
		return runtime.NewManager(
			transportFakeResolver{config: provider.Config{Model: "fake-model"}},
			&transportFakeTurnRunner{scripts: scripts},
			registry.NewToolRegistry([]registry.ToolSpec{
				{
					Name:            "list_servers",
					Description:     "列出服务器",
					ConfirmStrategy: registry.ConfirmNone,
					Executor: func(ctx context.Context, userID uuid.UUID, args json.RawMessage) (registry.ExecutionResult, error) {
						return registry.ExecutionResult{Content: "srv-1,srv-2"}, nil
					},
				},
			}),
			time.Minute,
		)
	}

	sseServer := newTransportTestServer(userID, buildManager())
	defer sseServer.Close()
	sseSessionID := createTransportSession(t, sseServer.URL)
	sseSeq := collectSSESequence(t, sseServer.URL, sseSessionID, "检查服务器", false)

	wsServer := newTransportTestServer(userID, buildManager())
	defer wsServer.Close()
	wsSessionID := createTransportSession(t, wsServer.URL)
	wsSeq := collectWSSequence(t, wsServer.URL, wsSessionID, "检查服务器", false)

	require.Equal(t, []string{
		"session.started:idle",
		"assistant.delta:正在检查服务器",
		"assistant.completed:",
		"task.created:list_servers:queued",
		"task.updated:list_servers:running",
		"task.updated:list_servers:succeeded",
		"assistant.delta:检查完成",
		"assistant.completed:服务器状态正常。",
		"session.completed:idle",
	}, sseSeq)
	require.Equal(t, sseSeq, wsSeq)
}

func TestAISessionTransportsProduceEquivalentConfirmationSequence(t *testing.T) {
	userID := uuid.New()
	scripts := []transportFakeTurnScript{
		{
			deltas: []string{"准备执行命令"},
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
			deltas: []string{"执行完成"},
			result: provider.TurnResult{
				Content: "命令执行完成，负载正常。",
			},
		},
	}

	buildManager := func() *runtime.Manager {
		return runtime.NewManager(
			transportFakeResolver{config: provider.Config{Model: "fake-model"}},
			&transportFakeTurnRunner{scripts: scripts},
			registry.NewToolRegistry([]registry.ToolSpec{
				{
					Name:            "execute_command",
					Description:     "执行命令",
					Dangerous:       true,
					ConfirmStrategy: registry.ConfirmUser,
					SupportedModes:  []string{"balanced", "privileged"},
					Executor: func(ctx context.Context, userID uuid.UUID, args json.RawMessage) (registry.ExecutionResult, error) {
						return registry.ExecutionResult{Content: "load average: 0.12 0.18 0.21"}, nil
					},
				},
			}),
			time.Minute,
		)
	}

	sseServer := newTransportTestServer(userID, buildManager())
	defer sseServer.Close()
	sseSessionID := createTransportSession(t, sseServer.URL)
	sseSeq := collectSSESequence(t, sseServer.URL, sseSessionID, "执行 uptime", true)

	wsServer := newTransportTestServer(userID, buildManager())
	defer wsServer.Close()
	wsSessionID := createTransportSession(t, wsServer.URL)
	wsSeq := collectWSSequence(t, wsServer.URL, wsSessionID, "执行 uptime", true)

	require.Equal(t, []string{
		"session.started:idle",
		"assistant.delta:准备执行命令",
		"assistant.completed:",
		"task.created:execute_command:queued",
		"task.updated:execute_command:waiting_confirm",
		"confirmation.requested:waiting_confirm",
		"confirmation.resolved:confirm",
		"task.updated:execute_command:running",
		"task.updated:execute_command:succeeded",
		"assistant.delta:执行完成",
		"assistant.completed:命令执行完成，负载正常。",
		"session.completed:idle",
	}, sseSeq)
	require.Equal(t, sseSeq, wsSeq)
}
