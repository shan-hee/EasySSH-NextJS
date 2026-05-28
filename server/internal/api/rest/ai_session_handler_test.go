package rest

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
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
	router.POST("/sessions/:session_id/chat", handler.Chat)
	router.POST("/sessions/:session_id/cancel", handler.CancelSession)
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

func parseSSEChunks(t *testing.T, recorder *httptest.ResponseRecorder) []map[string]interface{} {
	t.Helper()

	chunks := make([]map[string]interface{}, 0)
	for _, block := range strings.Split(recorder.Body.String(), "\n\n") {
		block = strings.TrimSpace(block)
		if block == "" {
			continue
		}

		for _, line := range strings.Split(block, "\n") {
			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			payload := strings.TrimSpace(strings.TrimPrefix(line, "data: "))
			if payload == "" || payload == "[DONE]" {
				continue
			}

			var chunk map[string]interface{}
			require.NoError(t, json.Unmarshal([]byte(payload), &chunk))
			chunks = append(chunks, chunk)
		}
	}

	return chunks
}

func chunkTypes(chunks []map[string]interface{}) []string {
	types := make([]string, 0, len(chunks))
	for _, chunk := range chunks {
		if typ, ok := chunk["type"].(string); ok {
			types = append(types, typ)
		}
	}
	return types
}

func findChunk(chunks []map[string]interface{}, typ string) (map[string]interface{}, bool) {
	for _, chunk := range chunks {
		if chunk["type"] == typ {
			return chunk, true
		}
	}
	return nil, false
}

func chatRequestBody(content string, extra map[string]interface{}) map[string]interface{} {
	messageID := uuid.NewString()
	body := map[string]interface{}{
		"id":        "test-chat",
		"trigger":   "submit-message",
		"messageId": messageID,
		"messages": []map[string]interface{}{
			{
				"id":   messageID,
				"role": "user",
				"parts": []map[string]interface{}{
					{"type": "text", "text": content},
				},
			},
		},
	}
	for key, value := range extra {
		body[key] = value
	}
	return body
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
	require.Equal(t, runtime.TransportAISDKUI, created.Data.DefaultTransport)

	sendResp := performJSONRequest(t, router, http.MethodPost, "/sessions/"+created.Data.SessionID+"/chat", chatRequestBody("执行 uptime", map[string]interface{}{
		"context": "请只返回摘要，不要贴满屏原始输出。",
	}))
	require.Equal(t, http.StatusOK, sendResp.Code)
	require.Equal(t, "v1", sendResp.Header().Get("X-Vercel-AI-UI-Message-Stream"))

	sendChunks := parseSSEChunks(t, sendResp)
	require.Contains(t, chunkTypes(sendChunks), "tool-approval-request")
	approvalChunk, ok := findChunk(sendChunks, "tool-approval-request")
	require.True(t, ok)
	taskID, ok := approvalChunk["approvalId"].(string)
	require.True(t, ok)
	require.NotEmpty(t, taskID)

	secondSendResp := performJSONRequest(t, router, http.MethodPost, "/sessions/"+created.Data.SessionID+"/chat", chatRequestBody("再检查一次", nil))
	require.Equal(t, http.StatusConflict, secondSendResp.Code)

	var sendConflict ErrorResponse
	require.NoError(t, json.Unmarshal(secondSendResp.Body.Bytes(), &sendConflict))
	require.Equal(t, "session_conflict", sendConflict.Error)

	confirmResp := performJSONRequest(t, router, http.MethodPost, "/sessions/"+created.Data.SessionID+"/chat", map[string]interface{}{
		"id": "test-chat",
		"approval": map[string]interface{}{
			"task_id":  taskID,
			"decision": "confirm",
		},
	})
	require.Equal(t, http.StatusOK, confirmResp.Code)
	confirmChunks := parseSSEChunks(t, confirmResp)
	require.Contains(t, chunkTypes(confirmChunks), "tool-output-available")
	require.Contains(t, chunkTypes(confirmChunks), "text-delta")

	latestResp := performJSONRequest(t, router, http.MethodGet, "/sessions/"+created.Data.SessionID, nil)
	require.Equal(t, http.StatusOK, latestResp.Code)
	var latest struct {
		Data CreateAISessionResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(latestResp.Body.Bytes(), &latest))
	require.Equal(t, runtime.SessionStatusIdle, latest.Data.Session.Status)
	require.Len(t, latest.Data.Session.Tasks, 1)
	require.Equal(t, runtime.TaskStatusSucceeded, latest.Data.Session.Tasks[0].Status)
	require.Equal(t, "命令执行完成，系统负载正常。", latest.Data.Session.Messages[len(latest.Data.Session.Messages)-1].Content)

	calls := runner.snapshotCalls()
	require.Len(t, calls, 2)
	require.Len(t, calls[0].Messages, 2)
	require.Contains(t, calls[0].Messages[1].Content, "执行 uptime")
	require.Contains(t, calls[0].Messages[1].Content, "请只返回摘要")

	closeResp := performJSONRequest(t, router, http.MethodDelete, "/sessions/"+created.Data.SessionID, nil)
	require.Equal(t, http.StatusNoContent, closeResp.Code)

	_, err := manager.GetSession(userID, created.Data.SessionID)
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

	resp := performJSONRequest(t, router, http.MethodPost, "/sessions/not-found/chat", chatRequestBody("hello", nil))
	require.Equal(t, http.StatusNotFound, resp.Code)

	var errorResponse ErrorResponse
	require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &errorResponse))
	require.Equal(t, "session_not_found", errorResponse.Error)
}
