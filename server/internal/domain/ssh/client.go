package ssh

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"time"

	"github.com/easyssh/server/internal/domain/server"
	"github.com/easyssh/server/internal/pkg/crypto"
	"golang.org/x/crypto/ssh"
)

// Client SSH 客户端封装
type Client struct {
	conn      *ssh.Client
	serverID  string
	config    *ssh.ClientConfig
	connected bool
	createdAt time.Time
}

type clientOptions struct {
	keyboardInteractive  ssh.KeyboardInteractiveChallenge
	authMethod           *server.AuthMethod
	password             string
	privateKey           string
	privateKeyPassphrase string
}

// ClientOption configures optional SSH client behavior.
type ClientOption func(*clientOptions)

// WithKeyboardInteractive enables SSH keyboard-interactive authentication.
func WithKeyboardInteractive(challenge ssh.KeyboardInteractiveChallenge) ClientOption {
	return func(opts *clientOptions) {
		opts.keyboardInteractive = challenge
	}
}

// WithPasswordAuth uses a plaintext password for this SSH connection only.
func WithPasswordAuth(password string) ClientOption {
	return func(opts *clientOptions) {
		method := server.AuthMethodPassword
		opts.authMethod = &method
		opts.password = password
	}
}

// WithPrivateKeyAuth uses a plaintext private key for this SSH connection only.
func WithPrivateKeyAuth(privateKey string) ClientOption {
	return func(opts *clientOptions) {
		method := server.AuthMethodKey
		opts.authMethod = &method
		opts.privateKey = privateKey
	}
}

// WithPrivateKeyPassphrase uses a plaintext passphrase for an encrypted private key.
func WithPrivateKeyPassphrase(passphrase string) ClientOption {
	return func(opts *clientOptions) {
		opts.privateKeyPassphrase = passphrase
	}
}

// NewClient 创建 SSH 客户端
// hostKeyCallback: 可选的主机密钥验证回调，如果为 nil 则使用不安全的模式（不推荐）
func NewClient(srv *server.Server, encryptor *crypto.Encryptor, hostKeyCallback ssh.HostKeyCallback, opts ...ClientOption) (*Client, error) {
	options := &clientOptions{}
	for _, opt := range opts {
		if opt != nil {
			opt(options)
		}
	}

	// 解密认证信息
	var authMethods []ssh.AuthMethod

	authMethod := srv.AuthMethod
	if options.authMethod != nil {
		authMethod = *options.authMethod
	}

	if authMethod == server.AuthMethodPassword {
		password := options.password
		if password == "" {
			var err error
			password, err = encryptor.Decrypt(srv.Password)
			if err != nil {
				return nil, fmt.Errorf("failed to decrypt password: %w", err)
			}
		}
		authMethods = append(authMethods, ssh.Password(password))
	} else {
		privateKey := options.privateKey
		if privateKey == "" {
			var err error
			privateKey, err = encryptor.Decrypt(srv.PrivateKey)
			if err != nil {
				return nil, fmt.Errorf("failed to decrypt private key: %w", err)
			}
		}

		signer, err := parsePrivateKey(privateKey, options.privateKeyPassphrase)
		if err != nil {
			return nil, err
		}
		authMethods = append(authMethods, ssh.PublicKeys(signer))
	}

	if options.keyboardInteractive != nil {
		authMethods = append(authMethods, ssh.KeyboardInteractive(options.keyboardInteractive))
	}

	// 配置 SSH 客户端
	// 如果没有提供主机密钥验证回调，显式使用不安全的模式（不推荐）
	if hostKeyCallback == nil {
		hostKeyCallback = ssh.InsecureIgnoreHostKey()
	}

	config := &ssh.ClientConfig{
		User:            srv.Username,
		Auth:            authMethods,
		HostKeyCallback: hostKeyCallback,
		Timeout:         30 * time.Second,
	}

	client := &Client{
		serverID:  srv.ID.String(),
		config:    config,
		connected: false,
		createdAt: time.Now(),
	}

	return client, nil
}

func parsePrivateKey(privateKey, passphrase string) (ssh.Signer, error) {
	keyBytes := []byte(privateKey)
	signer, err := ssh.ParsePrivateKey(keyBytes)
	if err == nil {
		return signer, nil
	}

	var missingPassphrase *ssh.PassphraseMissingError
	if !errors.As(err, &missingPassphrase) {
		return nil, fmt.Errorf("failed to parse private key: %w", err)
	}

	if passphrase == "" {
		return nil, fmt.Errorf("private_key_passphrase_required: %w", err)
	}

	signer, err = ssh.ParsePrivateKeyWithPassphrase(keyBytes, []byte(passphrase))
	if err != nil {
		return nil, fmt.Errorf("private_key_passphrase_invalid: %w", err)
	}

	return signer, nil
}

// Connect 连接到服务器
func (c *Client) Connect(host string, port int) error {
	addr := fmt.Sprintf("%s:%d", host, port)
	conn, err := ssh.Dial("tcp", addr, c.config)
	if err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}

	c.conn = conn
	c.connected = true
	return nil
}

// ConnectContext 使用上下文连接到服务器（支持超时/取消）
func (c *Client) ConnectContext(ctx context.Context, host string, port int) error {
	// 如果上层没有设置 deadline，则使用客户端配置里的默认超时兜底
	ctxToUse := ctx
	if _, ok := ctx.Deadline(); !ok && c.config != nil && c.config.Timeout > 0 {
		var cancel context.CancelFunc
		ctxToUse, cancel = context.WithTimeout(ctx, c.config.Timeout)
		defer cancel()
	}

	addr := fmt.Sprintf("%s:%d", host, port)
	dialer := &net.Dialer{}
	netConn, err := dialer.DialContext(ctxToUse, "tcp", addr)
	if err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}

	// 让 SSH 握手也受同一 deadline 控制
	if deadline, ok := ctxToUse.Deadline(); ok {
		_ = netConn.SetDeadline(deadline)
	}

	sshConn, chans, reqs, err := ssh.NewClientConn(netConn, addr, c.config)
	if err != nil {
		_ = netConn.Close()
		return fmt.Errorf("failed to establish ssh connection: %w", err)
	}

	// 清掉握手 deadline，避免影响后续读写
	_ = netConn.SetDeadline(time.Time{})

	c.conn = ssh.NewClient(sshConn, chans, reqs)
	c.connected = true
	return nil
}

// NewSession 创建新会话
func (c *Client) NewSession() (*ssh.Session, error) {
	if !c.connected || c.conn == nil {
		return nil, fmt.Errorf("client not connected")
	}

	session, err := c.conn.NewSession()
	if err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	return session, nil
}

// MeasureTransportLatency measures the SSH transport round trip without
// starting a remote shell command. Unsupported keepalive requests still
// require a server reply, so they are useful as a low-overhead RTT probe.
func (c *Client) MeasureTransportLatency() (time.Duration, error) {
	if !c.connected || c.conn == nil {
		return 0, fmt.Errorf("client not connected")
	}

	start := time.Now()
	_, _, err := c.conn.SendRequest("keepalive@openssh.com", true, nil)
	if err != nil {
		return 0, fmt.Errorf("failed to measure ssh latency: %w", err)
	}

	return time.Since(start), nil
}

// Close 关闭连接
func (c *Client) Close() error {
	if c.conn != nil {
		c.connected = false
		return c.conn.Close()
	}
	return nil
}

// IsConnected 检查是否已连接
func (c *Client) IsConnected() bool {
	return c.connected && c.conn != nil
}

// GetServerID 获取服务器 ID
func (c *Client) GetServerID() string {
	return c.serverID
}

// GetUptime 获取连接持续时间
func (c *Client) GetUptime() time.Duration {
	return time.Since(c.createdAt)
}

// ExecuteCommand 执行命令
func (c *Client) ExecuteCommand(cmd string) (string, error) {
	session, err := c.NewSession()
	if err != nil {
		return "", err
	}
	defer session.Close()

	output, err := session.CombinedOutput(cmd)
	if err != nil {
		return "", fmt.Errorf("command execution failed: %w", err)
	}

	return string(output), nil
}

// CopyTo 复制文件到远程服务器
func (c *Client) CopyTo(localReader io.Reader, remotePath string, size int64) error {
	session, err := c.NewSession()
	if err != nil {
		return err
	}
	defer session.Close()

	// 使用 SCP 协议
	// 这里简化实现，实际应该使用完整的 SCP 协议
	stdin, err := session.StdinPipe()
	if err != nil {
		return err
	}

	if err := session.Start(fmt.Sprintf("scp -t %s", remotePath)); err != nil {
		return err
	}

	// 复制数据
	if _, err := io.Copy(stdin, localReader); err != nil {
		return err
	}

	stdin.Close()
	return session.Wait()
}

// GetRawConnection 获取原始 SSH 连接（用于 SFTP）
func (c *Client) GetRawConnection() *ssh.Client {
	return c.conn
}
