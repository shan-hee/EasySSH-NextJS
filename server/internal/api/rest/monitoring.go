package rest

import (
	"context"
	"net/http"
	"strconv"

	"github.com/easyssh/server/internal/domain/monitoring"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// MonitoringHandler 监控处理器
type MonitoringHandler struct {
	monitoringService monitoring.Service
}

// NewMonitoringHandler 创建监控处理器
func NewMonitoringHandler(monitoringService monitoring.Service) *MonitoringHandler {
	return &MonitoringHandler{
		monitoringService: monitoringService,
	}
}

// GetSystemInfo 获取系统综合信息
// GET /api/v1/monitoring/:server_id/system
func (h *MonitoringHandler) GetSystemInfo(c *gin.Context) {
	serverID := c.Param("server_id")

	// 设置用户 ID 到上下文
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	ctx := c.Request.Context()
	ctx = setUserIDToContext(ctx, userID)

	systemInfo, err := h.monitoringService.GetSystemInfo(ctx, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "monitoring_error", err.Error())
		return
	}

	RespondSuccess(c, systemInfo)
}

// GetCPUInfo 获取 CPU 信息
// GET /api/v1/monitoring/:server_id/cpu
func (h *MonitoringHandler) GetCPUInfo(c *gin.Context) {
	serverID := c.Param("server_id")

	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	ctx := c.Request.Context()
	ctx = setUserIDToContext(ctx, userID)

	cpuInfo, err := h.monitoringService.GetCPUInfo(ctx, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "monitoring_error", err.Error())
		return
	}

	RespondSuccess(c, cpuInfo)
}

// GetMemoryInfo 获取内存信息
// GET /api/v1/monitoring/:server_id/memory
func (h *MonitoringHandler) GetMemoryInfo(c *gin.Context) {
	serverID := c.Param("server_id")

	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	ctx := c.Request.Context()
	ctx = setUserIDToContext(ctx, userID)

	memInfo, err := h.monitoringService.GetMemoryInfo(ctx, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "monitoring_error", err.Error())
		return
	}

	RespondSuccess(c, memInfo)
}

// GetDiskInfo 获取磁盘信息
// GET /api/v1/monitoring/:server_id/disk
func (h *MonitoringHandler) GetDiskInfo(c *gin.Context) {
	serverID := c.Param("server_id")

	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	ctx := c.Request.Context()
	ctx = setUserIDToContext(ctx, userID)

	diskInfo, err := h.monitoringService.GetDiskInfo(ctx, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "monitoring_error", err.Error())
		return
	}

	RespondSuccess(c, diskInfo)
}

// GetNetworkInfo 获取网络信息
// GET /api/v1/monitoring/:server_id/network
func (h *MonitoringHandler) GetNetworkInfo(c *gin.Context) {
	serverID := c.Param("server_id")

	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	ctx := c.Request.Context()
	ctx = setUserIDToContext(ctx, userID)

	netInfo, err := h.monitoringService.GetNetworkInfo(ctx, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "monitoring_error", err.Error())
		return
	}

	RespondSuccess(c, netInfo)
}

// GetTopProcesses 获取资源占用最高的进程
// GET /api/v1/monitoring/:server_id/processes?limit=10
func (h *MonitoringHandler) GetTopProcesses(c *gin.Context) {
	serverID := c.Param("server_id")

	// 获取 limit 参数
	limitStr := c.DefaultQuery("limit", "10")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 10
	}

	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	ctx := c.Request.Context()
	ctx = setUserIDToContext(ctx, userID)

	processes, err := h.monitoringService.GetTopProcesses(ctx, serverID, limit)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "monitoring_error", err.Error())
		return
	}

	RespondSuccess(c, gin.H{
		"processes": processes,
		"total":     len(processes),
	})
}

// setUserIDToContext 设置用户 ID 到上下文
func setUserIDToContext(ctx context.Context, userID uuid.UUID) context.Context {
	return context.WithValue(ctx, "user_id", userID.String())
}
