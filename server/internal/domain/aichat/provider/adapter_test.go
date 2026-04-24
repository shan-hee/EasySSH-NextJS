package provider

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/easyssh/server/internal/domain/aichat/registry"
	"github.com/stretchr/testify/require"
)

func TestStreamOpenAIWithToolsNormalizesTextAndChunkedToolCalls(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/v1/chat/completions", r.URL.Path)
		w.Header().Set("Content-Type", "text/event-stream")

		writeSSEData(t, w, `{"id":"chunk-1","object":"chat.completion.chunk","created":1,"model":"test-model","choices":[{"index":0,"delta":{"content":"正在"},"finish_reason":""}]}`)
		writeSSEData(t, w, `{"id":"chunk-2","object":"chat.completion.chunk","created":1,"model":"test-model","choices":[{"index":0,"delta":{"content":"查询"},"finish_reason":""}]}`)
		writeSSEData(t, w, `{"id":"chunk-3","object":"chat.completion.chunk","created":1,"model":"test-model","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call-1","type":"function","function":{"name":"list_servers","arguments":"{\"status\":\"on"}}]},"finish_reason":""}]}`)
		writeSSEData(t, w, `{"id":"chunk-4","object":"chat.completion.chunk","created":1,"model":"test-model","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"type":"function","function":{"arguments":"line\"}"}}]},"finish_reason":"tool_calls"}]}`)
		_, err := w.Write([]byte("data: [DONE]\n\n"))
		require.NoError(t, err)
	}))
	defer server.Close()

	var events []Event
	result, err := streamOpenAIWithTools(
		context.Background(),
		Config{Provider: "openai", APIKey: "test-key", Endpoint: server.URL},
		TurnRequest{Model: "test-model", Messages: []Message{{Role: "user", Content: "列出在线服务器"}}},
		func(event Event) error {
			events = append(events, event)
			return nil
		},
	)

	require.NoError(t, err)
	require.Equal(t, "正在查询", result.Content)
	require.Equal(t, []Event{
		{Type: EventTextDelta, Delta: "正在"},
		{Type: EventTextDelta, Delta: "查询"},
	}, events)
	require.Len(t, result.ToolCalls, 1)
	require.Equal(t, "call-1", result.ToolCalls[0].ID)
	require.Equal(t, "list_servers", result.ToolCalls[0].Name)
	require.JSONEq(t, `{"status":"online"}`, string(result.ToolCalls[0].Arguments))
}

func TestStreamOpenAIWithToolsKeepsMultipleToolCallOrderWithoutIndexes(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		writeSSEData(t, w, `{"id":"chunk-1","object":"chat.completion.chunk","created":1,"model":"test-model","choices":[{"index":0,"delta":{"tool_calls":[{"id":"call-a","type":"function","function":{"name":"list_servers","arguments":"{}"}},{"id":"call-b","type":"function","function":{"name":"get_server_metrics","arguments":"{\"server_id\":\"srv"}}]},"finish_reason":""}]}`)
		writeSSEData(t, w, `{"id":"chunk-2","object":"chat.completion.chunk","created":1,"model":"test-model","choices":[{"index":0,"delta":{"tool_calls":[{"id":"call-b","type":"function","function":{"arguments":"-1\"}"}}]},"finish_reason":"tool_calls"}]}`)
		_, err := w.Write([]byte("data: [DONE]\n\n"))
		require.NoError(t, err)
	}))
	defer server.Close()

	result, err := streamOpenAIWithTools(
		context.Background(),
		Config{Provider: "openai", APIKey: "test-key", Endpoint: server.URL},
		TurnRequest{Model: "test-model", Messages: []Message{{Role: "user", Content: "查询服务器"}}},
		func(Event) error { return nil },
	)

	require.NoError(t, err)
	require.Len(t, result.ToolCalls, 2)
	require.Equal(t, "call-a", result.ToolCalls[0].ID)
	require.Equal(t, "list_servers", result.ToolCalls[0].Name)
	require.JSONEq(t, `{}`, string(result.ToolCalls[0].Arguments))
	require.Equal(t, "call-b", result.ToolCalls[1].ID)
	require.Equal(t, "get_server_metrics", result.ToolCalls[1].Name)
	require.JSONEq(t, `{"server_id":"srv-1"}`, string(result.ToolCalls[1].Arguments))
}

func TestConvertToAnthropicMessagesNormalizesSystemToolUseAndToolResult(t *testing.T) {
	t.Parallel()

	messages, systemPrompt := convertToAnthropicMessages([]Message{
		{Role: "system", Content: "你是 EasySSH 助手"},
		{Role: "user", Content: "查服务器"},
		{
			Role:    "assistant",
			Content: "我会调用工具。",
			ToolCalls: []registry.ToolCall{{
				ID:        "toolu-1",
				Name:      "list_servers",
				Arguments: json.RawMessage(`{"status":"online"}`),
			}},
		},
		{Role: "tool", ToolCallID: "toolu-1", Content: "共 2 台"},
	})

	require.Equal(t, "你是 EasySSH 助手", systemPrompt)
	require.Len(t, messages, 3)
	require.Equal(t, "user", string(messages[0].Role))
	require.Len(t, messages[0].Content, 1)
	require.Equal(t, "查服务器", messages[0].Content[0].GetText())

	require.Equal(t, "assistant", string(messages[1].Role))
	require.Len(t, messages[1].Content, 2)
	require.Equal(t, "我会调用工具。", messages[1].Content[0].GetText())
	require.Equal(t, "toolu-1", messages[1].Content[1].MessageContentToolUse.ID)
	require.Equal(t, "list_servers", messages[1].Content[1].MessageContentToolUse.Name)
	require.JSONEq(t, `{"status":"online"}`, string(messages[1].Content[1].MessageContentToolUse.Input))

	require.Equal(t, "user", string(messages[2].Role))
	require.Len(t, messages[2].Content, 1)
	require.NotNil(t, messages[2].Content[0].MessageContentToolResult.ToolUseID)
	require.Equal(t, "toolu-1", *messages[2].Content[0].MessageContentToolResult.ToolUseID)
}

func TestStreamAnthropicWithToolsNormalizesTextAndToolUse(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/messages", r.URL.Path)
		w.Header().Set("Content-Type", "text/event-stream")

		writeSSEEvent(t, w, "message_start", `{"type":"message_start","message":{"id":"msg-1","type":"message","role":"assistant","content":[],"model":"claude-test","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":1,"output_tokens":1}}}`)
		writeSSEEvent(t, w, "content_block_start", `{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}`)
		writeSSEEvent(t, w, "content_block_delta", `{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"正在"}}`)
		writeSSEEvent(t, w, "content_block_delta", `{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"查询"}}`)
		writeSSEEvent(t, w, "content_block_stop", `{"type":"content_block_stop","index":0}`)
		writeSSEEvent(t, w, "content_block_start", `{"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu-1","name":"list_servers","input":{}}}`)
		writeSSEEvent(t, w, "content_block_delta", `{"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\"status\":\"on"}}`)
		writeSSEEvent(t, w, "content_block_delta", `{"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"line\"}"}}`)
		writeSSEEvent(t, w, "content_block_stop", `{"type":"content_block_stop","index":1}`)
		writeSSEEvent(t, w, "message_delta", `{"type":"message_delta","delta":{"stop_reason":"tool_use","stop_sequence":null},"usage":{"output_tokens":12}}`)
		writeSSEEvent(t, w, "message_stop", `{"type":"message_stop"}`)
	}))
	defer server.Close()

	var events []Event
	result, err := streamAnthropicWithTools(
		context.Background(),
		Config{Provider: "anthropic", APIKey: "test-key", Endpoint: server.URL},
		TurnRequest{Model: "claude-test", Messages: []Message{{Role: "user", Content: "列出在线服务器"}}},
		func(event Event) error {
			events = append(events, event)
			return nil
		},
	)

	require.NoError(t, err)
	require.Equal(t, "正在查询", result.Content)
	require.Equal(t, []Event{
		{Type: EventTextDelta, Delta: "正在"},
		{Type: EventTextDelta, Delta: "查询"},
	}, events)
	require.Len(t, result.ToolCalls, 1)
	require.Equal(t, "toolu-1", result.ToolCalls[0].ID)
	require.Equal(t, "list_servers", result.ToolCalls[0].Name)
	require.JSONEq(t, `{"status":"online"}`, string(result.ToolCalls[0].Arguments))
}

func writeSSEData(t *testing.T, w http.ResponseWriter, data string) {
	t.Helper()
	_, err := w.Write([]byte("data: " + data + "\n\n"))
	require.NoError(t, err)
}

func writeSSEEvent(t *testing.T, w http.ResponseWriter, event string, data string) {
	t.Helper()
	_, err := w.Write([]byte("event: " + event + "\n" + "data: " + data + "\n\n"))
	require.NoError(t, err)
}
