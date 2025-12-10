package rest

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/easyssh/server/internal/domain/auth"
	"github.com/easyssh/server/internal/domain/monitoring"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// MonitoringHandler 监控处理器
type MonitoringHandler struct {
	monitoringService monitoring.Service
	authService       auth.Service
}

// NewMonitoringHandler 创建监控处理器
func NewMonitoringHandler(monitoringService monitoring.Service, authService auth.Service) *MonitoringHandler {
	return &MonitoringHandler{
		monitoringService: monitoringService,
		authService:       authService,
	}
}

// GetAllResources 获取所有服务器的资源概览
// GET /api/v1/monitoring/resources
func (h *MonitoringHandler) GetAllResources(c *gin.Context) {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	ctx := c.Request.Context()

	// 获取用户信息（包含数据源配置）
	user, err := h.authService.GetUserByID(ctx, userID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "user_error", err.Error())
		return
	}

	// 使用用户配置的数据源获取资源
	resources, err := h.monitoringService.GetAllServersResourcesWithUser(ctx, user)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "monitoring_error", err.Error())
		return
	}

	RespondSuccess(c, resources)
}

// StreamResources 流式获取服务器资源（SSE）
// GET /api/v1/monitoring/resources/stream
func (h *MonitoringHandler) StreamResources(c *gin.Context) {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	// 设置 SSE 响应头
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no") // 禁用 nginx 缓冲

	ctx := c.Request.Context()

	// 获取用户信息（包含数据源配置）
	user, err := h.authService.GetUserByID(ctx, userID)
	if err != nil {
		errData, _ := json.Marshal(map[string]string{"error": err.Error()})
		fmt.Fprintf(c.Writer, "event: error\ndata: %s\n\n", errData)
		c.Writer.Flush()
		return
	}

	// 创建结果 channel 和错误 channel
	resultChan := make(chan *monitoring.ServerResourceSummary, 10)
	errChan := make(chan error, 1)

	// 启动流式采集（使用用户配置的数据源）
	// 注意：channel 由 StreamServersResourcesWithUser 内部负责关闭，这里不要重复关闭
	go func() {
		if err := h.monitoringService.StreamServersResourcesWithUser(ctx, user, resultChan); err != nil {
			// 检查是否是上下文取消导致的错误，如果是则不发送错误
			if ctx.Err() == nil {
				select {
				case errChan <- err:
				default:
				}
			}
		}
	}()

	// 流式输出
	c.Stream(func(w io.Writer) bool {
		select {
		case err := <-errChan:
			// 发送错误事件
			errData, _ := json.Marshal(map[string]string{"error": err.Error()})
			fmt.Fprintf(w, "event: error\ndata: %s\n\n", errData)
			return false
		case result, ok := <-resultChan:
			if !ok {
				// channel 关闭，发送完成事件
				fmt.Fprintf(w, "event: done\ndata: {}\n\n")
				return false
			}
			// 发送服务器数据
			data, err := json.Marshal(result)
			if err != nil {
				return true
			}
			fmt.Fprintf(w, "event: server\ndata: %s\n\n", data)
			return true
		case <-ctx.Done():
			return false
		}
	})
}

// TestDataSourceConnection 测试数据源连接
// POST /api/v1/monitoring/datasource/test
func (h *MonitoringHandler) TestDataSourceConnection(c *gin.Context) {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	var req struct {
		Type     string `json:"type" binding:"required"`      // easyssh, nezha, komari
		Endpoint string `json:"endpoint"`                     // API 端点
		Token    string `json:"token"`                        // API Token
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}

	ctx := c.Request.Context()

	// 获取用户信息（EasySSH 数据源需要用户 ID）
	user, err := h.authService.GetUserByID(ctx, userID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "user_error", err.Error())
		return
	}

	// 构建数据源配置
	config := &monitoring.DataSourceConfig{
		Type:     req.Type,
		Endpoint: req.Endpoint,
		Token:    req.Token,
	}

	// 测试连接
	if err := h.monitoringService.TestDataSourceConnection(ctx, config, user); err != nil {
		log.Printf("[Monitoring] TestDataSourceConnection failed: type=%s, endpoint=%s, error=%v", config.Type, config.Endpoint, err)
		RespondError(c, http.StatusBadRequest, "connection_failed", err.Error())
		return
	}

	RespondSuccess(c, map[string]string{"message": "Connection successful"})
}

// setUserIDToContext 设置用户 ID 到上下文
func setUserIDToContext(ctx context.Context, userID uuid.UUID) context.Context {
	return context.WithValue(ctx, "user_id", userID.String())
}
