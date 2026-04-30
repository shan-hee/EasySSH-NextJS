package ws

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/easyssh/server/internal/domain/completion"
	"github.com/easyssh/server/internal/domain/security"
	"github.com/easyssh/server/internal/domain/server"
	sshDomain "github.com/easyssh/server/internal/domain/ssh"
	"github.com/easyssh/server/internal/domain/sshsession"
	"github.com/easyssh/server/internal/domain/systemconfig"
	"github.com/easyssh/server/internal/pkg/crypto"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"golang.org/x/crypto/ssh"
)

// getUpgrader 创建 WebSocket upgrader，集成 CORS 配置
func (h *TerminalHandler) getUpgrader() websocket.Upgrader {
	return websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			origin := r.Header.Get("Origin")
			if origin == "" {
				// 无 Origin 头：通常为同源升级，允许
				return true
			}

			// 1. 优先检查 Web UI 配置的 CORS 白名单
			corsConfig, err := h.securityService.GetCORSConfig(context.Background())
			if err == nil && corsConfig != nil && len(corsConfig.AllowedOrigins) > 0 {
				for _, allowedOrigin := range corsConfig.AllowedOrigins {
					if origin == allowedOrigin {
						log.Printf("WebSocket allowed by CORS config: %s", origin)
						return true
					}
				}
			}

			// 2. 兜底机制：动态允许同主机名的连接
			// 当 Origin 的主机名与当前请求的 Host 或 X-Forwarded-Host 一致时放行
			var originHost string
			if u, err := url.Parse(origin); err == nil {
				originHost = u.Hostname()
			}
			if originHost == "" {
				log.Printf("WebSocket origin parse failed: %s", origin)
				return false
			}

			// 候选主机：请求的 Host
			candidates := []string{strings.Split(r.Host, ":")[0]}
			// 以及 X-Forwarded-Host（可能为逗号分隔）
			if xfh := r.Header.Get("X-Forwarded-Host"); xfh != "" {
				for _, h := range strings.Split(xfh, ",") {
					h = strings.TrimSpace(h)
					if h != "" {
						candidates = append(candidates, strings.Split(h, ":")[0])
					}
				}
			}

			for _, h := range candidates {
				if h != "" && strings.EqualFold(h, originHost) {
					log.Printf("WebSocket allowed by hostname match: %s", origin)
					return true
				}
			}

			log.Printf("WebSocket connection rejected: origin %s not allowed (host=%s, x-forwarded-host=%s)", origin, r.Host, r.Header.Get("X-Forwarded-Host"))
			return false
		},
	}
}

// TerminalHandler WebSocket 终端处理器
type TerminalHandler struct {
	serverService     server.Service
	serverRepo        server.Repository
	sessionManager    *sshDomain.SessionManager
	encryptor         *crypto.Encryptor
	sshSessionService sshsession.Service
	hostKeyCallback   ssh.HostKeyCallback  // SSH主机密钥验证回调
	securityService   security.Service     // 安全配置服务（用于 CORS）
	completionService completion.Service   // 补全服务
	systemConfigSvc   systemconfig.Service // 系统配置（用于补全配置动态生效）
	completionSubMu   sync.RWMutex
	completionSubs    map[completionBroadcastKey]map[*completionSubscriber]struct{}
}

// NewTerminalHandler 创建终端处理器
func NewTerminalHandler(serverService server.Service, serverRepo server.Repository, sessionManager *sshDomain.SessionManager, encryptor *crypto.Encryptor, sshSessionService sshsession.Service, hostKeyCallback ssh.HostKeyCallback, securityService security.Service, completionService completion.Service, systemConfigSvc systemconfig.Service) *TerminalHandler {
	return &TerminalHandler{
		serverService:     serverService,
		serverRepo:        serverRepo,
		sessionManager:    sessionManager,
		encryptor:         encryptor,
		sshSessionService: sshSessionService,
		hostKeyCallback:   hostKeyCallback,
		securityService:   securityService,
		completionService: completionService,
		systemConfigSvc:   systemConfigSvc,
		completionSubs:    make(map[completionBroadcastKey]map[*completionSubscriber]struct{}),
	}
}

// Message WebSocket 消息
type Message struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

// MessageType 定义消息类型常量
const (
	MessageTypeText                 = 1 // 文本消息（JSON）
	MessageTypeBinary               = 2 // 二进制消息（原始输出）
	terminalSSHLatencyProbeInterval = 15 * time.Second
	terminalSSHAuthChallengeTimeout = 2 * time.Minute
	terminalSSHInitTimeout          = 5 * time.Minute
)

// InputMessage 输入消息
type InputMessage struct {
	Data string `json:"data"`
}

// ResizeMessage 调整大小消息
type ResizeMessage struct {
	Cols int `json:"cols"`
	Rows int `json:"rows"`
}

// PingMessage 心跳/延迟探测消息
type PingMessage struct {
	ID string `json:"id,omitempty"`
	Ts int64  `json:"ts,omitempty"`
}

// AuthPromptItem SSH keyboard-interactive 单个提示项
type AuthPromptItem struct {
	Text string `json:"text"`
	Echo bool   `json:"echo"`
}

// AuthPromptMessage SSH keyboard-interactive 验证提示
type AuthPromptMessage struct {
	RequestID   string           `json:"request_id"`
	Name        string           `json:"name,omitempty"`
	Instruction string           `json:"instruction,omitempty"`
	Prompts     []AuthPromptItem `json:"prompts"`
}

// AuthResponseMessage SSH keyboard-interactive 验证响应
type AuthResponseMessage struct {
	RequestID string   `json:"request_id"`
	Answers   []string `json:"answers"`
	Cancelled bool     `json:"cancelled,omitempty"`
}

// OutputMessage 输出消息
type OutputMessage struct {
	Type string `json:"type"` // stdout, stderr
	Data string `json:"data"`
}

// ErrorMessage 错误消息
type ErrorMessage struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

// FetchCompletionDataMessage 获取补全数据请求
type FetchCompletionDataMessage struct {
	HistoryLimit int `json:"historyLimit"` // 历史命令数量限制，默认500
}

// CompletionDataResponse 补全数据响应
type CompletionDataResponse struct {
	History   []string                `json:"history"`
	Scripts   []completion.ScriptItem `json:"scripts"`
	Timestamp int64                   `json:"timestamp"`
}

// CompletionUpdateMessage 补全更新消息（增量更新）
type CompletionUpdateMessage struct {
	NewCommand string `json:"newCommand"`
}

type completionBroadcastKey struct {
	userID   uuid.UUID
	serverID uuid.UUID
}

type completionSubscriber struct {
	conn    *websocket.Conn
	writeMu *sync.Mutex
}

func newTerminalKeyboardInteractiveChallenge(conn *websocket.Conn, writeJSON func(interface{}) error) ssh.KeyboardInteractiveChallenge {
	return func(name, instruction string, questions []string, echos []bool) ([]string, error) {
		if len(questions) == 0 {
			return []string{}, nil
		}

		requestID := uuid.NewString()
		prompts := make([]AuthPromptItem, len(questions))
		for i, question := range questions {
			echo := false
			if i < len(echos) {
				echo = echos[i]
			}
			prompts[i] = AuthPromptItem{
				Text: question,
				Echo: echo,
			}
		}

		payload, _ := json.Marshal(AuthPromptMessage{
			RequestID:   requestID,
			Name:        name,
			Instruction: instruction,
			Prompts:     prompts,
		})
		if err := writeJSON(Message{Type: "auth_prompt", Data: payload}); err != nil {
			return nil, fmt.Errorf("failed to send authentication prompt: %w", err)
		}

		defer func() {
			_ = conn.SetReadDeadline(time.Time{})
		}()

		for {
			if err := conn.SetReadDeadline(time.Now().Add(terminalSSHAuthChallengeTimeout)); err != nil {
				return nil, fmt.Errorf("failed to set authentication response timeout: %w", err)
			}

			messageType, message, err := conn.ReadMessage()
			if err != nil {
				return nil, fmt.Errorf("failed to read authentication response: %w", err)
			}
			if messageType != websocket.TextMessage {
				continue
			}

			var msg Message
			if err := json.Unmarshal(message, &msg); err != nil {
				log.Printf("Error parsing authentication response message: %v", err)
				continue
			}
			if msg.Type != "auth_response" {
				continue
			}

			var response AuthResponseMessage
			if err := json.Unmarshal(msg.Data, &response); err != nil {
				log.Printf("Error parsing authentication response payload: %v", err)
				continue
			}
			if response.RequestID != requestID {
				continue
			}
			if response.Cancelled {
				return nil, fmt.Errorf("authentication cancelled by user")
			}

			answers := make([]string, len(questions))
			copy(answers, response.Answers)
			return answers, nil
		}
	}
}

// HandleSSH 处理 SSH WebSocket 连接
// WS /api/v1/ssh/terminal/:server_id
func (h *TerminalHandler) HandleSSH(c *gin.Context) {
	// 从上下文获取用户 ID
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	userID := userIDStr.(string)
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid_user_id"})
		return
	}

	// 解析服务器 ID
	serverID := c.Param("server_id")
	serverUUID, err := uuid.Parse(serverID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_server_id"})
		return
	}

	// 获取终端尺寸参数
	cols := 80
	rows := 24
	if colsStr := c.Query("cols"); colsStr != "" {
		fmt.Sscanf(colsStr, "%d", &cols)
	}
	if rowsStr := c.Query("rows"); rowsStr != "" {
		fmt.Sscanf(rowsStr, "%d", &rows)
	}

	// 升级到 WebSocket
	upgrader := h.getUpgrader()
	wsConn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade to WebSocket: %v", err)
		return
	}
	defer wsConn.Close()

	// WebSocket写锁保护（防止并发写入）
	wsMutex := &sync.Mutex{}
	safeWriteMessage := func(messageType int, data []byte) error {
		wsMutex.Lock()
		defer wsMutex.Unlock()
		return wsConn.WriteMessage(messageType, data)
	}
	safeWriteJSON := func(v interface{}) error {
		wsMutex.Lock()
		defer wsMutex.Unlock()
		return wsConn.WriteJSON(v)
	}
	sendError := func(errorCode, message string) {
		errMsg := ErrorMessage{
			Error:   errorCode,
			Message: message,
		}
		errData, _ := json.Marshal(errMsg)

		if err := safeWriteJSON(Message{
			Type: "error",
			Data: errData,
		}); err != nil {
			log.Printf("Error sending error message: %v", err)
		}

		time.Sleep(100 * time.Millisecond)
		wsConn.Close()
	}

	// 立即发送握手完成消息
	if err := safeWriteJSON(Message{
		Type: "handshake_complete",
		Data: json.RawMessage(`{"status":"connecting"}`),
	}); err != nil {
		log.Printf("Error sending handshake_complete: %v", err)
		return
	}

	// 创建通道用于异步初始化结果
	type initResult struct {
		session   *sshDomain.Session
		dbSession *sshsession.SSHSession
		stdin     io.WriteCloser
		stdout    io.Reader
		stderr    io.Reader
		err       error
	}
	resultChan := make(chan initResult, 1)

	// 异步建立SSH连接和初始化
	go func() {
		// 获取服务器信息
		srv, err := h.serverService.GetByID(context.Background(), userUUID, serverUUID)
		if err != nil {
			resultChan <- initResult{err: fmt.Errorf("server_not_found: %w", err)}
			return
		}

		// 创建 SSH 客户端（使用主机密钥验证）
		client, err := sshDomain.NewClient(
			srv,
			h.encryptor,
			h.hostKeyCallback,
			sshDomain.WithKeyboardInteractive(newTerminalKeyboardInteractiveChallenge(wsConn, safeWriteJSON)),
		)
		if err != nil {
			resultChan <- initResult{err: fmt.Errorf("client_creation_failed: %w", err)}
			return
		}

		// 连接到服务器
		if err := client.Connect(srv.Host, srv.Port); err != nil {
			// 异步更新服务器状态为离线
			go func() {
				srv.UpdateStatus(server.StatusOffline)
				if updateErr := h.serverRepo.UpdateStatus(context.Background(), srv.ID, srv.Status, srv.LastConnected); updateErr != nil {
					log.Printf("Failed to update server status to offline: %v", updateErr)
				}
			}()
			resultChan <- initResult{err: fmt.Errorf("connection_failed: %w", err)}
			return
		}

		// 异步更新服务器状态为在线
		go func() {
			srv.UpdateStatus(server.StatusOnline)
			if err := h.serverRepo.UpdateStatus(context.Background(), srv.ID, srv.Status, srv.LastConnected); err != nil {
				log.Printf("Failed to update server status: %v", err)
			}
		}()

		// 创建 SSH 会话
		sshSession, err := client.NewSession()
		if err != nil {
			client.Close()
			resultChan <- initResult{err: fmt.Errorf("session_creation_failed: %w", err)}
			return
		}

		// 创建会话记录
		session := sshDomain.NewSession(userID, serverID, client, cols, rows)
		session.SSHSession = sshSession

		// 获取客户端IP
		clientIP := c.ClientIP()
		clientPort := 0 // WebSocket无法获取客户端端口，使用0

		// 异步创建数据库会话记录
		var dbSession *sshsession.SSHSession
		dbSessionChan := make(chan *sshsession.SSHSession, 1)
		go func() {
			createReq := &sshsession.CreateSSHSessionRequest{
				UserID:       userUUID,
				ServerID:     serverUUID,
				SessionID:    session.ID,
				ClientIP:     clientIP,
				ClientPort:   clientPort,
				TerminalType: "xterm-256color",
			}
			dbSess, err := h.sshSessionService.CreateSSHSession(createReq)
			if err != nil {
				log.Printf("Failed to create SSH session record: %v", err)
				dbSessionChan <- nil
			} else {
				dbSessionChan <- dbSess
			}
		}()

		// 设置终端模式
		modes := ssh.TerminalModes{
			ssh.ECHO:          1,     // 启用回显
			ssh.TTY_OP_ISPEED: 14400, // 输入速度 = 14.4kbaud
			ssh.TTY_OP_OSPEED: 14400, // 输出速度 = 14.4kbaud
		}

		// 请求伪终端
		if err := sshSession.RequestPty("xterm-256color", rows, cols, modes); err != nil {
			resultChan <- initResult{err: fmt.Errorf("pty_request_failed: %w", err)}
			return
		}

		// 获取输入输出管道
		stdin, err := sshSession.StdinPipe()
		if err != nil {
			resultChan <- initResult{err: fmt.Errorf("stdin_pipe_failed: %w", err)}
			return
		}

		stdout, err := sshSession.StdoutPipe()
		if err != nil {
			resultChan <- initResult{err: fmt.Errorf("stdout_pipe_failed: %w", err)}
			return
		}

		stderr, err := sshSession.StderrPipe()
		if err != nil {
			resultChan <- initResult{err: fmt.Errorf("stderr_pipe_failed: %w", err)}
			return
		}

		// 启动 shell
		if err := sshSession.Shell(); err != nil {
			resultChan <- initResult{err: fmt.Errorf("shell_start_failed: %w", err)}
			return
		}

		// 等待数据库会话创建完成（非阻塞）
		select {
		case dbSession = <-dbSessionChan:
		case <-time.After(100 * time.Millisecond):
			// 超时则继续，不阻塞连接建立
			log.Printf("Database session creation timeout, continuing...")
		}

		resultChan <- initResult{
			session:   session,
			dbSession: dbSession,
			stdin:     stdin,
			stdout:    stdout,
			stderr:    stderr,
			err:       nil,
		}
	}()

	// 等待初始化完成或超时
	var result initResult
	select {
	case result = <-resultChan:
		if result.err != nil {
			sendError("initialization_failed", result.err.Error())
			return
		}
	case <-time.After(terminalSSHInitTimeout):
		sendError("initialization_timeout", "SSH connection timeout")
		return
	}

	// 初始化成功，注册会话
	session := result.session
	dbSession := result.dbSession
	stdin := result.stdin
	stdout := result.stdout
	stderr := result.stderr

	h.sessionManager.Add(session)
	defer h.sessionManager.Remove(session.ID)

	// 发送连接成功消息
	if err := safeWriteJSON(Message{
		Type: "connected",
		Data: json.RawMessage(fmt.Sprintf(`{"session_id":"%s"}`, session.ID)),
	}); err != nil {
		log.Printf("Error sending connected message: %v", err)
		return
	}

	// 创建停止通道和关闭保护
	done := make(chan struct{})
	var closeOnce sync.Once
	closeChannel := func() {
		closeOnce.Do(func() {
			close(done)
		})
	}

	var sshLatencyMs atomic.Int64
	var sshLatencyMeasuredAt atomic.Int64
	var sshLatencyProbeInFlight atomic.Bool
	sshLatencyMs.Store(-1)

	refreshSSHLatency := func() {
		if measuredAt := sshLatencyMeasuredAt.Load(); measuredAt > 0 {
			if time.Since(time.UnixMilli(measuredAt)) < terminalSSHLatencyProbeInterval {
				return
			}
		}

		if !sshLatencyProbeInFlight.CompareAndSwap(false, true) {
			return
		}

		go func() {
			defer sshLatencyProbeInFlight.Store(false)

			latency, err := session.Client.MeasureTransportLatency()
			if err != nil {
				log.Printf("Failed to measure SSH transport latency: %v", err)
				return
			}

			sshLatencyMs.Store(latency.Milliseconds())
			sshLatencyMeasuredAt.Store(time.Now().UnixMilli())
		}()
	}
	refreshSSHLatency()

	// 注册补全增量广播订阅（同用户 + 同服务器）
	completionKey := completionBroadcastKey{
		userID:   userUUID,
		serverID: serverUUID,
	}
	completionSub := &completionSubscriber{
		conn:    wsConn,
		writeMu: wsMutex,
	}
	h.registerCompletionSubscriber(completionKey, completionSub)
	defer h.unregisterCompletionSubscriber(completionKey, completionSub)

	// 从 SSH 读取并发送到 WebSocket（stdout）- 使用二进制传输
	go func() {
		buf := make([]byte, 32768) // 增大缓冲区以提高性能
		for {
			n, err := stdout.Read(buf)
			if err != nil {
				if err != io.EOF {
					log.Printf("Error reading from stdout: %v", err)
				}
				closeChannel()
				return
			}

			if n > 0 {
				// 直接发送二进制数据，不使用 JSON 包装
				if err := safeWriteMessage(websocket.BinaryMessage, buf[:n]); err != nil {
					log.Printf("Error sending output: %v", err)
					closeChannel()
					return
				}
			}
		}
	}()

	// 从 SSH 读取并发送到 WebSocket（stderr）- 也使用二进制传输
	go func() {
		buf := make([]byte, 32768)
		for {
			n, err := stderr.Read(buf)
			if err != nil {
				if err != io.EOF {
					log.Printf("Error reading from stderr: %v", err)
				}
				return
			}

			if n > 0 {
				// stderr 也直接发送二进制数据
				if err := safeWriteMessage(websocket.BinaryMessage, buf[:n]); err != nil {
					log.Printf("Error sending stderr: %v", err)
					return
				}
			}
		}
	}()

	// 从 WebSocket 读取并发送到 SSH
	go func() {
		for {
			messageType, message, err := wsConn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("WebSocket error: %v", err)
				}
				closeChannel()
				return
			}

			switch messageType {
			case websocket.TextMessage:
				// JSON 格式的控制消息
				var msg Message
				if err := json.Unmarshal(message, &msg); err != nil {
					log.Printf("Error parsing message: %v", err)
					continue
				}

				switch msg.Type {
				case "input":
					var input InputMessage
					if err := json.Unmarshal(msg.Data, &input); err != nil {
						log.Printf("Error parsing input: %v", err)
						continue
					}
					if _, err := stdin.Write([]byte(input.Data)); err != nil {
						log.Printf("Error writing to stdin: %v", err)
						closeChannel()
						return
					}

				case "resize":
					var resize ResizeMessage
					if err := json.Unmarshal(msg.Data, &resize); err != nil {
						log.Printf("Error parsing resize: %v", err)
						continue
					}
					if err := session.ResizeTerminal(resize.Cols, resize.Rows); err != nil {
						log.Printf("Error resizing terminal: %v", err)
					}

				case "ping":
					var ping PingMessage
					if len(msg.Data) > 0 {
						if err := json.Unmarshal(msg.Data, &ping); err != nil {
							log.Printf("Error parsing ping: %v", err)
						}
					}

					now := time.Now().UnixMilli()
					resp := map[string]any{
						"id":           ping.ID,
						"ts":           ping.Ts,
						"serverRecvTs": now,
					}
					if latency := sshLatencyMs.Load(); latency >= 0 {
						resp["sshLatencyMs"] = latency
						resp["sshLatencyMeasuredAt"] = sshLatencyMeasuredAt.Load()
					}

					// 使用安全写入。这里不等待 SSH 探测完成，避免污染 WebSocket RTT。
					resp["serverSendTs"] = time.Now().UnixMilli()
					respData, _ := json.Marshal(resp)
					if err := safeWriteJSON(Message{Type: "pong", Data: json.RawMessage(respData)}); err != nil {
						log.Printf("Error sending pong: %v", err)
					}
					refreshSSHLatency()

				case "fetch_completion_data":
					// 处理补全数据请求
					var fetchReq FetchCompletionDataMessage
					if err := json.Unmarshal(msg.Data, &fetchReq); err != nil {
						log.Printf("Error parsing fetch_completion_data: %v", err)
						continue
					}

					// 设置默认值
					if fetchReq.HistoryLimit <= 0 {
						fetchReq.HistoryLimit = 500
					}

					// 异步获取补全数据
					go func() {
						// 获取SSH客户端
						sshClient := session.Client.GetRawConnection()
						if sshClient == nil {
							log.Printf("SSH client not available for completion data")
							return
						}

						fetchOpts := completion.FetchOptions{
							HistoryLimit:   fetchReq.HistoryLimit,
							IncludeHistory: true,
							IncludeScripts: true,
						}

						// 运行时读取系统配置，使补全提供者与缓存配置动态生效
						if h.systemConfigSvc != nil {
							if providers, cfgErr := h.systemConfigSvc.GetCompletionProviders(context.Background()); cfgErr != nil {
								log.Printf("Failed to get completion providers config: %v", cfgErr)
							} else if providers != nil {
								fetchOpts.IncludeHistory = providers.RemoteHistory
								fetchOpts.IncludeScripts = providers.Script
							}

							if quotas, cfgErr := h.systemConfigSvc.GetCompletionQuotas(context.Background()); cfgErr != nil {
								log.Printf("Failed to get completion quotas config: %v", cfgErr)
							} else if quotas != nil && !quotas.RemoteHistoryUnlimited && quotas.RemoteHistorySoftMax > 0 && fetchOpts.HistoryLimit > quotas.RemoteHistorySoftMax {
								fetchOpts.HistoryLimit = quotas.RemoteHistorySoftMax
							}

							if cacheCfg, cfgErr := h.systemConfigSvc.GetCompletionCache(context.Background()); cfgErr != nil {
								log.Printf("Failed to get completion cache config: %v", cfgErr)
							} else if cacheCfg != nil {
								h.completionService.UpdateCacheConfig(cacheCfg.TTLMinutes, cacheCfg.MaxEntries)
							}
						}

						if !fetchOpts.IncludeHistory {
							fetchOpts.HistoryLimit = 0
						}

						// 获取补全数据（传递 serverID 以区分不同服务器）
						completionData, err := h.completionService.FetchCompletionData(
							sshClient,
							userUUID,
							serverUUID,
							fetchOpts,
						)
						if err != nil {
							log.Printf("Failed to fetch completion data: %v", err)
							// 使用安全写入发送错误
							errMsg := ErrorMessage{
								Error:   "completion_fetch_failed",
								Message: err.Error(),
							}
							errData, _ := json.Marshal(errMsg)
							if writeErr := safeWriteJSON(Message{
								Type: "error",
								Data: errData,
							}); writeErr != nil {
								log.Printf("Error sending error message: %v", writeErr)
							}
							return
						}

						// 设置时间戳
						completionData.Timestamp = time.Now().Unix()

						// 发送补全数据
						responseData, _ := json.Marshal(CompletionDataResponse{
							History:   completionData.History,
							Scripts:   completionData.Scripts,
							Timestamp: completionData.Timestamp,
						})

						// 使用安全写入
						if err := safeWriteJSON(Message{
							Type: "completion_data",
							Data: responseData,
						}); err != nil {
							log.Printf("Error sending completion data: %v", err)
							return
						}

						log.Printf("Sent completion data: %d history, %d scripts",
							len(completionData.History), len(completionData.Scripts))
					}()

				case "completion_update":
					// 处理补全增量更新（命令执行后由前端上报）
					var updateReq CompletionUpdateMessage
					if err := json.Unmarshal(msg.Data, &updateReq); err != nil {
						log.Printf("Error parsing completion_update: %v", err)
						continue
					}

					if strings.TrimSpace(updateReq.NewCommand) == "" {
						continue
					}

					h.completionService.AppendHistoryCommand(
						userUUID,
						serverUUID,
						updateReq.NewCommand,
					)

					h.broadcastCompletionUpdate(completionKey, updateReq.NewCommand, completionSub)
				}

			case websocket.BinaryMessage:
				// 二进制数据直接作为输入发送到 SSH
				if _, err := stdin.Write(message); err != nil {
					log.Printf("Error writing binary to stdin: %v", err)
					closeChannel()
					return
				}
			}
		}
	}()

	// 等待会话结束
	<-done

	// 更新数据库会话记录状态为关闭
	if dbSession != nil {
		updateReq := &sshsession.UpdateSSHSessionRequest{
			Status: "closed",
		}

		if _, err := h.sshSessionService.UpdateSSHSession(dbSession.UserID, dbSession.ID, updateReq); err != nil {
			log.Printf("Failed to update SSH session status: %v", err)
		}
	}

	// 尝试发送关闭消息（如果连接已关闭则静默忽略）
	wsConn.SetWriteDeadline(time.Now().Add(time.Second))
	_ = safeWriteJSON(Message{Type: "closed"})
}

func (h *TerminalHandler) registerCompletionSubscriber(key completionBroadcastKey, sub *completionSubscriber) {
	h.completionSubMu.Lock()
	defer h.completionSubMu.Unlock()

	subscribers, exists := h.completionSubs[key]
	if !exists {
		subscribers = make(map[*completionSubscriber]struct{})
		h.completionSubs[key] = subscribers
	}
	subscribers[sub] = struct{}{}
}

func (h *TerminalHandler) unregisterCompletionSubscriber(key completionBroadcastKey, sub *completionSubscriber) {
	h.completionSubMu.Lock()
	defer h.completionSubMu.Unlock()

	subscribers, exists := h.completionSubs[key]
	if !exists {
		return
	}
	delete(subscribers, sub)
	if len(subscribers) == 0 {
		delete(h.completionSubs, key)
	}
}

func (h *TerminalHandler) broadcastCompletionUpdate(key completionBroadcastKey, command string, exclude *completionSubscriber) {
	trimmed := strings.TrimSpace(command)
	if trimmed == "" {
		return
	}

	payload, err := json.Marshal(CompletionUpdateMessage{NewCommand: trimmed})
	if err != nil {
		log.Printf("Failed to marshal completion_update payload: %v", err)
		return
	}

	msg := Message{
		Type: "completion_update",
		Data: payload,
	}

	h.completionSubMu.RLock()
	group, exists := h.completionSubs[key]
	if !exists || len(group) == 0 {
		h.completionSubMu.RUnlock()
		return
	}

	targets := make([]*completionSubscriber, 0, len(group))
	for sub := range group {
		if exclude != nil && sub == exclude {
			continue
		}
		targets = append(targets, sub)
	}
	h.completionSubMu.RUnlock()

	if len(targets) == 0 {
		return
	}

	invalid := make([]*completionSubscriber, 0)
	for _, sub := range targets {
		sub.writeMu.Lock()
		writeErr := sub.conn.WriteJSON(msg)
		sub.writeMu.Unlock()

		if writeErr != nil {
			log.Printf("Failed to broadcast completion_update: %v", writeErr)
			invalid = append(invalid, sub)
		}
	}

	if len(invalid) == 0 {
		return
	}

	h.completionSubMu.Lock()
	defer h.completionSubMu.Unlock()

	currentGroup, exists := h.completionSubs[key]
	if !exists {
		return
	}
	for _, sub := range invalid {
		delete(currentGroup, sub)
	}
	if len(currentGroup) == 0 {
		delete(h.completionSubs, key)
	}
}

// sendMessage 发送消息
func (h *TerminalHandler) sendMessage(conn *websocket.Conn, msg Message) {
	if err := conn.WriteJSON(msg); err != nil {
		log.Printf("Error sending message: %v", err)
	}
}

// sendOutput 发送输出
func (h *TerminalHandler) sendOutput(conn *websocket.Conn, outputType, data string) {
	output := OutputMessage{
		Type: outputType,
		Data: data,
	}
	outputData, _ := json.Marshal(output)

	h.sendMessage(conn, Message{
		Type: "output",
		Data: outputData,
	})
}

// sendError 发送错误
func (h *TerminalHandler) sendError(conn *websocket.Conn, errorCode, message string) {
	errMsg := ErrorMessage{
		Error:   errorCode,
		Message: message,
	}
	errData, _ := json.Marshal(errMsg)

	h.sendMessage(conn, Message{
		Type: "error",
		Data: errData,
	})

	time.Sleep(100 * time.Millisecond)
	conn.Close()
}
