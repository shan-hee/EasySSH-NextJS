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
	Model          string `json:"model,omitempty"`
	PermissionMode string `json:"permission_mode,omitempty" binding:"omitempty,oneof=readonly balanced privileged"`
}

type CreateAISessionResponse struct {
	SessionID        string                `json:"session_id"`
	Session          *runtime.SessionView  `json:"session"`
	DefaultTransport runtime.TransportType `json:"default_transport"`
}

type AISessionMessageRequest struct {
	Content string `json:"content" binding:"required"`
	Context string `json:"context,omitempty"`
}

type ConfirmAISessionTaskRequest struct {
	Decision string `json:"decision" binding:"required,oneof=confirm reject"`
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

func (h *AISessionHandler) SendMessage(c *gin.Context) {
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

	var req AISessionMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	if err := h.manager.SendUserMessage(
		c.Request.Context(),
		userID,
		sessionID,
		buildAISessionMessageContent(req.Content, req.Context),
	); err != nil {
		h.respondRuntimeError(c, err)
		return
	}

	c.JSON(http.StatusAccepted, SuccessResponse{
		Data: gin.H{
			"accepted": true,
		},
	})
}

func (h *AISessionHandler) StreamEvents(c *gin.Context) {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	sessionID := strings.TrimSpace(c.Param("session_id"))
	events, unsubscribe, err := h.manager.Subscribe(userID, sessionID)
	if err != nil {
		h.respondRuntimeError(c, err)
		return
	}
	defer unsubscribe()

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")
	c.Status(http.StatusOK)
	c.Writer.Flush()

	for {
		select {
		case <-c.Request.Context().Done():
			return
		case event, ok := <-events:
			if !ok {
				return
			}

			payload, err := json.Marshal(event)
			if err != nil {
				return
			}

			if _, err := fmt.Fprintf(c.Writer, "event: %s\n", event.Type); err != nil {
				return
			}
			if _, err := fmt.Fprintf(c.Writer, "data: %s\n\n", payload); err != nil {
				return
			}
			c.Writer.Flush()
		}
	}
}

func (h *AISessionHandler) ConfirmTask(c *gin.Context) {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	sessionID := strings.TrimSpace(c.Param("session_id"))
	taskID := strings.TrimSpace(c.Param("task_id"))
	if sessionID == "" || taskID == "" {
		RespondError(c, http.StatusBadRequest, "validation_error", "session_id and task_id are required")
		return
	}

	var req ConfirmAISessionTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	if err := h.manager.ConfirmTask(
		c.Request.Context(),
		userID,
		sessionID,
		taskID,
		runtime.Decision(req.Decision),
	); err != nil {
		h.respondRuntimeError(c, err)
		return
	}

	c.JSON(http.StatusAccepted, SuccessResponse{
		Data: gin.H{
			"accepted": true,
		},
	})
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
