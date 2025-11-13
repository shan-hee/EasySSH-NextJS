package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// upgrader 在 monitor.go 中已定义，这里不需要重复定义
// 如果编译器报错，说明包级别的 upgrader 变量已经在 monitor.go 中定义

// UploadProgressMessage SFTP 上传进度消息
type UploadProgressMessage struct {
	Type     string `json:"type"`      // "progress", "complete", "error"
	TaskID   string `json:"task_id"`   // 任务ID
	Loaded   int64  `json:"loaded"`    // 已传输字节数
	Total    int64  `json:"total"`     // 总字节数
	Stage    string `json:"stage"`     // "http" 或 "sftp"
	SpeedBps int64  `json:"speed_bps"` // 传输速度(字节/秒)
	Message  string `json:"message"`   // 错误或完成消息
}

// SFTPUploadHandler SFTP 上传 WebSocket 处理器
type SFTPUploadHandler struct {
	// 存储活跃的 WebSocket 连接，key 是 taskID
	connections map[string]*websocket.Conn
	mu          sync.RWMutex
}

// NewSFTPUploadHandler 创建 SFTP 上传处理器
func NewSFTPUploadHandler() *SFTPUploadHandler {
	return &SFTPUploadHandler{
		connections: make(map[string]*websocket.Conn),
	}
}

// HandleUploadWebSocket 处理上传进度 WebSocket 连接
// WS /api/v1/sftp/upload/ws/:task_id
func (h *SFTPUploadHandler) HandleUploadWebSocket(c *gin.Context) {
	// 从上下文获取用户 ID（认证中间件已验证）
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	userID := userIDStr.(string)

	// 获取任务 ID
	taskID := c.Param("task_id")
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "task_id required"})
		return
	}

	log.Printf("[SFTPUploadWS] 连接请求: userID=%s, taskID=%s", userID, taskID)

	// 升级到 WebSocket
	wsConn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("[SFTPUploadWS] 升级失败: %v", err)
		return
	}

	// 注册连接
	h.mu.Lock()
	h.connections[taskID] = wsConn
	h.mu.Unlock()

	log.Printf("[SFTPUploadWS] 连接已建立: taskID=%s", taskID)

	// 配置 WebSocket 超时和限制
	_ = wsConn.SetReadDeadline(time.Now().Add(wsPongWait))
	wsConn.SetReadLimit(1 << 10) // 1KB，上传进度 WS 只接收心跳
	wsConn.SetPongHandler(func(appData string) error {
		return wsConn.SetReadDeadline(time.Now().Add(wsPongWait))
	})

	// 启动心跳 goroutine
	stopHeartbeat := make(chan struct{})
	go h.heartbeat(wsConn, taskID, stopHeartbeat)

	// 等待客户端关闭或读取错误（客户端只发送 pong）
	for {
		_, _, err := wsConn.ReadMessage()
		if err != nil {
			if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				log.Printf("[SFTPUploadWS] 客户端正常关闭: taskID=%s", taskID)
			} else {
				log.Printf("[SFTPUploadWS] 读取错误: taskID=%s, error=%v", taskID, err)
			}
			break
		}
	}

	// 清理
	close(stopHeartbeat)
	h.mu.Lock()
	delete(h.connections, taskID)
	h.mu.Unlock()
	wsConn.Close()

	log.Printf("[SFTPUploadWS] 连接已关闭: taskID=%s", taskID)
}

// heartbeat 发送心跳 ping 消息
func (h *SFTPUploadHandler) heartbeat(wsConn *websocket.Conn, taskID string, stop chan struct{}) {
	ticker := time.NewTicker(wsPingEvery)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if err := wsConn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(wsWriteWait)); err != nil {
				log.Printf("[SFTPUploadWS] 心跳失败: taskID=%s, error=%v", taskID, err)
				return
			}
		case <-stop:
			return
		}
	}
}

// SendProgress 发送进度消息到指定任务的 WebSocket 连接
func (h *SFTPUploadHandler) SendProgress(taskID string, msg UploadProgressMessage) error {
	h.mu.RLock()
	wsConn, exists := h.connections[taskID]
	h.mu.RUnlock()

	if !exists {
		// WebSocket 连接不存在（可能客户端未启用或已断开），静默忽略
		return nil
	}

	// 序列化消息
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("[SFTPUploadWS] 序列化消息失败: taskID=%s, error=%v", taskID, err)
		return err
	}

	// 发送消息
	if err := wsConn.SetWriteDeadline(time.Now().Add(wsWriteWait)); err != nil {
		return err
	}

	if err := wsConn.WriteMessage(websocket.TextMessage, data); err != nil {
		log.Printf("[SFTPUploadWS] 发送消息失败: taskID=%s, error=%v", taskID, err)
		// 连接可能已断开，移除
		h.mu.Lock()
		delete(h.connections, taskID)
		h.mu.Unlock()
		wsConn.Close()
		return err
	}

	return nil
}

// GetHandler 获取处理器引用（用于在 REST API 中调用 SendProgress）
func (h *SFTPUploadHandler) GetHandler() *SFTPUploadHandler {
	return h
}
