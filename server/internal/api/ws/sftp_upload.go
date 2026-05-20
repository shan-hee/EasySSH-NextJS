package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/easyssh/server/internal/api/middleware"
	"github.com/easyssh/server/internal/domain/security"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// UploadProgressMessage SFTP 上传进度消息
type UploadProgressMessage struct {
	Type     string `json:"type"`      // "started", "progress", "complete", "cancelled", "error"
	TaskID   string `json:"task_id"`   // 任务ID
	Loaded   int64  `json:"loaded"`    // 已传输字节数
	Total    int64  `json:"total"`     // 总字节数
	Stage    string `json:"stage"`     // "http", "sftp" 或 "stream"
	SpeedBps int64  `json:"speed_bps"` // 传输速度(字节/秒)
	Message  string `json:"message"`   // 错误或完成消息
}

// UploadTaskStatus 上传任务运行态（内存态，用于前端恢复和统一队列展示）
type UploadTaskStatus struct {
	ID         string     `json:"id"`
	FileName   string     `json:"file_name"`
	FileSize   int64      `json:"file_size"`
	ServerID   string     `json:"server_id,omitempty"`
	RemotePath string     `json:"remote_path,omitempty"`
	Status     string     `json:"status"` // pending, uploading, completed, failed, cancelled
	Stage      string     `json:"stage,omitempty"`
	Progress   float64    `json:"progress"`
	Loaded     int64      `json:"loaded"`
	Total      int64      `json:"total"`
	SpeedBps   int64      `json:"speed_bps"`
	Message    string     `json:"message,omitempty"`
	Error      string     `json:"error,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	StartedAt  *time.Time `json:"started_at,omitempty"`
	UpdatedAt  time.Time  `json:"updated_at"`
	EndedAt    *time.Time `json:"ended_at,omitempty"`
}

// SFTPUploadHandler SFTP 上传 WebSocket 处理器
type SFTPUploadHandler struct {
	// 存储活跃的 WebSocket 连接，key 是 taskID
	connections map[string]*websocket.Conn
	// 存储每个任务的取消函数（由 REST 上传逻辑注册）
	cancelFuncs map[string]func()
	// 存储任务归属与生命周期（用于强校验与回收）
	tasks           map[string]uploadTaskMeta
	mu              sync.RWMutex
	securityService security.Service // 安全配置服务（用于 CORS）
	webDevPort      int
}

type uploadTaskMeta struct {
	userID     string
	serverID   string
	remotePath string
	fileName   string
	fileSize   int64
	status     string
	stage      string
	loaded     int64
	total      int64
	speedBps   int64
	message    string
	errMessage string
	createdAt  time.Time
	startedAt  *time.Time
	updatedAt  time.Time
	endedAt    *time.Time
}

// NewSFTPUploadHandler 创建 SFTP 上传处理器
func NewSFTPUploadHandler(securityService security.Service, webDevPort int) *SFTPUploadHandler {
	if webDevPort <= 0 {
		webDevPort = 3000
	}
	h := &SFTPUploadHandler{
		connections:     make(map[string]*websocket.Conn),
		cancelFuncs:     make(map[string]func()),
		tasks:           make(map[string]uploadTaskMeta),
		securityService: securityService,
		webDevPort:      webDevPort,
	}
	go h.cleanupLoop()
	return h
}

func (h *SFTPUploadHandler) cleanupLoop() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		h.cleanupExpiredTasks(60 * time.Minute)
	}
}

func (h *SFTPUploadHandler) cleanupExpiredTasks(maxAge time.Duration) {
	cutoff := time.Now().Add(-maxAge)
	h.mu.Lock()
	defer h.mu.Unlock()
	for taskID, meta := range h.tasks {
		if meta.createdAt.After(cutoff) {
			continue
		}
		// 仅在无连接且无 cancelFunc 时清理，避免误删活跃上传
		if h.connections[taskID] == nil && h.cancelFuncs[taskID] == nil {
			delete(h.tasks, taskID)
		}
	}
}

// CreateTask 创建一个服务端任务 ID，并绑定用户
func (h *SFTPUploadHandler) CreateTask(userID string) string {
	taskID := uuid.NewString()
	now := time.Now()
	h.mu.Lock()
	h.tasks[taskID] = uploadTaskMeta{
		userID:    userID,
		status:    "pending",
		createdAt: now,
		updatedAt: now,
	}
	h.mu.Unlock()
	return taskID
}

// ValidateTaskOwnership 校验 task 是否属于 user
func (h *SFTPUploadHandler) ValidateTaskOwnership(userID, taskID string) bool {
	h.mu.RLock()
	meta, ok := h.tasks[taskID]
	h.mu.RUnlock()
	return ok && meta.userID == userID
}

// PrepareTask 填充上传任务元信息。上传开始前调用，便于任务列表立即展示。
func (h *SFTPUploadHandler) PrepareTask(userID, taskID, serverID, remotePath, fileName string, fileSize int64) bool {
	now := time.Now()
	h.mu.Lock()
	defer h.mu.Unlock()

	meta, ok := h.tasks[taskID]
	if !ok || meta.userID != userID {
		return false
	}

	meta.serverID = serverID
	meta.remotePath = remotePath
	meta.fileName = fileName
	meta.fileSize = fileSize
	if fileSize > 0 {
		meta.total = fileSize
	}
	meta.updatedAt = now
	h.tasks[taskID] = meta
	return true
}

// IsTaskCancelled 判断任务是否已被提前取消。
func (h *SFTPUploadHandler) IsTaskCancelled(userID, taskID string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()

	meta, ok := h.tasks[taskID]
	return ok && meta.userID == userID && meta.status == "cancelled"
}

// CancelTaskForUser 取消上传任务。若上传尚未注册取消函数，则先把任务标记为取消。
func (h *SFTPUploadHandler) CancelTaskForUser(userID, taskID string) bool {
	var cancel func()

	h.mu.Lock()
	meta, ok := h.tasks[taskID]
	if !ok || meta.userID != userID {
		h.mu.Unlock()
		return false
	}

	cancel = h.cancelFuncs[taskID]
	if cancel == nil && meta.status != "completed" && meta.status != "failed" {
		now := time.Now()
		meta.status = "cancelled"
		meta.message = "upload cancelled"
		meta.updatedAt = now
		meta.endedAt = &now
		h.tasks[taskID] = meta
	}
	h.mu.Unlock()

	if cancel != nil {
		cancel()
	}
	return true
}

// GetTaskForUser 获取单个上传任务状态。
func (h *SFTPUploadHandler) GetTaskForUser(userID, taskID string) (UploadTaskStatus, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	meta, ok := h.tasks[taskID]
	if !ok || meta.userID != userID {
		return UploadTaskStatus{}, false
	}
	return uploadTaskStatusFromMeta(taskID, meta), true
}

// ListTasksForUser 获取当前用户的上传任务状态。
func (h *SFTPUploadHandler) ListTasksForUser(userID string) []UploadTaskStatus {
	h.mu.RLock()
	defer h.mu.RUnlock()

	tasks := make([]UploadTaskStatus, 0)
	for taskID, meta := range h.tasks {
		if meta.userID != userID {
			continue
		}
		tasks = append(tasks, uploadTaskStatusFromMeta(taskID, meta))
	}
	return tasks
}

func uploadTaskStatusFromMeta(taskID string, meta uploadTaskMeta) UploadTaskStatus {
	total := meta.total
	if total <= 0 {
		total = meta.fileSize
	}

	progress := float64(0)
	if total > 0 {
		progress = float64(meta.loaded) / float64(total) * 100
		if progress > 100 {
			progress = 100
		}
	}
	if meta.status == "completed" {
		progress = 100
	}

	return UploadTaskStatus{
		ID:         taskID,
		FileName:   meta.fileName,
		FileSize:   meta.fileSize,
		ServerID:   meta.serverID,
		RemotePath: meta.remotePath,
		Status:     meta.status,
		Stage:      meta.stage,
		Progress:   progress,
		Loaded:     meta.loaded,
		Total:      total,
		SpeedBps:   meta.speedBps,
		Message:    meta.message,
		Error:      meta.errMessage,
		CreatedAt:  meta.createdAt,
		StartedAt:  meta.startedAt,
		UpdatedAt:  meta.updatedAt,
		EndedAt:    meta.endedAt,
	}
}

// getUpgrader 创建 WebSocket upgrader，集成 CORS 配置
func (h *SFTPUploadHandler) getUpgrader() websocket.Upgrader {
	return websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			allowed := middleware.IsAllowedOrigin(r, h.securityService, h.webDevPort)
			if !allowed {
				log.Printf("[SFTPUploadWS] WebSocket connection rejected: origin %s not allowed (host=%s)", r.Header.Get("Origin"), r.Host)
			}
			return allowed
		},
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

	// 强校验任务归属（防止猜测 task_id 窃听/取消他人任务）
	if !h.ValidateTaskOwnership(userID, taskID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden", "message": "task not owned by user"})
		return
	}

	// 升级到 WebSocket
	upgrader := h.getUpgrader()
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

	// 等待客户端消息（目前用于心跳和取消指令）
	for {
		msgType, data, err := wsConn.ReadMessage()
		if err != nil {
			if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				log.Printf("[SFTPUploadWS] 客户端正常关闭: taskID=%s", taskID)
			} else {
				log.Printf("[SFTPUploadWS] 读取错误: taskID=%s, error=%v", taskID, err)
			}
			break
		}

		// 仅处理文本消息中的控制指令（例如取消上传）
		if msgType == websocket.TextMessage {
			var ctrl struct {
				Type   string `json:"type"`
				TaskID string `json:"task_id"`
			}
			if err := json.Unmarshal(data, &ctrl); err != nil {
				log.Printf("[SFTPUploadWS] 解析控制消息失败: taskID=%s, error=%v", taskID, err)
				continue
			}

			if ctrl.Type == "cancel" {
				log.Printf("[SFTPUploadWS] 收到取消指令: taskID=%s", taskID)
				if ok := h.CancelTaskForUser(userID, taskID); !ok {
					log.Printf("[SFTPUploadWS] 未找到取消函数: taskID=%s", taskID)
				}
			}
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
	h.mu.Lock()
	h.updateTaskFromMessageLocked(taskID, msg)
	wsConn, exists := h.connections[taskID]
	h.mu.Unlock()

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

func (h *SFTPUploadHandler) updateTaskFromMessageLocked(taskID string, msg UploadProgressMessage) {
	meta, ok := h.tasks[taskID]
	if !ok {
		return
	}

	now := time.Now()
	meta.updatedAt = now

	if msg.Stage != "" {
		meta.stage = msg.Stage
	}
	if msg.Loaded > 0 || msg.Type == "progress" || msg.Type == "complete" {
		meta.loaded = msg.Loaded
	}
	if msg.Total > 0 {
		meta.total = msg.Total
		if meta.fileSize <= 0 {
			meta.fileSize = msg.Total
		}
	}
	if msg.SpeedBps > 0 {
		meta.speedBps = msg.SpeedBps
	}
	if msg.Message != "" {
		meta.message = msg.Message
	}

	switch msg.Type {
	case "started":
		meta.status = "uploading"
		if meta.startedAt == nil {
			meta.startedAt = &now
		}
	case "progress":
		meta.status = "uploading"
		if meta.startedAt == nil {
			meta.startedAt = &now
		}
	case "complete":
		meta.status = "completed"
		if meta.total > 0 {
			meta.loaded = meta.total
		}
		meta.errMessage = ""
		meta.endedAt = &now
	case "cancelled":
		meta.status = "cancelled"
		meta.message = firstNonEmpty(msg.Message, "upload cancelled")
		meta.endedAt = &now
	case "error":
		meta.status = "failed"
		meta.errMessage = firstNonEmpty(msg.Message, "upload failed")
		meta.endedAt = &now
	}

	h.tasks[taskID] = meta
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

// GetHandler 获取处理器引用（用于在 REST API 中调用 SendProgress）
func (h *SFTPUploadHandler) GetHandler() *SFTPUploadHandler {
	return h
}

// RegisterCancelFunc 为指定任务注册取消函数
func (h *SFTPUploadHandler) RegisterCancelFunc(taskID string, cancel func()) {
	callImmediately := false

	h.mu.Lock()
	h.cancelFuncs[taskID] = cancel
	if meta, ok := h.tasks[taskID]; ok && meta.status == "cancelled" {
		callImmediately = true
	}
	h.mu.Unlock()

	if callImmediately && cancel != nil {
		cancel()
	}
}

// UnregisterCancelFunc 移除指定任务的取消函数
func (h *SFTPUploadHandler) UnregisterCancelFunc(taskID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.cancelFuncs, taskID)
}
