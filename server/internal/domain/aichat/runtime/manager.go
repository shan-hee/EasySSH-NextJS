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
	store      SessionStore
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
	title          string
	permissionMode string
	scope          SessionScope
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

func (m *Manager) SetSessionStore(store SessionStore) {
	m.store = store
}

func (m *Manager) CreateSession(ctx context.Context, userID uuid.UUID, input CreateSessionInput) (*SessionView, error) {
	now := time.Now()
	sessionID := uuid.NewString()

	s := &session{
		id:             sessionID,
		userID:         userID,
		model:          strings.TrimSpace(input.Model),
		permissionMode: normalizePermissionMode(input.PermissionMode),
		scope:          normalizeSessionScope(input.Scope),
		status:         SessionStatusIdle,
		createdAt:      now,
		updatedAt:      now,
		tasks:          make(map[string]*taskState),
		subscribers:    make(map[string]chan Event),
	}

	m.mu.Lock()
	m.sessions[sessionID] = s
	view := m.snapshotSessionLocked(s)
	snapshot := m.snapshotForPersistenceLocked(s)
	m.mu.Unlock()

	m.saveSnapshot(ctx, snapshot)
	return &view, nil
}

func (m *Manager) GetSession(userID uuid.UUID, sessionID string) (*SessionView, error) {
	s, err := m.getOrRestoreSession(context.Background(), userID, sessionID)
	if err != nil {
		return nil, err
	}

	view := m.snapshotSession(s)
	return &view, nil
}

func (m *Manager) ListSessions(ctx context.Context, userID uuid.UUID, query string, limit, offset int, scope ...SessionScope) ([]SessionListItem, int64, error) {
	filterScope := normalizeSessionScopeFromVariadic(scope)
	if m.store != nil && filterScope.Kind == "" {
		snapshots, total, err := m.store.List(ctx, userID, strings.TrimSpace(query), limit, offset)
		if err != nil {
			return nil, 0, err
		}

		items := make([]SessionListItem, 0, len(snapshots))
		for _, snapshot := range snapshots {
			items = append(items, sessionListItemFromSnapshot(snapshot))
		}
		return items, total, nil
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	items := make([]SessionListItem, 0)
	query = strings.ToLower(strings.TrimSpace(query))
	for _, s := range m.sessions {
		if s.userID != userID {
			continue
		}
		if !sessionMatchesScope(s, filterScope) {
			continue
		}
		item := sessionListItemFromSnapshot(m.snapshotForPersistenceLocked(s))
		if query != "" && !strings.Contains(strings.ToLower(item.Title), query) {
			continue
		}
		items = append(items, item)
	}

	sort.SliceStable(items, func(i, j int) bool {
		return items[i].UpdatedAt.After(items[j].UpdatedAt)
	})

	total := int64(len(items))
	if offset < 0 {
		offset = 0
	}
	if limit <= 0 || limit > 100 {
		limit = 30
	}
	if offset >= len(items) {
		return nil, total, nil
	}
	end := offset + limit
	if end > len(items) {
		end = len(items)
	}
	return items[offset:end], total, nil
}

func (m *Manager) RenameSession(ctx context.Context, userID uuid.UUID, sessionID, title string) error {
	title = strings.TrimSpace(title)
	if title == "" {
		return ErrEmptyMessageContent
	}
	if len([]rune(title)) > 80 {
		title = string([]rune(title)[:80])
	}

	storeMissing := false
	if m.store != nil {
		if err := m.store.Rename(ctx, userID, sessionID, title); err != nil {
			if !errors.Is(err, ErrSessionNotFound) {
				return err
			}
			storeMissing = true
		}
	}

	m.mu.Lock()
	if s, ok := m.sessions[sessionID]; ok && s.userID == userID {
		s.title = title
		s.updatedAt = time.Now()
		snapshot := m.snapshotForPersistenceLocked(s)
		m.mu.Unlock()
		m.saveSnapshot(ctx, snapshot)
		return nil
	}
	m.mu.Unlock()

	if m.store == nil || storeMissing {
		return ErrSessionNotFound
	}
	return nil
}

func (m *Manager) DeleteSession(ctx context.Context, userID uuid.UUID, sessionID string) error {
	storeMissing := false
	if m.store != nil {
		if err := m.store.Delete(ctx, userID, sessionID); err != nil {
			if !errors.Is(err, ErrSessionNotFound) {
				return err
			}
			storeMissing = true
		}
	}

	m.mu.Lock()
	if s, ok := m.sessions[sessionID]; ok && s.userID == userID {
		cancel := s.currentRun
		subs := cloneSubscribersLocked(s)
		delete(m.sessions, sessionID)
		s.subscribers = make(map[string]chan Event)
		s.closed = true
		s.processing = false
		s.currentRun = nil
		m.mu.Unlock()

		if cancel != nil {
			cancel()
		}
		for _, ch := range subs {
			close(ch)
		}
		return nil
	}
	m.mu.Unlock()

	if m.store == nil || storeMissing {
		return ErrSessionNotFound
	}
	return nil
}

func (m *Manager) GetLatestActiveSession(ctx context.Context, userID uuid.UUID) (*SessionView, error) {
	if m.store == nil {
		return nil, ErrSessionNotFound
	}

	snapshot, err := m.store.GetLatestActive(ctx, userID)
	if err != nil {
		return nil, err
	}

	s, err := m.restoreSnapshot(snapshot)
	if err != nil {
		return nil, err
	}

	view := m.snapshotSession(s)
	return &view, nil
}

func (m *Manager) Subscribe(userID uuid.UUID, sessionID string) (<-chan Event, func(), error) {
	s, err := m.getOrRestoreSession(context.Background(), userID, sessionID)
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
	return m.SendUserMessageWithOptions(ctx, userID, sessionID, SendUserMessageInput{Content: content})
}

func (m *Manager) SendUserMessageWithOptions(ctx context.Context, userID uuid.UUID, sessionID string, input SendUserMessageInput) error {
	content := strings.TrimSpace(input.Content)
	if content == "" {
		return ErrEmptyMessageContent
	}
	model := strings.TrimSpace(input.Model)
	permissionMode := strings.TrimSpace(input.PermissionMode)
	scope := normalizeSessionScope(input.Scope)

	s, err := m.getOrRestoreSession(ctx, userID, sessionID)
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
	if model != "" {
		s.model = model
	}
	if permissionMode != "" {
		s.permissionMode = normalizePermissionMode(permissionMode)
	}
	if scope.Kind != "" {
		s.scope = scope
	}
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
	snapshot := m.snapshotForPersistenceLocked(s)
	m.mu.Unlock()

	m.saveSnapshot(ctx, snapshot)
	go m.runSession(sessionID)
	return nil
}

func (m *Manager) ConfirmTask(ctx context.Context, userID uuid.UUID, sessionID, taskID string, decision Decision) error {
	return m.ConfirmTasks(ctx, userID, sessionID, []ConfirmTaskInput{{TaskID: taskID, Decision: decision}})
}

func (m *Manager) ConfirmTasks(ctx context.Context, userID uuid.UUID, sessionID string, inputs []ConfirmTaskInput) error {
	s, err := m.getOrRestoreSession(ctx, userID, sessionID)
	if err != nil {
		return err
	}

	if len(inputs) == 0 {
		return ErrInvalidDecision
	}
	for _, input := range inputs {
		if input.Decision != DecisionConfirm && input.Decision != DecisionReject {
			return ErrInvalidDecision
		}
	}

	m.mu.Lock()
	if s.closed {
		m.mu.Unlock()
		return ErrSessionClosed
	}
	for _, input := range inputs {
		task, ok := s.tasks[input.TaskID]
		if !ok {
			m.mu.Unlock()
			return ErrTaskNotFound
		}
		if task.view.Status != TaskStatusWaitingConfirm {
			m.mu.Unlock()
			return ErrTaskConfirmationNotPending
		}
	}

	now := time.Now()
	resolved := make([]struct {
		view     TaskView
		decision Decision
		status   string
	}, 0, len(inputs))
	for _, input := range inputs {
		task := s.tasks[input.TaskID]
		confirmationStatus := string(task.view.Status)
		if input.Decision == DecisionConfirm {
			s.status = SessionStatusRunning
			task.view.Status = TaskStatusRunning
			confirmationStatus = string(TaskStatusRunning)
		} else {
			task.view.Status = TaskStatusCancelled
			task.view.Result = "用户已拒绝执行该操作。"
			confirmationStatus = string(TaskStatusCancelled)
		}
		task.view.UpdatedAt = now
		resolved = append(resolved, struct {
			view     TaskView
			decision Decision
			status   string
		}{
			view:     task.view,
			decision: input.Decision,
			status:   confirmationStatus,
		})
	}
	s.updatedAt = now
	snapshot := m.snapshotForPersistenceLocked(s)
	m.mu.Unlock()

	m.saveSnapshot(ctx, snapshot)
	for _, item := range resolved {
		view := item.view
		m.emitEvent(s, Event{
			ID:        uuid.NewString(),
			Type:      EventConfirmationResolved,
			SessionID: s.id,
			CreatedAt: now,
			Confirmation: &ConfirmationView{
				TaskID:    view.ID,
				Status:    item.status,
				Decision:  string(item.decision),
				CreatedAt: now,
			},
			UIMessage: uiMessagePtrForTask(view),
		})
	}

	go m.resolvePendingTasks(sessionID, inputs)
	return nil
}

func (m *Manager) CancelSession(ctx context.Context, userID uuid.UUID, sessionID string) error {
	s, err := m.getOrRestoreSession(ctx, userID, sessionID)
	if err != nil {
		return err
	}

	m.mu.Lock()
	if s.closed {
		m.mu.Unlock()
		return ErrSessionClosed
	}
	cancel := s.currentRun
	s.currentRun = nil
	s.processing = false
	s.status = SessionStatusIdle
	s.updatedAt = time.Now()
	view := m.snapshotSessionLocked(s)
	snapshot := m.snapshotForPersistenceLocked(s)
	m.mu.Unlock()

	if cancel != nil {
		cancel()
	}
	m.saveSnapshot(ctx, snapshot)
	m.emitEvent(s, Event{
		ID:        uuid.NewString(),
		Type:      EventSessionCompleted,
		SessionID: s.id,
		CreatedAt: time.Now(),
		Session:   &view,
	})
	return nil
}

func (m *Manager) CloseSession(userID uuid.UUID, sessionID string) error {
	s, err := m.getOrRestoreSession(context.Background(), userID, sessionID)
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
	snapshot := m.snapshotForPersistenceLocked(s)
	subs := cloneSubscribersLocked(s)
	s.subscribers = make(map[string]chan Event)
	delete(m.sessions, s.id)
	m.mu.Unlock()

	if cancel != nil {
		cancel()
	}

	m.saveSnapshot(context.Background(), snapshot)
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
		tools := m.visibleToolsForSession(s)
		systemPrompt := buildToolSystemPrompt(s.permissionMode, tools, s.scope)

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
				UIMessage: m.uiMessageForAssistantDelta(s, assistantMessageID),
			})
			return nil
		})
		if err != nil {
			if ctx.Err() != nil {
				m.completeTurn(s, false)
				return
			}
			m.failSessionTurn(s, "provider_error", err.Error())
			return
		}

		m.finalizeAssistantTurn(s, assistantMessageID, result)
		if len(result.ToolCalls) == 0 {
			m.completeTurn(s, false)
			return
		}

		autoTasks, pendingConfirm := m.materializeTasks(s, assistantMessageID, result.ToolCalls)
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
			view := m.snapshotSessionLocked(s)
			snapshot := m.snapshotForPersistenceLocked(s)
			m.mu.Unlock()
			m.saveSnapshot(context.Background(), snapshot)
			m.emitEvent(s, Event{
				ID:        uuid.NewString(),
				Type:      EventSessionCompleted,
				SessionID: s.id,
				CreatedAt: time.Now(),
				Session:   &view,
			})
			return
		}
	}

	m.failSessionTurn(s, "max_rounds_reached", errConversationMaxRoundsReached.Error())
}

func (m *Manager) resolvePendingTasks(sessionID string, inputs []ConfirmTaskInput) {
	s, ok := m.getSessionByID(sessionID)
	if !ok {
		return
	}

	for _, input := range inputs {
		if input.Decision == DecisionConfirm {
			m.executeTask(context.Background(), s, input.TaskID)
		} else {
			m.rejectTask(s, input.TaskID)
		}
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
		snapshot := m.snapshotForPersistenceLocked(s)
		m.mu.Unlock()
		m.saveSnapshot(context.Background(), snapshot)
		return
	}

	s.status = SessionStatusRunning
	s.processing = true
	s.updatedAt = time.Now()
	snapshot := m.snapshotForPersistenceLocked(s)
	m.mu.Unlock()

	m.saveSnapshot(context.Background(), snapshot)
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
	snapshot := m.snapshotForPersistenceLocked(s)
	m.mu.Unlock()

	m.saveSnapshot(context.Background(), snapshot)
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
	snapshot = m.snapshotForPersistenceLocked(s)
	m.mu.Unlock()

	m.saveSnapshot(context.Background(), snapshot)
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
	snapshot := m.snapshotForPersistenceLocked(s)
	m.mu.Unlock()

	m.saveSnapshot(context.Background(), snapshot)
	m.emitTaskEvent(s, EventTaskUpdated, view)
}

func (m *Manager) materializeTasks(s *session, assistantMessageID string, toolCalls []registry.ToolCall) ([]string, bool) {
	autoTasks := make([]string, 0, len(toolCalls))
	pendingConfirm := false

	for _, tc := range toolCalls {
		tc = scopeToolCall(s.scope, tc)
		spec, ok := m.registry.Get(tc.Name)
		taskID := uuid.NewString()
		args := decodeArguments(tc.Arguments)
		now := time.Now()

		view := TaskView{
			ID:                   taskID,
			AssistantMessageID:   assistantMessageID,
			ToolCallID:           tc.ID,
			ToolName:             tc.Name,
			ToolDisplayName:      coalesce(spec.DisplayName, tc.Name),
			Summary:              summarizeTask(tc.Name, args),
			Status:               TaskStatusQueued,
			Dangerous:            spec.Dangerous,
			RequiresConfirmation: requiresUserConfirmation(s.permissionMode, spec),
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
			snapshot := m.snapshotForPersistenceLocked(s)
			m.mu.Unlock()

			m.saveSnapshot(context.Background(), snapshot)
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
		snapshot := m.snapshotForPersistenceLocked(s)
		m.mu.Unlock()

		m.saveSnapshot(context.Background(), snapshot)
		m.emitTaskEvent(s, EventTaskCreated, view)

		if requiresUserConfirmation(s.permissionMode, spec) {
			m.mu.Lock()
			task := s.tasks[taskID]
			task.view.Status = TaskStatusWaitingConfirm
			task.view.UpdatedAt = time.Now()
			view = task.view
			s.updatedAt = task.view.UpdatedAt
			snapshot = m.snapshotForPersistenceLocked(s)
			m.mu.Unlock()

			m.saveSnapshot(context.Background(), snapshot)
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
				UIMessage: uiMessagePtrForTask(view),
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
	snapshot := m.snapshotForPersistenceLocked(s)
	m.mu.Unlock()

	m.saveSnapshot(context.Background(), snapshot)
	m.emitEvent(s, Event{
		ID:        uuid.NewString(),
		Type:      EventAssistantCompleted,
		SessionID: s.id,
		CreatedAt: time.Now(),
		Assistant: &AssistantEventData{
			MessageID: messageID,
			Content:   content,
		},
		UIMessage: m.uiMessageForAssistantMessage(s, messageID),
	})
}

func (m *Manager) appendAssistantDelta(s *session, messageID, delta string) {
	m.mu.Lock()
	s.appendAssistantDelta(messageID, delta)
	s.updatedAt = time.Now()
	snapshot := m.snapshotForPersistenceLocked(s)
	m.mu.Unlock()

	m.saveSnapshot(context.Background(), snapshot)
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
	snapshot := m.snapshotForPersistenceLocked(s)
	m.mu.Unlock()

	m.saveSnapshot(context.Background(), snapshot)
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
		Scope:            s.scope,
		Status:           s.status,
		CreatedAt:        s.createdAt,
		UpdatedAt:        s.updatedAt,
		Messages:         messages,
		Tasks:            tasks,
		UIMessages:       m.buildUIMessagesLocked(s),
		AvailableTools:   buildToolViews(m.visibleToolsForSessionLocked(s)),
		DefaultTransport: TransportAISDKUI,
	}
}

func (m *Manager) emitTaskEvent(s *session, eventType EventType, task TaskView) {
	m.emitEvent(s, Event{
		ID:        uuid.NewString(),
		Type:      eventType,
		SessionID: s.id,
		CreatedAt: time.Now(),
		Task:      &task,
		UIMessage: uiMessagePtrForTask(task),
	})
}

func (m *Manager) buildUIMessagesLocked(s *session) []UIMessage {
	items := make([]uiTimelineItem, 0, len(s.messageViews)+len(s.taskOrder))
	sequence := 0
	for _, message := range s.messageViews {
		items = append(items, uiTimelineItem{
			createdAt:  message.CreatedAt,
			sequence:   sequence,
			message:    message,
			hasMessage: true,
		})
		sequence++
	}
	for _, taskID := range s.taskOrder {
		if task, ok := s.tasks[taskID]; ok {
			items = append(items, uiTimelineItem{
				createdAt: task.view.CreatedAt,
				sequence:  sequence,
				task:      task.view,
				hasTask:   true,
			})
			sequence++
		}
	}

	sort.SliceStable(items, func(i, j int) bool {
		if items[i].createdAt.Equal(items[j].createdAt) {
			return items[i].sequence < items[j].sequence
		}
		return items[i].createdAt.Before(items[j].createdAt)
	})

	messages := make([]UIMessage, 0, len(items))
	currentAssistantIndex := -1
	currentStepSource := ""

	for _, item := range items {
		if item.hasMessage {
			message := item.message
			switch message.Role {
			case "user", "system":
				if uiMessage, ok := uiMessageForMessage(message, false); ok {
					messages = append(messages, uiMessage)
				}
				currentAssistantIndex = -1
				currentStepSource = ""
			case "assistant":
				parts := uiPartsForAssistant(message, false)
				if len(parts) == 0 {
					continue
				}
				currentAssistantIndex = ensureAssistantUIMessage(&messages, currentAssistantIndex, message.ID, message.CreatedAt)
				appendStepStartIfNeeded(&messages[currentAssistantIndex], &currentStepSource, message.ID)
				messages[currentAssistantIndex].Parts = append(messages[currentAssistantIndex].Parts, parts...)
			}
			continue
		}

		if item.hasTask {
			task := item.task
			messageID := coalesce(task.AssistantMessageID, "task:"+task.ID)
			currentAssistantIndex = ensureAssistantUIMessage(&messages, currentAssistantIndex, messageID, task.CreatedAt)

			stepSource := task.AssistantMessageID
			if stepSource == "" {
				stepSource = currentStepSource
			}
			if stepSource == "" {
				stepSource = "task:" + task.ID
			}
			appendStepStartIfNeeded(&messages[currentAssistantIndex], &currentStepSource, stepSource)
			messages[currentAssistantIndex].Parts = append(messages[currentAssistantIndex].Parts, uiToolPartForTask(task))
		}
	}

	return messages
}

type uiTimelineItem struct {
	createdAt  time.Time
	sequence   int
	message    MessageView
	hasMessage bool
	task       TaskView
	hasTask    bool
}

func ensureAssistantUIMessage(messages *[]UIMessage, currentIndex int, messageID string, createdAt time.Time) int {
	if currentIndex >= 0 {
		return currentIndex
	}
	if strings.TrimSpace(messageID) == "" {
		messageID = "assistant"
	}
	*messages = append(*messages, UIMessage{
		ID:   messageID,
		Role: "assistant",
		Metadata: map[string]interface{}{
			"source":       "message",
			"createdAt":    createdAt,
			"originalRole": "assistant",
		},
		Parts: []map[string]interface{}{},
	})
	return len(*messages) - 1
}

func appendStepStartIfNeeded(message *UIMessage, currentStepSource *string, sourceID string) {
	if strings.TrimSpace(sourceID) == "" {
		sourceID = "assistant"
	}
	if *currentStepSource == sourceID {
		return
	}
	message.Parts = append(message.Parts, map[string]interface{}{"type": "step-start"})
	*currentStepSource = sourceID
}

func (m *Manager) uiMessageForAssistantDelta(s *session, messageID string) *UIMessage {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, message := range s.messageViews {
		if message.ID == messageID {
			uiMessage := uiMessageForAssistant(message, true)
			return &uiMessage
		}
	}

	return nil
}

func (m *Manager) uiMessageForAssistantMessage(s *session, messageID string) *UIMessage {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, message := range s.messageViews {
		if message.ID == messageID {
			uiMessage := uiMessageForAssistant(message, false)
			return &uiMessage
		}
	}

	return nil
}

func uiMessageForMessage(message MessageView, streaming bool) (UIMessage, bool) {
	switch message.Role {
	case "user":
		return UIMessage{
			ID:   message.ID,
			Role: "user",
			Metadata: map[string]interface{}{
				"source":       "message",
				"createdAt":    message.CreatedAt,
				"originalRole": message.Role,
			},
			Parts: []map[string]interface{}{
				{
					"type":  "text",
					"text":  message.Content,
					"state": "done",
				},
			},
		}, true
	case "assistant":
		return uiMessageForAssistant(message, streaming), true
	case "system":
		return UIMessage{
			ID:   message.ID,
			Role: "system",
			Metadata: map[string]interface{}{
				"source":       "message",
				"createdAt":    message.CreatedAt,
				"originalRole": message.Role,
			},
			Parts: []map[string]interface{}{
				{
					"type":  "text",
					"text":  message.Content,
					"state": "done",
				},
			},
		}, true
	default:
		return UIMessage{}, false
	}
}

func uiMessageForAssistant(message MessageView, streaming bool) UIMessage {
	return UIMessage{
		ID:   message.ID,
		Role: "assistant",
		Metadata: map[string]interface{}{
			"source":       "message",
			"createdAt":    message.CreatedAt,
			"pending":      streaming,
			"originalRole": message.Role,
		},
		Parts: uiPartsForAssistant(message, streaming),
	}
}

func uiPartsForAssistant(message MessageView, streaming bool) []map[string]interface{} {
	toolStatus, withoutToolStatus := extractLastTaggedContent(message.Content, "tool-status")
	reasoning, text := extractLastTaggedContent(withoutToolStatus, "think")
	state := "done"
	if streaming {
		state = "streaming"
	}

	parts := make([]map[string]interface{}, 0, 3)
	if strings.TrimSpace(toolStatus) != "" {
		parts = append(parts, map[string]interface{}{
			"type": "data-tool-status",
			"id":   message.ID + ":tool-status",
			"data": map[string]interface{}{
				"text": strings.TrimSpace(toolStatus),
			},
		})
	}
	if strings.TrimSpace(reasoning) != "" {
		parts = append(parts, map[string]interface{}{
			"type":  "reasoning",
			"text":  strings.TrimSpace(reasoning),
			"state": state,
		})
	}
	if strings.TrimSpace(text) != "" {
		parts = append(parts, map[string]interface{}{
			"type":  "text",
			"text":  strings.TrimSpace(text),
			"state": state,
		})
	}

	return parts
}

func uiMessageForTask(task TaskView) UIMessage {
	return UIMessage{
		ID:   "task:" + task.ID,
		Role: "assistant",
		Metadata: map[string]interface{}{
			"source":               "task",
			"createdAt":            task.CreatedAt,
			"updatedAt":            task.UpdatedAt,
			"taskId":               task.ID,
			"taskStatus":           task.Status,
			"dangerous":            task.Dangerous,
			"requiresConfirmation": task.RequiresConfirmation,
			"displayName":          task.ToolDisplayName,
			"summary":              task.Summary,
		},
		Parts: []map[string]interface{}{uiToolPartForTask(task)},
	}
}

func uiMessagePtrForTask(task TaskView) *UIMessage {
	uiMessage := uiMessageForTask(task)
	return &uiMessage
}

func uiToolPartForTask(task TaskView) map[string]interface{} {
	part := map[string]interface{}{
		"type":             "dynamic-tool",
		"toolName":         task.ToolName,
		"toolCallId":       coalesce(task.ToolCallID, task.ID),
		"title":            coalesce(task.ToolDisplayName, task.ToolName),
		"providerExecuted": false,
		"input":            task.Arguments,
		"toolMetadata": map[string]interface{}{
			"taskId":               task.ID,
			"assistantMessageId":   task.AssistantMessageID,
			"taskStatus":           task.Status,
			"dangerous":            task.Dangerous,
			"requiresConfirmation": task.RequiresConfirmation,
			"displayName":          task.ToolDisplayName,
			"summary":              task.Summary,
		},
	}

	switch task.Status {
	case TaskStatusWaitingConfirm:
		part["state"] = "approval-requested"
		part["approval"] = map[string]interface{}{
			"id": task.ID,
		}
	case TaskStatusSucceeded:
		part["state"] = "output-available"
		part["output"] = task.Result
	case TaskStatusFailed:
		part["state"] = "output-error"
		part["errorText"] = coalesce(task.Error, "Tool execution failed")
	case TaskStatusCancelled:
		part["state"] = "output-denied"
		part["approval"] = map[string]interface{}{
			"id":       task.ID,
			"approved": false,
			"reason":   coalesce(task.Error, task.Result),
		}
	default:
		part["state"] = "input-available"
	}

	if task.Arguments == nil {
		part["input"] = map[string]interface{}{}
	}

	return part
}

func extractLastTaggedContent(content, tagName string) (string, string) {
	openTag := "<" + tagName + ">"
	closeTag := "</" + tagName + ">"
	lower := strings.ToLower(content)
	lowerOpen := strings.ToLower(openTag)
	lowerClose := strings.ToLower(closeTag)

	start := strings.LastIndex(lower, lowerOpen)
	if start < 0 {
		return "", content
	}

	valueStart := start + len(openTag)
	endRelative := strings.Index(lower[valueStart:], lowerClose)
	if endRelative < 0 {
		return strings.TrimSpace(content[valueStart:]), strings.TrimSpace(content[:start])
	}

	end := valueStart + endRelative
	value := content[valueStart:end]
	remaining := strings.TrimSpace(content[:start] + content[end+len(closeTag):])
	return strings.TrimSpace(value), remaining
}

func uiMessageCreatedAt(message UIMessage) time.Time {
	if message.Metadata == nil {
		return time.Time{}
	}
	value, ok := message.Metadata["createdAt"]
	if !ok {
		return time.Time{}
	}
	switch typed := value.(type) {
	case time.Time:
		return typed
	case string:
		parsed, err := time.Parse(time.RFC3339Nano, typed)
		if err == nil {
			return parsed
		}
	}
	return time.Time{}
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

func (m *Manager) getOrRestoreSession(ctx context.Context, userID uuid.UUID, sessionID string) (*session, error) {
	if s, ok := m.getSessionByID(sessionID); ok && s.userID == userID {
		return s, nil
	}
	if m.store == nil {
		return nil, ErrSessionNotFound
	}

	snapshot, err := m.store.Get(ctx, userID, sessionID)
	if err != nil {
		return nil, err
	}
	return m.restoreSnapshot(snapshot)
}

func (m *Manager) restoreSnapshot(snapshot *SessionSnapshot) (*session, error) {
	if snapshot == nil || snapshot.Status == SessionStatusClosed {
		return nil, ErrSessionNotFound
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if existing, ok := m.sessions[snapshot.ID]; ok {
		return existing, nil
	}

	s := &session{
		id:             snapshot.ID,
		userID:         snapshot.UserID,
		model:          snapshot.Model,
		title:          snapshot.Title,
		permissionMode: normalizePermissionMode(snapshot.PermissionMode),
		scope:          normalizeSessionScope(snapshot.Scope),
		status:         snapshot.Status,
		createdAt:      snapshot.CreatedAt,
		updatedAt:      snapshot.UpdatedAt,
		messages:       append([]provider.Message(nil), snapshot.Messages...),
		messageViews:   append([]MessageView(nil), snapshot.MessageViews...),
		tasks:          make(map[string]*taskState),
		taskOrder:      append([]string(nil), snapshot.TaskOrder...),
		subscribers:    make(map[string]chan Event),
	}

	for _, persistedTask := range snapshot.Tasks {
		spec, _ := m.registry.Get(persistedTask.View.ToolName)
		s.tasks[persistedTask.View.ID] = &taskState{
			spec:     spec,
			toolCall: persistedTask.ToolCall,
			view:     persistedTask.View,
		}
	}

	m.sessions[s.id] = s
	return s, nil
}

func (m *Manager) snapshotForPersistenceLocked(s *session) SessionSnapshot {
	tasks := make([]PersistedTask, 0, len(s.taskOrder))
	for _, taskID := range s.taskOrder {
		if task, ok := s.tasks[taskID]; ok {
			tasks = append(tasks, PersistedTask{
				ToolCall: task.toolCall,
				View:     task.view,
			})
		}
	}

	return SessionSnapshot{
		ID:             s.id,
		UserID:         s.userID,
		Model:          s.model,
		Title:          s.title,
		PermissionMode: s.permissionMode,
		Scope:          s.scope,
		Status:         s.status,
		CreatedAt:      s.createdAt,
		UpdatedAt:      s.updatedAt,
		Messages:       append([]provider.Message(nil), s.messages...),
		MessageViews:   append([]MessageView(nil), s.messageViews...),
		Tasks:          tasks,
		TaskOrder:      append([]string(nil), s.taskOrder...),
	}
}

func (m *Manager) saveSnapshot(ctx context.Context, snapshot SessionSnapshot) {
	if m.store == nil {
		return
	}
	if normalizeSessionScope(snapshot.Scope).Kind == "terminal" {
		return
	}
	_ = m.store.Save(ctx, snapshot)
}

func sessionListItemFromSnapshot(snapshot SessionSnapshot) SessionListItem {
	title := strings.TrimSpace(snapshot.Title)
	customTitle := title != ""
	if title == "" {
		title = "新会话"
		for _, message := range snapshot.MessageViews {
			if message.Role != "user" {
				continue
			}
			content := strings.TrimSpace(message.Content)
			if content == "" {
				continue
			}
			title = content
			if runes := []rune(title); len(runes) > 40 {
				title = string(runes[:40]) + "…"
			}
			break
		}
	}

	return SessionListItem{
		ID:             snapshot.ID,
		Model:          snapshot.Model,
		PermissionMode: snapshot.PermissionMode,
		Status:         snapshot.Status,
		Title:          title,
		CustomTitle:    customTitle,
		MessageCount:   len(snapshot.MessageViews),
		TaskCount:      len(snapshot.Tasks),
		CreatedAt:      snapshot.CreatedAt,
		UpdatedAt:      snapshot.UpdatedAt,
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

func requiresUserConfirmation(permissionMode string, spec registry.ToolSpec) bool {
	return normalizePermissionMode(permissionMode) != "privileged" && spec.ConfirmStrategy == registry.ConfirmUser
}

func buildToolSystemPrompt(permissionMode string, allowedTools []registry.ToolSpec, scope SessionScope) string {
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
	if scope.Kind == "terminal" {
		sb.WriteString("\n")
		sb.WriteString("8. 当前会话范围：你正在嵌入一个终端页签中，默认面向当前终端连接的服务器。")
		if scope.ServerID != "" {
			sb.WriteString("除非用户明确要求切换目标，否则工具调用必须使用当前服务器 server_id=")
			sb.WriteString(scope.ServerID)
			sb.WriteString("。")
		} else {
			sb.WriteString("如果缺少当前服务器 ID，请先说明无法定位目标服务器。")
		}
	}
	sb.WriteString("\n\n")
	if scope.Kind == "terminal" {
		sb.WriteString("当前终端上下文：\n")
		sb.WriteString(formatTerminalScope(scope))
		sb.WriteString("\n\n")
	}
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

func (m *Manager) visibleToolsForSession(s *session) []registry.ToolSpec {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.visibleToolsForSessionLocked(s)
}

func (m *Manager) visibleToolsForSessionLocked(s *session) []registry.ToolSpec {
	tools := m.registry.VisibleForMode(s.permissionMode)
	scope := normalizeSessionScope(s.scope)
	if scope.Kind != "terminal" || scope.ServerID == "" {
		return tools
	}

	filtered := make([]registry.ToolSpec, 0, len(tools))
	for _, tool := range tools {
		if tool.Name == "list_servers" {
			continue
		}
		if hasServerIDParameter(tool) {
			tool.Parameters = pinServerIDParameter(tool.Parameters, scope.ServerID)
		}
		filtered = append(filtered, tool)
	}
	return filtered
}

func hasServerIDParameter(tool registry.ToolSpec) bool {
	properties, ok := tool.Parameters["properties"].(map[string]interface{})
	if !ok {
		return false
	}
	_, ok = properties["server_id"]
	return ok
}

func pinServerIDParameter(parameters map[string]interface{}, serverID string) map[string]interface{} {
	next := shallowCopyMap(parameters)
	properties, ok := next["properties"].(map[string]interface{})
	if !ok {
		return next
	}

	nextProperties := shallowCopyMap(properties)
	serverIDParam, _ := nextProperties["server_id"].(map[string]interface{})
	nextServerIDParam := shallowCopyMap(serverIDParam)
	nextServerIDParam["const"] = serverID
	nextServerIDParam["default"] = serverID
	nextServerIDParam["description"] = "当前终端会话服务器 ID。必须使用该值，除非用户明确要求切换目标。"
	nextProperties["server_id"] = nextServerIDParam
	next["properties"] = nextProperties
	return next
}

func shallowCopyMap(input map[string]interface{}) map[string]interface{} {
	next := make(map[string]interface{}, len(input))
	for key, value := range input {
		next[key] = value
	}
	return next
}

func scopeToolCall(scope SessionScope, toolCall registry.ToolCall) registry.ToolCall {
	scope = normalizeSessionScope(scope)
	if scope.Kind != "terminal" || scope.ServerID == "" {
		return toolCall
	}

	args := decodeArguments(toolCall.Arguments)
	if _, ok := args["server_id"]; !ok {
		return toolCall
	}

	args["server_id"] = scope.ServerID
	encoded, err := json.Marshal(args)
	if err != nil {
		return toolCall
	}
	toolCall.Arguments = encoded
	return toolCall
}

func normalizeSessionScope(scope SessionScope) SessionScope {
	normalized := SessionScope{
		Kind:              strings.ToLower(strings.TrimSpace(scope.Kind)),
		TerminalSessionID: strings.TrimSpace(scope.TerminalSessionID),
		ServerID:          strings.TrimSpace(scope.ServerID),
		ServerName:        strings.TrimSpace(scope.ServerName),
		Host:              strings.TrimSpace(scope.Host),
		Port:              scope.Port,
		Username:          strings.TrimSpace(scope.Username),
	}

	switch normalized.Kind {
	case "terminal":
		return normalized
	default:
		if normalized.TerminalSessionID != "" || normalized.ServerID != "" {
			normalized.Kind = "terminal"
			return normalized
		}
		return SessionScope{}
	}
}

func normalizeSessionScopeFromVariadic(scopes []SessionScope) SessionScope {
	if len(scopes) == 0 {
		return SessionScope{}
	}
	return normalizeSessionScope(scopes[0])
}

func sessionMatchesScope(s *session, scope SessionScope) bool {
	if scope.Kind == "" {
		return true
	}
	return scopeMatches(s.scope, scope)
}

func scopeMatches(target, filter SessionScope) bool {
	target = normalizeSessionScope(target)
	filter = normalizeSessionScope(filter)
	if filter.Kind == "" {
		return true
	}
	if target.Kind != filter.Kind {
		return false
	}
	if filter.TerminalSessionID != "" && target.TerminalSessionID != filter.TerminalSessionID {
		return false
	}
	if filter.ServerID != "" && target.ServerID != filter.ServerID {
		return false
	}
	return true
}

func formatTerminalScope(scope SessionScope) string {
	var lines []string
	if scope.TerminalSessionID != "" {
		lines = append(lines, "- terminal_session_id: "+scope.TerminalSessionID)
	}
	if scope.ServerID != "" {
		lines = append(lines, "- server_id: "+scope.ServerID)
	}
	if scope.ServerName != "" {
		lines = append(lines, "- server_name: "+scope.ServerName)
	}
	if scope.Username != "" || scope.Host != "" || scope.Port > 0 {
		target := scope.Username
		if scope.Host != "" {
			if target != "" {
				target += "@"
			}
			target += scope.Host
		}
		if scope.Port > 0 {
			target += fmt.Sprintf(":%d", scope.Port)
		}
		lines = append(lines, "- connection: "+target)
	}
	if len(lines) == 0 {
		return "- 未提供当前终端目标信息"
	}
	return strings.Join(lines, "\n")
}

func permissionRule(mode string) string {
	switch normalizePermissionMode(mode) {
	case "readonly":
		return "当前是只读分析模式：仅允许查询、读取、分析；如果用户要求写入、删除或状态变更，请明确说明限制并给出只读替代方案。"
	case "privileged":
		return "当前是全部权限模式：可直接使用当前会话可见的全部工具；危险操作无需等待二次确认，但需要在结果中说明风险与影响。"
	default:
		return "当前是标准权限模式：允许常规运维操作；危险动作会进入系统确认流程。"
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
