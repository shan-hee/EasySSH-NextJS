package ws

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/easyssh/server/internal/domain/monitor"
	sshDomain "github.com/easyssh/server/internal/domain/ssh"
	pb "github.com/easyssh/server/internal/proto"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"google.golang.org/protobuf/proto"
)

// MonitorHandler WebSocket 监控处理器
type MonitorHandler struct {
	sessionManager *sshDomain.SessionManager
}

// NewMonitorHandler 创建监控处理器
func NewMonitorHandler(sessionManager *sshDomain.SessionManager) *MonitorHandler {
	return &MonitorHandler{
		sessionManager: sessionManager,
	}
}

// HandleMonitor 处理监控 WebSocket 连接
// WS /api/v1/monitor/server/:server_id?interval=2
func (h *MonitorHandler) HandleMonitor(c *gin.Context) {
	// 从上下文获取用户 ID
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	userID := userIDStr.(string)

	// 获取服务器 ID
	serverID := c.Param("server_id")
	if serverID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "server_id required"})
		return
	}

	// 获取采集间隔（秒），默认为 2 秒
	intervalParam := c.DefaultQuery("interval", "2")
	interval, err := time.ParseDuration(intervalParam + "s")
	if err != nil || interval < time.Second || interval > 10*time.Second {
		// 无效间隔，使用默认值 2 秒
		interval = 2 * time.Second
	}
	log.Printf("[Monitor] 使用采集间隔: %v", interval)

	// 根据 server_id 和 user_id 查找活跃会话
	log.Printf("[Monitor] 尝试查找会话: userID=%s, serverID=%s", userID, serverID)
	session := h.sessionManager.GetActiveByUserAndServer(userID, serverID)
	if session == nil {
		log.Printf("[Monitor] 未找到活跃会话: userID=%s, serverID=%s", userID, serverID)
		c.JSON(http.StatusNotFound, gin.H{"error": "no active session for this server"})
		return
	}
	log.Printf("[Monitor] 找到会话: ID=%s, UserID=%s, ServerID=%s", session.ID, session.UserID, session.ServerID)

	// 检查 SSH Client 是否活跃
	if session.Client == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ssh client not active"})
		return
	}

	// 升级到 WebSocket
	wsConn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade to WebSocket: %v", err)
		return
	}
	defer wsConn.Close()

	log.Printf("Monitor WebSocket connected for server: %s, session: %s", serverID, session.ID)

	// 创建采集器
	collector := monitor.NewCollector(session)

	// 创建停止通道
	done := make(chan struct{})
	stopMonitoring := make(chan struct{})

	// 监听客户端消息 (处理 ping/close)
	go func() {
		for {
			_, _, err := wsConn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("Monitor WebSocket error: %v", err)
				}
				close(done)
				return
			}
		}
	}()

	// 定期采集和推送指标
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	// 立即发送第一次数据
	if err := h.sendMetrics(wsConn, collector); err != nil {
		log.Printf("Failed to send initial metrics: %v", err)
		return
	}

	for {
		select {
		case <-ticker.C:
			if err := h.sendMetrics(wsConn, collector); err != nil {
				log.Printf("Failed to send metrics: %v", err)
				close(stopMonitoring)
				return
			}

		case <-done:
			log.Printf("Monitor WebSocket closed for session: %s", session.ID)
			return

		case <-stopMonitoring:
			return
		}
	}
}

// sendMetrics 采集并发送指标
func (h *MonitorHandler) sendMetrics(conn *websocket.Conn, collector *monitor.Collector) error {
	// 采集指标
	metrics, err := collector.Collect()
	if err != nil {
		return fmt.Errorf("failed to collect metrics: %w", err)
	}

	// Protobuf 序列化
	data, err := proto.Marshal(metrics)
	if err != nil {
		return fmt.Errorf("failed to marshal metrics: %w", err)
	}

	// 发送二进制数据
	if err := conn.WriteMessage(websocket.BinaryMessage, data); err != nil {
		return fmt.Errorf("failed to send metrics: %w", err)
	}

	return nil
}

// sendErrorMessage 发送错误消息 (JSON 格式)
func (h *MonitorHandler) sendErrorMessage(conn *websocket.Conn, errorCode, message string) {
	errMsg := &pb.SystemMetrics{
		Timestamp: time.Now().Unix(),
		// 可以添加错误字段到 proto 定义中
	}

	data, _ := proto.Marshal(errMsg)
	conn.WriteMessage(websocket.BinaryMessage, data)

	time.Sleep(100 * time.Millisecond)
	conn.Close()
}
