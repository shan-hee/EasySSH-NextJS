package aichat

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"sort"
	"strings"

	"github.com/google/uuid"
	"github.com/liushuangls/go-anthropic/v2"
	openai "github.com/sashabaranov/go-openai"
)

// ChatWithTools 发送带工具的聊天请求（非流式）
func (s *service) ChatWithTools(ctx context.Context, userID uuid.UUID, req *ChatRequest) (*ChatResponse, error) {
	if len(req.Messages) == 0 {
		return nil, ErrEmptyMessages
	}

	config, err := s.GetEffectiveConfig(ctx, userID)
	if err != nil {
		return nil, err
	}

	model := req.Model
	if model == "" {
		model = config.Model
	}
	permissionMode := NormalizePermissionMode(string(req.PermissionMode))

	provider := normalizeProviderName(config.Provider)
	config.Provider = provider

	switch {
	case isOpenAICompatibleProvider(provider):
		return s.chatOpenAIWithTools(ctx, config, req.Messages, model, permissionMode)
	case provider == "anthropic":
		return s.chatAnthropicWithTools(ctx, config, req.Messages, model, permissionMode)
	default:
		return nil, ErrInvalidProvider
	}
}

func buildToolSystemPrompt(permissionMode PermissionMode, allowedTools []ToolDefinition) string {
	var sb strings.Builder
	sb.WriteString("你是一个服务器管理助手，可以帮助用户管理和操作他们的服务器。\n\n")
	sb.WriteString("重要规则：\n")
	sb.WriteString("1. 当用户请求需要执行操作时（如查看Docker服务、执行命令、读写文件等），你应该直接调用相应的工具，而不是用文字询问用户是否允许。\n")
	sb.WriteString("2. 工具调用会由系统自动处理权限确认，危险操作会弹窗让用户确认后才执行。\n")
	sb.WriteString("3. 你只需要专注于理解用户需求并调用正确的工具，权限控制由系统负责。\n")
	sb.WriteString("4. 如果需要多个步骤完成任务，请依次调用所需的工具。\n")
	sb.WriteString("5. 一旦拿到工具结果，你必须先基于结果做分析并给出结论，不要只给模板化建议。\n")
	sb.WriteString("6. 分析时必须引用关键数据（例如具体进程ID、CPU/内存数值、错误行、文件路径），并明确说明“正常/异常”及原因。\n")
	sb.WriteString("7. 只有在当前结果不足以支持结论时，才继续调用下一步工具；否则直接输出完整结论和可执行建议。\n")
	sb.WriteString("8. 不要重复大段原始工具输出，重点提炼关键发现并给出下一步动作。\n")
	sb.WriteString("9. ")
	sb.WriteString(GetPermissionModeRule(permissionMode))
	sb.WriteString("\n\n")

	sb.WriteString("本会话可用工具（仅限以下工具）：\n")
	for _, tool := range allowedTools {
		sb.WriteString("- ")
		sb.WriteString(tool.Name)
		sb.WriteString(": ")
		sb.WriteString(tool.Description)
		sb.WriteString("\n")
	}

	return sb.String()
}

// StreamChatWithTools 流式聊天（带工具）- 支持自动工具调用循环
func (s *service) StreamChatWithTools(ctx context.Context, userID uuid.UUID, req *ChatRequest, onDelta func(delta *StreamDelta) error) error {
	if len(req.Messages) == 0 {
		return ErrEmptyMessages
	}

	config, err := s.GetEffectiveConfig(ctx, userID)
	if err != nil {
		return err
	}
	config.Provider = normalizeProviderName(config.Provider)

	model := req.Model
	if model == "" {
		model = config.Model
	}
	permissionMode := NormalizePermissionMode(string(req.PermissionMode))
	allowedTools := GetAvailableToolsByPermission(permissionMode)

	// 系统提示词：引导 AI 直接调用工具，而不是用文字询问用户
	systemPrompt := buildToolSystemPrompt(permissionMode, allowedTools)

	// 复制消息列表，用于多轮对话
	// 在开头插入系统提示词
	messages := make([]ChatMessage, 0, len(req.Messages)+1)
	messages = append(messages, ChatMessage{Role: "system", Content: systemPrompt})
	messages = append(messages, req.Messages...)
	// 当上一条是工具结果时，显式要求先“基于结果分析”，避免与工具执行割裂。
	if len(req.Messages) > 0 {
		last := req.Messages[len(req.Messages)-1]
		if last.Role == "tool" {
			messages = append(messages, ChatMessage{
				Role:    "user",
				Content: "请基于上一条工具结果直接给出结论和分析（引用关键数据），再给出下一步建议。若信息已足够，不要继续调用工具。",
			})
		}
	}

	// 最大工具调用轮数，防止无限循环
	const maxToolRounds = 10

	for round := 0; round < maxToolRounds; round++ {
		var toolCalls []ToolCall
		var contentBuffer strings.Builder

		// 创建一个内部回调来收集工具调用
		internalCallback := func(delta *StreamDelta) error {
			// 收集文本内容
			if delta.Content != "" {
				contentBuffer.WriteString(delta.Content)
				// 实时推送文本内容给客户端
				if err := onDelta(&StreamDelta{Content: delta.Content}); err != nil {
					return err
				}
			}

			// 收集工具调用（仅记录；是否需要推送给前端由后续逻辑决定）
			if len(delta.ToolCalls) > 0 {
				toolCalls = delta.ToolCalls
			}

			return nil
		}

		// 调用 AI
		var streamErr error
		switch {
		case isOpenAICompatibleProvider(config.Provider):
			streamErr = s.streamOpenAIWithTools(ctx, config, messages, model, permissionMode, internalCallback)
		case config.Provider == "anthropic":
			streamErr = s.streamAnthropicWithTools(ctx, config, messages, model, permissionMode, internalCallback)
		default:
			return ErrInvalidProvider
		}

		if streamErr != nil {
			return streamErr
		}

		// 如果没有工具调用，说明 AI 已经完成回复
		if len(toolCalls) == 0 {
			return onDelta(&StreamDelta{Done: true})
		}

		// 检查是否有工具执行器
		if s.toolExecutor == nil {
			// 没有工具执行器，直接返回工具调用让前端处理（包含安全/危险）
			return onDelta(&StreamDelta{Done: true, ToolCalls: toolCalls})
		}

		// 将 assistant 的回复（包含工具调用）添加到消息历史
		assistantMsg := ChatMessage{
			Role:      "assistant",
			Content:   contentBuffer.String(),
			ToolCalls: toolCalls,
		}
		messages = append(messages, assistantMsg)

		// 检查是否有危险工具需要用户确认
		var dangerousToolCalls []ToolCall
		var safeToolCalls []ToolCall
		for _, tc := range toolCalls {
			if IsDangerousTool(tc.Name) {
				dangerousToolCalls = append(dangerousToolCalls, tc)
			} else {
				safeToolCalls = append(safeToolCalls, tc)
			}
		}

		// 如果有危险工具，返回让前端处理（用户确认后再执行）
		if len(dangerousToolCalls) > 0 {
			// 仅在需要用户确认时才把 tool_calls 推送给前端，避免安全工具已在服务端自动执行但前端仍显示“待确认”
			return onDelta(&StreamDelta{Done: true, ToolCalls: toolCalls})
		}

		// 只自动执行安全工具
		for _, tc := range safeToolCalls {
			// 通知前端正在执行工具（使用特殊标记格式，前端会解析并显示动画）
			actionDesc := GetToolActionDescription(tc.Name)
			if err := onDelta(&StreamDelta{
				Content: "\n\n<tool-status>" + actionDesc + "</tool-status>\n",
			}); err != nil {
				return err
			}

			// 执行工具
			result, err := s.toolExecutor.ExecuteTool(ctx, userID, &tc, permissionMode)
			if err != nil {
				result = &ToolResult{
					ToolCallID: tc.ID,
					Content:    "工具执行错误: " + err.Error(),
					IsError:    true,
				}
			}

			// 将工具结果添加到消息历史
			toolResultMsg := ChatMessage{
				Role:       "tool",
				Content:    result.Content,
				ToolCallID: tc.ID,
			}
			messages = append(messages, toolResultMsg)
		}

		// 继续下一轮对话，让 AI 处理工具结果
	}

	// 达到最大轮数
	return onDelta(&StreamDelta{
		Content: "\n\n⚠️ 达到最大工具调用轮数限制",
		Done:    true,
	})
}

// ========== OpenAI 带工具调用 ==========

// convertToOpenAIMessagesWithTools 将消息转换为 OpenAI 格式（支持工具调用）
func convertToOpenAIMessagesWithTools(messages []ChatMessage) []openai.ChatCompletionMessage {
	result := make([]openai.ChatCompletionMessage, 0, len(messages))
	for _, msg := range messages {
		oaiMsg := openai.ChatCompletionMessage{
			Role:    msg.Role,
			Content: msg.Content,
		}

		// 处理工具调用消息
		if msg.Role == "assistant" && len(msg.ToolCalls) > 0 {
			oaiMsg.ToolCalls = make([]openai.ToolCall, len(msg.ToolCalls))
			for i, tc := range msg.ToolCalls {
				oaiMsg.ToolCalls[i] = openai.ToolCall{
					ID:   tc.ID,
					Type: openai.ToolTypeFunction,
					Function: openai.FunctionCall{
						Name:      tc.Name,
						Arguments: string(tc.Arguments),
					},
				}
			}
		}

		// 处理工具结果消息
		if msg.Role == "tool" {
			oaiMsg.ToolCallID = msg.ToolCallID
		}

		result = append(result, oaiMsg)
	}
	return result
}

// getOpenAITools 获取 OpenAI 格式的工具定义
func getOpenAITools(permissionMode PermissionMode) []openai.Tool {
	tools := GetAvailableToolsByPermission(permissionMode)
	result := make([]openai.Tool, len(tools))
	for i, tool := range tools {
		paramsJSON, _ := json.Marshal(tool.Parameters)
		result[i] = openai.Tool{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        tool.Name,
				Description: tool.Description,
				Parameters:  json.RawMessage(paramsJSON),
			},
		}
	}
	return result
}

func (s *service) chatOpenAIWithTools(ctx context.Context, config *ProviderConfig, messages []ChatMessage, model string, permissionMode PermissionMode) (*ChatResponse, error) {
	client := s.createOpenAIClient(config)

	resp, err := client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
		Model:    model,
		Messages: convertToOpenAIMessagesWithTools(messages),
		Tools:    getOpenAITools(permissionMode),
	})
	if err != nil {
		return nil, wrapOpenAIProviderError("OpenAI API error", err)
	}

	if len(resp.Choices) == 0 {
		return nil, errors.New("no response from OpenAI")
	}

	choice := resp.Choices[0]
	response := &ChatResponse{
		Content: choice.Message.Content,
		Model:   model,
		Usage: &ChatUsage{
			PromptTokens:     resp.Usage.PromptTokens,
			CompletionTokens: resp.Usage.CompletionTokens,
			TotalTokens:      resp.Usage.TotalTokens,
		},
	}

	// 处理工具调用
	if len(choice.Message.ToolCalls) > 0 {
		response.ToolCalls = make([]ToolCall, len(choice.Message.ToolCalls))
		for i, tc := range choice.Message.ToolCalls {
			response.ToolCalls[i] = ToolCall{
				ID:        tc.ID,
				Name:      tc.Function.Name,
				Arguments: json.RawMessage(tc.Function.Arguments),
			}
		}
	}

	return response, nil
}

func (s *service) streamOpenAIWithTools(ctx context.Context, config *ProviderConfig, messages []ChatMessage, model string, permissionMode PermissionMode, onDelta func(delta *StreamDelta) error) error {
	client := s.createOpenAIClient(config)

	stream, err := client.CreateChatCompletionStream(ctx, openai.ChatCompletionRequest{
		Model:    model,
		Messages: convertToOpenAIMessagesWithTools(messages),
		Tools:    getOpenAITools(permissionMode),
	})
	if err != nil {
		return wrapOpenAIProviderError("failed to create OpenAI stream", err)
	}
	defer stream.Close()

	// 收集工具调用（流式中逐步构建）
	toolCallsMap := make(map[int]*ToolCall)
	toolCallIDToIndex := make(map[string]int)
	nextToolCallIndex := 0

	buildToolCalls := func() []ToolCall {
		if len(toolCallsMap) == 0 {
			return nil
		}
		indexes := make([]int, 0, len(toolCallsMap))
		for idx := range toolCallsMap {
			indexes = append(indexes, idx)
		}
		sort.Ints(indexes)

		result := make([]ToolCall, 0, len(indexes))
		for _, idx := range indexes {
			result = append(result, *toolCallsMap[idx])
		}
		return result
	}

	for {
		response, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			// 流结束，返回收集到的工具调用
			return onDelta(&StreamDelta{Done: true, ToolCalls: buildToolCalls()})
		}
		if err != nil {
			return wrapOpenAIProviderError("OpenAI stream error", err)
		}

		if len(response.Choices) > 0 {
			choice := response.Choices[0]

			// 处理文本内容
			if choice.Delta.Content != "" {
				if err := onDelta(&StreamDelta{Content: choice.Delta.Content}); err != nil {
					return err
				}
			}

			// 处理工具调用增量
			for _, tc := range choice.Delta.ToolCalls {
				idx := -1
				if tc.Index != nil {
					idx = *tc.Index
				} else if tc.ID != "" {
					if existingIdx, ok := toolCallIDToIndex[tc.ID]; ok {
						idx = existingIdx
					}
				}
				if idx < 0 {
					idx = nextToolCallIndex
					nextToolCallIndex++
				}
				if tc.ID != "" {
					toolCallIDToIndex[tc.ID] = idx
				}
				if idx >= nextToolCallIndex {
					nextToolCallIndex = idx + 1
				}

				if _, exists := toolCallsMap[idx]; !exists {
					toolCallsMap[idx] = &ToolCall{
						ID:        tc.ID,
						Name:      tc.Function.Name,
						Arguments: json.RawMessage(tc.Function.Arguments),
					}
				} else {
					// 追加参数
					existing := toolCallsMap[idx]
					if tc.ID != "" {
						existing.ID = tc.ID
					}
					if tc.Function.Name != "" {
						existing.Name = tc.Function.Name
					}
					if tc.Function.Arguments != "" {
						existing.Arguments = json.RawMessage(string(existing.Arguments) + tc.Function.Arguments)
					}
				}
			}

			// 检查是否因工具调用而停止
			if choice.FinishReason == openai.FinishReasonToolCalls {
				return onDelta(&StreamDelta{Done: true, ToolCalls: buildToolCalls()})
			}

			if choice.FinishReason == openai.FinishReasonStop {
				// 某些 OpenAI 兼容实现会在工具调用场景下返回 stop。
				// 如果已收集到 tool calls，则按工具调用结束处理，避免前端只收到 done:true。
				if len(toolCallsMap) > 0 {
					return onDelta(&StreamDelta{Done: true, ToolCalls: buildToolCalls()})
				}
				return onDelta(&StreamDelta{Done: true})
			}
		}
	}
}

// ========== Anthropic 带工具调用 ==========

// convertToAnthropicMessagesWithTools 将消息转换为 Anthropic 格式（支持工具调用）
func convertToAnthropicMessagesWithTools(messages []ChatMessage) ([]anthropic.Message, string) {
	result := make([]anthropic.Message, 0, len(messages))
	var systemPrompt string

	for _, msg := range messages {
		if msg.Role == "system" {
			systemPrompt = msg.Content
			continue
		}

		// 处理工具结果消息
		if msg.Role == "tool" {
			result = append(result, anthropic.Message{
				Role: anthropic.RoleUser,
				Content: []anthropic.MessageContent{
					anthropic.NewToolResultMessageContent(msg.ToolCallID, msg.Content, false),
				},
			})
			continue
		}

		// 处理 assistant 消息（可能包含工具调用）
		if msg.Role == "assistant" && len(msg.ToolCalls) > 0 {
			contents := make([]anthropic.MessageContent, 0)
			if msg.Content != "" {
				contents = append(contents, anthropic.NewTextMessageContent(msg.Content))
			}
			for _, tc := range msg.ToolCalls {
				contents = append(contents, anthropic.NewToolUseMessageContent(tc.ID, tc.Name, tc.Arguments))
			}
			result = append(result, anthropic.Message{
				Role:    anthropic.ChatRole(msg.Role),
				Content: contents,
			})
			continue
		}

		// 普通消息
		result = append(result, anthropic.Message{
			Role: anthropic.ChatRole(msg.Role),
			Content: []anthropic.MessageContent{
				anthropic.NewTextMessageContent(msg.Content),
			},
		})
	}

	return result, systemPrompt
}

// getAnthropicTools 获取 Anthropic 格式的工具定义
func getAnthropicTools(permissionMode PermissionMode) []anthropic.ToolDefinition {
	tools := GetAvailableToolsByPermission(permissionMode)
	result := make([]anthropic.ToolDefinition, len(tools))
	for i, tool := range tools {
		result[i] = anthropic.ToolDefinition{
			Name:        tool.Name,
			Description: tool.Description,
			InputSchema: tool.Parameters,
		}
	}
	return result
}

func (s *service) chatAnthropicWithTools(ctx context.Context, config *ProviderConfig, messages []ChatMessage, model string, permissionMode PermissionMode) (*ChatResponse, error) {
	client := s.createAnthropicClient(config)

	anthropicMessages, systemPrompt := convertToAnthropicMessagesWithTools(messages)

	req := anthropic.MessagesRequest{
		Model:     anthropic.Model(model),
		Messages:  anthropicMessages,
		MaxTokens: 4096,
		Tools:     getAnthropicTools(permissionMode),
	}

	if systemPrompt != "" {
		req.System = systemPrompt
	}

	resp, err := client.CreateMessages(ctx, req)
	if err != nil {
		return nil, errors.Join(errors.New("Anthropic API error"), err)
	}

	// 提取文本内容和工具调用
	var content string
	var toolCalls []ToolCall

	for _, block := range resp.Content {
		if block.Type == anthropic.MessagesContentTypeText && block.Text != nil {
			content += *block.Text
		}
		if block.Type == anthropic.MessagesContentTypeToolUse {
			inputJSON, _ := json.Marshal(block.Input)
			toolCalls = append(toolCalls, ToolCall{
				ID:        block.ID,
				Name:      block.Name,
				Arguments: inputJSON,
			})
		}
	}

	return &ChatResponse{
		Content:   content,
		Model:     model,
		ToolCalls: toolCalls,
		Usage: &ChatUsage{
			PromptTokens:     resp.Usage.InputTokens,
			CompletionTokens: resp.Usage.OutputTokens,
			TotalTokens:      resp.Usage.InputTokens + resp.Usage.OutputTokens,
		},
	}, nil
}

func (s *service) streamAnthropicWithTools(ctx context.Context, config *ProviderConfig, messages []ChatMessage, model string, permissionMode PermissionMode, onDelta func(delta *StreamDelta) error) error {
	client := s.createAnthropicClient(config)

	anthropicMessages, systemPrompt := convertToAnthropicMessagesWithTools(messages)

	var callbackErr error
	var toolCalls []ToolCall
	currentToolCall := &ToolCall{}
	var inputBuilder strings.Builder

	req := anthropic.MessagesStreamRequest{
		MessagesRequest: anthropic.MessagesRequest{
			Model:     anthropic.Model(model),
			Messages:  anthropicMessages,
			MaxTokens: 4096,
			System:    systemPrompt,
			Tools:     getAnthropicTools(permissionMode),
		},
		OnContentBlockStart: func(data anthropic.MessagesEventContentBlockStartData) {
			if data.ContentBlock.Type == anthropic.MessagesContentTypeToolUse {
				currentToolCall = &ToolCall{
					ID:   data.ContentBlock.ID,
					Name: data.ContentBlock.Name,
				}
				inputBuilder.Reset()
			}
		},
		OnContentBlockDelta: func(data anthropic.MessagesEventContentBlockDeltaData) {
			if data.Delta.Text != nil {
				if err := onDelta(&StreamDelta{Content: *data.Delta.Text}); err != nil {
					callbackErr = err
				}
			}
			if data.Delta.PartialJson != nil {
				inputBuilder.WriteString(*data.Delta.PartialJson)
			}
		},
		OnContentBlockStop: func(data anthropic.MessagesEventContentBlockStopData, content anthropic.MessageContent) {
			if currentToolCall.ID != "" {
				currentToolCall.Arguments = json.RawMessage(inputBuilder.String())
				toolCalls = append(toolCalls, *currentToolCall)
				currentToolCall = &ToolCall{}
			}
		},
		OnMessageStop: func(data anthropic.MessagesEventMessageStopData) {
			if err := onDelta(&StreamDelta{Done: true, ToolCalls: toolCalls}); err != nil {
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
