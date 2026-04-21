package runtime

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/easyssh/server/internal/domain/aichat/provider"
	"github.com/easyssh/server/internal/domain/aichat/registry"
	"github.com/google/uuid"
)

var (
	ErrSessionNotFound                = errors.New("ai session not found")
	ErrSessionClosed                  = errors.New("ai session already closed")
	ErrSessionBusy                    = errors.New("ai session is busy")
	ErrTaskNotFound                   = errors.New("ai task not found")
	ErrTaskConfirmationNotPending     = errors.New("ai task is not awaiting confirmation")
	ErrInvalidDecision                = errors.New("invalid confirmation decision")
	ErrEmptyMessageContent            = errors.New("message content cannot be empty")
	ErrSessionHasPendingConfirmations = errors.New("session has pending confirmations")
	errConversationMaxRoundsReached   = errors.New("max tool rounds reached")
)

const (
	defaultCleanupInterval = 5 * time.Minute
	defaultMaxToolRounds   = 10
)

type ConfigResolver interface {
	Resolve(ctx context.Context, userID uuid.UUID) (provider.Config, error)
}

type TurnRunner interface {
	StreamTurn(ctx context.Context, config provider.Config, req provider.TurnRequest, onEvent func(provider.Event) error) (provider.TurnResult, error)
}

type Manager struct {
	resolver   ConfigResolver
	factory    TurnRunner
	registry   *registry.ToolRegistry
	ttl        time.Duration
	maxRounds  int
	cleanupGap time.Duration

	mu       sync.RWMutex
	sessions map[string]*session
}

type session struct {
	id             string
	userID         uuid.UUID
	model          string
	permissionMode string
	status         SessionStatus
	createdAt      time.Time
	updatedAt      time.Time

	messages     []provider.Message
	messageViews []MessageView
	tasks        map[string]*taskState
	taskOrder    []string

	subscribers map[string]chan Event

	processing bool
	currentRun context.CancelFunc
	closed     bool
}

type taskState struct {
	spec     registry.ToolSpec
	toolCall registry.ToolCall
	view     TaskView
}

func NewManager(resolver ConfigResolver, factory TurnRunner, toolRegistry *registry.ToolRegistry, ttl time.Duration) *Manager {
	if ttl <= 0 {
		ttl = 30 * time.Minute
	}
	if factory == nil {
		factory = provider.NewFactory()
	}
	if toolRegistry == nil {
		toolRegistry = registry.NewToolRegistry(nil)
	}

	manager := &Manager{
		resolver:   resolver,
		factory:    factory,
		registry:   toolRegistry,
		ttl:        ttl,
		maxRounds:  defaultMaxToolRounds,
		cleanupGap: defaultCleanupInterval,
		sessions:   make(map[string]*session),
	}

	go manager.cleanupLoop()
	return manager
}

func (m *Manager) CreateSession(ctx context.Context, userID uuid.UUID, input CreateSessionInput) (*SessionView, error) {
	now := time.Now()
	sessionID := uuid.NewString()

	s := &session{
		id:             sessionID,
		userID:         userID,
		model:          strings.TrimSpace(input.Model),
		permissionMode: normalizePermissionMode(input.PermissionMode),
		status:         SessionStatusIdle,
		createdAt:      now,
		updatedAt:      now,
		tasks:          make(map[string]*taskState),
		subscribers:    make(map[string]chan Event),
	}

	m.mu.Lock()
	m.sessions[sessionID] = s
	view := m.snapshotSessionLocked(s)
	m.mu.Unlock()

	return &view, nil
}

func (m *Manager) GetSession(userID uuid.UUID, sessionID string) (*SessionView, error) {
	s, err := m.getSession(userID, sessionID)
	if err != nil {
		return nil, err
	}

	view := m.snapshotSession(s)
	return &view, nil
}

func (m *Manager) Subscribe(userID uuid.UUID, sessionID string) (<-chan Event, func(), error) {
	s, err := m.getSession(userID, sessionID)
	if err != nil {
		return nil, nil, err
	}

	subID := uuid.NewString()
	ch := make(chan Event, 128)

	m.mu.Lock()
	if s.closed {
		m.mu.Unlock()
		close(ch)
		return nil, nil, ErrSessionClosed
	}
	s.subscribers[subID] = ch
	snapshot := m.snapshotSessionLocked(s)
	m.mu.Unlock()

	ch <- Event{
		ID:        uuid.NewString(),
		Type:      EventSessionStarted,
		SessionID: s.id,
		CreatedAt: time.Now(),
		Session:   &snapshot,
	}

	unsubscribe := func() {
		m.mu.Lock()
		defer m.mu.Unlock()
		if _, ok := s.subscribers[subID]; !ok {
			return
		}
		delete(s.subscribers, subID)
		close(ch)
	}

	return ch, unsubscribe, nil
}

func (m *Manager) SendUserMessage(ctx context.Context, userID uuid.UUID, sessionID string, content string) error {
	content = strings.TrimSpace(content)
	if content == "" {
		return ErrEmptyMessageContent
	}

	s, err := m.getSession(userID, sessionID)
	if err != nil {
		return err
	}

	m.mu.Lock()
	if s.closed {
		m.mu.Unlock()
		return ErrSessionClosed
	}
	if s.processing {
		m.mu.Unlock()
		return ErrSessionBusy
	}
	if s.hasPendingConfirmation() {
		m.mu.Unlock()
		return ErrSessionHasPendingConfirmations
	}

	now := time.Now()
	s.messages = append(s.messages, provider.Message{
		Role:    "user",
		Content: content,
	})
	s.messageViews = append(s.messageViews, MessageView{
		ID:        uuid.NewString(),
		Role:      "user",
		Content:   content,
		CreatedAt: now,
	})
	s.status = SessionStatusRunning
	s.processing = true
	s.updatedAt = now
	m.mu.Unlock()

	go m.runSession(sessionID)
	return nil
}

func (m *Manager) ConfirmTask(ctx context.Context, userID uuid.UUID, sessionID, taskID string, decision Decision) error {
	s, err := m.getSession(userID, sessionID)
	if err != nil {
		return err
	}

	if decision != DecisionConfirm && decision != DecisionReject {
		return ErrInvalidDecision
	}

	m.mu.Lock()
	if s.closed {
		m.mu.Unlock()
		return ErrSessionClosed
	}
	task, ok := s.tasks[taskID]
	if !ok {
		m.mu.Unlock()
		return ErrTaskNotFound
	}
	if task.view.Status != TaskStatusWaitingConfirm {
		m.mu.Unlock()
		return ErrTaskConfirmationNotPending
	}

	now := time.Now()
	confirmationStatus := string(task.view.Status)
	if decision == DecisionConfirm {
		s.status = SessionStatusRunning
		s.processing = true
		confirmationStatus = string(TaskStatusRunning)
	} else {
		confirmationStatus = string(TaskStatusCancelled)
	}
	s.updatedAt = now
	m.mu.Unlock()

	m.emitEvent(s, Event{
		ID:        uuid.NewString(),
		Type:      EventConfirmationResolved,
		SessionID: s.id,
		CreatedAt: now,
		Confirmation: &ConfirmationView{
			TaskID:    taskID,
			Status:    confirmationStatus,
			Decision:  string(decision),
			CreatedAt: now,
		},
	})

	go m.resolvePendingTask(sessionID, taskID, decision)
	return nil
}

func (m *Manager) CloseSession(userID uuid.UUID, sessionID string) error {
	s, err := m.getSession(userID, sessionID)
	if err != nil {
		return err
	}

	m.closeSession(s)
	return nil
}

func (m *Manager) closeSession(s *session) {
	m.mu.Lock()
	if s.closed {
		m.mu.Unlock()
		return
	}
	s.closed = true
	s.status = SessionStatusClosed
	s.updatedAt = time.Now()
	cancel := s.currentRun
	s.currentRun = nil
	s.processing = false
	view := m.snapshotSessionLocked(s)
	subs := cloneSubscribersLocked(s)
	s.subscribers = make(map[string]chan Event)
	delete(m.sessions, s.id)
	m.mu.Unlock()

	if cancel != nil {
		cancel()
	}

	m.emitToSubscribers(subs, Event{
		ID:        uuid.NewString(),
		Type:      EventSessionCompleted,
		SessionID: s.id,
		CreatedAt: time.Now(),
		Session:   &view,
	})

	for _, ch := range subs {
		close(ch)
	}
}

func (m *Manager) runSession(sessionID string) {
	s, ok := m.getSessionByID(sessionID)
	if !ok {
		return
	}

	ctx, cancel := context.WithCancel(context.Background())

	m.mu.Lock()
	if s.closed {
		m.mu.Unlock()
		cancel()
		return
	}
	s.currentRun = cancel
	m.mu.Unlock()
	defer cancel()

	config, err := m.resolver.Resolve(ctx, s.userID)
	if err != nil {
		m.failSessionTurn(s, "config_error", err.Error())
		return
	}

	model := strings.TrimSpace(s.model)
	if model == "" {
		model = config.Model
	}
	if model == "" {
		m.failSessionTurn(s, "model_missing", "未找到可用模型配置")
		return
	}

	for round := 0; round < m.maxRounds; round++ {
		tools := m.registry.VisibleForMode(s.permissionMode)
		systemPrompt := buildToolSystemPrompt(s.permissionMode, tools)

		m.mu.RLock()
		if s.closed {
			m.mu.RUnlock()
			return
		}
		reqMessages := make([]provider.Message, 0, len(s.messages)+1)
		reqMessages = append(reqMessages, provider.Message{
			Role:    "system",
			Content: systemPrompt,
		})
		reqMessages = append(reqMessages, s.messages...)
		m.mu.RUnlock()

		assistantMessageID := uuid.NewString()
		result, err := m.factory.StreamTurn(ctx, config, provider.TurnRequest{
			Model:    model,
			Messages: reqMessages,
			Tools:    tools,
		}, func(evt provider.Event) error {
			if evt.Type != provider.EventTextDelta || evt.Delta == "" {
				return nil
			}

			m.appendAssistantDelta(s, assistantMessageID, evt.Delta)
			m.emitEvent(s, Event{
				ID:        uuid.NewString(),
				Type:      EventAssistantDelta,
				SessionID: s.id,
				CreatedAt: time.Now(),
				Assistant: &AssistantEventData{
					MessageID: assistantMessageID,
					Delta:     evt.Delta,
				},
			})
			return nil
		})
		if err != nil {
			m.failSessionTurn(s, "provider_error", err.Error())
			return
		}

		m.finalizeAssistantTurn(s, assistantMessageID, result)
		if len(result.ToolCalls) == 0 {
			m.completeTurn(s, false)
			return
		}

		autoTasks, pendingConfirm := m.materializeTasks(s, result.ToolCalls)
		for _, taskID := range autoTasks {
			m.executeTask(ctx, s, taskID)
		}

		if pendingConfirm {
			m.mu.Lock()
			if !s.closed {
				s.status = SessionStatusWaitingConfirmation
				s.processing = false
				s.currentRun = nil
				s.updatedAt = time.Now()
			}
			m.mu.Unlock()
			return
		}
	}

	m.failSessionTurn(s, "max_rounds_reached", errConversationMaxRoundsReached.Error())
}

func (m *Manager) resolvePendingTask(sessionID, taskID string, decision Decision) {
	s, ok := m.getSessionByID(sessionID)
	if !ok {
		return
	}

	if decision == DecisionConfirm {
		m.executeTask(context.Background(), s, taskID)
	} else {
		m.rejectTask(s, taskID)
	}

	m.mu.Lock()
	if s.closed {
		m.mu.Unlock()
		return
	}
	if s.hasPendingConfirmation() {
		s.status = SessionStatusWaitingConfirmation
		s.processing = false
		s.currentRun = nil
		s.updatedAt = time.Now()
		m.mu.Unlock()
		return
	}

	s.status = SessionStatusRunning
	s.processing = true
	s.updatedAt = time.Now()
	m.mu.Unlock()

	go m.runSession(sessionID)
}

func (m *Manager) executeTask(ctx context.Context, s *session, taskID string) {
	m.mu.Lock()
	task, ok := s.tasks[taskID]
	if !ok || s.closed {
		m.mu.Unlock()
		return
	}
	task.view.Status = TaskStatusRunning
	task.view.UpdatedAt = time.Now()
	s.updatedAt = task.view.UpdatedAt
	view := task.view
	m.mu.Unlock()

	m.emitTaskEvent(s, EventTaskUpdated, view)

	result, err := task.spec.Executor(ctx, s.userID, task.toolCall.Arguments)

	m.mu.Lock()
	task, ok = s.tasks[taskID]
	if !ok {
		m.mu.Unlock()
		return
	}

	now := time.Now()
	toolMessage := ""
	if err != nil {
		task.view.Status = TaskStatusFailed
		task.view.Error = err.Error()
		toolMessage = "工具执行失败: " + err.Error()
	} else if result.IsError {
		task.view.Status = TaskStatusFailed
		task.view.Result = result.Content
		task.view.Error = result.Content
		toolMessage = result.Content
	} else {
		task.view.Status = TaskStatusSucceeded
		task.view.Result = result.Content
		toolMessage = result.Content
	}

	task.view.UpdatedAt = now
	s.updatedAt = now
	s.messages = append(s.messages, provider.Message{
		Role:       "tool",
		Content:    toolMessage,
		ToolCallID: task.toolCall.ID,
	})
	view = task.view
	m.mu.Unlock()

	m.emitTaskEvent(s, EventTaskUpdated, view)
}

func (m *Manager) rejectTask(s *session, taskID string) {
	m.mu.Lock()
	task, ok := s.tasks[taskID]
	if !ok {
		m.mu.Unlock()
		return
	}

	now := time.Now()
	task.view.Status = TaskStatusCancelled
	task.view.Result = "用户已拒绝执行该操作。"
	task.view.UpdatedAt = now
	s.updatedAt = now
	s.messages = append(s.messages, provider.Message{
		Role:       "tool",
		Content:    task.view.Result,
		ToolCallID: task.toolCall.ID,
	})
	view := task.view
	m.mu.Unlock()

	m.emitTaskEvent(s, EventTaskUpdated, view)
}

func (m *Manager) materializeTasks(s *session, toolCalls []registry.ToolCall) ([]string, bool) {
	autoTasks := make([]string, 0, len(toolCalls))
	pendingConfirm := false

	for _, tc := range toolCalls {
		spec, ok := m.registry.Get(tc.Name)
		taskID := uuid.NewString()
		args := decodeArguments(tc.Arguments)
		now := time.Now()

		view := TaskView{
			ID:                   taskID,
			ToolCallID:           tc.ID,
			ToolName:             tc.Name,
			ToolDisplayName:      coalesce(spec.DisplayName, tc.Name),
			Summary:              summarizeTask(tc.Name, args),
			Status:               TaskStatusQueued,
			Dangerous:            spec.Dangerous,
			RequiresConfirmation: spec.ConfirmStrategy == registry.ConfirmUser,
			Arguments:            args,
			CreatedAt:            now,
			UpdatedAt:            now,
		}

		if !ok {
			view.Status = TaskStatusFailed
			view.Error = fmt.Sprintf("未知工具: %s", tc.Name)
			view.Result = view.Error

			m.mu.Lock()
			s.tasks[taskID] = &taskState{
				spec:     spec,
				toolCall: tc,
				view:     view,
			}
			s.taskOrder = append(s.taskOrder, taskID)
			s.messages = append(s.messages, provider.Message{
				Role:       "tool",
				Content:    view.Error,
				ToolCallID: tc.ID,
			})
			s.updatedAt = now
			m.mu.Unlock()

			m.emitTaskEvent(s, EventTaskCreated, view)
			m.emitTaskEvent(s, EventTaskUpdated, view)
			continue
		}

		m.mu.Lock()
		s.tasks[taskID] = &taskState{
			spec:     spec,
			toolCall: tc,
			view:     view,
		}
		s.taskOrder = append(s.taskOrder, taskID)
		s.updatedAt = now
		m.mu.Unlock()

		m.emitTaskEvent(s, EventTaskCreated, view)

		if spec.ConfirmStrategy == registry.ConfirmUser {
			m.mu.Lock()
			task := s.tasks[taskID]
			task.view.Status = TaskStatusWaitingConfirm
			task.view.UpdatedAt = time.Now()
			view = task.view
			s.updatedAt = task.view.UpdatedAt
			m.mu.Unlock()

			pendingConfirm = true
			m.emitTaskEvent(s, EventTaskUpdated, view)
			m.emitEvent(s, Event{
				ID:        uuid.NewString(),
				Type:      EventConfirmationRequested,
				SessionID: s.id,
				CreatedAt: time.Now(),
				Confirmation: &ConfirmationView{
					TaskID:    taskID,
					Status:    string(view.Status),
					CreatedAt: time.Now(),
				},
			})
			continue
		}

		autoTasks = append(autoTasks, taskID)
	}

	return autoTasks, pendingConfirm
}

func (m *Manager) finalizeAssistantTurn(s *session, messageID string, result provider.TurnResult) {
	m.mu.Lock()
	if result.Content != "" {
		s.upsertAssistantMessage(messageID, result.Content)
	}
	s.messages = append(s.messages, provider.Message{
		Role:      "assistant",
		Content:   result.Content,
		ToolCalls: result.ToolCalls,
	})
	s.updatedAt = time.Now()
	content := result.Content
	m.mu.Unlock()

	m.emitEvent(s, Event{
		ID:        uuid.NewString(),
		Type:      EventAssistantCompleted,
		SessionID: s.id,
		CreatedAt: time.Now(),
		Assistant: &AssistantEventData{
			MessageID: messageID,
			Content:   content,
		},
	})
}

func (m *Manager) appendAssistantDelta(s *session, messageID, delta string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	s.appendAssistantDelta(messageID, delta)
	s.updatedAt = time.Now()
}

func (m *Manager) completeTurn(s *session, closed bool) {
	m.mu.Lock()
	if !s.closed {
		if closed {
			s.status = SessionStatusClosed
		} else {
			s.status = SessionStatusIdle
		}
		s.processing = false
		s.currentRun = nil
		s.updatedAt = time.Now()
	}
	view := m.snapshotSessionLocked(s)
	m.mu.Unlock()

	m.emitEvent(s, Event{
		ID:        uuid.NewString(),
		Type:      EventSessionCompleted,
		SessionID: s.id,
		CreatedAt: time.Now(),
		Session:   &view,
	})
}

func (m *Manager) failSessionTurn(s *session, code, message string) {
	m.emitEvent(s, Event{
		ID:        uuid.NewString(),
		Type:      EventError,
		SessionID: s.id,
		CreatedAt: time.Now(),
		Error: &ErrorView{
			Code:    code,
			Message: message,
		},
	})
	m.completeTurn(s, false)
}

func (m *Manager) snapshotSession(s *session) SessionView {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.snapshotSessionLocked(s)
}

func (m *Manager) snapshotSessionLocked(s *session) SessionView {
	messages := make([]MessageView, len(s.messageViews))
	copy(messages, s.messageViews)

	tasks := make([]TaskView, 0, len(s.taskOrder))
	for _, taskID := range s.taskOrder {
		if task, ok := s.tasks[taskID]; ok {
			tasks = append(tasks, task.view)
		}
	}

	return SessionView{
		ID:               s.id,
		Model:            s.model,
		PermissionMode:   s.permissionMode,
		Status:           s.status,
		CreatedAt:        s.createdAt,
		UpdatedAt:        s.updatedAt,
		Messages:         messages,
		Tasks:            tasks,
		AvailableTools:   buildToolViews(m.registry.VisibleForMode(s.permissionMode)),
		DefaultTransport: TransportWS,
	}
}

func (m *Manager) emitTaskEvent(s *session, eventType EventType, task TaskView) {
	m.emitEvent(s, Event{
		ID:        uuid.NewString(),
		Type:      eventType,
		SessionID: s.id,
		CreatedAt: time.Now(),
		Task:      &task,
	})
}

func (m *Manager) emitEvent(s *session, event Event) {
	m.mu.RLock()
	subs := cloneSubscribersLocked(s)
	m.mu.RUnlock()
	m.emitToSubscribers(subs, event)
}

func (m *Manager) emitToSubscribers(subs []chan Event, event Event) {
	for _, ch := range subs {
		select {
		case ch <- event:
		default:
		}
	}
}

func (m *Manager) getSession(userID uuid.UUID, sessionID string) (*session, error) {
	s, ok := m.getSessionByID(sessionID)
	if !ok || s.userID != userID {
		return nil, ErrSessionNotFound
	}
	return s, nil
}

func (m *Manager) getSessionByID(sessionID string) (*session, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	s, ok := m.sessions[sessionID]
	return s, ok
}

func (m *Manager) cleanupLoop() {
	ticker := time.NewTicker(m.cleanupGap)
	defer ticker.Stop()

	for range ticker.C {
		type expiredSession struct {
			session *session
			view    SessionView
			subs    []chan Event
		}

		expired := make([]expiredSession, 0)

		m.mu.Lock()
		now := time.Now()
		for id, s := range m.sessions {
			if s.closed || now.Sub(s.updatedAt) > m.ttl {
				s.closed = true
				s.status = SessionStatusClosed
				s.processing = false
				cancel := s.currentRun
				s.currentRun = nil
				s.updatedAt = now
				if cancel != nil {
					cancel()
				}
				expired = append(expired, expiredSession{
					session: s,
					view:    m.snapshotSessionLocked(s),
					subs:    cloneSubscribersLocked(s),
				})
				s.subscribers = make(map[string]chan Event)
				delete(m.sessions, id)
			}
		}
		m.mu.Unlock()

		for _, item := range expired {
			m.emitToSubscribers(item.subs, Event{
				ID:        uuid.NewString(),
				Type:      EventSessionCompleted,
				SessionID: item.session.id,
				CreatedAt: time.Now(),
				Session:   &item.view,
			})

			for _, ch := range item.subs {
				close(ch)
			}
		}
	}
}

func cloneSubscribersLocked(s *session) []chan Event {
	result := make([]chan Event, 0, len(s.subscribers))
	for _, ch := range s.subscribers {
		result = append(result, ch)
	}
	return result
}

func (s *session) appendAssistantDelta(messageID, delta string) {
	for i := range s.messageViews {
		if s.messageViews[i].ID == messageID {
			s.messageViews[i].Content += delta
			return
		}
	}

	s.messageViews = append(s.messageViews, MessageView{
		ID:        messageID,
		Role:      "assistant",
		Content:   delta,
		CreatedAt: time.Now(),
	})
}

func (s *session) upsertAssistantMessage(messageID, content string) {
	for i := range s.messageViews {
		if s.messageViews[i].ID == messageID {
			s.messageViews[i].Content = content
			return
		}
	}

	if content == "" {
		return
	}

	s.messageViews = append(s.messageViews, MessageView{
		ID:        messageID,
		Role:      "assistant",
		Content:   content,
		CreatedAt: time.Now(),
	})
}

func (s *session) hasPendingConfirmation() bool {
	for _, task := range s.tasks {
		if task.view.Status == TaskStatusWaitingConfirm {
			return true
		}
	}
	return false
}

func buildToolViews(specs []registry.ToolSpec) []ToolView {
	views := make([]ToolView, 0, len(specs))
	for _, spec := range specs {
		views = append(views, ToolView{
			Name:        spec.Name,
			DisplayName: spec.DisplayName,
			Description: spec.Description,
			Dangerous:   spec.Dangerous,
		})
	}
	sort.SliceStable(views, func(i, j int) bool {
		return views[i].Name < views[j].Name
	})
	return views
}

func normalizePermissionMode(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "readonly":
		return "readonly"
	case "privileged":
		return "privileged"
	default:
		return "balanced"
	}
}

func buildToolSystemPrompt(permissionMode string, allowedTools []registry.ToolSpec) string {
	var sb strings.Builder
	sb.WriteString("你是一个服务器管理助手，可以帮助用户管理和操作他们的服务器。\n\n")
	sb.WriteString("重要规则：\n")
	sb.WriteString("1. 当用户请求需要执行操作时，你应该直接调用相应工具，不要先用文字询问是否允许。\n")
	sb.WriteString("2. 工具权限与危险操作确认由系统负责，你需要专注于理解需求、正确调用工具、基于结果给出结论。\n")
	sb.WriteString("3. 如果需要多个步骤，请按顺序执行，并始终基于上一步结果推进。\n")
	sb.WriteString("4. 获取工具结果后，必须先引用关键数据给出结论，不要只给模板化建议。\n")
	sb.WriteString("5. 只有当前结果不足以支持结论时，才继续调用下一步工具。\n")
	sb.WriteString("6. 不要重复粘贴大段原始输出，优先提炼关键发现与下一步行动。\n")
	sb.WriteString("7. 当前权限规则：")
	sb.WriteString(permissionRule(permissionMode))
	sb.WriteString("\n\n")
	sb.WriteString("本会话可用工具：\n")
	for _, tool := range allowedTools {
		sb.WriteString("- ")
		sb.WriteString(tool.Name)
		sb.WriteString(": ")
		sb.WriteString(tool.Description)
		sb.WriteString("\n")
	}

	return sb.String()
}

func permissionRule(mode string) string {
	switch normalizePermissionMode(mode) {
	case "readonly":
		return "当前是只读分析模式：仅允许查询、读取、分析；如果用户要求写入、删除或状态变更，请明确说明限制并给出只读替代方案。"
	case "privileged":
		return "当前是高权限模式：可使用当前会话可见的全部工具；涉及高风险操作时仍需先说明风险与影响。"
	default:
		return "当前是标准模式：允许常规运维操作；危险动作会进入系统确认流程。"
	}
}

func decodeArguments(raw json.RawMessage) map[string]interface{} {
	if len(raw) == 0 {
		return nil
	}

	var args map[string]interface{}
	if err := json.Unmarshal(raw, &args); err != nil {
		return map[string]interface{}{
			"_raw": string(raw),
		}
	}
	return args
}

func summarizeTask(toolName string, args map[string]interface{}) string {
	if len(args) == 0 {
		return toolName
	}

	for _, key := range []string{"command", "path", "server_id"} {
		if value, ok := args[key]; ok {
			text := fmt.Sprint(value)
			if len(text) > 48 {
				text = text[:48] + "..."
			}
			return text
		}
	}

	return toolName
}

func coalesce(value string, fallback string) string {
	if strings.TrimSpace(value) != "" {
		return value
	}
	return fallback
}
