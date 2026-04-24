package ws

import (
	"context"
	"errors"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/easyssh/server/internal/domain/aichat/runtime"
	"github.com/easyssh/server/internal/domain/security"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type AISessionHandler struct {
	manager         *runtime.Manager
	securityService security.Service
}

func NewAISessionHandler(manager *runtime.Manager, securityService security.Service) *AISessionHandler {
	return &AISessionHandler{
		manager:         manager,
		securityService: securityService,
	}
}

type aiSessionWSCommand struct {
	Type     string `json:"type"`
	Content  string `json:"content,omitempty"`
	Context  string `json:"context,omitempty"`
	TaskID   string `json:"task_id,omitempty"`
	Decision string `json:"decision,omitempty"`
}

func (h *AISessionHandler) getUpgrader() *websocket.Upgrader {
	return &websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			origin := r.Header.Get("Origin")
			if origin == "" {
				return true
			}

			corsConfig, err := h.securityService.GetCORSConfig(context.Background())
			if err == nil && corsConfig != nil && len(corsConfig.AllowedOrigins) > 0 {
				for _, allowedOrigin := range corsConfig.AllowedOrigins {
					if origin == allowedOrigin {
						return true
					}
				}
			}

			var originHost string
			if u, err := url.Parse(origin); err == nil {
				originHost = u.Hostname()
			}
			if originHost == "" {
				return false
			}

			candidates := []string{strings.Split(r.Host, ":")[0]}
			if xfh := r.Header.Get("X-Forwarded-Host"); xfh != "" {
				for _, host := range strings.Split(xfh, ",") {
					host = strings.TrimSpace(host)
					if host != "" {
						candidates = append(candidates, strings.Split(host, ":")[0])
					}
				}
			}

			for _, host := range candidates {
				if host != "" && strings.EqualFold(host, originHost) {
					return true
				}
			}

			return false
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
			err = h.manager.SendUserMessage(
				c.Request.Context(),
				userID,
				sessionID,
				buildAISessionWSMessageContent(cmd.Content, cmd.Context),
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
