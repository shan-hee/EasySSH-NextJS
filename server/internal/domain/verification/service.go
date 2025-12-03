package verification

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	// 验证码配置
	CodeLength     = 6              // 验证码长度
	CodeExpiration = 5 * time.Minute // 验证码过期时间
	MaxAttempts    = 5              // 最大验证次数
	SendInterval   = 60 * time.Second // 发送间隔
)

var (
	ErrCodeExpired      = errors.New("verification code expired")
	ErrCodeInvalid      = errors.New("verification code invalid")
	ErrTooManyAttempts  = errors.New("too many verification attempts")
	ErrSendTooFrequent  = errors.New("send verification code too frequent")
	ErrCodeNotFound     = errors.New("verification code not found")
)

// Service 验证码服务接口
type Service interface {
	// GenerateAndSend 生成并发送验证码
	GenerateAndSend(ctx context.Context, email string) error
	// Verify 验证验证码
	Verify(ctx context.Context, email, code string) error
	// CanSend 检查是否可以发送验证码
	CanSend(ctx context.Context, email string) (bool, error)
	// GetCode 获取验证码（用于邮件发送）
	GetCode(ctx context.Context, email string) (string, error)
}

type service struct {
	redisClient *redis.Client
}

// NewService 创建验证码服务
func NewService(redisClient *redis.Client) Service {
	return &service{
		redisClient: redisClient,
	}
}

// GenerateAndSend 生成并发送验证码
func (s *service) GenerateAndSend(ctx context.Context, email string) error {
	// 检查发送频率
	canSend, err := s.CanSend(ctx, email)
	if err != nil {
		return err
	}
	if !canSend {
		return ErrSendTooFrequent
	}

	// 生成验证码
	code, err := s.generateCode()
	if err != nil {
		return fmt.Errorf("failed to generate code: %w", err)
	}

	// 创建验证码数据
	verificationCode := VerificationCode{
		Code:      code,
		Email:     email,
		Attempts:  0,
		CreatedAt: time.Now(),
	}

	// 序列化为JSON
	data, err := json.Marshal(verificationCode)
	if err != nil {
		return fmt.Errorf("failed to marshal verification code: %w", err)
	}

	// 存储到Redis
	key := s.getCodeKey(email)
	if err := s.redisClient.Set(ctx, key, data, CodeExpiration).Err(); err != nil {
		return fmt.Errorf("failed to store verification code: %w", err)
	}

	// 设置发送频率限制
	sentKey := s.getSentKey(email)
	if err := s.redisClient.Set(ctx, sentKey, "1", SendInterval).Err(); err != nil {
		return fmt.Errorf("failed to set send interval: %w", err)
	}

	return nil
}

// Verify 验证验证码
func (s *service) Verify(ctx context.Context, email, code string) error {
	key := s.getCodeKey(email)

	// 从Redis获取验证码数据
	data, err := s.redisClient.Get(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return ErrCodeNotFound
		}
		return fmt.Errorf("failed to get verification code: %w", err)
	}

	// 反序列化
	var verificationCode VerificationCode
	if err := json.Unmarshal([]byte(data), &verificationCode); err != nil {
		return fmt.Errorf("failed to unmarshal verification code: %w", err)
	}

	// 检查验证次数
	if verificationCode.Attempts >= MaxAttempts {
		// 删除验证码
		s.redisClient.Del(ctx, key)
		return ErrTooManyAttempts
	}

	// 验证码匹配
	if verificationCode.Code != code {
		// 增加尝试次数
		verificationCode.Attempts++
		updatedData, _ := json.Marshal(verificationCode)
		s.redisClient.Set(ctx, key, updatedData, CodeExpiration)
		return ErrCodeInvalid
	}

	// 验证成功，删除验证码
	if err := s.redisClient.Del(ctx, key).Err(); err != nil {
		return fmt.Errorf("failed to delete verification code: %w", err)
	}

	// 删除发送频率限制
	sentKey := s.getSentKey(email)
	s.redisClient.Del(ctx, sentKey)

	return nil
}

// CanSend 检查是否可以发送验证码
func (s *service) CanSend(ctx context.Context, email string) (bool, error) {
	sentKey := s.getSentKey(email)
	exists, err := s.redisClient.Exists(ctx, sentKey).Result()
	if err != nil {
		return false, fmt.Errorf("failed to check send interval: %w", err)
	}
	return exists == 0, nil
}

// GetCode 获取验证码（用于邮件发送）
func (s *service) GetCode(ctx context.Context, email string) (string, error) {
	key := s.getCodeKey(email)
	data, err := s.redisClient.Get(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return "", ErrCodeNotFound
		}
		return "", fmt.Errorf("failed to get verification code: %w", err)
	}

	var verificationCode VerificationCode
	if err := json.Unmarshal([]byte(data), &verificationCode); err != nil {
		return "", fmt.Errorf("failed to unmarshal verification code: %w", err)
	}

	return verificationCode.Code, nil
}

// generateCode 生成随机验证码
func (s *service) generateCode() (string, error) {
	const digits = "0123456789"
	code := make([]byte, CodeLength)
	for i := range code {
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(digits))))
		if err != nil {
			return "", err
		}
		code[i] = digits[num.Int64()]
	}
	return string(code), nil
}

// getCodeKey 获取验证码Redis键
func (s *service) getCodeKey(email string) string {
	return fmt.Sprintf("verification_code:%s", email)
}

// getSentKey 获取发送频率限制Redis键
func (s *service) getSentKey(email string) string {
	return fmt.Sprintf("verification_code_sent:%s", email)
}
