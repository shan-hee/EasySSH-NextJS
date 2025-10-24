package rest

import (
	"net/http"

	"github.com/easyssh/server/internal/domain/sshsession"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// SSHSessionHandler SSH会话处理器
type SSHSessionHandler struct {
	sshSessionService sshsession.Service
}

// NewSSHSessionHandler 创建SSH会话处理器实例
func NewSSHSessionHandler(sshSessionService sshsession.Service) *SSHSessionHandler {
	return &SSHSessionHandler{
		sshSessionService: sshSessionService,
	}
}

// List 获取SSH会话列表
func (h *SSHSessionHandler) List(c *gin.Context) {
	var req sshsession.ListSSHSessionsRequest

	// 解析查询参数
	if err := c.ShouldBindQuery(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "user_id not found")
		return
	}

	uid, err := uuid.Parse(userID.(string))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_user_id", err.Error())
		return
	}

	response, err := h.sshSessionService.ListSSHSessions(uid, &req)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "list_failed", err.Error())
		return
	}

	RespondSuccess(c, response)
}

// GetByID 获取SSH会话详情
func (h *SSHSessionHandler) GetByID(c *gin.Context) {
	idParam := c.Param("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_id", "Invalid session ID format")
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "user_id not found")
		return
	}

	uid, err := uuid.Parse(userID.(string))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_user_id", err.Error())
		return
	}

	session, err := h.sshSessionService.GetSSHSession(uid, id)
	if err != nil {
		if err == sshsession.ErrSSHSessionNotFound {
			RespondError(c, http.StatusNotFound, "not_found", "SSH session not found")
			return
		}
		if err == sshsession.ErrUnauthorized {
			RespondError(c, http.StatusForbidden, "forbidden", "Access denied")
			return
		}
		RespondError(c, http.StatusInternalServerError, "get_failed", err.Error())
		return
	}

	RespondSuccess(c, session)
}

// Delete 删除SSH会话记录
func (h *SSHSessionHandler) Delete(c *gin.Context) {
	idParam := c.Param("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_id", "Invalid session ID format")
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "user_id not found")
		return
	}

	uid, err := uuid.Parse(userID.(string))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_user_id", err.Error())
		return
	}

	if err := h.sshSessionService.DeleteSSHSession(uid, id); err != nil {
		if err == sshsession.ErrSSHSessionNotFound {
			RespondError(c, http.StatusNotFound, "not_found", "SSH session not found")
			return
		}
		if err == sshsession.ErrUnauthorized {
			RespondError(c, http.StatusForbidden, "forbidden", "Access denied")
			return
		}
		RespondError(c, http.StatusInternalServerError, "delete_failed", err.Error())
		return
	}

	RespondSuccess(c, gin.H{"message": "SSH session deleted successfully"})
}

// GetStatistics 获取SSH会话统计信息
func (h *SSHSessionHandler) GetStatistics(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "user_id not found")
		return
	}

	uid, err := uuid.Parse(userID.(string))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_user_id", err.Error())
		return
	}

	stats, err := h.sshSessionService.GetStatistics(uid)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "get_statistics_failed", err.Error())
		return
	}

	RespondSuccess(c, stats)
}

// Close 关闭SSH会话
func (h *SSHSessionHandler) Close(c *gin.Context) {
	idParam := c.Param("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_id", "Invalid session ID format")
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		RespondError(c, http.StatusUnauthorized, "unauthorized", "user_id not found")
		return
	}

	uid, err := uuid.Parse(userID.(string))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_user_id", err.Error())
		return
	}

	if err := h.sshSessionService.CloseSession(uid, id); err != nil {
		if err == sshsession.ErrSSHSessionNotFound {
			RespondError(c, http.StatusNotFound, "not_found", "SSH session not found")
			return
		}
		if err == sshsession.ErrUnauthorized {
			RespondError(c, http.StatusForbidden, "forbidden", "Access denied")
			return
		}
		RespondError(c, http.StatusInternalServerError, "close_failed", err.Error())
		return
	}

	RespondSuccess(c, gin.H{"message": "SSH session closed successfully"})
}
