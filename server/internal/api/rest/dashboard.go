package rest

import (
	"net/http"

	"github.com/easyssh/server/internal/domain/dashboard"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// DashboardHandler 仪表盘处理器
type DashboardHandler struct {
	dashboardService dashboard.Service
}

// NewDashboardHandler 创建仪表盘处理器
func NewDashboardHandler(dashboardService dashboard.Service) *DashboardHandler {
	return &DashboardHandler{
		dashboardService: dashboardService,
	}
}

// GetOverview 获取仪表盘聚合概览
// GET /api/v1/dashboard/overview
func (h *DashboardHandler) GetOverview(c *gin.Context) {
	// 获取当前用户
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	// 管理员查看全局统计，普通用户仅查看自己的
	role, _ := c.Get("role")
	var userIDPtr *uuid.UUID
	if role != "admin" {
		userIDPtr = &userID
	}

	overview, err := h.dashboardService.GetOverview(c.Request.Context(), userIDPtr)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "overview_failed", err.Error())
		return
	}

	RespondSuccess(c, overview)
}
