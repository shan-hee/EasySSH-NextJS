package ws

import (
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "sync"
    "time"

    "github.com/easyssh/server/internal/domain/monitor"
    pb "github.com/easyssh/server/internal/proto"
    "github.com/gin-gonic/gin"
    "github.com/gorilla/websocket"
    "google.golang.org/protobuf/proto"
)

const (
    // 控制帧心跳/超时设置
    wsPongWait  = 60 * time.Second
    wsPingEvery = 50 * time.Second
    wsWriteWait = 10 * time.Second
)

// upgrader WebSocket 升级器
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // 允许所有来源（生产环境应该限制）
	},
}

// MonitorHandler WebSocket 监控处理器
type MonitorHandler struct {
	connectionPool *monitor.ConnectionPool
}

// NewMonitorHandler 创建监控处理器
func NewMonitorHandler(connectionPool *monitor.ConnectionPool) *MonitorHandler {
	return &MonitorHandler{
		connectionPool: connectionPool,
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

    // 立即升级到 WebSocket
    wsConn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
    if err != nil {
        log.Printf("Failed to upgrade to WebSocket: %v", err)
        return
    }
    defer wsConn.Close()

	// 发送握手完成消息
	handshakeMsg := map[string]string{"type": "handshake_complete", "status": "connecting"}
	if data, err := json.Marshal(handshakeMsg); err == nil {
		_ = wsConn.SetWriteDeadline(time.Now().Add(wsWriteWait))
		_ = wsConn.WriteMessage(websocket.TextMessage, data)
	}

	// 异步获取或创建 SSH 连接
	log.Printf("[Monitor] 尝试获取连接: userID=%s, serverID=%s", userID, serverID)
	connChan := make(chan *monitor.PooledConnection, 1)
	errChan := make(chan error, 1)

	go func() {
		pooledConn, err := h.connectionPool.GetOrCreate(userID, serverID)
		if err != nil {
			errChan <- err
			return
		}
		connChan <- pooledConn
	}()

	// 等待连接建立或超时
	var pooledConn *monitor.PooledConnection
	select {
	case pooledConn = <-connChan:
		log.Printf("[Monitor] 成功获取连接: userID=%s, serverID=%s, refCount=%d", userID, serverID, pooledConn.GetRefCount())
		// 发送连接就绪消息
		readyMsg := map[string]string{"type": "ready"}
		if data, err := json.Marshal(readyMsg); err == nil {
			_ = wsConn.SetWriteDeadline(time.Now().Add(wsWriteWait))
			_ = wsConn.WriteMessage(websocket.TextMessage, data)
		}
	case err := <-errChan:
		log.Printf("[Monitor] 获取连接失败: %v", err)
		errMsg := map[string]string{"type": "error", "message": err.Error()}
		if data, err := json.Marshal(errMsg); err == nil {
			_ = wsConn.SetWriteDeadline(time.Now().Add(wsWriteWait))
			_ = wsConn.WriteMessage(websocket.TextMessage, data)
		}
		return
	case <-time.After(10 * time.Second):
		log.Printf("[Monitor] 获取连接超时")
		errMsg := map[string]string{"type": "error", "message": "connection timeout"}
		if data, err := json.Marshal(errMsg); err == nil {
			_ = wsConn.SetWriteDeadline(time.Now().Add(wsWriteWait))
			_ = wsConn.WriteMessage(websocket.TextMessage, data)
		}
		return
	}

	// 确保在函数退出时释放连接
	defer func() {
		h.connectionPool.Release(userID, serverID)
		log.Printf("[Monitor] 释放连接: userID=%s, serverID=%s", userID, serverID)
	}()

    log.Printf("Monitor WebSocket connected for server: %s, using pooled connection", serverID)

    // 配置 read deadline 与 pong 处理，便于断线检测
    _ = wsConn.SetReadDeadline(time.Now().Add(wsPongWait))
    // 设置读取大小限制，防止异常消息导致内存压力
    wsConn.SetReadLimit(1 << 20) // 1 MiB
    wsConn.SetPongHandler(func(appData string) error {
        return wsConn.SetReadDeadline(time.Now().Add(wsPongWait))
    })

	// 创建采集器（使用连接池中的 SSH Client）
	collector := monitor.NewCollector(pooledConn.Client)

    // 创建停止通道
    done := make(chan struct{})
    stopMonitoring := make(chan struct{})

    // 统一写锁，避免并发写导致报错
    var writeMu sync.Mutex

	// 监听客户端消息 (处理 ping/close)
    go func() {
        type pingMsg struct {
            Type string `json:"type"`
            Ts   int64  `json:"ts"`
        }

        for {
            msgType, payload, err := wsConn.ReadMessage()
            if err != nil {
                if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
                    log.Printf("Monitor WebSocket error: %v", err)
                }
                close(done)
                return
            }

            // 仅在 TextMessage 时尝试解析应用层 ping
            if msgType == websocket.TextMessage {
                var m pingMsg
                if err := json.Unmarshal(payload, &m); err == nil && m.Type == "ping" {
                    serverRecvTs := time.Now().UnixMilli()
                    // 构造 NTP 风格 4 时间戳响应
                    resp := map[string]any{
                        "type":         "pong",
                        "ts":           m.Ts,           // t0 客户端发送时间
                        "serverRecvTs": serverRecvTs,   // t1 服务器接收时间
                        // t2 服务器发送时间（下方写前设置）
                    }
                    // 写入前更新发送时间并设置写超时
                    writeMu.Lock()
                    _ = wsConn.SetWriteDeadline(time.Now().Add(wsWriteWait))
                    resp["serverSendTs"] = time.Now().UnixMilli() // t2
                    b, _ := json.Marshal(resp)
                    _ = wsConn.WriteMessage(websocket.TextMessage, b)
                    writeMu.Unlock()
                }
            }
        }
    }()

    // 定期采集和推送指标
    ticker := time.NewTicker(interval)
    defer ticker.Stop()
    // 定期发送 WS 控制帧 Ping（浏览器自动回 Pong）
    pingTicker := time.NewTicker(wsPingEvery)
    defer pingTicker.Stop()

	// 立即发送第一次数据
    if err := h.sendMetrics(wsConn, collector, &writeMu); err != nil {
        log.Printf("Failed to send initial metrics: %v", err)
        return
    }

	for {
		select {
        case <-ticker.C:
            if err := h.sendMetrics(wsConn, collector, &writeMu); err != nil {
                log.Printf("Failed to send metrics: %v", err)
                close(stopMonitoring)
                return
            }

        case <-pingTicker.C:
            // 发送控制帧 Ping
            writeMu.Lock()
            // 使用 WriteControl 的 deadline，另设置全局写超时
            _ = wsConn.SetWriteDeadline(time.Now().Add(wsWriteWait))
            err := wsConn.WriteControl(websocket.PingMessage, []byte("ping"), time.Now().Add(5*time.Second))
            writeMu.Unlock()
            if err != nil {
                log.Printf("Failed to send ws ping: %v", err)
                close(stopMonitoring)
                return
            }

		case <-done:
			log.Printf("Monitor WebSocket closed for server: %s", serverID)
			return

		case <-stopMonitoring:
			return
		}
	}
}

// sendMetrics 采集并发送指标
func (h *MonitorHandler) sendMetrics(conn *websocket.Conn, collector *monitor.Collector, writeMu *sync.Mutex) error {
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
    writeMu.Lock()
    defer writeMu.Unlock()
    _ = conn.SetWriteDeadline(time.Now().Add(wsWriteWait))
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
    _ = conn.SetWriteDeadline(time.Now().Add(wsWriteWait))
    conn.WriteMessage(websocket.BinaryMessage, data)

    time.Sleep(100 * time.Millisecond)
    conn.Close()
}
