package ws

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/easyssh/server/internal/domain/server"
	sshDomain "github.com/easyssh/server/internal/domain/ssh"
	"github.com/easyssh/server/internal/pkg/crypto"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"golang.org/x/crypto/ssh"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// 生产环境应该检查 Origin
		return true
	},
}

// TerminalHandler WebSocket 终端处理器
type TerminalHandler struct {
	serverService  server.Service
	serverRepo     server.Repository
	sessionManager *sshDomain.SessionManager
	encryptor      *crypto.Encryptor
}

// NewTerminalHandler 创建终端处理器
func NewTerminalHandler(serverService server.Service, serverRepo server.Repository, sessionManager *sshDomain.SessionManager, encryptor *crypto.Encryptor) *TerminalHandler {
	return &TerminalHandler{
		serverService:  serverService,
		serverRepo:     serverRepo,
		sessionManager: sessionManager,
		encryptor:      encryptor,
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
	wsConn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade to WebSocket: %v", err)
		return
	}
	defer wsConn.Close()

	// 获取服务器信息
	srv, err := h.serverService.GetByID(c.Request.Context(), uuid.MustParse(userID), uuid.MustParse(serverID))
	if err != nil {
		h.sendError(wsConn, "server_not_found", "Server not found")
		return
	}

	// 创建 SSH 客户端
	client, err := sshDomain.NewClient(srv, h.encryptor)
	if err != nil {
		h.sendError(wsConn, "client_creation_failed", err.Error())
		return
	}

	// 连接到服务器
	if err := client.Connect(srv.Host, srv.Port); err != nil {
		h.sendError(wsConn, "connection_failed", err.Error())
		return
	}

	// 性能优化：仅更新服务器状态和最后连接时间（避免慢查询）
	srv.UpdateStatus(server.StatusOnline)
	if err := h.serverRepo.UpdateStatus(c.Request.Context(), srv.ID, srv.Status, srv.LastConnected); err != nil {
		log.Printf("Failed to update server status: %v", err)
		// 不中断连接，只记录错误
	}

	// 创建 SSH 会话
	sshSession, err := client.NewSession()
	if err != nil {
		client.Close()
		h.sendError(wsConn, "session_creation_failed", err.Error())
		return
	}

	// 创建会话记录
	session := sshDomain.NewSession(userID, serverID, client, cols, rows)
	session.SSHSession = sshSession
	h.sessionManager.Add(session)
	defer h.sessionManager.Remove(session.ID)

	// 设置终端模式
	modes := ssh.TerminalModes{
		ssh.ECHO:          1,     // 启用回显
		ssh.TTY_OP_ISPEED: 14400, // 输入速度 = 14.4kbaud
		ssh.TTY_OP_OSPEED: 14400, // 输出速度 = 14.4kbaud
	}

	// 请求伪终端
	if err := sshSession.RequestPty("xterm-256color", rows, cols, modes); err != nil {
		h.sendError(wsConn, "pty_request_failed", err.Error())
		return
	}

	// 获取输入输出管道
	stdin, err := sshSession.StdinPipe()
	if err != nil {
		h.sendError(wsConn, "stdin_pipe_failed", err.Error())
		return
	}

	stdout, err := sshSession.StdoutPipe()
	if err != nil {
		h.sendError(wsConn, "stdout_pipe_failed", err.Error())
		return
	}

	stderr, err := sshSession.StderrPipe()
	if err != nil {
		h.sendError(wsConn, "stderr_pipe_failed", err.Error())
		return
	}

	// 启动 shell
	if err := sshSession.Shell(); err != nil {
		h.sendError(wsConn, "shell_start_failed", err.Error())
		return
	}

	// 发送连接成功消息
	h.sendMessage(wsConn, Message{
		Type: "connected",
		Data: json.RawMessage(fmt.Sprintf(`{"session_id":"%s"}`, session.ID)),
	})

	// 创建停止通道
	done := make(chan struct{})

	// 从 SSH 读取并发送到 WebSocket（stdout）- 使用二进制传输
	go func() {
		buf := make([]byte, 32768) // 增大缓冲区以提高性能
		for {
			n, err := stdout.Read(buf)
			if err != nil {
				if err != io.EOF {
					log.Printf("Error reading from stdout: %v", err)
				}
				close(done)
				return
			}

			if n > 0 {
				// 直接发送二进制数据，不使用 JSON 包装
				if err := wsConn.WriteMessage(websocket.BinaryMessage, buf[:n]); err != nil {
					log.Printf("Error sending output: %v", err)
					close(done)
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
				close(done)
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
						close(done)
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
					close(done)
					return
				}
			}
		}
	}()

	// 等待会话结束
	<-done

	// 发送关闭消息
	h.sendMessage(wsConn, Message{Type: "closed"})
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
