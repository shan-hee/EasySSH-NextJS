package rest

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

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

// GetAllResources 获取所有服务器的资源概览
// GET /api/v1/monitoring/resources
func (h *MonitoringHandler) GetAllResources(c *gin.Context) {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	ctx := c.Request.Context()
	ctx = setUserIDToContext(ctx, userID)

	resources, err := h.monitoringService.GetAllServersResources(ctx)
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
	ctx = setUserIDToContext(ctx, userID)

	// 创建结果 channel
	resultChan := make(chan *monitoring.ServerResourceSummary, 10)

	// 启动流式采集
	go func() {
		if err := h.monitoringService.StreamServersResources(ctx, resultChan); err != nil {
			// 错误通过 SSE 发送
			errData, _ := json.Marshal(map[string]string{"error": err.Error()})
			fmt.Fprintf(c.Writer, "event: error\ndata: %s\n\n", errData)
			c.Writer.Flush()
		}
	}()

	// 流式输出
	c.Stream(func(w io.Writer) bool {
		select {
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

// setUserIDToContext 设置用户 ID 到上下文
func setUserIDToContext(ctx context.Context, userID uuid.UUID) context.Context {
	return context.WithValue(ctx, "user_id", userID.String())
}
