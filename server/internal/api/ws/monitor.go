package ws

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/easyssh/server/internal/api/middleware"
	"github.com/easyssh/server/internal/domain/monitor"
	"github.com/easyssh/server/internal/domain/security"
	sshDomain "github.com/easyssh/server/internal/domain/ssh"
	pb "github.com/easyssh/server/internal/proto"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"golang.org/x/sync/singleflight"
	"google.golang.org/protobuf/proto"
)

const (
	// 控制帧心跳/超时设置
	wsPongWait  = 60 * time.Second
	wsPingEvery = 50 * time.Second
	wsWriteWait = 10 * time.Second
)

// wsSubscriber WebSocket 订阅者（实现 monitor.MetricsSubscriber 接口）
type wsSubscriber struct {
	id      string
	conn    *websocket.Conn
	writeMu *sync.Mutex
}

func (s *wsSubscriber) ID() string {
	return s.id
}

func (s *wsSubscriber) OnMetrics(metrics *pb.SystemMetrics) {
	data, err := proto.Marshal(metrics)
	if err != nil {
		log.Printf("[wsSubscriber] 序列化失败: %v", err)
		return
	}

	s.writeMu.Lock()
	defer s.writeMu.Unlock()
	_ = s.conn.SetWriteDeadline(time.Now().Add(wsWriteWait))
	if err := s.conn.WriteMessage(websocket.BinaryMessage, data); err != nil {
		log.Printf("[wsSubscriber] 发送失败: %v", err)
	}
}

// MonitorHandler WebSocket 监控处理器
type MonitorHandler struct {
	connectionPool   *monitor.ConnectionPool
	securityService  security.Service                // 安全配置服务（用于 CORS）
	webDevPort       int                             // 前端开发端口，用于默认同源白名单
	dockerSF         singleflight.Group              // Docker 数据请求合并
	collectorManager *monitor.SharedCollectorManager // 共享采集器管理器
}

// NewMonitorHandler 创建监控处理器
func NewMonitorHandler(connectionPool *monitor.ConnectionPool, securityService security.Service, webDevPort int) *MonitorHandler {
	return &MonitorHandler{
		connectionPool:   connectionPool,
		securityService:  securityService,
		webDevPort:       webDevPort,
		collectorManager: monitor.NewSharedCollectorManager(),
	}
}

// getUpgrader 创建 WebSocket upgrader，集成 CORS 配置
func (h *MonitorHandler) getUpgrader() websocket.Upgrader {
	return websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			allowed := middleware.IsAllowedOrigin(r, h.securityService, h.webDevPort)
			if !allowed {
				log.Printf("[Monitor] WebSocket connection rejected: origin %s not allowed (host=%s)", r.Header.Get("Origin"), r.Host)
			}
			return allowed
		},
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
	upgrader := h.getUpgrader()
	wsConn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("[Monitor] Failed to upgrade to WebSocket: %v", err)
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

	// 创建停止通道
	done := make(chan struct{})

	// 统一写锁，避免并发写导致报错
	var writeMu sync.Mutex

	// 创建 WebSocket 订阅者并注册到共享采集器
	subID := uuid.New().String()
	subscriber := &wsSubscriber{
		id:      subID,
		conn:    wsConn,
		writeMu: &writeMu,
	}
	// 使用工厂函数延迟创建 Collector，仅在首个订阅者时才实际创建
	h.collectorManager.GetOrCreate(serverID, func() *monitor.Collector {
		return monitor.NewCollector(pooledConn.Client)
	}, interval, subscriber)

	// 确保退出时取消订阅
	defer func() {
		h.collectorManager.Unsubscribe(serverID, subID)
		log.Printf("[Monitor] 取消订阅: serverID=%s, subID=%s", serverID, subID)
	}()

	// 监听客户端消息 (处理 ping/close/docker_request)
	go func() {
		// 通用消息结构
		type wsMsg struct {
			Type      string `json:"type"`
			Ts        int64  `json:"ts,omitempty"`
			RequestID string `json:"requestId,omitempty"`
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

			// 仅在 TextMessage 时尝试解析
			if msgType == websocket.TextMessage {
				var m wsMsg
				if err := json.Unmarshal(payload, &m); err != nil {
					continue
				}

				switch m.Type {
				case "ping":
					// 处理 ping 消息
					serverRecvTs := time.Now().UnixMilli()
					resp := map[string]any{
						"type":         "pong",
						"ts":           m.Ts,
						"serverRecvTs": serverRecvTs,
					}
					writeMu.Lock()
					_ = wsConn.SetWriteDeadline(time.Now().Add(wsWriteWait))
					resp["serverSendTs"] = time.Now().UnixMilli()
					b, _ := json.Marshal(resp)
					_ = wsConn.WriteMessage(websocket.TextMessage, b)
					writeMu.Unlock()

				case "docker_request":
					// 处理 Docker 数据请求（使用 singleflight 合并相同 serverID 的并发请求）
					go func(requestID string) {
						// 使用 serverID 作为 key，相同服务器的并发请求会被合并
						result, _, _ := h.dockerSF.Do(serverID, func() (interface{}, error) {
							return h.collectDockerData(pooledConn.Client), nil
						})
						dockerData := result.(*DockerDataResponse)
						resp := map[string]any{
							"type":      "docker_response",
							"requestId": requestID,
							"data":      dockerData,
						}
						writeMu.Lock()
						_ = wsConn.SetWriteDeadline(time.Now().Add(wsWriteWait))
						b, _ := json.Marshal(resp)
						_ = wsConn.WriteMessage(websocket.TextMessage, b)
						writeMu.Unlock()
					}(m.RequestID)
				}
			}
		}
	}()

	// 定期发送 WS 控制帧 Ping（浏览器自动回 Pong）
	// 注意：数据采集已由共享采集器处理，这里只负责心跳保活
	pingTicker := time.NewTicker(wsPingEvery)
	defer pingTicker.Stop()

	for {
		select {
		case <-pingTicker.C:
			// 发送控制帧 Ping
			writeMu.Lock()
			_ = wsConn.SetWriteDeadline(time.Now().Add(wsWriteWait))
			err := wsConn.WriteControl(websocket.PingMessage, []byte("ping"), time.Now().Add(5*time.Second))
			writeMu.Unlock()
			if err != nil {
				log.Printf("Failed to send ws ping: %v", err)
				return
			}

		case <-done:
			log.Printf("Monitor WebSocket closed for server: %s", serverID)
			return
		}
	}
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

// ==================== Docker 数据采集 ====================

// DockerDataResponse Docker 数据响应
type DockerDataResponse struct {
	Containers      []DockerContainer `json:"containers"`
	Stats           []ContainerStats  `json:"stats"`
	Images          []DockerImage     `json:"images"`
	SystemInfo      *DockerSystemInfo `json:"systemInfo"`
	DockerInstalled bool              `json:"dockerInstalled"`
	Error           string            `json:"error,omitempty"`
}

// DockerContainer Docker 容器信息
type DockerContainer struct {
	ID      string            `json:"id"`
	Names   []string          `json:"names"`
	Image   string            `json:"image"`
	ImageID string            `json:"imageId"`
	Command string            `json:"command"`
	Created int64             `json:"created"`
	Status  string            `json:"status"`
	State   string            `json:"state"`
	Ports   []DockerPort      `json:"ports"`
	Labels  map[string]string `json:"labels"`
	Mounts  []DockerMount     `json:"mounts"`
}

// DockerPort 端口映射
type DockerPort struct {
	IP          string `json:"ip,omitempty"`
	PrivatePort int    `json:"privatePort"`
	PublicPort  int    `json:"publicPort,omitempty"`
	Type        string `json:"type"`
}

// DockerMount 挂载点
type DockerMount struct {
	Type        string `json:"type"`
	Source      string `json:"source"`
	Destination string `json:"destination"`
	Mode        string `json:"mode"`
	RW          bool   `json:"rw"`
}

// ContainerStats 容器资源统计
type ContainerStats struct {
	ContainerID   string  `json:"containerId"`
	Name          string  `json:"name"`
	CPUPercent    float64 `json:"cpuPercent"`
	MemoryUsage   int64   `json:"memoryUsage"`
	MemoryLimit   int64   `json:"memoryLimit"`
	MemoryPercent float64 `json:"memoryPercent"`
	NetworkIn     int64   `json:"networkIn"`
	NetworkOut    int64   `json:"networkOut"`
	BlockRead     int64   `json:"blockRead"`
	BlockWrite    int64   `json:"blockWrite"`
	PIDs          int     `json:"pids"`
}

// DockerImage Docker 镜像
type DockerImage struct {
	ID          string `json:"id"`
	Repository  string `json:"repository"`
	Tag         string `json:"tag"`
	Created     int64  `json:"created"`
	Size        int64  `json:"size"`
	VirtualSize int64  `json:"virtualSize"`
}

// DockerSystemInfo Docker 系统信息
type DockerSystemInfo struct {
	ContainersRunning int    `json:"containersRunning"`
	ContainersPaused  int    `json:"containersPaused"`
	ContainersStopped int    `json:"containersStopped"`
	ContainersTotal   int    `json:"containersTotal"`
	ImagesCount       int    `json:"imagesCount"`
	DockerVersion     string `json:"dockerVersion"`
	ServerVersion     string `json:"serverVersion"`
	StorageDriver     string `json:"storageDriver"`
	TotalMemory       int64  `json:"totalMemory"`
	CPUs              int    `json:"cpus"`
}

// collectDockerData 通过 SSH 采集 Docker 数据
func (h *MonitorHandler) collectDockerData(sshClient *sshDomain.Client) *DockerDataResponse {
	response := &DockerDataResponse{
		DockerInstalled: false,
		Containers:      make([]DockerContainer, 0),
		Stats:           make([]ContainerStats, 0),
		Images:          make([]DockerImage, 0),
	}

	// 检查 Docker 是否安装
	checkOutput, err := h.executeSSHCommand(sshClient, "which docker 2>/dev/null || command -v docker 2>/dev/null")
	if err != nil || strings.TrimSpace(checkOutput) == "" {
		response.Error = "Docker not installed or not accessible"
		return response
	}

	response.DockerInstalled = true

	// 批量获取 Docker 数据
	script := `
echo "=== CONTAINERS ==="
docker ps -a --format '{{json .}}' 2>/dev/null || echo '[]'
echo "=== STATS ==="
docker stats --no-stream --format '{{json .}}' 2>/dev/null || echo '[]'
echo "=== IMAGES ==="
docker images --format '{{json .}}' 2>/dev/null || echo '[]'
echo "=== INFO ==="
docker info --format '{"Containers":{{.Containers}},"ContainersRunning":{{.ContainersRunning}},"ContainersPaused":{{.ContainersPaused}},"ContainersStopped":{{.ContainersStopped}},"Images":{{.Images}},"ServerVersion":"{{.ServerVersion}}","Driver":"{{.Driver}}","MemTotal":{{.MemTotal}},"NCPU":{{.NCPU}}}' 2>/dev/null || echo '{}'
`

	output, err := h.executeSSHCommand(sshClient, script)
	if err != nil {
		response.Error = err.Error()
		return response
	}

	// 解析输出
	sections := h.parseSections(output)

	if containerData, ok := sections["CONTAINERS"]; ok {
		response.Containers = h.parseContainers(containerData)
	}

	if statsData, ok := sections["STATS"]; ok {
		response.Stats = h.parseStats(statsData)
	}

	if imageData, ok := sections["IMAGES"]; ok {
		response.Images = h.parseImages(imageData)
	}

	if infoData, ok := sections["INFO"]; ok {
		response.SystemInfo = h.parseSystemInfo(infoData)
	}

	return response
}

// executeSSHCommand 执行 SSH 命令
func (h *MonitorHandler) executeSSHCommand(client *sshDomain.Client, cmd string) (string, error) {
	session, err := client.NewSession()
	if err != nil {
		return "", fmt.Errorf("failed to create session: %w", err)
	}
	defer session.Close()

	output, err := session.CombinedOutput(cmd)
	if err != nil {
		return string(output), err
	}

	return string(output), nil
}

// parseSections 解析脚本输出的各个部分
func (h *MonitorHandler) parseSections(output string) map[string]string {
	sections := make(map[string]string)
	lines := strings.Split(output, "\n")

	var currentSection string
	var sectionLines []string

	for _, line := range lines {
		if strings.HasPrefix(line, "=== ") && strings.HasSuffix(line, " ===") {
			if currentSection != "" {
				sections[currentSection] = strings.Join(sectionLines, "\n")
			}
			currentSection = strings.Trim(line, "= ")
			sectionLines = []string{}
		} else if currentSection != "" {
			sectionLines = append(sectionLines, line)
		}
	}

	if currentSection != "" {
		sections[currentSection] = strings.Join(sectionLines, "\n")
	}

	return sections
}

// parseContainers 解析容器列表
func (h *MonitorHandler) parseContainers(data string) []DockerContainer {
	containers := make([]DockerContainer, 0)
	lines := strings.Split(strings.TrimSpace(data), "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || line == "[]" {
			continue
		}

		var raw map[string]interface{}
		if err := json.Unmarshal([]byte(line), &raw); err != nil {
			continue
		}

		container := DockerContainer{
			ID:      getString(raw, "ID"),
			Image:   getString(raw, "Image"),
			Command: getString(raw, "Command"),
			Status:  getString(raw, "Status"),
			State:   strings.ToLower(getString(raw, "State")),
			Labels:  make(map[string]string),
			Mounts:  make([]DockerMount, 0),
		}

		// 解析名称
		names := getString(raw, "Names")
		if names != "" {
			container.Names = strings.Split(names, ",")
		}

		// 解析创建时间
		createdAt := getString(raw, "CreatedAt")
		if createdAt != "" {
			if t, err := time.Parse("2006-01-02 15:04:05 -0700 MST", createdAt); err == nil {
				container.Created = t.Unix()
			}
		}

		// 解析端口
		ports := getString(raw, "Ports")
		if ports != "" {
			container.Ports = h.parsePorts(ports)
		}

		// 解析标签
		labels := getString(raw, "Labels")
		if labels != "" {
			for _, kv := range strings.Split(labels, ",") {
				parts := strings.SplitN(kv, "=", 2)
				if len(parts) == 2 {
					container.Labels[parts[0]] = parts[1]
				}
			}
		}

		// 解析挂载点
		mounts := getString(raw, "Mounts")
		if mounts != "" {
			for _, m := range strings.Split(mounts, ",") {
				if m != "" {
					container.Mounts = append(container.Mounts, DockerMount{Source: m})
				}
			}
		}

		containers = append(containers, container)
	}

	return containers
}

// parsePorts 解析端口映射
func (h *MonitorHandler) parsePorts(ports string) []DockerPort {
	result := make([]DockerPort, 0)

	for _, p := range strings.Split(ports, ", ") {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}

		port := DockerPort{Type: "tcp"}

		if strings.HasSuffix(p, "/udp") {
			port.Type = "udp"
			p = strings.TrimSuffix(p, "/udp")
		} else if strings.HasSuffix(p, "/tcp") {
			p = strings.TrimSuffix(p, "/tcp")
		}

		if strings.Contains(p, "->") {
			parts := strings.Split(p, "->")
			if len(parts) == 2 {
				hostPart := parts[0]
				if strings.Contains(hostPart, ":") {
					hostParts := strings.Split(hostPart, ":")
					if len(hostParts) == 2 {
						port.IP = hostParts[0]
						port.PublicPort, _ = strconv.Atoi(hostParts[1])
					}
				} else {
					port.PublicPort, _ = strconv.Atoi(hostPart)
				}
				port.PrivatePort, _ = strconv.Atoi(parts[1])
			}
		} else {
			port.PrivatePort, _ = strconv.Atoi(p)
		}

		if port.PrivatePort > 0 {
			result = append(result, port)
		}
	}

	return result
}

// parseStats 解析容器统计
func (h *MonitorHandler) parseStats(data string) []ContainerStats {
	stats := make([]ContainerStats, 0)
	lines := strings.Split(strings.TrimSpace(data), "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || line == "[]" {
			continue
		}

		var raw map[string]interface{}
		if err := json.Unmarshal([]byte(line), &raw); err != nil {
			continue
		}

		stat := ContainerStats{
			ContainerID: getString(raw, "ID"),
			Name:        getString(raw, "Name"),
		}

		// 解析 CPU 使用率
		cpuStr := getString(raw, "CPUPerc")
		stat.CPUPercent = parsePercent(cpuStr)

		// 解析内存使用
		memStr := getString(raw, "MemUsage")
		stat.MemoryUsage, stat.MemoryLimit = parseMemory(memStr)

		// 解析内存百分比
		memPercStr := getString(raw, "MemPerc")
		stat.MemoryPercent = parsePercent(memPercStr)

		// 解析网络 IO
		netStr := getString(raw, "NetIO")
		stat.NetworkIn, stat.NetworkOut = parseNetIO(netStr)

		// 解析块 IO
		blockStr := getString(raw, "BlockIO")
		stat.BlockRead, stat.BlockWrite = parseNetIO(blockStr)

		// 解析 PIDs
		pidsStr := getString(raw, "PIDs")
		stat.PIDs, _ = strconv.Atoi(pidsStr)

		stats = append(stats, stat)
	}

	return stats
}

// parseImages 解析镜像列表
func (h *MonitorHandler) parseImages(data string) []DockerImage {
	images := make([]DockerImage, 0)
	lines := strings.Split(strings.TrimSpace(data), "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || line == "[]" {
			continue
		}

		var raw map[string]interface{}
		if err := json.Unmarshal([]byte(line), &raw); err != nil {
			continue
		}

		image := DockerImage{
			ID:         getString(raw, "ID"),
			Repository: getString(raw, "Repository"),
			Tag:        getString(raw, "Tag"),
		}

		createdAt := getString(raw, "CreatedAt")
		if createdAt != "" {
			if t, err := time.Parse("2006-01-02 15:04:05 -0700 MST", createdAt); err == nil {
				image.Created = t.Unix()
			}
		}

		sizeStr := getString(raw, "Size")
		image.Size = parseSize(sizeStr)

		images = append(images, image)
	}

	return images
}

// parseSystemInfo 解析系统信息
func (h *MonitorHandler) parseSystemInfo(data string) *DockerSystemInfo {
	data = strings.TrimSpace(data)
	if data == "" || data == "{}" {
		return nil
	}

	var raw map[string]interface{}
	if err := json.Unmarshal([]byte(data), &raw); err != nil {
		return nil
	}

	return &DockerSystemInfo{
		ContainersRunning: getInt(raw, "ContainersRunning"),
		ContainersPaused:  getInt(raw, "ContainersPaused"),
		ContainersStopped: getInt(raw, "ContainersStopped"),
		ContainersTotal:   getInt(raw, "Containers"),
		ImagesCount:       getInt(raw, "Images"),
		ServerVersion:     getString(raw, "ServerVersion"),
		StorageDriver:     getString(raw, "Driver"),
		TotalMemory:       getInt64(raw, "MemTotal"),
		CPUs:              getInt(raw, "NCPU"),
	}
}

// 辅助函数
func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func getInt(m map[string]interface{}, key string) int {
	if v, ok := m[key]; ok {
		switch n := v.(type) {
		case float64:
			return int(n)
		case int:
			return n
		}
	}
	return 0
}

func getInt64(m map[string]interface{}, key string) int64 {
	if v, ok := m[key]; ok {
		switch n := v.(type) {
		case float64:
			return int64(n)
		case int64:
			return n
		case int:
			return int64(n)
		}
	}
	return 0
}

func parsePercent(s string) float64 {
	s = strings.TrimSpace(s)
	s = strings.TrimSuffix(s, "%")
	v, _ := strconv.ParseFloat(s, 64)
	return v
}

func parseMemory(s string) (int64, int64) {
	parts := strings.Split(s, " / ")
	if len(parts) != 2 {
		return 0, 0
	}
	return parseSize(parts[0]), parseSize(parts[1])
}

func parseNetIO(s string) (int64, int64) {
	parts := strings.Split(s, " / ")
	if len(parts) != 2 {
		return 0, 0
	}
	return parseSize(parts[0]), parseSize(parts[1])
}

func parseSize(s string) int64 {
	s = strings.TrimSpace(s)
	s = strings.ToUpper(s)

	multiplier := int64(1)

	if strings.HasSuffix(s, "B") {
		s = strings.TrimSuffix(s, "B")
	}
	if strings.HasSuffix(s, "I") {
		s = strings.TrimSuffix(s, "I")
	}

	switch {
	case strings.HasSuffix(s, "K"):
		multiplier = 1024
		s = strings.TrimSuffix(s, "K")
	case strings.HasSuffix(s, "M"):
		multiplier = 1024 * 1024
		s = strings.TrimSuffix(s, "M")
	case strings.HasSuffix(s, "G"):
		multiplier = 1024 * 1024 * 1024
		s = strings.TrimSuffix(s, "G")
	case strings.HasSuffix(s, "T"):
		multiplier = 1024 * 1024 * 1024 * 1024
		s = strings.TrimSuffix(s, "T")
	}

	v, _ := strconv.ParseFloat(s, 64)
	return int64(v * float64(multiplier))
}
