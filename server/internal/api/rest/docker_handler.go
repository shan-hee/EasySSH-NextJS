package rest

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/easyssh/server/internal/domain/monitor"
	"github.com/easyssh/server/internal/domain/server"
	sshDomain "github.com/easyssh/server/internal/domain/ssh"
	"github.com/easyssh/server/internal/pkg/crypto"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/ssh"
)

// DockerContainer Docker 容器信息
type DockerContainer struct {
	ID        string            `json:"id"`
	Names     []string          `json:"names"`
	Image     string            `json:"image"`
	ImageID   string            `json:"imageId"`
	Command   string            `json:"command"`
	Created   int64             `json:"created"`
	Status    string            `json:"status"`
	State     string            `json:"state"`
	Ports     []DockerPort      `json:"ports"`
	Labels    map[string]string `json:"labels"`
	Mounts    []DockerMount     `json:"mounts"`
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

// DockerHandler Docker 处理器
type DockerHandler struct {
	serverService   server.Service
	serverRepo      server.Repository
	encryptor       *crypto.Encryptor
	hostKeyCallback ssh.HostKeyCallback
	connectionPool  *monitor.ConnectionPool // SSH 连接池（复用监控连接池）
}

// NewDockerHandler 创建 Docker 处理器
func NewDockerHandler(
	serverService server.Service,
	serverRepo server.Repository,
	encryptor *crypto.Encryptor,
	hostKeyCallback ssh.HostKeyCallback,
	connectionPool *monitor.ConnectionPool,
) *DockerHandler {
	return &DockerHandler{
		serverService:   serverService,
		serverRepo:      serverRepo,
		encryptor:       encryptor,
		hostKeyCallback: hostKeyCallback,
		connectionPool:  connectionPool,
	}
}

// getPooledConnection 从连接池获取 SSH 连接
func (h *DockerHandler) getPooledConnection(c *gin.Context, serverID string) (*monitor.PooledConnection, error) {
	userID, exists := c.Get("user_id")
	if !exists {
		return nil, fmt.Errorf("unauthorized")
	}

	// 使用连接池获取或创建连接
	pooledConn, err := h.connectionPool.GetOrCreate(userID.(string), serverID)
	if err != nil {
		return nil, fmt.Errorf("failed to get ssh connection: %w", err)
	}

	return pooledConn, nil
}

// releaseConnection 释放连接（减少引用计数）
func (h *DockerHandler) releaseConnection(c *gin.Context, serverID string) {
	userID, exists := c.Get("user_id")
	if !exists {
		return
	}
	h.connectionPool.Release(userID.(string), serverID)
}

// executeCommand 执行 SSH 命令
func (h *DockerHandler) executeCommand(client *sshDomain.Client, cmd string) (string, error) {
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

// ListContainers 获取容器列表
func (h *DockerHandler) ListContainers(c *gin.Context) {
	serverID := c.Param("serverId")
	all := c.DefaultQuery("all", "true") == "true"

	pooledConn, err := h.getPooledConnection(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "ssh_error", err.Error())
		return
	}
	defer h.releaseConnection(c, serverID)

	cmd := "docker ps --format '{{json .}}'"
	if all {
		cmd = "docker ps -a --format '{{json .}}'"
	}

	output, err := h.executeCommand(pooledConn.Client, cmd)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "docker_error", err.Error())
		return
	}

	containers := h.parseContainers(output)
	RespondSuccess(c, map[string]interface{}{
		"data":  containers,
		"total": len(containers),
	})
}

// SSE 事件类型
type SSEContainerEvent struct {
	Type string      `json:"type"` // "containers" | "update_status" | "done"
	Data interface{} `json:"data"`
}

// ListContainersSSE 获取容器列表（SSE 流式响应，包含更新检查）
func (h *DockerHandler) ListContainersSSE(c *gin.Context) {
	serverID := c.Param("serverId")
	all := c.DefaultQuery("all", "true") == "true"

	// 设置 SSE 响应头
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	pooledConn, err := h.getPooledConnection(c, serverID)
	if err != nil {
		h.sendSSEEvent(c, "error", map[string]string{"error": err.Error()})
		return
	}
	defer h.releaseConnection(c, serverID)

	cmd := "docker ps --format '{{json .}}'"
	if all {
		cmd = "docker ps -a --format '{{json .}}'"
	}

	output, err := h.executeCommand(pooledConn.Client, cmd)
	if err != nil {
		h.sendSSEEvent(c, "error", map[string]string{"error": err.Error()})
		return
	}

	containers := h.parseContainers(output)

	// 1. 先发送容器列表
	h.sendSSEEvent(c, "containers", map[string]interface{}{
		"data":  containers,
		"total": len(containers),
	})

	// 2. 收集运行中的容器
	var runningContainers []DockerContainer
	for _, container := range containers {
		if container.State == "running" {
			runningContainers = append(runningContainers, container)
		}
	}

	// 3. 逐个检查更新状态并流式返回
	for _, container := range runningContainers {
		status := h.checkSingleImageUpdate(pooledConn.Client, container.ID)
		status.ContainerID = container.ID
		h.sendSSEEvent(c, "update_status", status)
		c.Writer.Flush()
	}

	// 4. 发送完成事件
	h.sendSSEEvent(c, "done", nil)
}

// sendSSEEvent 发送 SSE 事件
func (h *DockerHandler) sendSSEEvent(c *gin.Context, eventType string, data interface{}) {
	event := SSEContainerEvent{
		Type: eventType,
		Data: data,
	}
	jsonData, _ := json.Marshal(event)
	c.Writer.Write([]byte("data: " + string(jsonData) + "\n\n"))
	c.Writer.Flush()
}

// GetContainerLogs 获取容器日志
func (h *DockerHandler) GetContainerLogs(c *gin.Context) {
	serverID := c.Param("serverId")
	containerID := c.Param("id")
	tail := c.DefaultQuery("tail", "100")

	pooledConn, err := h.getPooledConnection(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "ssh_error", err.Error())
		return
	}
	defer h.releaseConnection(c, serverID)

	cmd := fmt.Sprintf("docker logs --tail %s %s 2>&1", tail, containerID)
	output, err := h.executeCommand(pooledConn.Client, cmd)
	if err != nil {
		// Docker logs 可能返回错误码但仍有输出
		if output == "" {
			RespondError(c, http.StatusInternalServerError, "docker_error", err.Error())
			return
		}
	}

	tailInt, _ := strconv.Atoi(tail)
	RespondSuccess(c, map[string]interface{}{
		"data":         output,
		"container_id": containerID,
		"lines":        tailInt,
	})
}

// StartContainer 启动容器
func (h *DockerHandler) StartContainer(c *gin.Context) {
	serverID := c.Param("serverId")
	containerID := c.Param("id")

	pooledConn, err := h.getPooledConnection(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "ssh_error", err.Error())
		return
	}
	defer h.releaseConnection(c, serverID)

	cmd := fmt.Sprintf("docker start %s", containerID)
	_, err = h.executeCommand(pooledConn.Client, cmd)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "docker_error", err.Error())
		return
	}

	RespondSuccessWithMessage(c, nil, "Container started")
}

// StopContainer 停止容器
func (h *DockerHandler) StopContainer(c *gin.Context) {
	serverID := c.Param("serverId")
	containerID := c.Param("id")

	pooledConn, err := h.getPooledConnection(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "ssh_error", err.Error())
		return
	}
	defer h.releaseConnection(c, serverID)

	cmd := fmt.Sprintf("docker stop %s", containerID)
	_, err = h.executeCommand(pooledConn.Client, cmd)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "docker_error", err.Error())
		return
	}

	RespondSuccessWithMessage(c, nil, "Container stopped")
}

// RestartContainer 重启容器
func (h *DockerHandler) RestartContainer(c *gin.Context) {
	serverID := c.Param("serverId")
	containerID := c.Param("id")

	pooledConn, err := h.getPooledConnection(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "ssh_error", err.Error())
		return
	}
	defer h.releaseConnection(c, serverID)

	cmd := fmt.Sprintf("docker restart %s", containerID)
	_, err = h.executeCommand(pooledConn.Client, cmd)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "docker_error", err.Error())
		return
	}

	RespondSuccessWithMessage(c, nil, "Container restarted")
}

// PauseContainer 暂停容器
func (h *DockerHandler) PauseContainer(c *gin.Context) {
	serverID := c.Param("serverId")
	containerID := c.Param("id")

	pooledConn, err := h.getPooledConnection(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "ssh_error", err.Error())
		return
	}
	defer h.releaseConnection(c, serverID)

	cmd := fmt.Sprintf("docker pause %s", containerID)
	_, err = h.executeCommand(pooledConn.Client, cmd)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "docker_error", err.Error())
		return
	}

	RespondSuccessWithMessage(c, nil, "Container paused")
}

// UnpauseContainer 恢复容器
func (h *DockerHandler) UnpauseContainer(c *gin.Context) {
	serverID := c.Param("serverId")
	containerID := c.Param("id")

	pooledConn, err := h.getPooledConnection(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "ssh_error", err.Error())
		return
	}
	defer h.releaseConnection(c, serverID)

	cmd := fmt.Sprintf("docker unpause %s", containerID)
	_, err = h.executeCommand(pooledConn.Client, cmd)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "docker_error", err.Error())
		return
	}

	RespondSuccessWithMessage(c, nil, "Container unpaused")
}

// RemoveContainer 删除容器
func (h *DockerHandler) RemoveContainer(c *gin.Context) {
	serverID := c.Param("serverId")
	containerID := c.Param("id")
	force := c.DefaultQuery("force", "false") == "true"

	pooledConn, err := h.getPooledConnection(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "ssh_error", err.Error())
		return
	}
	defer h.releaseConnection(c, serverID)

	cmd := fmt.Sprintf("docker rm %s", containerID)
	if force {
		cmd = fmt.Sprintf("docker rm -f %s", containerID)
	}

	_, err = h.executeCommand(pooledConn.Client, cmd)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "docker_error", err.Error())
		return
	}

	RespondSuccessWithMessage(c, nil, "Container removed")
}

// ListImages 获取镜像列表
func (h *DockerHandler) ListImages(c *gin.Context) {
	serverID := c.Param("serverId")

	pooledConn, err := h.getPooledConnection(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "ssh_error", err.Error())
		return
	}
	defer h.releaseConnection(c, serverID)

	cmd := "docker images --format '{{json .}}'"
	output, err := h.executeCommand(pooledConn.Client, cmd)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "docker_error", err.Error())
		return
	}

	images := h.parseImages(output)
	RespondSuccess(c, map[string]interface{}{
		"data":  images,
		"total": len(images),
	})
}

// GetSystemInfo 获取 Docker 系统信息
func (h *DockerHandler) GetSystemInfo(c *gin.Context) {
	serverID := c.Param("serverId")

	pooledConn, err := h.getPooledConnection(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "ssh_error", err.Error())
		return
	}
	defer h.releaseConnection(c, serverID)

	cmd := `docker info --format '{"Containers":{{.Containers}},"ContainersRunning":{{.ContainersRunning}},"ContainersPaused":{{.ContainersPaused}},"ContainersStopped":{{.ContainersStopped}},"Images":{{.Images}},"ServerVersion":"{{.ServerVersion}}","Driver":"{{.Driver}}","MemTotal":{{.MemTotal}},"NCPU":{{.NCPU}}}'`
	output, err := h.executeCommand(pooledConn.Client, cmd)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "docker_error", err.Error())
		return
	}

	info := h.parseSystemInfo(output)
	RespondSuccess(c, map[string]interface{}{
		"data": info,
	})
}

// GetStats 获取所有容器统计
func (h *DockerHandler) GetStats(c *gin.Context) {
	serverID := c.Param("serverId")

	pooledConn, err := h.getPooledConnection(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "ssh_error", err.Error())
		return
	}
	defer h.releaseConnection(c, serverID)

	cmd := "docker stats --no-stream --format '{{json .}}'"
	output, err := h.executeCommand(pooledConn.Client, cmd)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "docker_error", err.Error())
		return
	}

	stats := h.parseStats(output)
	RespondSuccess(c, map[string]interface{}{
		"data": stats,
	})
}

// DockerResourcesResponse 资源页签响应（最小化数据）
type DockerResourcesResponse struct {
	Stats           []ContainerStats  `json:"stats"`
	SystemInfo      *DockerSystemInfo `json:"systemInfo"`
	DockerInstalled bool              `json:"dockerInstalled"`
	Error           string            `json:"error,omitempty"`
}

// GetResources 获取资源页签数据（仅 stats + systemInfo）
func (h *DockerHandler) GetResources(c *gin.Context) {
	serverID := c.Param("serverId")

	pooledConn, err := h.getPooledConnection(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "ssh_error", err.Error())
		return
	}
	defer h.releaseConnection(c, serverID)

	// 检查 Docker 是否安装
	checkOutput, err := h.executeCommand(pooledConn.Client, "which docker 2>/dev/null || command -v docker 2>/dev/null")
	if err != nil || strings.TrimSpace(checkOutput) == "" {
		RespondSuccess(c, DockerResourcesResponse{
			DockerInstalled: false,
			Error:           "Docker not installed or not accessible",
		})
		return
	}

	// 仅获取 stats 和 system info
	script := `
echo "=== STATS ==="
docker stats --no-stream --format '{{json .}}' 2>/dev/null || echo '[]'
echo "=== INFO ==="
docker info --format '{"Containers":{{.Containers}},"ContainersRunning":{{.ContainersRunning}},"ContainersPaused":{{.ContainersPaused}},"ContainersStopped":{{.ContainersStopped}},"Images":{{.Images}},"ServerVersion":"{{.ServerVersion}}","Driver":"{{.Driver}}","MemTotal":{{.MemTotal}},"NCPU":{{.NCPU}}}' 2>/dev/null || echo '{}'
`

	output, err := h.executeCommand(pooledConn.Client, script)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "docker_error", err.Error())
		return
	}

	// 解析输出
	sections := h.parseSections(output)

	response := DockerResourcesResponse{
		DockerInstalled: true,
		Stats:           make([]ContainerStats, 0),
	}

	// 解析统计
	if statsData, ok := sections["STATS"]; ok {
		response.Stats = h.parseStats(statsData)
	}

	// 解析系统信息
	if infoData, ok := sections["INFO"]; ok {
		response.SystemInfo = h.parseSystemInfo(infoData)
	}

	RespondSuccess(c, response)
}

// parseSections 解析脚本输出的各个部分
func (h *DockerHandler) parseSections(output string) map[string]string {
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
func (h *DockerHandler) parseContainers(data string) []DockerContainer {
	containers := make([]DockerContainer, 0)
	lines := strings.Split(strings.TrimSpace(data), "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || line == "[]" {
			continue
		}

		// Docker ps --format '{{json .}}' 输出的 JSON 格式
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
					container.Mounts = append(container.Mounts, DockerMount{
						Source: m,
					})
				}
			}
		}

		containers = append(containers, container)
	}

	return containers
}

// parsePorts 解析端口映射
func (h *DockerHandler) parsePorts(ports string) []DockerPort {
	result := make([]DockerPort, 0)

	// 格式: "0.0.0.0:80->80/tcp, 443/tcp"
	for _, p := range strings.Split(ports, ", ") {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}

		port := DockerPort{Type: "tcp"}

		// 检查协议
		if strings.HasSuffix(p, "/udp") {
			port.Type = "udp"
			p = strings.TrimSuffix(p, "/udp")
		} else if strings.HasSuffix(p, "/tcp") {
			p = strings.TrimSuffix(p, "/tcp")
		}

		// 解析映射
		if strings.Contains(p, "->") {
			parts := strings.Split(p, "->")
			if len(parts) == 2 {
				// 解析公共端口 (IP:port)
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
				// 解析私有端口
				port.PrivatePort, _ = strconv.Atoi(parts[1])
			}
		} else {
			// 仅私有端口
			port.PrivatePort, _ = strconv.Atoi(p)
		}

		if port.PrivatePort > 0 {
			result = append(result, port)
		}
	}

	return result
}

// parseStats 解析容器统计
func (h *DockerHandler) parseStats(data string) []ContainerStats {
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

		// 解析 CPU 使用率 (格式: "2.50%")
		cpuStr := getString(raw, "CPUPerc")
		stat.CPUPercent = parsePercent(cpuStr)

		// 解析内存使用 (格式: "128MiB / 2GiB")
		memStr := getString(raw, "MemUsage")
		stat.MemoryUsage, stat.MemoryLimit = parseMemory(memStr)

		// 解析内存百分比
		memPercStr := getString(raw, "MemPerc")
		stat.MemoryPercent = parsePercent(memPercStr)

		// 解析网络 IO (格式: "1.5kB / 2.3kB")
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
func (h *DockerHandler) parseImages(data string) []DockerImage {
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

		// 解析创建时间
		createdAt := getString(raw, "CreatedAt")
		if createdAt != "" {
			if t, err := time.Parse("2006-01-02 15:04:05 -0700 MST", createdAt); err == nil {
				image.Created = t.Unix()
			}
		}

		// 解析大小
		sizeStr := getString(raw, "Size")
		image.Size = parseSize(sizeStr)

		images = append(images, image)
	}

	return images
}

// parseSystemInfo 解析系统信息
func (h *DockerHandler) parseSystemInfo(data string) *DockerSystemInfo {
	data = strings.TrimSpace(data)
	if data == "" || data == "{}" {
		return nil
	}

	var raw map[string]interface{}
	if err := json.Unmarshal([]byte(data), &raw); err != nil {
		return nil
	}

	info := &DockerSystemInfo{
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

	return info
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
	// 格式: "128MiB / 2GiB"
	parts := strings.Split(s, " / ")
	if len(parts) != 2 {
		return 0, 0
	}
	return parseSize(parts[0]), parseSize(parts[1])
}

func parseNetIO(s string) (int64, int64) {
	// 格式: "1.5kB / 2.3kB"
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

// ImageUpdateStatus 镜像更新状态
type ImageUpdateStatus struct {
	ContainerID   string `json:"containerId,omitempty"`
	HasUpdate     bool   `json:"hasUpdate"`
	CurrentDigest string `json:"currentDigest,omitempty"`
	RemoteDigest  string `json:"remoteDigest,omitempty"`
	Error         string `json:"error,omitempty"`
}

// checkSingleImageUpdate 检查单个容器镜像更新
func (h *DockerHandler) checkSingleImageUpdate(client *sshDomain.Client, containerID string) ImageUpdateStatus {
	// 1. 获取容器使用的镜像名称
	getImageCmd := fmt.Sprintf("docker inspect --format='{{.Config.Image}}' %s 2>/dev/null", containerID)
	imageName, err := h.executeCommand(client, getImageCmd)
	if err != nil {
		return ImageUpdateStatus{
			HasUpdate: false,
			Error:     "Failed to get container image: " + err.Error(),
		}
	}
	imageName = strings.TrimSpace(imageName)
	if imageName == "" {
		return ImageUpdateStatus{
			HasUpdate: false,
			Error:     "Container image name is empty",
		}
	}

	// 2. 获取本地镜像的 digest
	localDigestCmd := fmt.Sprintf("docker inspect --format='{{index .RepoDigests 0}}' %s 2>/dev/null || echo ''", imageName)
	localDigestOutput, _ := h.executeCommand(client, localDigestCmd)
	localDigest := strings.TrimSpace(localDigestOutput)

	// 如果没有 RepoDigests（本地构建的镜像），使用镜像 ID
	if localDigest == "" || localDigest == "<no value>" {
		localIdCmd := fmt.Sprintf("docker inspect --format='{{.Id}}' %s 2>/dev/null || echo ''", imageName)
		localIdOutput, _ := h.executeCommand(client, localIdCmd)
		localDigest = strings.TrimSpace(localIdOutput)
	}

	// 提取 digest 部分（去掉镜像名前缀）
	if strings.Contains(localDigest, "@") {
		parts := strings.Split(localDigest, "@")
		if len(parts) == 2 {
			localDigest = parts[1]
		}
	}

	// 3. 尝试获取远程镜像的 digest
	remoteDigestCmd := fmt.Sprintf("docker manifest inspect %s 2>/dev/null | grep -m1 '\"digest\"' | cut -d'\"' -f4 || echo ''", imageName)
	remoteDigestOutput, _ := h.executeCommand(client, remoteDigestCmd)
	remoteDigest := strings.TrimSpace(remoteDigestOutput)

	// 如果 manifest inspect 不可用，尝试使用 skopeo
	if remoteDigest == "" {
		skopeoCmd := fmt.Sprintf("skopeo inspect docker://%s 2>/dev/null | grep -m1 '\"Digest\"' | cut -d'\"' -f4 || echo ''", imageName)
		skopeoOutput, _ := h.executeCommand(client, skopeoCmd)
		remoteDigest = strings.TrimSpace(skopeoOutput)
	}

	// 如果无法获取远程 digest，返回未知状态
	if remoteDigest == "" {
		return ImageUpdateStatus{
			HasUpdate:     false,
			CurrentDigest: localDigest,
			Error:         "Unable to check remote image",
		}
	}

	// 4. 比较 digest
	hasUpdate := localDigest != "" && remoteDigest != "" && localDigest != remoteDigest

	return ImageUpdateStatus{
		HasUpdate:     hasUpdate,
		CurrentDigest: localDigest,
		RemoteDigest:  remoteDigest,
	}
}
