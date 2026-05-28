package rest

import (
	"net/http"
	"strings"

	"github.com/easyssh/server/internal/domain/auth"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type TicketHandler struct {
	ticketService auth.TicketService
}

func NewTicketHandler(ticketService auth.TicketService) *TicketHandler {
	return &TicketHandler{ticketService: ticketService}
}

type CreateTicketRequest struct {
	Type            string   `json:"type" binding:"required"`
	ServerID        string   `json:"server_id"`
	TaskID          string   `json:"task_id"`
	Path            string   `json:"path"`
	Paths           []string `json:"paths"`
	Mode            string   `json:"mode"`
	ExcludePatterns []string `json:"exclude_patterns"`
}

type CreateTicketResponse struct {
	Ticket    string `json:"ticket"`
	ExpiresIn int    `json:"expires_in"`
}

// CreateTicket 创建一次性 Ticket（用于 WebSocket 握手 / 原生下载等无法附带 Authorization Header 的场景）
// POST /api/v1/auth/ticket
func (h *TicketHandler) CreateTicket(c *gin.Context) {
	if h.ticketService == nil {
		RespondError(c, http.StatusServiceUnavailable, "ticket_not_available", "Ticket service not available")
		return
	}

	var req CreateTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	tt := auth.TicketType(strings.TrimSpace(req.Type))
	if !tt.IsValid() {
		RespondError(c, http.StatusBadRequest, "invalid_ticket_type", "Invalid ticket type")
		return
	}

	userIDStr, ok := c.Get("user_id")
	if !ok {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "Missing user")
		return
	}
	userID, err := uuid.Parse(strings.TrimSpace(userIDStr.(string)))
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "Invalid user")
		return
	}

	username := ""
	if v, ok := c.Get("username"); ok {
		if s, ok := v.(string); ok {
			username = s
		}
	}
	email := ""
	if v, ok := c.Get("email"); ok {
		if s, ok := v.(string); ok {
			email = s
		}
	}
	role := auth.RoleUser
	if v, ok := c.Get("role"); ok {
		if s, ok := v.(string); ok && strings.TrimSpace(s) != "" {
			role = auth.UserRole(s)
		}
	}
	var sessionID uuid.UUID
	if v, ok := c.Get("session_id"); ok {
		if s, ok := v.(string); ok {
			if sid, err := uuid.Parse(strings.TrimSpace(s)); err == nil {
				sessionID = sid
			}
		}
	}

	createReq := auth.CreateTicketRequest{
		Type:      tt,
		UserID:    userID,
		Username:  username,
		Email:     email,
		Role:      role,
		SessionID: sessionID,
	}

	switch tt {
	case auth.TicketTypeWSTerminal, auth.TicketTypeWSMonitor:
		serverID := strings.TrimSpace(req.ServerID)
		if serverID == "" {
			RespondError(c, http.StatusBadRequest, "missing_server_id", "server_id is required")
			return
		}
		if _, err := uuid.Parse(serverID); err != nil {
			RespondError(c, http.StatusBadRequest, "invalid_server_id", "Invalid server_id")
			return
		}
		createReq.Ref = serverID

	case auth.TicketTypeWSSFTPUpload, auth.TicketTypeWSSFTPTransfer:
		taskID := strings.TrimSpace(req.TaskID)
		if taskID == "" {
			RespondError(c, http.StatusBadRequest, "missing_task_id", "task_id is required")
			return
		}
		if len(taskID) > 256 {
			RespondError(c, http.StatusBadRequest, "invalid_task_id", "task_id too long")
			return
		}
		createReq.Ref = taskID

	case auth.TicketTypeSFTPDownload:
		serverID := strings.TrimSpace(req.ServerID)
		if serverID == "" {
			RespondError(c, http.StatusBadRequest, "missing_server_id", "server_id is required")
			return
		}
		if _, err := uuid.Parse(serverID); err != nil {
			RespondError(c, http.StatusBadRequest, "invalid_server_id", "Invalid server_id")
			return
		}
		remotePath := strings.TrimSpace(req.Path)
		if remotePath == "" {
			RespondError(c, http.StatusBadRequest, "missing_path", "path is required")
			return
		}
		if len(remotePath) > 4096 {
			RespondError(c, http.StatusBadRequest, "invalid_path", "path too long")
			return
		}
		createReq.Ref = serverID
		createReq.SFTPDownloadPath = remotePath

	case auth.TicketTypeSFTPBatchDownload:
		serverID := strings.TrimSpace(req.ServerID)
		if serverID == "" {
			RespondError(c, http.StatusBadRequest, "missing_server_id", "server_id is required")
			return
		}
		if _, err := uuid.Parse(serverID); err != nil {
			RespondError(c, http.StatusBadRequest, "invalid_server_id", "Invalid server_id")
			return
		}
		if len(req.Paths) == 0 {
			RespondError(c, http.StatusBadRequest, "missing_paths", "paths is required")
			return
		}
		if len(req.Paths) > 100 {
			RespondError(c, http.StatusBadRequest, "invalid_paths", "paths too many (max 100)")
			return
		}
		createReq.Ref = serverID
		createReq.SFTPBatchDownloadInput = &auth.SFTPBatchDownloadPayload{
			Paths:           req.Paths,
			Mode:            strings.TrimSpace(req.Mode),
			ExcludePatterns: req.ExcludePatterns,
		}
	}

	ticket, expiresIn, err := h.ticketService.Create(createReq)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "ticket_create_failed", "Failed to create ticket")
		return
	}

	RespondSuccess(c, CreateTicketResponse{
		Ticket:    ticket,
		ExpiresIn: expiresIn,
	})
}
