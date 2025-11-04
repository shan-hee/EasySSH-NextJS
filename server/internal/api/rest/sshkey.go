package rest

import (
	"net/http"
	"strconv"

	"github.com/easyssh/server/internal/domain/sshkey"

	"github.com/gin-gonic/gin"
)

// SSHKeyHandler handles SSH key related HTTP requests
type SSHKeyHandler struct {
	service sshkey.Service
}

// NewSSHKeyHandler creates a new SSH key handler
func NewSSHKeyHandler(service sshkey.Service) *SSHKeyHandler {
	return &SSHKeyHandler{
		service: service,
	}
}

// GetSSHKeys godoc
// @Summary Get user's SSH keys
// @Description Get all SSH keys for the authenticated user
// @Tags sshkeys
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {array} sshkey.SSHKey
// @Failure 401 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/ssh-keys [get]
func (h *SSHKeyHandler) GetSSHKeys(c *gin.Context) {
	userID := c.GetUint("user_id")

	keys, err := h.service.GetUserKeys(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error: "Failed to retrieve SSH keys",
		})
		return
	}

	c.JSON(http.StatusOK, keys)
}

// GenerateSSHKey godoc
// @Summary Generate a new SSH key pair
// @Description Generate a new SSH key pair (RSA or ED25519)
// @Tags sshkeys
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body sshkey.CreateSSHKeyRequest true "SSH key generation request"
// @Success 201 {object} sshkey.SSHKeyResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/ssh-keys/generate [post]
func (h *SSHKeyHandler) GenerateSSHKey(c *gin.Context) {
	userID := c.GetUint("user_id")

	var req sshkey.CreateSSHKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error: "Invalid request: " + err.Error(),
		})
		return
	}

	keyResponse, err := h.service.GenerateKeyPair(&req, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error: "Failed to generate SSH key: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, keyResponse)
}

// ImportSSHKey godoc
// @Summary Import an existing SSH key
// @Description Import an existing SSH private key
// @Tags sshkeys
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body sshkey.ImportSSHKeyRequest true "SSH key import request"
// @Success 201 {object} sshkey.SSHKeyResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/ssh-keys/import [post]
func (h *SSHKeyHandler) ImportSSHKey(c *gin.Context) {
	userID := c.GetUint("user_id")

	var req sshkey.ImportSSHKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error: "Invalid request: " + err.Error(),
		})
		return
	}

	keyResponse, err := h.service.ImportKeyPair(&req, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error: "Failed to import SSH key: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, keyResponse)
}

// DeleteSSHKey godoc
// @Summary Delete an SSH key
// @Description Delete an SSH key by ID
// @Tags sshkeys
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "SSH Key ID"
// @Success 200 {object} map[string]string
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/ssh-keys/{id} [delete]
func (h *SSHKeyHandler) DeleteSSHKey(c *gin.Context) {
	userID := c.GetUint("user_id")

	keyID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error: "Invalid key ID",
		})
		return
	}

	if err := h.service.DeleteKey(uint(keyID), userID); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error: "Failed to delete SSH key",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "SSH key deleted successfully",
	})
}
