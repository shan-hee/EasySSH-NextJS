package ws

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/easyssh/server/internal/api/middleware"
	"github.com/easyssh/server/internal/domain/completion"
	"github.com/easyssh/server/internal/domain/operationrecord"
	"github.com/easyssh/server/internal/domain/security"
	"github.com/easyssh/server/internal/domain/server"
	sshDomain "github.com/easyssh/server/internal/domain/ssh"
	"github.com/easyssh/server/internal/domain/sshhostkey"
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
			allowed := middleware.IsAllowedOrigin(r, h.securityService, h.webDevPort)
			if !allowed {
				log.Printf("WebSocket connection rejected: origin %s not allowed (host=%s)", r.Header.Get("Origin"), r.Host)
			}
			return allowed
		},
	}
}

// TerminalHandler WebSocket 终端处理器
type TerminalHandler struct {
	serverService     server.Service
	serverRepo        server.Repository
	sessionManager    *sshDomain.SessionManager
	encryptor         *crypto.Encryptor
	operationRecords  operationrecord.Service
	hostKeyService    *sshhostkey.Service  // SSH主机密钥验证服务
	securityService   security.Service     // 安全配置服务（用于 CORS）
	webDevPort        int                  // 前端开发端口，用于默认同源白名单
	completionService completion.Service   // 补全服务
	systemConfigSvc   systemconfig.Service // 系统配置（用于补全配置动态生效）
	completionSubMu   sync.RWMutex
	completionSubs    map[completionBroadcastKey]map[*completionSubscriber]struct{}
}

// NewTerminalHandler 创建终端处理器
func NewTerminalHandler(serverService server.Service, serverRepo server.Repository, sessionManager *sshDomain.SessionManager, encryptor *crypto.Encryptor, operationRecords operationrecord.Service, hostKeyService *sshhostkey.Service, securityService security.Service, webDevPort int, completionService completion.Service, systemConfigSvc systemconfig.Service) *TerminalHandler {
	return &TerminalHandler{
		serverService:     serverService,
		serverRepo:        serverRepo,
		sessionManager:    sessionManager,
		encryptor:         encryptor,
		operationRecords:  operationRecords,
		hostKeyService:    hostKeyService,
		securityService:   securityService,
		webDevPort:        webDevPort,
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
	terminalSSHAuthRetryMaxAttempts = 3
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
	RequestID         string            `json:"request_id"`
	Kind              string            `json:"kind,omitempty"`
	Name              string            `json:"name,omitempty"`
	Instruction       string            `json:"instruction,omitempty"`
	Prompts           []AuthPromptItem  `json:"prompts"`
	AuthMethod        server.AuthMethod `json:"auth_method,omitempty"`
	Attempt           int               `json:"attempt,omitempty"`
	MaxAttempts       int               `json:"max_attempts,omitempty"`
	AttemptsRemaining int               `json:"attempts_remaining,omitempty"`
}

// AuthResponseMessage SSH keyboard-interactive 验证响应
type AuthResponseMessage struct {
	RequestID  string            `json:"request_id"`
	Answers    []string          `json:"answers"`
	Cancelled  bool              `json:"cancelled,omitempty"`
	AuthMethod server.AuthMethod `json:"auth_method,omitempty"`
}

// HostKeyResponseMessage SSH 主机密钥变更确认响应
type HostKeyResponseMessage struct {
	RequestID   string `json:"request_id"`
	Accepted    bool   `json:"accepted"`
	Fingerprint string `json:"fingerprint"`
}

// OutputMessage 输出消息
type OutputMessage struct {
	Type string `json:"type"` // stdout, stderr
	Data string `json:"data"`
}

// ErrorMessage 错误消息
type ErrorMessage struct {
	Error   string      `json:"error"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
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

type terminalCredentialRetry struct {
	AuthMethod           server.AuthMethod
	Secret               string
	PrivateKeyPassphrase string
}

type terminalErrorInfo struct {
	Code    string
	Message string
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
			Kind:        "keyboard_interactive",
			Name:        name,
			Instruction: instruction,
			Prompts:     prompts,
		})
		if err := writeJSON(Message{Type: "auth_prompt", Data: payload}); err != nil {
			return nil, fmt.Errorf("failed to send authentication prompt: %w", err)
		}

		response, err := readTerminalAuthResponse(conn, writeJSON, requestID)
		if err != nil {
			return nil, err
		}
		if response.Cancelled {
			return nil, fmt.Errorf("authentication cancelled by user")
		}

		answers := make([]string, len(questions))
		copy(answers, response.Answers)
		return answers, nil
	}
}

func isTerminalSSHAuthError(err error) bool {
	if err == nil {
		return false
	}

	message := strings.ToLower(err.Error())
	authMarkers := []string{
		"unable to authenticate",
		"permission denied",
		"authentication failed",
		"no supported methods remain",
		"attempted methods",
		"failed to decrypt password",
		"failed to decrypt private key",
		"failed to parse private key",
	}
	for _, marker := range authMarkers {
		if strings.Contains(message, marker) {
			return true
		}
	}

	return false
}

func isTerminalPrivateKeyPassphraseError(err error) bool {
	if err == nil {
		return false
	}

	message := strings.ToLower(err.Error())
	return strings.Contains(message, "private_key_passphrase_required") ||
		strings.Contains(message, "private_key_passphrase_invalid")
}

func classifyTerminalInitError(err error) terminalErrorInfo {
	if err == nil {
		return terminalErrorInfo{}
	}

	raw := err.Error()
	message := strings.ToLower(raw)
	info := terminalErrorInfo{
		Code:    "initialization_failed",
		Message: raw,
	}

	switch {
	case strings.Contains(message, "authentication cancelled") ||
		strings.Contains(message, "private key passphrase cancelled"):
		info.Code = "auth_cancelled"
	case strings.Contains(message, "private_key_passphrase_required"):
		info.Code = "private_key_passphrase_required"
	case strings.Contains(message, "private_key_passphrase_invalid"):
		info.Code = "private_key_passphrase_invalid"
	case strings.Contains(message, "failed to parse private key"):
		info.Code = "private_key_invalid"
	case strings.Contains(message, "failed to decrypt private key"):
		info.Code = "private_key_decrypt_failed"
	case strings.Contains(message, "failed to decrypt password"):
		info.Code = "password_decrypt_failed"
	case strings.Contains(message, "unable to authenticate") ||
		strings.Contains(message, "permission denied") ||
		strings.Contains(message, "authentication failed"):
		info.Code = "auth_failed"
	case strings.Contains(message, "connection refused"):
		info.Code = "connection_refused"
	case strings.Contains(message, "no route to host"):
		info.Code = "no_route_to_host"
	case strings.Contains(message, "network is unreachable"):
		info.Code = "network_unreachable"
	case strings.Contains(message, "i/o timeout") ||
		strings.Contains(message, "deadline exceeded"):
		info.Code = "connection_timeout"
	case strings.Contains(message, "host key verification failed"):
		info.Code = "host_key_changed"
	case strings.Contains(message, "host key trust has been revoked"):
		info.Code = "host_key_revoked"
	case strings.Contains(message, "no common algorithm"):
		info.Code = "ssh_algorithm_mismatch"
	}

	return info
}

func writeTerminalPong(writeJSON func(interface{}) error, data json.RawMessage) {
	var ping PingMessage
	if len(data) > 0 {
		if err := json.Unmarshal(data, &ping); err != nil {
			log.Printf("Error parsing ping: %v", err)
		}
	}

	now := time.Now().UnixMilli()
	resp := map[string]any{
		"id":           ping.ID,
		"ts":           ping.Ts,
		"serverRecvTs": now,
		"serverSendTs": time.Now().UnixMilli(),
	}
	respData, _ := json.Marshal(resp)
	if err := writeJSON(Message{Type: "pong", Data: json.RawMessage(respData)}); err != nil {
		log.Printf("Error sending pong during SSH initialization: %v", err)
	}
}

func readTerminalAuthResponse(conn *websocket.Conn, writeJSON func(interface{}) error, requestID string) (AuthResponseMessage, error) {
	defer func() {
		_ = conn.SetReadDeadline(time.Time{})
	}()

	for {
		if err := conn.SetReadDeadline(time.Now().Add(terminalSSHAuthChallengeTimeout)); err != nil {
			return AuthResponseMessage{}, fmt.Errorf("failed to set authentication response timeout: %w", err)
		}

		messageType, message, err := conn.ReadMessage()
		if err != nil {
			return AuthResponseMessage{}, fmt.Errorf("failed to read authentication response: %w", err)
		}
		if messageType != websocket.TextMessage {
			continue
		}

		var msg Message
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Error parsing authentication response message: %v", err)
			continue
		}
		if msg.Type == "ping" {
			writeTerminalPong(writeJSON, msg.Data)
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

		return response, nil
	}
}

func newTerminalCredentialRetryPrompt(conn *websocket.Conn, writeJSON func(interface{}) error, srv *server.Server, attempt, maxAttempts int) (*terminalCredentialRetry, error) {
	requestID := uuid.NewString()
	authMethod := srv.AuthMethod
	promptText := "Password"
	if authMethod == server.AuthMethodKey {
		promptText = "Private key"
	}

	payload, _ := json.Marshal(AuthPromptMessage{
		RequestID:         requestID,
		Kind:              "credential_retry",
		Prompts:           []AuthPromptItem{{Text: promptText, Echo: false}},
		AuthMethod:        authMethod,
		Attempt:           attempt,
		MaxAttempts:       maxAttempts,
		AttemptsRemaining: maxAttempts - attempt,
	})
	if err := writeJSON(Message{Type: "auth_prompt", Data: payload}); err != nil {
		return nil, fmt.Errorf("failed to send credential retry prompt: %w", err)
	}

	response, err := readTerminalAuthResponse(conn, writeJSON, requestID)
	if err != nil {
		return nil, err
	}
	if response.Cancelled {
		return nil, fmt.Errorf("authentication cancelled by user")
	}

	authMethod = response.AuthMethod
	if authMethod == "" {
		authMethod = srv.AuthMethod
	}
	if authMethod != server.AuthMethodPassword && authMethod != server.AuthMethodKey {
		return nil, fmt.Errorf("unsupported authentication method: %s", authMethod)
	}
	if len(response.Answers) == 0 || response.Answers[0] == "" {
		return nil, fmt.Errorf("authentication credential is required")
	}

	return &terminalCredentialRetry{
		AuthMethod: authMethod,
		Secret:     response.Answers[0],
	}, nil
}

func newTerminalPrivateKeyPassphrasePrompt(conn *websocket.Conn, writeJSON func(interface{}) error, attempt, maxAttempts int) (string, error) {
	requestID := uuid.NewString()

	payload, _ := json.Marshal(AuthPromptMessage{
		RequestID:         requestID,
		Kind:              "private_key_passphrase",
		Prompts:           []AuthPromptItem{{Text: "Private key passphrase", Echo: false}},
		AuthMethod:        server.AuthMethodKey,
		Attempt:           attempt,
		MaxAttempts:       maxAttempts,
		AttemptsRemaining: maxAttempts - attempt,
	})
	if err := writeJSON(Message{Type: "auth_prompt", Data: payload}); err != nil {
		return "", fmt.Errorf("failed to send private key passphrase prompt: %w", err)
	}

	response, err := readTerminalAuthResponse(conn, writeJSON, requestID)
	if err != nil {
		return "", err
	}
	if response.Cancelled {
		return "", fmt.Errorf("private key passphrase cancelled by user")
	}
	if len(response.Answers) == 0 || response.Answers[0] == "" {
		return "", fmt.Errorf("private key passphrase is required")
	}

	return response.Answers[0], nil
}

func readTerminalHostKeyResponse(conn *websocket.Conn, writeJSON func(interface{}) error, requestID string) (HostKeyResponseMessage, error) {
	defer func() {
		_ = conn.SetReadDeadline(time.Time{})
	}()

	for {
		if err := conn.SetReadDeadline(time.Now().Add(terminalSSHAuthChallengeTimeout)); err != nil {
			return HostKeyResponseMessage{}, fmt.Errorf("failed to set host key response timeout: %w", err)
		}

		messageType, message, err := conn.ReadMessage()
		if err != nil {
			return HostKeyResponseMessage{}, fmt.Errorf("failed to read host key response: %w", err)
		}
		if messageType != websocket.TextMessage {
			continue
		}

		var msg Message
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Error parsing host key response message: %v", err)
			continue
		}
		if msg.Type == "ping" {
			writeTerminalPong(writeJSON, msg.Data)
			continue
		}
		if msg.Type != "host_key_response" {
			continue
		}

		var response HostKeyResponseMessage
		if err := json.Unmarshal(msg.Data, &response); err != nil {
			log.Printf("Error parsing host key response payload: %v", err)
			continue
		}
		if response.RequestID != requestID {
			continue
		}

		return response, nil
	}
}

func newTerminalHostKeyPrompt(conn *websocket.Conn, writeJSON func(interface{}) error, details *sshhostkey.HostKeyVerificationError) (bool, error) {
	requestID := uuid.NewString()

	payload := struct {
		RequestID string `json:"request_id"`
		*sshhostkey.HostKeyVerificationError
	}{
		RequestID:                requestID,
		HostKeyVerificationError: details,
	}
	payloadData, _ := json.Marshal(payload)
	if err := writeJSON(Message{Type: "host_key_prompt", Data: payloadData}); err != nil {
		return false, fmt.Errorf("failed to send host key prompt: %w", err)
	}

	response, err := readTerminalHostKeyResponse(conn, writeJSON, requestID)
	if err != nil {
		return false, err
	}
	if !response.Accepted {
		return false, nil
	}
	if response.Fingerprint != "" && response.Fingerprint != details.ReceivedKey {
		return false, fmt.Errorf(
			"host key response fingerprint mismatch: approved %s, expected %s",
			response.Fingerprint,
			details.ReceivedKey,
		)
	}

	return true, nil
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
	clientIP := c.ClientIP()
	clientPort := 0 // WebSocket无法获取客户端端口，使用0

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
	sendError := func(errorCode, message string, details interface{}) {
		errMsg := ErrorMessage{
			Error:   errorCode,
			Message: message,
			Details: details,
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
		session    *sshDomain.Session
		serverName string
		stdin      io.WriteCloser
		stdout     io.Reader
		stderr     io.Reader
		err        error
		errCode    string
		errDetail  interface{}
	}
	initCtx, cancelInit := context.WithTimeout(c.Request.Context(), terminalSSHInitTimeout)
	defer cancelInit()
	resultChan := make(chan initResult)

	// 异步建立SSH连接和初始化
	go func() {
		var client *sshDomain.Client
		var sshSession *ssh.Session
		var initSucceeded bool

		defer func() {
			if initSucceeded {
				return
			}
			if sshSession != nil {
				_ = sshSession.Close()
			}
			if client != nil {
				_ = client.Close()
			}
		}()

		sendResult := func(result initResult) bool {
			select {
			case resultChan <- result:
				return true
			case <-initCtx.Done():
				return false
			}
		}

		// 获取服务器信息
		srv, err := h.serverService.GetByID(initCtx, userUUID, serverUUID)
		if err != nil {
			sendResult(initResult{err: fmt.Errorf("server_not_found: %w", err)})
			return
		}

		keyboardInteractive := newTerminalKeyboardInteractiveChallenge(wsConn, safeWriteJSON)
		hostKeyCallback := h.hostKeyService.GetTrustOnChangeHostKeyCallback(
			func(details *sshhostkey.HostKeyVerificationError) (bool, error) {
				return newTerminalHostKeyPrompt(wsConn, safeWriteJSON, details)
			},
		)
		connectWithCredential := func(credential *terminalCredentialRetry) (*sshDomain.Client, error) {
			opts := []sshDomain.ClientOption{
				sshDomain.WithKeyboardInteractive(keyboardInteractive),
			}
			if credential != nil {
				if credential.AuthMethod == server.AuthMethodKey {
					opts = append(opts, sshDomain.WithPrivateKeyAuth(credential.Secret))
				} else {
					opts = append(opts, sshDomain.WithPasswordAuth(credential.Secret))
				}
				if credential.PrivateKeyPassphrase != "" {
					opts = append(opts, sshDomain.WithPrivateKeyPassphrase(credential.PrivateKeyPassphrase))
				}
			}

			nextClient, createErr := sshDomain.NewClient(
				srv,
				h.encryptor,
				hostKeyCallback,
				opts...,
			)
			if createErr != nil {
				return nil, fmt.Errorf("client_creation_failed: %w", createErr)
			}

			if connectErr := nextClient.ConnectContext(initCtx, srv.Host, srv.Port); connectErr != nil {
				_ = nextClient.Close()
				return nil, fmt.Errorf("connection_failed: %w", connectErr)
			}

			return nextClient, nil
		}

		var credential *terminalCredentialRetry
		client, err = connectWithCredential(nil)
		if err != nil && isTerminalPrivateKeyPassphraseError(err) && srv.AuthMethod == server.AuthMethodKey {
			for attempt := 1; attempt <= terminalSSHAuthRetryMaxAttempts; attempt++ {
				passphrase, promptErr := newTerminalPrivateKeyPassphrasePrompt(
					wsConn,
					safeWriteJSON,
					attempt,
					terminalSSHAuthRetryMaxAttempts,
				)
				if promptErr != nil {
					sendResult(initResult{err: fmt.Errorf("connection_failed: %w", promptErr)})
					return
				}

				credential = &terminalCredentialRetry{
					AuthMethod:           server.AuthMethodKey,
					PrivateKeyPassphrase: passphrase,
				}
				client, err = connectWithCredential(credential)
				if err == nil {
					break
				}
				if !isTerminalPrivateKeyPassphraseError(err) {
					break
				}
			}
		}
		if err != nil && isTerminalSSHAuthError(err) {
			for attempt := 1; attempt <= terminalSSHAuthRetryMaxAttempts; attempt++ {
				nextCredential, promptErr := newTerminalCredentialRetryPrompt(
					wsConn,
					safeWriteJSON,
					srv,
					attempt,
					terminalSSHAuthRetryMaxAttempts,
				)
				if promptErr != nil {
					sendResult(initResult{err: fmt.Errorf("connection_failed: %w", promptErr)})
					return
				}

				credential = nextCredential
				client, err = connectWithCredential(credential)
				if err != nil && isTerminalPrivateKeyPassphraseError(err) && credential.AuthMethod == server.AuthMethodKey {
					for passphraseAttempt := 1; passphraseAttempt <= terminalSSHAuthRetryMaxAttempts; passphraseAttempt++ {
						passphrase, passphraseErr := newTerminalPrivateKeyPassphrasePrompt(
							wsConn,
							safeWriteJSON,
							passphraseAttempt,
							terminalSSHAuthRetryMaxAttempts,
						)
						if passphraseErr != nil {
							sendResult(initResult{err: fmt.Errorf("connection_failed: %w", passphraseErr)})
							return
						}

						credential.PrivateKeyPassphrase = passphrase
						client, err = connectWithCredential(credential)
						if err == nil {
							break
						}
						if !isTerminalPrivateKeyPassphraseError(err) {
							break
						}
					}
				}
				if err == nil {
					break
				}
				if !isTerminalSSHAuthError(err) {
					break
				}
			}
		}
		if err != nil {
			// 异步更新服务器状态为离线
			go func() {
				srv.UpdateStatus(server.StatusOffline)
				if updateErr := h.serverRepo.UpdateStatus(context.Background(), srv.ID, srv.Status, srv.LastConnected); updateErr != nil {
					log.Printf("Failed to update server status to offline: %v", updateErr)
				}
			}()
			sendResult(initResult{err: err})
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
		sshSession, err = client.NewSession()
		if err != nil {
			sendResult(initResult{err: fmt.Errorf("session_creation_failed: %w", err)})
			return
		}

		// 创建会话记录
		session := sshDomain.NewSession(userID, serverID, client, cols, rows)
		session.SSHSession = sshSession

		// 设置终端模式
		modes := ssh.TerminalModes{
			ssh.ECHO:          1,     // 启用回显
			ssh.TTY_OP_ISPEED: 14400, // 输入速度 = 14.4kbaud
			ssh.TTY_OP_OSPEED: 14400, // 输出速度 = 14.4kbaud
		}

		// 请求伪终端
		if err := sshSession.RequestPty("xterm-256color", rows, cols, modes); err != nil {
			sendResult(initResult{err: fmt.Errorf("pty_request_failed: %w", err)})
			return
		}

		// 获取输入输出管道
		stdin, err := sshSession.StdinPipe()
		if err != nil {
			sendResult(initResult{err: fmt.Errorf("stdin_pipe_failed: %w", err)})
			return
		}

		stdout, err := sshSession.StdoutPipe()
		if err != nil {
			sendResult(initResult{err: fmt.Errorf("stdout_pipe_failed: %w", err)})
			return
		}

		stderr, err := sshSession.StderrPipe()
		if err != nil {
			sendResult(initResult{err: fmt.Errorf("stderr_pipe_failed: %w", err)})
			return
		}

		// 启动 shell
		if err := sshSession.Shell(); err != nil {
			sendResult(initResult{err: fmt.Errorf("shell_start_failed: %w", err)})
			return
		}

		h.upsertTerminalOperationRecord(terminalOperationRecord{
			UserID:       userUUID,
			ServerID:     serverUUID,
			ServerName:   srv.Name,
			SessionID:    session.ID,
			ClientIP:     clientIP,
			ClientPort:   clientPort,
			TerminalType: "xterm-256color",
			StartedAt:    session.CreatedAt,
			Status:       operationrecord.StatusRunning,
		})

		initSucceeded = sendResult(initResult{
			session:    session,
			serverName: srv.Name,
			stdin:      stdin,
			stdout:     stdout,
			stderr:     stderr,
			err:        nil,
		})
	}()

	// 等待初始化完成或超时
	var result initResult
	select {
	case result = <-resultChan:
		if result.err != nil {
			errorInfo := classifyTerminalInitError(result.err)
			if result.errCode != "" {
				errorInfo.Code = result.errCode
			}
			if errorInfo.Code == "" {
				errorInfo.Code = "initialization_failed"
			}
			if errorInfo.Message == "" {
				errorInfo.Message = result.err.Error()
			}
			sendError(errorInfo.Code, errorInfo.Message, result.errDetail)
			return
		}
	case <-initCtx.Done():
		if initCtx.Err() == context.DeadlineExceeded {
			sendError("initialization_timeout", "SSH connection timeout", nil)
		}
		return
	}
	cancelInit()

	// 初始化成功，注册会话
	session := result.session
	serverName := result.serverName
	stdin := result.stdin
	stdout := result.stdout
	stderr := result.stderr

	h.sessionManager.Add(session)
	defer h.sessionManager.Remove(session.ID)
	defer session.Close()

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

	finishedAt := time.Now()
	h.upsertTerminalOperationRecord(terminalOperationRecord{
		UserID:       userUUID,
		ServerID:     serverUUID,
		ServerName:   serverName,
		SessionID:    session.ID,
		ClientIP:     clientIP,
		ClientPort:   clientPort,
		TerminalType: "xterm-256color",
		StartedAt:    session.CreatedAt,
		FinishedAt:   &finishedAt,
		Status:       operationrecord.StatusSuccess,
	})

	// 尝试发送关闭消息（如果连接已关闭则静默忽略）
	wsConn.SetWriteDeadline(time.Now().Add(time.Second))
	_ = safeWriteJSON(Message{Type: "closed"})
}

type terminalOperationRecord struct {
	UserID       uuid.UUID
	ServerID     uuid.UUID
	ServerName   string
	SessionID    string
	ClientIP     string
	ClientPort   int
	TerminalType string
	StartedAt    time.Time
	FinishedAt   *time.Time
	Status       operationrecord.Status
	ErrorMessage string
}

func (h *TerminalHandler) upsertTerminalOperationRecord(input terminalOperationRecord) {
	if h.operationRecords == nil || input.UserID == uuid.Nil || input.ServerID == uuid.Nil || input.SessionID == "" {
		return
	}

	detail, _ := json.Marshal(map[string]interface{}{
		"client_ip":     input.ClientIP,
		"client_port":   input.ClientPort,
		"terminal_type": input.TerminalType,
	})

	var durationMs int64
	if input.FinishedAt != nil {
		durationMs = input.FinishedAt.Sub(input.StartedAt).Milliseconds()
	}

	now := time.Now()
	record := &operationrecord.OperationRecord{
		UserID:       input.UserID,
		Type:         operationrecord.TypeConnection,
		Action:       "ssh_session",
		Status:       input.Status,
		ServerID:     &input.ServerID,
		ServerName:   input.ServerName,
		Title:        "SSH session",
		Resource:     input.SessionID,
		Source:       "terminal",
		StartedAt:    &input.StartedAt,
		FinishedAt:   input.FinishedAt,
		DurationMs:   durationMs,
		ErrorMessage: input.ErrorMessage,
		DetailJSON:   string(detail),
		SourceTable:  "terminal_sessions",
		SourceID:     input.SessionID,
		CreatedAt:    input.StartedAt,
		UpdatedAt:    now,
	}

	_ = h.operationRecords.Upsert(context.Background(), record)
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
