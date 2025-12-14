package aichat

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/easyssh/server/internal/domain/aiconfig"
	"github.com/easyssh/server/internal/domain/useraiconfig"
	"github.com/google/uuid"
)

var (
	ErrAINotConfigured = errors.New("AI service is not configured")
	ErrEmptyMessages   = errors.New("messages cannot be empty")
	ErrInvalidProvider = errors.New("invalid AI provider")
)

// Service AI聊天服务接口
type Service interface {
	// Chat 发送聊天请求（非流式）
	Chat(ctx context.Context, userID uuid.UUID, req *ChatRequest) (*ChatResponse, error)

	// StreamChat 流式聊天
	StreamChat(ctx context.Context, userID uuid.UUID, req *ChatRequest, onDelta func(delta *StreamDelta) error) error

	// GetEffectiveConfig 获取用户有效的AI配置
	GetEffectiveConfig(ctx context.Context, userID uuid.UUID) (*ProviderConfig, error)
}

type service struct {
	aiConfigService     aiconfig.Service
	userAIConfigService useraiconfig.Service
	httpClient          *http.Client
}

// NewService 创建AI聊天服务
func NewService(aiConfigService aiconfig.Service, userAIConfigService useraiconfig.Service) Service {
	return &service{
		aiConfigService:     aiConfigService,
		userAIConfigService: userAIConfigService,
		httpClient: &http.Client{
			Timeout: 120 * time.Second, // AI响应可能较慢
		},
	}
}

// GetEffectiveConfig 获取用户有效的AI配置
func (s *service) GetEffectiveConfig(ctx context.Context, userID uuid.UUID) (*ProviderConfig, error) {
	// 1. 尝试获取用户自定义配置
	userConfig, err := s.userAIConfigService.GetUserConfig(ctx, userID)
	if err == nil && userConfig != nil && !userConfig.UseSystemConfig && userConfig.CustomEnabled {
		return &ProviderConfig{
			Provider:  userConfig.CustomProvider,
			APIKey:    userConfig.CustomAPIKey,
			Endpoint:  userConfig.CustomEndpoint,
			Model:     userConfig.CustomModel,
			RateLimit: 0, // 用户配置无速率限制
		}, nil
	}

	// 2. 回退到系统配置
	sysConfig, err := s.aiConfigService.GetSystemConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get system AI config: %w", err)
	}

	if !sysConfig.SystemEnabled {
		return nil, ErrAINotConfigured
	}

	return &ProviderConfig{
		Provider:  sysConfig.SystemProvider,
		APIKey:    sysConfig.SystemAPIKey,
		Endpoint:  sysConfig.SystemAPIEndpoint,
		Model:     sysConfig.SystemDefaultModel,
		RateLimit: sysConfig.SystemRateLimit,
	}, nil
}

// Chat 发送聊天请求（非流式）
func (s *service) Chat(ctx context.Context, userID uuid.UUID, req *ChatRequest) (*ChatResponse, error) {
	if len(req.Messages) == 0 {
		return nil, ErrEmptyMessages
	}

	config, err := s.GetEffectiveConfig(ctx, userID)
	if err != nil {
		return nil, err
	}

	// 使用请求中的模型或默认模型
	model := req.Model
	if model == "" {
		model = config.Model
	}

	switch config.Provider {
	case "openai", "azure", "custom":
		return s.chatOpenAI(ctx, config, req.Messages, model)
	case "anthropic":
		return s.chatAnthropic(ctx, config, req.Messages, model)
	default:
		return nil, ErrInvalidProvider
	}
}

// StreamChat 流式聊天
func (s *service) StreamChat(ctx context.Context, userID uuid.UUID, req *ChatRequest, onDelta func(delta *StreamDelta) error) error {
	if len(req.Messages) == 0 {
		return ErrEmptyMessages
	}

	config, err := s.GetEffectiveConfig(ctx, userID)
	if err != nil {
		return err
	}

	// 使用请求中的模型或默认模型
	model := req.Model
	if model == "" {
		model = config.Model
	}

	switch config.Provider {
	case "openai", "azure", "custom":
		return s.streamOpenAI(ctx, config, req.Messages, model, onDelta)
	case "anthropic":
		return s.streamAnthropic(ctx, config, req.Messages, model, onDelta)
	default:
		return ErrInvalidProvider
	}
}

// ========== OpenAI / Azure / Custom 兼容 API ==========

type openAIRequest struct {
	Model    string              `json:"model"`
	Messages []openAIMessage     `json:"messages"`
	Stream   bool                `json:"stream"`
}

type openAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAIResponse struct {
	ID      string `json:"id"`
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
}

type openAIStreamResponse struct {
	Choices []struct {
		Delta struct {
			Content string `json:"content"`
		} `json:"delta"`
		FinishReason *string `json:"finish_reason"`
	} `json:"choices"`
}

func (s *service) getOpenAIEndpoint(config *ProviderConfig) string {
	if config.Endpoint != "" {
		return strings.TrimSuffix(config.Endpoint, "/") + "/chat/completions"
	}
	// 默认 OpenAI 端点
	return "https://api.openai.com/v1/chat/completions"
}

func (s *service) chatOpenAI(ctx context.Context, config *ProviderConfig, messages []ChatMessage, model string) (*ChatResponse, error) {
	// 转换消息格式
	openAIMessages := make([]openAIMessage, len(messages))
	for i, msg := range messages {
		openAIMessages[i] = openAIMessage{
			Role:    msg.Role,
			Content: msg.Content,
		}
	}

	reqBody := openAIRequest{
		Model:    model,
		Messages: openAIMessages,
		Stream:   false,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", s.getOpenAIEndpoint(config), bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+config.APIKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("OpenAI API error: %s, body: %s", resp.Status, string(respBody))
	}

	var openAIResp openAIResponse
	if err := json.NewDecoder(resp.Body).Decode(&openAIResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if len(openAIResp.Choices) == 0 {
		return nil, errors.New("no response from OpenAI")
	}

	return &ChatResponse{
		Content: openAIResp.Choices[0].Message.Content,
		Model:   model,
		Usage: &ChatUsage{
			PromptTokens:     openAIResp.Usage.PromptTokens,
			CompletionTokens: openAIResp.Usage.CompletionTokens,
			TotalTokens:      openAIResp.Usage.TotalTokens,
		},
	}, nil
}

func (s *service) streamOpenAI(ctx context.Context, config *ProviderConfig, messages []ChatMessage, model string, onDelta func(delta *StreamDelta) error) error {
	// 转换消息格式
	openAIMessages := make([]openAIMessage, len(messages))
	for i, msg := range messages {
		openAIMessages[i] = openAIMessage{
			Role:    msg.Role,
			Content: msg.Content,
		}
	}

	reqBody := openAIRequest{
		Model:    model,
		Messages: openAIMessages,
		Stream:   true,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", s.getOpenAIEndpoint(config), bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+config.APIKey)
	req.Header.Set("Accept", "text/event-stream")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("OpenAI API error: %s, body: %s", resp.Status, string(respBody))
	}

	// 解析 SSE 流
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()

		// 跳过空行
		if line == "" {
			continue
		}

		// 跳过注释
		if strings.HasPrefix(line, ":") {
			continue
		}

		// 解析 data: 前缀
		if !strings.HasPrefix(line, "data: ") {
			continue
		}

		data := strings.TrimPrefix(line, "data: ")

		// 检查是否结束
		if data == "[DONE]" {
			return onDelta(&StreamDelta{Done: true})
		}

		var streamResp openAIStreamResponse
		if err := json.Unmarshal([]byte(data), &streamResp); err != nil {
			continue // 跳过无法解析的行
		}

		if len(streamResp.Choices) > 0 {
			delta := &StreamDelta{
				Content: streamResp.Choices[0].Delta.Content,
			}
			if streamResp.Choices[0].FinishReason != nil && *streamResp.Choices[0].FinishReason == "stop" {
				delta.Done = true
			}
			if err := onDelta(delta); err != nil {
				return err
			}
		}
	}

	return scanner.Err()
}

// ========== Anthropic API ==========

type anthropicRequest struct {
	Model     string             `json:"model"`
	Messages  []anthropicMessage `json:"messages"`
	MaxTokens int                `json:"max_tokens"`
	Stream    bool               `json:"stream"`
}

type anthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type anthropicResponse struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
	Usage struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
}

type anthropicStreamEvent struct {
	Type  string `json:"type"`
	Delta *struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"delta,omitempty"`
}

func (s *service) getAnthropicEndpoint(config *ProviderConfig) string {
	if config.Endpoint != "" {
		return strings.TrimSuffix(config.Endpoint, "/") + "/messages"
	}
	return "https://api.anthropic.com/v1/messages"
}

func (s *service) chatAnthropic(ctx context.Context, config *ProviderConfig, messages []ChatMessage, model string) (*ChatResponse, error) {
	// 转换消息格式（Anthropic 不支持 system role 在 messages 中）
	anthropicMessages := make([]anthropicMessage, 0, len(messages))
	for _, msg := range messages {
		if msg.Role == "system" {
			continue // Anthropic 使用单独的 system 参数
		}
		anthropicMessages = append(anthropicMessages, anthropicMessage{
			Role:    msg.Role,
			Content: msg.Content,
		})
	}

	reqBody := anthropicRequest{
		Model:     model,
		Messages:  anthropicMessages,
		MaxTokens: 4096,
		Stream:    false,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", s.getAnthropicEndpoint(config), bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", config.APIKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Anthropic API error: %s, body: %s", resp.Status, string(respBody))
	}

	var anthropicResp anthropicResponse
	if err := json.NewDecoder(resp.Body).Decode(&anthropicResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	var content string
	for _, c := range anthropicResp.Content {
		if c.Type == "text" {
			content += c.Text
		}
	}

	return &ChatResponse{
		Content: content,
		Model:   model,
		Usage: &ChatUsage{
			PromptTokens:     anthropicResp.Usage.InputTokens,
			CompletionTokens: anthropicResp.Usage.OutputTokens,
			TotalTokens:      anthropicResp.Usage.InputTokens + anthropicResp.Usage.OutputTokens,
		},
	}, nil
}

func (s *service) streamAnthropic(ctx context.Context, config *ProviderConfig, messages []ChatMessage, model string, onDelta func(delta *StreamDelta) error) error {
	// 转换消息格式
	anthropicMessages := make([]anthropicMessage, 0, len(messages))
	for _, msg := range messages {
		if msg.Role == "system" {
			continue
		}
		anthropicMessages = append(anthropicMessages, anthropicMessage{
			Role:    msg.Role,
			Content: msg.Content,
		})
	}

	reqBody := anthropicRequest{
		Model:     model,
		Messages:  anthropicMessages,
		MaxTokens: 4096,
		Stream:    true,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", s.getAnthropicEndpoint(config), bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", config.APIKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("Accept", "text/event-stream")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("Anthropic API error: %s, body: %s", resp.Status, string(respBody))
	}

	// 解析 SSE 流
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()

		if line == "" || strings.HasPrefix(line, ":") {
			continue
		}

		if !strings.HasPrefix(line, "data: ") {
			continue
		}

		data := strings.TrimPrefix(line, "data: ")

		var event anthropicStreamEvent
		if err := json.Unmarshal([]byte(data), &event); err != nil {
			continue
		}

		switch event.Type {
		case "content_block_delta":
			if event.Delta != nil && event.Delta.Type == "text_delta" {
				if err := onDelta(&StreamDelta{Content: event.Delta.Text}); err != nil {
					return err
				}
			}
		case "message_stop":
			return onDelta(&StreamDelta{Done: true})
		}
	}

	return scanner.Err()
}
