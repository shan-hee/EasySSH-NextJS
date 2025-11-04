package notification

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// DingTalkService 钉钉通知服务接口
type DingTalkService interface {
	// SendTextMessage 发送文本消息
	SendTextMessage(ctx context.Context, content string) error
	// SendMarkdownMessage 发送 Markdown 消息
	SendMarkdownMessage(ctx context.Context, title, text string) error
}

// DingTalkConfig 钉钉配置
type DingTalkConfig struct {
	WebhookURL string // Webhook URL
	Secret     string // 签名密钥（可选）
}

type dingTalkService struct {
	config *DingTalkConfig
	client *http.Client
}

// NewDingTalkService 创建钉钉服务
func NewDingTalkService(config *DingTalkConfig) (DingTalkService, error) {
	if config.WebhookURL == "" {
		return nil, fmt.Errorf("dingtalk webhook URL is required")
	}

	return &dingTalkService{
		config: config,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}, nil
}

// DingTalkMessage 钉钉消息结构
type DingTalkMessage struct {
	MsgType  string                 `json:"msgtype"`
	Text     *DingTalkText          `json:"text,omitempty"`
	Markdown *DingTalkMarkdown      `json:"markdown,omitempty"`
}

// DingTalkText 文本消息
type DingTalkText struct {
	Content string `json:"content"`
}

// DingTalkMarkdown Markdown 消息
type DingTalkMarkdown struct {
	Title string `json:"title"`
	Text  string `json:"text"`
}

// SendTextMessage 发送文本消息
func (s *dingTalkService) SendTextMessage(ctx context.Context, content string) error {
	message := DingTalkMessage{
		MsgType: "text",
		Text: &DingTalkText{
			Content: content,
		},
	}

	return s.send(ctx, message)
}

// SendMarkdownMessage 发送 Markdown 消息
func (s *dingTalkService) SendMarkdownMessage(ctx context.Context, title, text string) error {
	message := DingTalkMessage{
		MsgType: "markdown",
		Markdown: &DingTalkMarkdown{
			Title: title,
			Text:  text,
		},
	}

	return s.send(ctx, message)
}

// send 发送消息
func (s *dingTalkService) send(ctx context.Context, message DingTalkMessage) error {
	// 序列化消息
	jsonData, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	// 构建请求 URL（如果有签名）
	requestURL := s.config.WebhookURL
	if s.config.Secret != "" {
		timestamp := time.Now().UnixMilli()
		sign, err := s.generateSign(timestamp)
		if err != nil {
			return fmt.Errorf("failed to generate signature: %w", err)
		}

		// 添加签名参数
		u, err := url.Parse(requestURL)
		if err != nil {
			return fmt.Errorf("invalid webhook URL: %w", err)
		}
		q := u.Query()
		q.Add("timestamp", fmt.Sprintf("%d", timestamp))
		q.Add("sign", sign)
		u.RawQuery = q.Encode()
		requestURL = u.String()
	}

	// 创建请求
	req, err := http.NewRequestWithContext(ctx, "POST", requestURL, bytes.NewBuffer(jsonData))
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
		return fmt.Errorf("dingtalk error %d: %s", int(errCode), errMsg)
	}

	return nil
}

// generateSign 生成钉钉签名
// 签名算法：timestamp + "\n" + secret -> HMAC-SHA256 -> Base64
func (s *dingTalkService) generateSign(timestamp int64) (string, error) {
	stringToSign := fmt.Sprintf("%d\n%s", timestamp, s.config.Secret)

	h := hmac.New(sha256.New, []byte(s.config.Secret))
	h.Write([]byte(stringToSign))
	signature := base64.StdEncoding.EncodeToString(h.Sum(nil))

	return signature, nil
}

// TestDingTalkConnection 测试钉钉连接
func TestDingTalkConnection(config *DingTalkConfig) error {
	service, err := NewDingTalkService(config)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 发送测试消息
	return service.SendTextMessage(ctx, "【EasySSH 测试】\n这是来自 EasySSH 的测试消息，您的钉钉通知配置正常！")
}
