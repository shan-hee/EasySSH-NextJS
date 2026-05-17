package rest

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
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
	"golang.org/x/text/encoding"
	"golang.org/x/text/encoding/japanese"
	"golang.org/x/text/encoding/korean"
	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/encoding/traditionalchinese"
	"golang.org/x/text/transform"
)

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

func decoderForEncoding(name string) encoding.Encoding {
	switch strings.ToLower(strings.TrimSpace(name)) {
	case "gbk", "gb2312":
		return simplifiedchinese.GBK
	case "gb18030":
		return simplifiedchinese.GB18030
	case "big5":
		return traditionalchinese.Big5
	case "shift_jis", "shift-jis", "sjis":
		return japanese.ShiftJIS
	case "euc-jp":
		return japanese.EUCJP
	case "euc-kr":
		return korean.EUCKR
	default:
		return nil
	}
}

func decodeTextWithEncoding(content string, encodingName string) string {
	decoder := decoderForEncoding(encodingName)
	if decoder == nil {
		return content
	}

	decoded, err := io.ReadAll(transform.NewReader(bytes.NewReader([]byte(content)), decoder.NewDecoder()))
	if err != nil {
		return content
	}
	return string(decoded)
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

	containers, err := h.listContainersFast(pooledConn.Client, all)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "docker_error", err.Error())
		return
	}
	RespondSuccess(c, map[string]interface{}{
		"data":  containers,
		"total": len(containers),
	})
}

const dockerSockNoCurlSentinel = "__EASYSSH_NO_CURL__"

func (h *DockerHandler) listContainersFast(client *sshDomain.Client, all bool) ([]DockerContainer, error) {
	containers, ok, err := h.listContainersViaDockerSock(client, all)
	if err != nil {
		return nil, err
	}
	if ok {
		return containers, nil
	}
	return h.listContainersViaInspect(client, all)
}

func (h *DockerHandler) listContainersViaDockerSock(client *sshDomain.Client, all bool) ([]DockerContainer, bool, error) {
	allFlag := 0
	if all {
		allFlag = 1
	}

	cmd := fmt.Sprintf(
		`sh -lc 'if command -v curl >/dev/null 2>&1; then curl -sS --fail --max-time 5 --unix-socket /var/run/docker.sock "http://localhost/containers/json?all=%d"; else echo "%s"; fi'`,
		allFlag,
		dockerSockNoCurlSentinel,
	)

	output, err := h.executeCommand(client, cmd)
	if err != nil {
		// curl 不可用/失败时回退到 inspect 路径
		return nil, false, nil
	}

	output = strings.TrimSpace(output)
	if output == dockerSockNoCurlSentinel {
		return nil, false, nil
	}

	containers, err := h.parseContainersFromDockerSock(output)
	if err != nil {
		return nil, true, err
	}
	return containers, true, nil
}

type dockerSockContainerSummary struct {
	ID      string            `json:"Id"`
	Names   []string          `json:"Names"`
	Image   string            `json:"Image"`
	ImageID string            `json:"ImageID"`
	Command string            `json:"Command"`
	Created int64             `json:"Created"`
	State   string            `json:"State"`
	Status  string            `json:"Status"`
	Ports   []DockerPort      `json:"Ports"`
	Labels  map[string]string `json:"Labels"`
	Mounts  []dockerSockMount `json:"Mounts"`
}

type dockerSockMount struct {
	Type        string `json:"Type"`
	Source      string `json:"Source"`
	Destination string `json:"Destination"`
	Mode        string `json:"Mode"`
	RW          bool   `json:"RW"`
}

func (h *DockerHandler) parseContainersFromDockerSock(data string) ([]DockerContainer, error) {
	data = strings.TrimSpace(data)
	if data == "" || data == "[]" {
		return []DockerContainer{}, nil
	}

	var raw []dockerSockContainerSummary
	if err := json.Unmarshal([]byte(data), &raw); err != nil {
		return nil, err
	}

	containers := make([]DockerContainer, 0, len(raw))
	for _, c := range raw {
		names := make([]string, 0, len(c.Names))
		for _, n := range c.Names {
			n = strings.TrimSpace(strings.TrimPrefix(n, "/"))
			if n != "" {
				names = append(names, n)
			}
		}

		mounts := make([]DockerMount, 0, len(c.Mounts))
		for _, m := range c.Mounts {
			mounts = append(mounts, DockerMount{
				Type:        m.Type,
				Source:      m.Source,
				Destination: m.Destination,
				Mode:        m.Mode,
				RW:          m.RW,
			})
		}

		labels := c.Labels
		if labels == nil {
			labels = make(map[string]string)
		}

		containers = append(containers, DockerContainer{
			ID:      c.ID,
			Names:   names,
			Image:   c.Image,
			ImageID: c.ImageID,
			Command: c.Command,
			Created: c.Created,
			Status:  c.Status,
			State:   strings.ToLower(c.State),
			Ports:   c.Ports,
			Labels:  labels,
			Mounts:  mounts,
		})
	}

	return containers, nil
}

type dockerPSMeta struct {
	Status string
	State  string
	Names  []string
}

type dockerInspectPortBinding struct {
	HostIP   string `json:"HostIp"`
	HostPort string `json:"HostPort"`
}

type dockerInspectContainer struct {
	ID      string   `json:"Id"`
	Name    string   `json:"Name"`
	Image   string   `json:"Image"`
	Created string   `json:"Created"`
	Path    string   `json:"Path"`
	Args    []string `json:"Args"`
	State   struct {
		Status string `json:"Status"`
	} `json:"State"`
	Config struct {
		Image  string            `json:"Image"`
		Labels map[string]string `json:"Labels"`
	} `json:"Config"`
	NetworkSettings struct {
		Ports map[string][]dockerInspectPortBinding `json:"Ports"`
	} `json:"NetworkSettings"`
	Mounts []struct {
		Type        string `json:"Type"`
		Source      string `json:"Source"`
		Destination string `json:"Destination"`
		Mode        string `json:"Mode"`
		RW          bool   `json:"RW"`
	} `json:"Mounts"`
}

func (h *DockerHandler) listContainersViaInspect(client *sshDomain.Client, all bool) ([]DockerContainer, error) {
	psFlag := ""
	if all {
		psFlag = "-a"
	}

	metaCmd := fmt.Sprintf(`docker ps %s --no-trunc --format '{{.ID}}\t{{.Status}}\t{{.State}}\t{{.Names}}'`, psFlag)
	metaOut, err := h.executeCommand(client, metaCmd)
	if err != nil {
		return nil, err
	}
	meta := h.parseDockerPSMeta(metaOut)

	idsCmd := fmt.Sprintf("docker ps %s -q", psFlag)
	idsOut, err := h.executeCommand(client, idsCmd)
	if err != nil {
		return nil, err
	}

	ids := splitNonEmptyLines(idsOut)
	if len(ids) == 0 {
		return []DockerContainer{}, nil
	}

	inspectCmd := fmt.Sprintf("docker inspect %s", strings.Join(ids, " "))
	inspectOut, err := h.executeCommand(client, inspectCmd)
	if err != nil {
		return nil, err
	}

	inspectOut = strings.TrimSpace(inspectOut)
	var inspected []dockerInspectContainer
	if err := json.Unmarshal([]byte(inspectOut), &inspected); err != nil {
		return nil, err
	}

	containers := make([]DockerContainer, 0, len(inspected))
	for _, ic := range inspected {
		labels := ic.Config.Labels
		if labels == nil {
			labels = make(map[string]string)
		}

		names := []string{}
		if m, ok := meta[ic.ID]; ok && len(m.Names) > 0 {
			names = m.Names
		} else if ic.Name != "" {
			name := strings.TrimPrefix(strings.TrimSpace(ic.Name), "/")
			if name != "" {
				names = []string{name}
			}
		}

		createdUnix := int64(0)
		if ic.Created != "" {
			if t, err := time.Parse(time.RFC3339Nano, ic.Created); err == nil {
				createdUnix = t.Unix()
			} else if t, err := time.Parse(time.RFC3339, ic.Created); err == nil {
				createdUnix = t.Unix()
			}
		}

		mounts := make([]DockerMount, 0, len(ic.Mounts))
		for _, m := range ic.Mounts {
			mounts = append(mounts, DockerMount{
				Type:        m.Type,
				Source:      m.Source,
				Destination: m.Destination,
				Mode:        m.Mode,
				RW:          m.RW,
			})
		}

		status := ""
		state := strings.ToLower(ic.State.Status)
		if m, ok := meta[ic.ID]; ok {
			status = m.Status
			if m.State != "" {
				state = strings.ToLower(m.State)
			}
		}
		if status == "" {
			status = ic.State.Status
		}

		command := strings.TrimSpace(strings.Join(append([]string{ic.Path}, ic.Args...), " "))

		containers = append(containers, DockerContainer{
			ID:      ic.ID,
			Names:   names,
			Image:   ic.Config.Image,
			ImageID: ic.Image,
			Command: command,
			Created: createdUnix,
			Status:  status,
			State:   state,
			Ports:   parseInspectPorts(ic.NetworkSettings.Ports),
			Labels:  labels,
			Mounts:  mounts,
		})
	}

	return containers, nil
}

func (h *DockerHandler) parseDockerPSMeta(output string) map[string]dockerPSMeta {
	result := make(map[string]dockerPSMeta)
	for _, line := range strings.Split(strings.TrimSpace(output), "\n") {
		line = strings.TrimRight(line, "\r")
		if strings.TrimSpace(line) == "" {
			continue
		}
		parts := strings.SplitN(line, "\t", 4)
		if len(parts) < 4 {
			continue
		}
		id := strings.TrimSpace(parts[0])
		if id == "" {
			continue
		}
		names := []string{}
		for _, n := range strings.Split(parts[3], ",") {
			n = strings.TrimSpace(n)
			if n != "" {
				names = append(names, n)
			}
		}
		result[id] = dockerPSMeta{
			Status: strings.TrimSpace(parts[1]),
			State:  strings.TrimSpace(parts[2]),
			Names:  names,
		}
	}
	return result
}

func splitNonEmptyLines(output string) []string {
	lines := strings.Split(strings.TrimSpace(output), "\n")
	out := make([]string, 0, len(lines))
	for _, l := range lines {
		l = strings.TrimSpace(strings.TrimRight(l, "\r"))
		if l != "" {
			out = append(out, l)
		}
	}
	return out
}

func parseInspectPorts(ports map[string][]dockerInspectPortBinding) []DockerPort {
	if len(ports) == 0 {
		return []DockerPort{}
	}

	result := make([]DockerPort, 0)
	for containerPortSpec, bindings := range ports {
		spec := strings.TrimSpace(containerPortSpec)
		if spec == "" {
			continue
		}
		privateStr, proto := spec, "tcp"
		if strings.Contains(spec, "/") {
			parts := strings.SplitN(spec, "/", 2)
			privateStr = parts[0]
			if parts[1] != "" {
				proto = parts[1]
			}
		}
		privatePort, err := strconv.Atoi(privateStr)
		if err != nil || privatePort <= 0 {
			continue
		}

		if len(bindings) == 0 {
			result = append(result, DockerPort{PrivatePort: privatePort, Type: proto})
			continue
		}

		for _, b := range bindings {
			publicPort, _ := strconv.Atoi(strings.TrimSpace(b.HostPort))
			result = append(result, DockerPort{
				IP:          strings.TrimSpace(b.HostIP),
				PrivatePort: privatePort,
				PublicPort:  publicPort,
				Type:        proto,
			})
		}
	}
	return result
}

// GetContainerLogs 获取容器日志
func (h *DockerHandler) GetContainerLogs(c *gin.Context) {
	serverID := c.Param("serverId")
	containerID := c.Param("id")
	tail := c.DefaultQuery("tail", "100")
	encodingName := c.DefaultQuery("encoding", "utf-8")

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
	output = decodeTextWithEncoding(output, encodingName)

	tailInt, _ := strconv.Atoi(tail)
	RespondSuccess(c, map[string]interface{}{
		"data":         output,
		"container_id": containerID,
		"lines":        tailInt,
		"encoding":     encodingName,
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

// ImageUpdateCheckResponse 镜像更新检查响应
type ImageUpdateCheckResponse struct {
	HasUpdate     bool   `json:"hasUpdate"`
	ImageName     string `json:"imageName"`
	ContainerName string `json:"containerName"`
	UpdateCommand string `json:"updateCommand"`
	Error         string `json:"error,omitempty"`
}

// CheckContainerImageUpdate 检查容器镜像是否有更新
func (h *DockerHandler) CheckContainerImageUpdate(c *gin.Context) {
	serverID := c.Param("serverId")
	containerID := c.Param("id")

	pooledConn, err := h.getPooledConnection(c, serverID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "ssh_error", err.Error())
		return
	}
	defer h.releaseConnection(c, serverID)

	// 获取容器信息
	inspectCmd := fmt.Sprintf("docker inspect %s --format '{{.Name}}|{{.Config.Image}}'", containerID)
	output, err := h.executeCommand(pooledConn.Client, inspectCmd)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "docker_error", "获取容器信息失败: "+err.Error())
		return
	}

	output = strings.TrimSpace(output)
	parts := strings.SplitN(output, "|", 2)
	if len(parts) != 2 {
		RespondError(c, http.StatusInternalServerError, "docker_error", "解析容器信息失败")
		return
	}

	containerName := strings.TrimPrefix(parts[0], "/")
	imageName := parts[1]

	// 获取本地镜像 digest
	localDigestCmd := fmt.Sprintf("docker image inspect %s --format '{{index .RepoDigests 0}}' 2>/dev/null || echo ''", imageName)
	localDigestOutput, _ := h.executeCommand(pooledConn.Client, localDigestCmd)
	localDigest := strings.TrimSpace(localDigestOutput)

	// 提取 digest 部分 (repo@sha256:xxx -> sha256:xxx)
	if idx := strings.Index(localDigest, "@"); idx != -1 {
		localDigest = localDigest[idx+1:]
	}

	// 获取远程镜像 digest (使用 docker manifest inspect)
	remoteDigestCmd := fmt.Sprintf("docker manifest inspect %s 2>/dev/null | grep -m1 '\"digest\"' | cut -d'\"' -f4 || echo ''", imageName)
	remoteDigestOutput, _ := h.executeCommand(pooledConn.Client, remoteDigestCmd)
	remoteDigest := strings.TrimSpace(remoteDigestOutput)

	// 生成更新命令
	updateCommand := fmt.Sprintf("docker pull %s", imageName)

	// 判断是否有更新
	hasUpdate := false
	errorMsg := ""

	if localDigest == "" && remoteDigest == "" {
		// 无法获取 digest 信息，可能是本地构建的镜像或私有仓库
		errorMsg = "无法检查更新：可能是本地构建的镜像或需要登录私有仓库"
	} else if remoteDigest == "" {
		// 无法获取远程 digest
		errorMsg = "无法获取远程镜像信息，请确保网络连接正常且已登录镜像仓库"
	} else if localDigest == "" {
		// 本地没有 digest，可能需要更新
		hasUpdate = true
	} else if localDigest != remoteDigest {
		// digest 不同，有更新
		hasUpdate = true
	}

	RespondSuccess(c, ImageUpdateCheckResponse{
		HasUpdate:     hasUpdate,
		ImageName:     imageName,
		ContainerName: containerName,
		UpdateCommand: updateCommand,
		Error:         errorMsg,
	})
}
