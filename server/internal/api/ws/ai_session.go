package ws

import (
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/easyssh/server/internal/api/middleware"
	"github.com/easyssh/server/internal/domain/aichat/runtime"
	"github.com/easyssh/server/internal/domain/security"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type AISessionHandler struct {
	manager         *runtime.Manager
	securityService security.Service
	webDevPort      int
}

func NewAISessionHandler(manager *runtime.Manager, securityService security.Service, webDevPort ...int) *AISessionHandler {
	port := 3000
	if len(webDevPort) > 0 && webDevPort[0] > 0 {
		port = webDevPort[0]
	}
	return &AISessionHandler{
		manager:         manager,
		securityService: securityService,
		webDevPort:      port,
	}
}

type aiSessionWSCommand struct {
	Type           string `json:"type"`
	Content        string `json:"content,omitempty"`
	Context        string `json:"context,omitempty"`
	Model          string `json:"model,omitempty"`
	PermissionMode string `json:"permission_mode,omitempty"`
	TaskID         string `json:"task_id,omitempty"`
	Decision       string `json:"decision,omitempty"`
}

func (h *AISessionHandler) getUpgrader() *websocket.Upgrader {
	return &websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			return middleware.IsAllowedOrigin(r, h.securityService, h.webDevPort)
		},
	}
}

func (h *AISessionHandler) HandleSession(c *gin.Context) {
	userID, err := getWSUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	sessionID := strings.TrimSpace(c.Param("session_id"))
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_session_id"})
		return
	}

	events, unsubscribe, err := h.manager.Subscribe(userID, sessionID)
	if err != nil {
		c.JSON(mapRuntimeErrorStatus(err), gin.H{
			"error":   "ai_session_error",
			"message": err.Error(),
		})
		return
	}
	defer unsubscribe()

	conn, err := h.getUpgrader().Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade AI session websocket: %v", err)
		return
	}
	defer conn.Close()

	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()

	localEvents := make(chan runtime.Event, 32)
	writerDone := make(chan struct{})

	go func() {
		defer close(writerDone)
		defer conn.Close()

		for {
			select {
			case <-ctx.Done():
				return
			case event, ok := <-events:
				if !ok {
					return
				}
				if err := conn.WriteJSON(event); err != nil {
					return
				}
			case event := <-localEvents:
				if err := conn.WriteJSON(event); err != nil {
					return
				}
			}
		}
	}()

	for {
		select {
		case <-writerDone:
			return
		default:
		}

		var cmd aiSessionWSCommand
		if err := conn.ReadJSON(&cmd); err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("AI session websocket closed unexpectedly: %v", err)
			}
			return
		}

		switch strings.TrimSpace(cmd.Type) {
		case "user.message":
			err = h.manager.SendUserMessageWithOptions(
				c.Request.Context(),
				userID,
				sessionID,
				runtime.SendUserMessageInput{
					Content:        buildAISessionWSMessageContent(cmd.Content, cmd.Context),
					Model:          cmd.Model,
					PermissionMode: cmd.PermissionMode,
				},
			)
			if err != nil {
				select {
				case localEvents <- runtimeErrorEvent(sessionID, "user_message_failed", err.Error()):
				default:
				}
			}
		case "task.confirm":
			err = h.manager.ConfirmTask(
				c.Request.Context(),
				userID,
				sessionID,
				strings.TrimSpace(cmd.TaskID),
				runtime.Decision(strings.TrimSpace(cmd.Decision)),
			)
			if err != nil {
				select {
				case localEvents <- runtimeErrorEvent(sessionID, "task_confirm_failed", err.Error()):
				default:
				}
			}
		case "session.cancel":
			if err := h.manager.CancelSession(c.Request.Context(), userID, sessionID); err != nil {
				select {
				case localEvents <- runtimeErrorEvent(sessionID, "session_cancel_failed", err.Error()):
				default:
				}
			}
		case "ping":
			continue
		default:
			select {
			case localEvents <- runtimeErrorEvent(sessionID, "invalid_command", "不支持的 AI 会话命令"):
			default:
			}
		}
	}
}

func runtimeErrorEvent(sessionID, code, message string) runtime.Event {
	return runtime.Event{
		ID:        uuid.NewString(),
		Type:      runtime.EventError,
		SessionID: sessionID,
		CreatedAt: time.Now(),
		Error: &runtime.ErrorView{
			Code:    code,
			Message: message,
		},
	}
}

func buildAISessionWSMessageContent(content, contextText string) string {
	content = strings.TrimSpace(content)
	contextText = strings.TrimSpace(contextText)
	if contextText == "" {
		return content
	}
	return content + "\n\n" + contextText
}

func getWSUserIDFromContext(c *gin.Context) (uuid.UUID, error) {
	userIDValue, exists := c.Get("user_id")
	if !exists {
		return uuid.Nil, errors.New("user not authenticated")
	}

	userID, ok := userIDValue.(string)
	if !ok {
		return uuid.Nil, errors.New("invalid user id")
	}

	return uuid.Parse(strings.TrimSpace(userID))
}

func mapRuntimeErrorStatus(err error) int {
	switch {
	case errors.Is(err, runtime.ErrSessionNotFound), errors.Is(err, runtime.ErrTaskNotFound):
		return http.StatusNotFound
	case errors.Is(err, runtime.ErrEmptyMessageContent), errors.Is(err, runtime.ErrInvalidDecision):
		return http.StatusBadRequest
	case errors.Is(err, runtime.ErrSessionBusy), errors.Is(err, runtime.ErrSessionClosed), errors.Is(err, runtime.ErrTaskConfirmationNotPending), errors.Is(err, runtime.ErrSessionHasPendingConfirmations):
		return http.StatusConflict
	default:
		return http.StatusInternalServerError
	}
}
