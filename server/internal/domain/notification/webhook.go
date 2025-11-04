package notification

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// WebhookService Webhook 通知服务接口
type WebhookService interface {
	// SendNotification 发送 Webhook 通知
	SendNotification(ctx context.Context, event string, data map[string]interface{}) error
}

// WebhookConfig Webhook 配置
type WebhookConfig struct {
	URL    string // Webhook URL
	Secret string // 签名密钥（可选）
	Method string // HTTP 方法（POST 或 GET）
}

type webhookService struct {
	config *WebhookConfig
	client *http.Client
}

// NewWebhookService 创建 Webhook 服务
func NewWebhookService(config *WebhookConfig) (WebhookService, error) {
	if config.URL == "" {
		return nil, fmt.Errorf("webhook URL is required")
	}

	// 默认使用 POST 方法
	if config.Method == "" {
		config.Method = "POST"
	}

	return &webhookService{
		config: config,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}, nil
}

// WebhookPayload Webhook 请求负载
type WebhookPayload struct {
	Event     string                 `json:"event"`
	Timestamp int64                  `json:"timestamp"`
	Data      map[string]interface{} `json:"data"`
	Signature string                 `json:"signature,omitempty"`
}

// SendNotification 发送通知
func (s *webhookService) SendNotification(ctx context.Context, event string, data map[string]interface{}) error {
	timestamp := time.Now().Unix()

	payload := WebhookPayload{
		Event:     event,
		Timestamp: timestamp,
		Data:      data,
	}

	// 生成签名（如果配置了 secret）
	if s.config.Secret != "" {
		signature, err := s.generateSignature(payload)
		if err != nil {
			return fmt.Errorf("failed to generate signature: %w", err)
		}
		payload.Signature = signature
	}

	// 序列化 payload
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	// 根据方法发送请求
	var req *http.Request
	if s.config.Method == "POST" {
		req, err = http.NewRequestWithContext(ctx, "POST", s.config.URL, bytes.NewBuffer(jsonData))
		if err != nil {
			return fmt.Errorf("failed to create request: %w", err)
		}
		req.Header.Set("Content-Type", "application/json")
	} else {
		// GET 方法：将数据作为查询参数
		req, err = http.NewRequestWithContext(ctx, "GET", s.config.URL, nil)
		if err != nil {
			return fmt.Errorf("failed to create request: %w", err)
		}
		q := req.URL.Query()
		q.Add("event", event)
		q.Add("timestamp", fmt.Sprintf("%d", timestamp))
		q.Add("data", string(jsonData))
		if payload.Signature != "" {
			q.Add("signature", payload.Signature)
		}
		req.URL.RawQuery = q.Encode()
	}

	// 发送请求（带重试）
	return s.sendWithRetry(req, 3)
}

// sendWithRetry 带重试的发送
func (s *webhookService) sendWithRetry(req *http.Request, maxRetries int) error {
	var lastErr error

	for i := 0; i < maxRetries; i++ {
		resp, err := s.client.Do(req)
		if err != nil {
			lastErr = err
			// 指数退避
			time.Sleep(time.Duration(1<<uint(i)) * time.Second)
			continue
		}

		// 读取响应体
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		// 检查状态码
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			return nil
		}

		lastErr = fmt.Errorf("webhook returned status %d: %s", resp.StatusCode, string(body))

		// 如果是 4xx 错误，不重试
		if resp.StatusCode >= 400 && resp.StatusCode < 500 {
			return lastErr
		}

		// 5xx 错误，重试
		time.Sleep(time.Duration(1<<uint(i)) * time.Second)
	}

	return fmt.Errorf("webhook failed after %d retries: %w", maxRetries, lastErr)
}

// generateSignature 生成 HMAC-SHA256 签名
func (s *webhookService) generateSignature(payload WebhookPayload) (string, error) {
	// 序列化 payload（不包含 signature 字段）
	data := map[string]interface{}{
		"event":     payload.Event,
		"timestamp": payload.Timestamp,
		"data":      payload.Data,
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return "", err
	}

	// 计算 HMAC-SHA256
	h := hmac.New(sha256.New, []byte(s.config.Secret))
	h.Write(jsonData)
	signature := hex.EncodeToString(h.Sum(nil))

	return signature, nil
}

// TestConnection 测试 Webhook 连接
func TestWebhookConnection(config *WebhookConfig) error {
	service, err := NewWebhookService(config)
	if err != nil {
		return err
	}

	// 发送测试通知
	testData := map[string]interface{}{
		"message": "This is a test notification from EasySSH",
		"source":  "EasySSH",
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	return service.SendNotification(ctx, "test", testData)
}
