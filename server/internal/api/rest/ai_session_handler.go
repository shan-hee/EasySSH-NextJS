package rest

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/easyssh/server/internal/domain/aichat/runtime"
	"github.com/gin-gonic/gin"
)

type AISessionHandler struct {
	manager *runtime.Manager
}

func NewAISessionHandler(manager *runtime.Manager) *AISessionHandler {
	return &AISessionHandler{manager: manager}
}

type CreateAISessionRequest struct {
	Model          string               `json:"model,omitempty"`
	PermissionMode string               `json:"permission_mode,omitempty" binding:"omitempty,oneof=readonly balanced privileged"`
	Scope          runtime.SessionScope `json:"scope,omitempty"`
}

type CreateAISessionResponse struct {
	SessionID        string                `json:"session_id"`
	Session          *runtime.SessionView  `json:"session"`
	DefaultTransport runtime.TransportType `json:"default_transport"`
}

type ListAISessionsResponse struct {
	Items []runtime.SessionListItem `json:"items"`
	Total int64                     `json:"total"`
}

type AISDKChatApprovalRequest struct {
	TaskID   string `json:"task_id,omitempty"`
	Decision string `json:"decision,omitempty" binding:"omitempty,oneof=confirm reject"`
}

type AISDKChatRequest struct {
	ID             string                    `json:"id,omitempty"`
	Messages       []runtime.UIMessage       `json:"messages,omitempty"`
	Trigger        string                    `json:"trigger,omitempty"`
	MessageID      string                    `json:"messageId,omitempty"`
	Context        string                    `json:"context,omitempty"`
	Model          string                    `json:"model,omitempty"`
	PermissionMode string                    `json:"permission_mode,omitempty" binding:"omitempty,oneof=readonly balanced privileged"`
	Scope          runtime.SessionScope      `json:"scope,omitempty"`
	Approval       *AISDKChatApprovalRequest `json:"approval,omitempty"`
}

type RenameAISessionRequest struct {
	Title string `json:"title" binding:"required"`
}

func (h *AISessionHandler) ListSessions(c *gin.Context) {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	limit, offset := GetPaginationParams(c)
	items, total, err := h.manager.ListSessions(
		c.Request.Context(),
		userID,
		strings.TrimSpace(c.Query("q")),
		limit,
		offset,
		runtime.SessionScope{
			Kind:              strings.TrimSpace(c.Query("scope_kind")),
			TerminalSessionID: strings.TrimSpace(c.Query("terminal_session_id")),
			ServerID:          strings.TrimSpace(c.Query("server_id")),
		},
	)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "list_sessions_failed", err.Error())
		return
	}

	RespondSuccess(c, ListAISessionsResponse{
		Items: items,
		Total: total,
	})
}

func (h *AISessionHandler) GetSession(c *gin.Context) {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	sessionID := strings.TrimSpace(c.Param("session_id"))
	if sessionID == "" {
		RespondError(c, http.StatusBadRequest, "invalid_session_id", "session_id is required")
		return
	}

	view, err := h.manager.GetSession(userID, sessionID)
	if err != nil {
		h.respondRuntimeError(c, err)
		return
	}

	RespondSuccess(c, CreateAISessionResponse{
		SessionID:        view.ID,
		Session:          view,
		DefaultTransport: view.DefaultTransport,
	})
}

func (h *AISessionHandler) GetLatestSession(c *gin.Context) {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	view, err := h.manager.GetLatestActiveSession(c.Request.Context(), userID)
	if err != nil {
		h.respondRuntimeError(c, err)
		return
	}

	RespondSuccess(c, CreateAISessionResponse{
		SessionID:        view.ID,
		Session:          view,
		DefaultTransport: view.DefaultTransport,
	})
}

func (h *AISessionHandler) CreateSession(c *gin.Context) {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	var req CreateAISessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	view, err := h.manager.CreateSession(c.Request.Context(), userID, runtime.CreateSessionInput{
		Model:          req.Model,
		PermissionMode: req.PermissionMode,
		Scope:          req.Scope,
	})
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "create_session_failed", err.Error())
		return
	}

	RespondCreated(c, CreateAISessionResponse{
		SessionID:        view.ID,
		Session:          view,
		DefaultTransport: view.DefaultTransport,
	})
}

func (h *AISessionHandler) Chat(c *gin.Context) {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	sessionID := strings.TrimSpace(c.Param("session_id"))
	if sessionID == "" {
		RespondError(c, http.StatusBadRequest, "invalid_session_id", "session_id is required")
		return
	}

	var req AISDKChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	action, err := resolveAISDKChatAction(req)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	events, unsubscribe, err := h.manager.Subscribe(userID, sessionID)
	if err != nil {
		h.respondRuntimeError(c, err)
		return
	}
	defer unsubscribe()

	switch action.kind {
	case "approval":
		confirmations := make([]runtime.ConfirmTaskInput, 0, len(action.approvals))
		for _, approval := range action.approvals {
			confirmations = append(confirmations, runtime.ConfirmTaskInput{
				TaskID:   approval.taskID,
				Decision: approval.decision,
			})
		}
		if err := h.manager.ConfirmTasks(c.Request.Context(), userID, sessionID, confirmations); err != nil {
			h.respondRuntimeError(c, err)
			return
		}
	case "message":
		if err := h.manager.SendUserMessageWithOptions(
			c.Request.Context(),
			userID,
			sessionID,
			runtime.SendUserMessageInput{
				Content:        buildAISessionMessageContent(action.content, req.Context),
				Model:          req.Model,
				PermissionMode: req.PermissionMode,
				Scope:          req.Scope,
			},
		); err != nil {
			h.respondRuntimeError(c, err)
			return
		}
	default:
		RespondError(c, http.StatusBadRequest, "validation_error", "unsupported AI SDK chat request")
		return
	}

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Vercel-AI-UI-Message-Stream", "v1")
	c.Writer.Header().Set("X-Accel-Buffering", "no")
	c.Status(http.StatusOK)
	c.Writer.Flush()

	streamer := newAISDKUIMessageStreamer(c.Writer, action.kind == "approval")
	for {
		select {
		case <-c.Request.Context().Done():
			return
		case event, ok := <-events:
			if !ok {
				_ = streamer.finish("stop")
				return
			}

			done, err := streamer.writeRuntimeEvent(event)
			if err != nil {
				return
			}
			c.Writer.Flush()
			if done {
				return
			}
		}
	}
}

func (h *AISessionHandler) CancelSession(c *gin.Context) {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	sessionID := strings.TrimSpace(c.Param("session_id"))
	if sessionID == "" {
		RespondError(c, http.StatusBadRequest, "invalid_session_id", "session_id is required")
		return
	}

	if err := h.manager.CancelSession(c.Request.Context(), userID, sessionID); err != nil {
		h.respondRuntimeError(c, err)
		return
	}

	RespondSuccess(c, gin.H{"cancelled": true})
}

func (h *AISessionHandler) RenameSession(c *gin.Context) {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	sessionID := strings.TrimSpace(c.Param("session_id"))
	if sessionID == "" {
		RespondError(c, http.StatusBadRequest, "invalid_session_id", "session_id is required")
		return
	}

	var req RenameAISessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	if err := h.manager.RenameSession(c.Request.Context(), userID, sessionID, req.Title); err != nil {
		h.respondRuntimeError(c, err)
		return
	}

	RespondSuccess(c, gin.H{"updated": true})
}

func (h *AISessionHandler) DeleteSession(c *gin.Context) {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	sessionID := strings.TrimSpace(c.Param("session_id"))
	if sessionID == "" {
		RespondError(c, http.StatusBadRequest, "invalid_session_id", "session_id is required")
		return
	}

	if err := h.manager.DeleteSession(c.Request.Context(), userID, sessionID); err != nil {
		h.respondRuntimeError(c, err)
		return
	}

	RespondNoContent(c)
}

func (h *AISessionHandler) CloseSession(c *gin.Context) {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	sessionID := strings.TrimSpace(c.Param("session_id"))
	if sessionID == "" {
		RespondError(c, http.StatusBadRequest, "invalid_session_id", "session_id is required")
		return
	}

	if err := h.manager.CloseSession(userID, sessionID); err != nil {
		h.respondRuntimeError(c, err)
		return
	}

	RespondNoContent(c)
}

func buildAISessionMessageContent(content, contextText string) string {
	content = strings.TrimSpace(content)
	contextText = strings.TrimSpace(contextText)
	if contextText == "" {
		return content
	}
	return content + "\n\n" + contextText
}

type aiSDKChatAction struct {
	kind      string
	content   string
	approvals []aiSDKChatApproval
}

type aiSDKChatApproval struct {
	taskID   string
	decision runtime.Decision
}

func resolveAISDKChatAction(req AISDKChatRequest) (aiSDKChatAction, error) {
	if req.Approval != nil && strings.TrimSpace(req.Approval.TaskID) != "" {
		decision := runtime.Decision(strings.TrimSpace(req.Approval.Decision))
		if decision != runtime.DecisionConfirm && decision != runtime.DecisionReject {
			return aiSDKChatAction{}, errors.New("invalid approval decision")
		}
		return aiSDKChatAction{kind: "approval", approvals: []aiSDKChatApproval{{taskID: strings.TrimSpace(req.Approval.TaskID), decision: decision}}}, nil
	}

	if approvals := approvalResponsesFromUIMessages(req.Messages); len(approvals) > 0 {
		return aiSDKChatAction{kind: "approval", approvals: approvals}, nil
	}

	content := latestUserMessageText(req.Messages)
	if content == "" {
		return aiSDKChatAction{}, errors.New("message content is required")
	}
	return aiSDKChatAction{kind: "message", content: content}, nil
}

func latestUserMessageText(messages []runtime.UIMessage) string {
	for i := len(messages) - 1; i >= 0; i-- {
		message := messages[i]
		if message.Role != "user" {
			if i == len(messages)-1 {
				return ""
			}
			continue
		}

		return strings.TrimSpace(uiMessageText(message))
	}
	return ""
}

func uiMessageText(message runtime.UIMessage) string {
	var builder strings.Builder
	for _, part := range message.Parts {
		if stringValue(part["type"]) != "text" {
			continue
		}
		builder.WriteString(stringValue(part["text"]))
	}
	return builder.String()
}

func approvalResponsesFromUIMessages(messages []runtime.UIMessage) []aiSDKChatApproval {
	if len(messages) == 0 {
		return nil
	}

	last := messages[len(messages)-1]
	if last.Role != "assistant" {
		return nil
	}

	approvals := make([]aiSDKChatApproval, 0)
	seen := make(map[string]bool)
	lastStepStart := -1
	for i, part := range last.Parts {
		if stringValue(part["type"]) == "step-start" {
			lastStepStart = i
		}
	}
	for i := len(last.Parts) - 1; i > lastStepStart; i-- {
		part := last.Parts[i]
		if !isToolPartType(stringValue(part["type"])) || stringValue(part["state"]) != "approval-responded" {
			continue
		}

		approval, ok := mapValue(part["approval"])
		if !ok {
			continue
		}
		taskID := strings.TrimSpace(stringValue(approval["id"]))
		approved, ok := boolValue(approval["approved"])
		if taskID == "" || !ok {
			continue
		}
		if seen[taskID] {
			continue
		}
		seen[taskID] = true

		decision := runtime.DecisionReject
		if approved {
			decision = runtime.DecisionConfirm
		}
		approvals = append(approvals, aiSDKChatApproval{taskID: taskID, decision: decision})
	}

	for left, right := 0, len(approvals)-1; left < right; left, right = left+1, right-1 {
		approvals[left], approvals[right] = approvals[right], approvals[left]
	}
	return approvals
}

type aiSDKUIMessageStreamer struct {
	writer            http.ResponseWriter
	preserveMessageID bool
	started           bool
	finished          bool
	stepOpen          bool
	currentStepSource string
	assistantSources  map[string]bool
	textParts         map[string]*aiSDKTextPartState
	reasoningParts    map[string]*aiSDKTextPartState
	toolInputs        map[string]bool
	toolApprovals     map[string]bool
	toolOutputs       map[string]bool
}

type aiSDKTextPartState struct {
	started bool
	sent    int
	ended   bool
}

func newAISDKUIMessageStreamer(writer http.ResponseWriter, preserveMessageID bool) *aiSDKUIMessageStreamer {
	return &aiSDKUIMessageStreamer{
		writer:            writer,
		preserveMessageID: preserveMessageID,
		assistantSources:  make(map[string]bool),
		textParts:         make(map[string]*aiSDKTextPartState),
		reasoningParts:    make(map[string]*aiSDKTextPartState),
		toolInputs:        make(map[string]bool),
		toolApprovals:     make(map[string]bool),
		toolOutputs:       make(map[string]bool),
	}
}

func (s *aiSDKUIMessageStreamer) writeRuntimeEvent(event runtime.Event) (bool, error) {
	switch event.Type {
	case runtime.EventSessionStarted:
		return false, nil
	case runtime.EventAssistantDelta, runtime.EventAssistantCompleted:
		if event.UIMessage != nil {
			if err := s.writeAssistantSnapshot(*event.UIMessage); err != nil {
				return false, err
			}
		}
	case runtime.EventTaskCreated, runtime.EventTaskUpdated, runtime.EventConfirmationRequested, runtime.EventConfirmationResolved:
		if event.Task != nil {
			if err := s.writeTask(*event.Task); err != nil {
				return false, err
			}
		} else if event.UIMessage != nil {
			if err := s.writeToolUIMessage(*event.UIMessage); err != nil {
				return false, err
			}
		}
	case runtime.EventError:
		message := "AI session error"
		if event.Error != nil && strings.TrimSpace(event.Error.Message) != "" {
			message = event.Error.Message
		}
		if err := s.writeChunk(map[string]interface{}{"type": "error", "errorText": message}); err != nil {
			return false, err
		}
		if err := s.writeDone(); err != nil {
			return false, err
		}
		return true, nil
	case runtime.EventSessionCompleted:
		if err := s.finish("stop"); err != nil {
			return false, err
		}
		return true, nil
	}

	return false, nil
}

func (s *aiSDKUIMessageStreamer) writeAssistantSnapshot(message runtime.UIMessage) error {
	if err := s.ensureAssistantSource(message.ID); err != nil {
		return err
	}

	for _, part := range message.Parts {
		typeName := stringValue(part["type"])
		switch {
		case typeName == "text":
			partID := message.ID + ":text"
			if err := s.writeTextPart(s.textParts, "text", partID, stringValue(part["text"]), stringValue(part["state"]) == "done"); err != nil {
				return err
			}
		case typeName == "reasoning":
			partID := message.ID + ":reasoning"
			if err := s.writeTextPart(s.reasoningParts, "reasoning", partID, stringValue(part["text"]), stringValue(part["state"]) == "done"); err != nil {
				return err
			}
		case strings.HasPrefix(typeName, "data-"):
			chunk := map[string]interface{}{
				"type": typeName,
				"data": part["data"],
			}
			if id := stringValue(part["id"]); id != "" {
				chunk["id"] = id
			}
			if err := s.writeChunk(chunk); err != nil {
				return err
			}
		case isToolPartType(typeName):
			if err := s.writeToolPart(message.ID, message.Metadata, part); err != nil {
				return err
			}
		}
	}

	return nil
}

func (s *aiSDKUIMessageStreamer) writeTextPart(parts map[string]*aiSDKTextPartState, kind, id, text string, done bool) error {
	if strings.TrimSpace(text) == "" && !done {
		return nil
	}

	state := parts[id]
	if state == nil {
		state = &aiSDKTextPartState{}
		parts[id] = state
	}

	if !state.started {
		if err := s.writeChunk(map[string]interface{}{"type": kind + "-start", "id": id}); err != nil {
			return err
		}
		state.started = true
	}

	if len(text) > state.sent {
		if err := s.writeChunk(map[string]interface{}{
			"type":  kind + "-delta",
			"id":    id,
			"delta": text[state.sent:],
		}); err != nil {
			return err
		}
		state.sent = len(text)
	}

	if done && !state.ended {
		if err := s.writeChunk(map[string]interface{}{"type": kind + "-end", "id": id}); err != nil {
			return err
		}
		state.ended = true
	}

	return nil
}

func (s *aiSDKUIMessageStreamer) writeTask(task runtime.TaskView) error {
	message := runtime.UIMessage{
		ID:       coalesceString(task.AssistantMessageID, "task:"+task.ID),
		Role:     "assistant",
		Metadata: taskMetadata(task),
		Parts:    []map[string]interface{}{taskToolPart(task)},
	}
	return s.writeToolUIMessage(message)
}

func (s *aiSDKUIMessageStreamer) writeToolUIMessage(message runtime.UIMessage) error {
	if err := s.ensureAssistantSource(message.ID); err != nil {
		return err
	}

	for _, part := range message.Parts {
		if !isToolPartType(stringValue(part["type"])) {
			continue
		}
		return s.writeToolPart(message.ID, message.Metadata, part)
	}

	return nil
}

func (s *aiSDKUIMessageStreamer) writeToolPart(messageID string, metadata map[string]interface{}, part map[string]interface{}) error {
	if err := s.ensureAssistantSource(messageID); err != nil {
		return err
	}

	toolCallID := stringValue(part["toolCallId"])
	if toolCallID == "" {
		toolCallID = stringValue(metadata["taskId"])
	}
	if toolCallID == "" {
		return nil
	}

	toolName := stringValue(part["toolName"])
	if toolName == "" {
		toolName = strings.TrimPrefix(stringValue(part["type"]), "tool-")
	}
	if toolName == "" {
		toolName = "tool"
	}

	if !s.toolInputs[toolCallID] {
		chunk := map[string]interface{}{
			"type":       "tool-input-available",
			"toolCallId": toolCallID,
			"toolName":   toolName,
			"input":      defaultMap(part["input"]),
			"dynamic":    stringValue(part["type"]) == "dynamic-tool",
			"title":      coalesceString(stringValue(part["title"]), stringValue(metadata["displayName"]), toolName),
			"toolMetadata": map[string]interface{}{
				"taskId":               metadata["taskId"],
				"taskStatus":           metadata["taskStatus"],
				"dangerous":            metadata["dangerous"],
				"requiresConfirmation": metadata["requiresConfirmation"],
				"displayName":          metadata["displayName"],
				"summary":              metadata["summary"],
			},
		}
		if err := s.writeChunk(chunk); err != nil {
			return err
		}
		s.toolInputs[toolCallID] = true
	}

	switch stringValue(part["state"]) {
	case "approval-requested":
		approvalID := approvalIDFromPart(part)
		if approvalID != "" && !s.toolApprovals[approvalID] {
			if err := s.writeChunk(map[string]interface{}{
				"type":       "tool-approval-request",
				"approvalId": approvalID,
				"toolCallId": toolCallID,
			}); err != nil {
				return err
			}
			s.toolApprovals[approvalID] = true
		}
	case "output-available":
		key := toolCallID + ":output"
		if !s.toolOutputs[key] {
			if err := s.writeChunk(map[string]interface{}{
				"type":       "tool-output-available",
				"toolCallId": toolCallID,
				"output":     part["output"],
				"dynamic":    stringValue(part["type"]) == "dynamic-tool",
			}); err != nil {
				return err
			}
			s.toolOutputs[key] = true
		}
	case "output-error":
		key := toolCallID + ":error"
		if !s.toolOutputs[key] {
			if err := s.writeChunk(map[string]interface{}{
				"type":       "tool-output-error",
				"toolCallId": toolCallID,
				"errorText":  coalesceString(stringValue(part["errorText"]), "Tool execution failed"),
				"dynamic":    stringValue(part["type"]) == "dynamic-tool",
			}); err != nil {
				return err
			}
			s.toolOutputs[key] = true
		}
	case "output-denied":
		key := toolCallID + ":denied"
		if !s.toolOutputs[key] {
			if err := s.writeChunk(map[string]interface{}{
				"type":       "tool-output-denied",
				"toolCallId": toolCallID,
			}); err != nil {
				return err
			}
			s.toolOutputs[key] = true
		}
	}

	return nil
}

func (s *aiSDKUIMessageStreamer) ensureAssistantSource(messageID string) error {
	if err := s.ensureStarted(messageID); err != nil {
		return err
	}
	if err := s.ensureStep(messageID); err != nil {
		return err
	}
	if s.assistantSources[messageID] {
		return nil
	}
	s.assistantSources[messageID] = true
	return nil
}

func (s *aiSDKUIMessageStreamer) ensureStep(sourceID string) error {
	if strings.TrimSpace(sourceID) == "" {
		sourceID = "assistant"
	}
	if !s.stepOpen {
		if err := s.writeChunk(map[string]interface{}{"type": "start-step"}); err != nil {
			return err
		}
		s.stepOpen = true
		s.currentStepSource = sourceID
		return nil
	}
	if s.currentStepSource == sourceID {
		return nil
	}
	if err := s.writeChunk(map[string]interface{}{"type": "finish-step"}); err != nil {
		return err
	}
	if err := s.writeChunk(map[string]interface{}{"type": "start-step"}); err != nil {
		return err
	}
	s.currentStepSource = sourceID
	return nil
}

func (s *aiSDKUIMessageStreamer) ensureStarted(messageID string) error {
	if s.started {
		return nil
	}
	if strings.TrimSpace(messageID) == "" {
		messageID = "assistant"
	}
	s.started = true
	if s.preserveMessageID {
		return s.writeChunk(map[string]interface{}{"type": "start"})
	}
	return s.writeChunk(map[string]interface{}{"type": "start", "messageId": messageID})
}

func (s *aiSDKUIMessageStreamer) finish(reason string) error {
	if s.finished {
		return nil
	}
	if !s.started {
		if err := s.ensureStarted("assistant"); err != nil {
			return err
		}
	}
	for id, state := range s.textParts {
		if state.started && !state.ended {
			if err := s.writeChunk(map[string]interface{}{"type": "text-end", "id": id}); err != nil {
				return err
			}
			state.ended = true
		}
	}
	for id, state := range s.reasoningParts {
		if state.started && !state.ended {
			if err := s.writeChunk(map[string]interface{}{"type": "reasoning-end", "id": id}); err != nil {
				return err
			}
			state.ended = true
		}
	}
	if !s.stepOpen {
		if err := s.writeChunk(map[string]interface{}{"type": "start-step"}); err != nil {
			return err
		}
		s.stepOpen = true
	}
	if err := s.writeChunk(map[string]interface{}{"type": "finish-step"}); err != nil {
		return err
	}
	if err := s.writeChunk(map[string]interface{}{"type": "finish", "finishReason": reason}); err != nil {
		return err
	}
	s.finished = true
	return s.writeDone()
}

func (s *aiSDKUIMessageStreamer) writeChunk(chunk map[string]interface{}) error {
	payload, err := json.Marshal(chunk)
	if err != nil {
		return err
	}
	_, err = fmt.Fprintf(s.writer, "data: %s\n\n", payload)
	return err
}

func (s *aiSDKUIMessageStreamer) writeDone() error {
	_, err := fmt.Fprint(s.writer, "data: [DONE]\n\n")
	return err
}

func taskMetadata(task runtime.TaskView) map[string]interface{} {
	return map[string]interface{}{
		"source":               "task",
		"createdAt":            task.CreatedAt,
		"updatedAt":            task.UpdatedAt,
		"taskId":               task.ID,
		"assistantMessageId":   task.AssistantMessageID,
		"taskStatus":           task.Status,
		"dangerous":            task.Dangerous,
		"requiresConfirmation": task.RequiresConfirmation,
		"displayName":          task.ToolDisplayName,
		"summary":              task.Summary,
	}
}

func taskToolPart(task runtime.TaskView) map[string]interface{} {
	part := map[string]interface{}{
		"type":             "dynamic-tool",
		"toolName":         task.ToolName,
		"toolCallId":       coalesceString(task.ToolCallID, task.ID),
		"title":            coalesceString(task.ToolDisplayName, task.ToolName),
		"providerExecuted": false,
		"input":            task.Arguments,
	}

	switch task.Status {
	case runtime.TaskStatusWaitingConfirm:
		part["state"] = "approval-requested"
		part["approval"] = map[string]interface{}{"id": task.ID}
	case runtime.TaskStatusSucceeded:
		part["state"] = "output-available"
		part["output"] = task.Result
	case runtime.TaskStatusFailed:
		part["state"] = "output-error"
		part["errorText"] = coalesceString(task.Error, "Tool execution failed")
	case runtime.TaskStatusCancelled:
		part["state"] = "output-denied"
		part["approval"] = map[string]interface{}{
			"id":       task.ID,
			"approved": false,
			"reason":   coalesceString(task.Error, task.Result),
		}
	default:
		part["state"] = "input-available"
	}

	if task.Arguments == nil {
		part["input"] = map[string]interface{}{}
	}
	return part
}

func approvalIDFromPart(part map[string]interface{}) string {
	approval, ok := mapValue(part["approval"])
	if !ok {
		return ""
	}
	return strings.TrimSpace(stringValue(approval["id"]))
}

func isToolPartType(value string) bool {
	return value == "dynamic-tool" || strings.HasPrefix(value, "tool-")
}

func stringValue(value interface{}) string {
	if value == nil {
		return ""
	}
	if typed, ok := value.(string); ok {
		return typed
	}
	return fmt.Sprint(value)
}

func boolValue(value interface{}) (bool, bool) {
	typed, ok := value.(bool)
	return typed, ok
}

func mapValue(value interface{}) (map[string]interface{}, bool) {
	typed, ok := value.(map[string]interface{})
	return typed, ok
}

func defaultMap(value interface{}) interface{} {
	if value == nil {
		return map[string]interface{}{}
	}
	return value
}

func coalesceString(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func (h *AISessionHandler) respondRuntimeError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, runtime.ErrSessionNotFound):
		RespondError(c, http.StatusNotFound, "session_not_found", err.Error())
	case errors.Is(err, runtime.ErrTaskNotFound):
		RespondError(c, http.StatusNotFound, "task_not_found", err.Error())
	case errors.Is(err, runtime.ErrEmptyMessageContent), errors.Is(err, runtime.ErrInvalidDecision):
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
	case errors.Is(err, runtime.ErrSessionBusy), errors.Is(err, runtime.ErrSessionClosed), errors.Is(err, runtime.ErrTaskConfirmationNotPending), errors.Is(err, runtime.ErrSessionHasPendingConfirmations):
		RespondError(c, http.StatusConflict, "session_conflict", err.Error())
	default:
		RespondError(c, http.StatusInternalServerError, "ai_session_error", err.Error())
	}
}
