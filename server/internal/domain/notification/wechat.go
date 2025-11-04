package notification

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// WeComService 企业微信通知服务接口
type WeComService interface {
	// SendTextMessage 发送文本消息
	SendTextMessage(ctx context.Context, content string) error
	// SendMarkdownMessage 发送 Markdown 消息
	SendMarkdownMessage(ctx context.Context, content string) error
}

// WeComConfig 企业微信配置
type WeComConfig struct {
	WebhookURL string // Webhook URL
}

type weComService struct {
	config *WeComConfig
	client *http.Client
}

// NewWeComService 创建企业微信服务
func NewWeComService(config *WeComConfig) (WeComService, error) {
	if config.WebhookURL == "" {
		return nil, fmt.Errorf("wechat work webhook URL is required")
	}

	return &weComService{
		config: config,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}, nil
}

// WeComMessage 企业微信消息结构
type WeComMessage struct {
	MsgType  string            `json:"msgtype"`
	Text     *WeComText        `json:"text,omitempty"`
	Markdown *WeComMarkdown    `json:"markdown,omitempty"`
}

// WeComText 文本消息
type WeComText struct {
	Content string `json:"content"`
}

// WeComMarkdown Markdown 消息
type WeComMarkdown struct {
	Content string `json:"content"`
}

// SendTextMessage 发送文本消息
func (s *weComService) SendTextMessage(ctx context.Context, content string) error {
	message := WeComMessage{
		MsgType: "text",
		Text: &WeComText{
			Content: content,
		},
	}

	return s.send(ctx, message)
}

// SendMarkdownMessage 发送 Markdown 消息
func (s *weComService) SendMarkdownMessage(ctx context.Context, content string) error {
	message := WeComMessage{
		MsgType: "markdown",
		Markdown: &WeComMarkdown{
			Content: content,
		},
	}

	return s.send(ctx, message)
}

// send 发送消息
func (s *weComService) send(ctx context.Context, message WeComMessage) error {
	// 序列化消息
	jsonData, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	// 创建请求
	req, err := http.NewRequestWithContext(ctx, "POST", s.config.WebhookURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	// 发送请求
	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	// 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	// 解析响应
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}

	// 检查错误码
	if errCode, ok := result["errcode"].(float64); ok && errCode != 0 {
		errMsg, _ := result["errmsg"].(string)
		return fmt.Errorf("wechat work error %d: %s", int(errCode), errMsg)
	}

	return nil
}

// TestWeComConnection 测试企业微信连接
func TestWeComConnection(config *WeComConfig) error {
	service, err := NewWeComService(config)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 发送测试消息
	return service.SendTextMessage(ctx, "【EasySSH 测试】\n这是来自 EasySSH 的测试消息，您的企业微信通知配置正常！")
}
