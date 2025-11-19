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
	"time"

	"github.com/easyssh/server/internal/domain/server"
	"github.com/easyssh/server/internal/domain/settings"
	sshDomain "github.com/easyssh/server/internal/domain/ssh"
	"github.com/easyssh/server/internal/domain/sshsession"
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
			corsConfig, err := h.configManager.GetCORSConfig(context.Background())
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
	hostKeyCallback   ssh.HostKeyCallback // SSH主机密钥验证回调
	configManager     settings.ConfigManager // CORS 配置管理器
}

// NewTerminalHandler 创建终端处理器
func NewTerminalHandler(serverService server.Service, serverRepo server.Repository, sessionManager *sshDomain.SessionManager, encryptor *crypto.Encryptor, sshSessionService sshsession.Service, hostKeyCallback ssh.HostKeyCallback, configManager settings.ConfigManager) *TerminalHandler {
	return &TerminalHandler{
		serverService:     serverService,
		serverRepo:        serverRepo,
		sessionManager:    sessionManager,
		encryptor:         encryptor,
		sshSessionService: sshSessionService,
		hostKeyCallback:   hostKeyCallback,
		configManager:     configManager,
	}
}

// Message WebSocket 消息
type Message struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

// MessageType 定义消息类型常量
const (
	MessageTypeText   = 1 // 文本消息（JSON）
	MessageTypeBinary = 2 // 二进制消息（原始输出）
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

	// 解析服务器 ID
	serverID := c.Param("server_id")
	if _, err := uuid.Parse(serverID); err != nil {
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

	// 立即发送握手完成消息
	h.sendMessage(wsConn, Message{
		Type: "handshake_complete",
		Data: json.RawMessage(`{"status":"connecting"}`),
	})

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
		srv, err := h.serverService.GetByID(context.Background(), uuid.MustParse(userID), uuid.MustParse(serverID))
		if err != nil {
			resultChan <- initResult{err: fmt.Errorf("server_not_found: %w", err)}
			return
		}

		// 创建 SSH 客户端（使用主机密钥验证）
		client, err := sshDomain.NewClient(srv, h.encryptor, h.hostKeyCallback)
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
				UserID:       uuid.MustParse(userID),
				ServerID:     uuid.MustParse(serverID),
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
			h.sendError(wsConn, "initialization_failed", result.err.Error())
			return
		}
	case <-time.After(10 * time.Second):
		h.sendError(wsConn, "initialization_timeout", "SSH connection timeout")
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
	h.sendMessage(wsConn, Message{
		Type: "connected",
		Data: json.RawMessage(fmt.Sprintf(`{"session_id":"%s"}`, session.ID)),
	})

	// 创建停止通道和关闭保护
	done := make(chan struct{})
	var closeOnce sync.Once
	closeChannel := func() {
		closeOnce.Do(func() {
			close(done)
		})
	}

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
				if err := wsConn.WriteMessage(websocket.BinaryMessage, buf[:n]); err != nil {
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
				if err := wsConn.WriteMessage(websocket.BinaryMessage, buf[:n]); err != nil {
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
					h.sendMessage(wsConn, Message{Type: "pong"})
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
	_ = wsConn.WriteJSON(Message{Type: "closed"})
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
