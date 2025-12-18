package aichat

import (
	"context"
	"errors"
	"io"
	"strings"

	"github.com/easyssh/server/internal/domain/aiconfig"
	"github.com/easyssh/server/internal/domain/useraiconfig"
	"github.com/google/uuid"
	"github.com/liushuangls/go-anthropic/v2"
	openai "github.com/sashabaranov/go-openai"
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

	// ChatWithTools 发送带工具的聊天请求（非流式）
	ChatWithTools(ctx context.Context, userID uuid.UUID, req *ChatRequest) (*ChatResponse, error)

	// StreamChatWithTools 流式聊天（带工具）
	StreamChatWithTools(ctx context.Context, userID uuid.UUID, req *ChatRequest, onDelta func(delta *StreamDelta) error) error

	// GetEffectiveConfig 获取用户有效的AI配置
	GetEffectiveConfig(ctx context.Context, userID uuid.UUID) (*ProviderConfig, error)
}

type service struct {
	aiConfigService     aiconfig.Service
	userAIConfigService useraiconfig.Service
	toolExecutor        *ToolExecutorService
}

// NewService 创建AI聊天服务
func NewService(aiConfigService aiconfig.Service, userAIConfigService useraiconfig.Service) Service {
	return &service{
		aiConfigService:     aiConfigService,
		userAIConfigService: userAIConfigService,
	}
}

// SetToolExecutor 设置工具执行器（用于自动工具调用循环）
func (s *service) SetToolExecutor(executor *ToolExecutorService) {
	s.toolExecutor = executor
}

// parseModels 解析逗号分隔的模型字符串
func parseModels(modelsStr string) []string {
	if modelsStr == "" {
		return []string{}
	}
	parts := strings.Split(modelsStr, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		if trimmed := strings.TrimSpace(p); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

// GetEffectiveConfig 获取用户有效的AI配置
func (s *service) GetEffectiveConfig(ctx context.Context, userID uuid.UUID) (*ProviderConfig, error) {
	// 1. 尝试获取用户自定义配置
	userConfig, err := s.userAIConfigService.GetUserConfig(ctx, userID)
	if err == nil && userConfig != nil && !userConfig.UseSystemConfig && userConfig.CustomEnabled {
		// 解析用户配置的模型列表
		userModels := parseModels(userConfig.CustomModels)
		defaultModel := ""
		if len(userModels) > 0 {
			defaultModel = userModels[0] // 默认使用第一个模型
		}
		return &ProviderConfig{
			Provider: userConfig.CustomProvider,
			APIKey:   userConfig.CustomAPIKey,
			Endpoint: userConfig.CustomEndpoint,
			Model:    defaultModel,
			Models:   userModels,
		}, nil
	}

	// 2. 回退到系统配置
	sysConfig, err := s.aiConfigService.GetSystemConfig(ctx)
	if err != nil {
		return nil, errors.Join(errors.New("failed to get system AI config"), err)
	}

	if !sysConfig.SystemEnabled {
		return nil, ErrAINotConfigured
	}

	models := parseModels(sysConfig.SystemModels)
	defaultModel := ""
	if len(models) > 0 {
		defaultModel = models[0] // 默认使用第一个模型
	}

	return &ProviderConfig{
		Provider: sysConfig.SystemProvider,
		APIKey:   sysConfig.SystemAPIKey,
		Endpoint: sysConfig.SystemAPIEndpoint,
		Model:    defaultModel,
		Models:   models,
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
	case "openai":
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
	case "openai":
		return s.streamOpenAI(ctx, config, req.Messages, model, onDelta)
	case "anthropic":
		return s.streamAnthropic(ctx, config, req.Messages, model, onDelta)
	default:
		return ErrInvalidProvider
	}
}

// ========== OpenAI / Azure / Custom 兼容 API (使用 go-openai SDK) ==========

// createOpenAIClient 创建 OpenAI 客户端
func (s *service) createOpenAIClient(config *ProviderConfig) *openai.Client {
	cfg := openai.DefaultConfig(config.APIKey)

	if config.Endpoint != "" {
		// 自定义端点（Azure、本地部署等）
		baseURL := strings.TrimSuffix(config.Endpoint, "/")
		// 确保以 /v1 结尾（go-openai SDK 要求）
		if !strings.HasSuffix(baseURL, "/v1") {
			baseURL = baseURL + "/v1"
		}
		cfg.BaseURL = baseURL
	}

	return openai.NewClientWithConfig(cfg)
}

// convertToOpenAIMessages 将消息转换为 OpenAI 格式
func convertToOpenAIMessages(messages []ChatMessage) []openai.ChatCompletionMessage {
	result := make([]openai.ChatCompletionMessage, len(messages))
	for i, msg := range messages {
		result[i] = openai.ChatCompletionMessage{
			Role:    msg.Role,
			Content: msg.Content,
		}
	}
	return result
}

func (s *service) chatOpenAI(ctx context.Context, config *ProviderConfig, messages []ChatMessage, model string) (*ChatResponse, error) {
	client := s.createOpenAIClient(config)

	resp, err := client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
		Model:    model,
		Messages: convertToOpenAIMessages(messages),
	})
	if err != nil {
		return nil, errors.Join(errors.New("OpenAI API error"), err)
	}

	if len(resp.Choices) == 0 {
		return nil, errors.New("no response from OpenAI")
	}

	return &ChatResponse{
		Content: resp.Choices[0].Message.Content,
		Model:   model,
		Usage: &ChatUsage{
			PromptTokens:     resp.Usage.PromptTokens,
			CompletionTokens: resp.Usage.CompletionTokens,
			TotalTokens:      resp.Usage.TotalTokens,
		},
	}, nil
}

func (s *service) streamOpenAI(ctx context.Context, config *ProviderConfig, messages []ChatMessage, model string, onDelta func(delta *StreamDelta) error) error {
	client := s.createOpenAIClient(config)

	stream, err := client.CreateChatCompletionStream(ctx, openai.ChatCompletionRequest{
		Model:    model,
		Messages: convertToOpenAIMessages(messages),
	})
	if err != nil {
		return errors.Join(errors.New("failed to create OpenAI stream"), err)
	}
	defer stream.Close()

	for {
		response, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			// 流结束
			return onDelta(&StreamDelta{Done: true})
		}
		if err != nil {
			return errors.Join(errors.New("OpenAI stream error"), err)
		}

		if len(response.Choices) > 0 {
			delta := &StreamDelta{
				Content: response.Choices[0].Delta.Content,
			}
			if response.Choices[0].FinishReason == openai.FinishReasonStop {
				delta.Done = true
			}
			if err := onDelta(delta); err != nil {
				return err
			}
		}
	}
}

// ========== Anthropic API (使用 go-anthropic SDK) ==========

// createAnthropicClient 创建 Anthropic 客户端
func (s *service) createAnthropicClient(config *ProviderConfig) *anthropic.Client {
	opts := []anthropic.ClientOption{}

	if config.Endpoint != "" {
		baseURL := strings.TrimSuffix(config.Endpoint, "/")
		opts = append(opts, anthropic.WithBaseURL(baseURL))
	}

	return anthropic.NewClient(config.APIKey, opts...)
}

// convertToAnthropicMessages 将消息转换为 Anthropic 格式（过滤 system role）
func convertToAnthropicMessages(messages []ChatMessage) ([]anthropic.Message, string) {
	result := make([]anthropic.Message, 0, len(messages))
	var systemPrompt string

	for _, msg := range messages {
		if msg.Role == "system" {
			// Anthropic 使用单独的 system 参数
			systemPrompt = msg.Content
			continue
		}
		result = append(result, anthropic.Message{
			Role: anthropic.ChatRole(msg.Role),
			Content: []anthropic.MessageContent{
				anthropic.NewTextMessageContent(msg.Content),
			},
		})
	}

	return result, systemPrompt
}

func (s *service) chatAnthropic(ctx context.Context, config *ProviderConfig, messages []ChatMessage, model string) (*ChatResponse, error) {
	client := s.createAnthropicClient(config)

	anthropicMessages, systemPrompt := convertToAnthropicMessages(messages)

	req := anthropic.MessagesRequest{
		Model:     anthropic.Model(model),
		Messages:  anthropicMessages,
		MaxTokens: 4096,
	}

	if systemPrompt != "" {
		req.System = systemPrompt
	}

	resp, err := client.CreateMessages(ctx, req)
	if err != nil {
		return nil, errors.Join(errors.New("Anthropic API error"), err)
	}

	// 提取文本内容
	var content string
	for _, block := range resp.Content {
		if block.Type == anthropic.MessagesContentTypeText && block.Text != nil {
			content += *block.Text
		}
	}

	return &ChatResponse{
		Content: content,
		Model:   model,
		Usage: &ChatUsage{
			PromptTokens:     resp.Usage.InputTokens,
			CompletionTokens: resp.Usage.OutputTokens,
			TotalTokens:      resp.Usage.InputTokens + resp.Usage.OutputTokens,
		},
	}, nil
}

func (s *service) streamAnthropic(ctx context.Context, config *ProviderConfig, messages []ChatMessage, model string, onDelta func(delta *StreamDelta) error) error {
	client := s.createAnthropicClient(config)

	anthropicMessages, systemPrompt := convertToAnthropicMessages(messages)

	// 用于捕获回调中的错误
	var callbackErr error

	req := anthropic.MessagesStreamRequest{
		MessagesRequest: anthropic.MessagesRequest{
			Model:     anthropic.Model(model),
			Messages:  anthropicMessages,
			MaxTokens: 4096,
			System:    systemPrompt,
		},
		OnContentBlockDelta: func(data anthropic.MessagesEventContentBlockDeltaData) {
			if data.Delta.Text != nil {
				if err := onDelta(&StreamDelta{Content: *data.Delta.Text}); err != nil {
					callbackErr = err
				}
			}
		},
		OnMessageStop: func(data anthropic.MessagesEventMessageStopData) {
			if err := onDelta(&StreamDelta{Done: true}); err != nil {
				callbackErr = err
			}
		},
	}

	_, err := client.CreateMessagesStream(ctx, req)
	if err != nil {
		return errors.Join(errors.New("Anthropic stream error"), err)
	}

	if callbackErr != nil {
		return callbackErr
	}

	return nil
}
