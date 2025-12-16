package rest

import (
	"net/http"

	"github.com/easyssh/server/internal/domain/auth"
	"github.com/easyssh/server/internal/domain/permission"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// PermissionHandler 权限管理处理器
type PermissionHandler struct {
	service permission.Service
}

func NewPermissionHandler(service permission.Service) *PermissionHandler {
	return &PermissionHandler{service: service}
}

type ListPermissionsRequest struct {
	Page   int    `form:"page"`
	Limit  int    `form:"limit"`
	Module string `form:"module"`
	Q      string `form:"q"`
}

type CreatePermissionRequest struct {
	Name        string            `json:"name" binding:"required,min=1,max=100"`
	Code        string            `json:"code" binding:"required,min=1,max=100"`
	Description string            `json:"description"`
	Module      permission.Module `json:"module" binding:"required,oneof=server file terminal audit system"`
	Roles       []auth.UserRole   `json:"roles" binding:"required,min=1,dive,oneof=admin user viewer"`
}

type UpdatePermissionRequest struct {
	Name        string            `json:"name" binding:"required,min=1,max=100"`
	Code        string            `json:"code" binding:"required,min=1,max=100"`
	Description string            `json:"description"`
	Module      permission.Module `json:"module" binding:"required,oneof=server file terminal audit system"`
	Roles       []auth.UserRole   `json:"roles" binding:"required,min=1,dive,oneof=admin user viewer"`
}

// ListPermissions 获取权限列表
// GET /api/v1/permissions
func (h *PermissionHandler) ListPermissions(c *gin.Context) {
	var req ListPermissionsRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}
	if req.Page == 0 {
		req.Page = 1
	}
	if req.Limit == 0 {
		req.Limit = 100
	}

	perms, total, err := h.service.List(c.Request.Context(), req.Page, req.Limit, req.Module, req.Q)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	totalPages := int(total) / req.Limit
	if int(total)%req.Limit > 0 {
		totalPages++
	}

	c.JSON(http.StatusOK, gin.H{
		"data":        perms,
		"total":       total,
		"page":        req.Page,
		"page_size":   req.Limit,
		"total_pages": totalPages,
	})
}

// CreatePermission 创建权限
// POST /api/v1/permissions
func (h *PermissionHandler) CreatePermission(c *gin.Context) {
	var req CreatePermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	p, err := h.service.Create(c.Request.Context(), req.Name, req.Code, req.Description, req.Module, req.Roles)
	if err != nil {
		if err == permission.ErrPermissionCodeExists {
			RespondError(c, http.StatusConflict, "PERMISSION_EXISTS", "Permission code already exists")
			return
		}
		if err == permission.ErrInvalidPermission {
			RespondError(c, http.StatusBadRequest, "INVALID_INPUT", err.Error())
			return
		}
		RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"data":    p,
		"message": "Permission created successfully",
	})
}

// UpdatePermission 更新权限
// PUT /api/v1/permissions/:id
func (h *PermissionHandler) UpdatePermission(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "INVALID_ID", "Invalid permission ID format")
		return
	}

	var req UpdatePermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	p, err := h.service.Update(c.Request.Context(), id, req.Name, req.Code, req.Description, req.Module, req.Roles)
	if err != nil {
		if err == permission.ErrPermissionNotFound {
			RespondError(c, http.StatusNotFound, "PERMISSION_NOT_FOUND", "Permission not found")
			return
		}
		if err == permission.ErrPermissionCodeExists {
			RespondError(c, http.StatusConflict, "PERMISSION_EXISTS", "Permission code already exists")
			return
		}
		if err == permission.ErrInvalidPermission {
			RespondError(c, http.StatusBadRequest, "INVALID_INPUT", err.Error())
			return
		}
		RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":    p,
		"message": "Permission updated successfully",
	})
}

// DeletePermission 删除权限
// DELETE /api/v1/permissions/:id
func (h *PermissionHandler) DeletePermission(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "INVALID_ID", "Invalid permission ID format")
		return
	}

	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		if err == permission.ErrPermissionNotFound {
			RespondError(c, http.StatusNotFound, "PERMISSION_NOT_FOUND", "Permission not found")
			return
		}
		RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Permission deleted successfully",
	})
}
