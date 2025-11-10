package ssh

import (
	"fmt"
	"io"
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

// NewClient 创建 SSH 客户端
// hostKeyCallback: 可选的主机密钥验证回调，如果为 nil 则使用不安全的模式（不推荐）
func NewClient(srv *server.Server, encryptor *crypto.Encryptor, hostKeyCallback ssh.HostKeyCallback) (*Client, error) {
	// 解密认证信息
	var authMethods []ssh.AuthMethod

	if srv.AuthMethod == server.AuthMethodPassword {
		password, err := encryptor.Decrypt(srv.Password)
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt password: %w", err)
		}
		authMethods = append(authMethods, ssh.Password(password))
	} else {
		privateKey, err := encryptor.Decrypt(srv.PrivateKey)
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt private key: %w", err)
		}

		signer, err := ssh.ParsePrivateKey([]byte(privateKey))
		if err != nil {
			return nil, fmt.Errorf("failed to parse private key: %w", err)
		}
		authMethods = append(authMethods, ssh.PublicKeys(signer))
	}

	// 配置 SSH 客户端
	// 如果没有提供主机密钥验证回调，使用不安全的模式（向后兼容）
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
