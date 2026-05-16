package verification

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"sync"
	"time"
)

const (
	CodeLength     = 6
	CodeExpiration = 5 * time.Minute
	MaxAttempts    = 5
	SendInterval   = 60 * time.Second
)

var (
	ErrCodeExpired     = errors.New("verification code expired")
	ErrCodeInvalid     = errors.New("verification code invalid")
	ErrTooManyAttempts = errors.New("too many verification attempts")
	ErrSendTooFrequent = errors.New("send verification code too frequent")
	ErrCodeNotFound    = errors.New("verification code not found")
)

// Service 验证码服务接口（按类型划分，不再保留向后兼容的无类型方法）
type Service interface {
	GenerateAndSendWithType(ctx context.Context, email string, codeType VerificationCodeType) error
	VerifyWithType(ctx context.Context, email, code string, codeType VerificationCodeType) error
	CanSendWithType(ctx context.Context, email string, codeType VerificationCodeType) (bool, error)
	GetCodeWithType(ctx context.Context, email string, codeType VerificationCodeType) (string, error)
}

type codeRecord struct {
	code      VerificationCode
	expiresAt time.Time
}

type service struct {
	mu       sync.Mutex
	codes    map[string]codeRecord
	sentOnce map[string]time.Time
}

// NewService 创建单实例内存验证码服务。
func NewService() Service {
	s := &service{
		codes:    make(map[string]codeRecord),
		sentOnce: make(map[string]time.Time),
	}
	go s.cleanupLoop()
	return s
}

func (s *service) GenerateAndSendWithType(ctx context.Context, email string, codeType VerificationCodeType) error {
	canSend, err := s.CanSendWithType(ctx, email, codeType)
	if err != nil {
		return err
	}
	if !canSend {
		return ErrSendTooFrequent
	}

	code, err := s.generateCode()
	if err != nil {
		return fmt.Errorf("failed to generate code: %w", err)
	}

	now := time.Now()
	key := s.getCodeKeyWithType(email, codeType)

	s.mu.Lock()
	defer s.mu.Unlock()

	s.codes[key] = codeRecord{
		code: VerificationCode{
			Code:      code,
			Email:     email,
			Type:      codeType,
			Attempts:  0,
			CreatedAt: now,
		},
		expiresAt: now.Add(CodeExpiration),
	}
	s.sentOnce[key] = now.Add(SendInterval)

	return nil
}

func (s *service) VerifyWithType(ctx context.Context, email, code string, codeType VerificationCodeType) error {
	key := s.getCodeKeyWithType(email, codeType)

	s.mu.Lock()
	defer s.mu.Unlock()

	rec, ok := s.codes[key]
	if !ok {
		return ErrCodeNotFound
	}
	if time.Now().After(rec.expiresAt) {
		delete(s.codes, key)
		return ErrCodeExpired
	}
	if rec.code.Attempts >= MaxAttempts {
		delete(s.codes, key)
		return ErrTooManyAttempts
	}
	if rec.code.Code != code {
		rec.code.Attempts++
		s.codes[key] = rec
		return ErrCodeInvalid
	}

	delete(s.codes, key)
	delete(s.sentOnce, key)
	return nil
}

func (s *service) CanSendWithType(ctx context.Context, email string, codeType VerificationCodeType) (bool, error) {
	key := s.getCodeKeyWithType(email, codeType)

	s.mu.Lock()
	defer s.mu.Unlock()

	until, ok := s.sentOnce[key]
	if !ok || time.Now().After(until) {
		delete(s.sentOnce, key)
		return true, nil
	}
	return false, nil
}

func (s *service) GetCodeWithType(ctx context.Context, email string, codeType VerificationCodeType) (string, error) {
	key := s.getCodeKeyWithType(email, codeType)

	s.mu.Lock()
	defer s.mu.Unlock()

	rec, ok := s.codes[key]
	if !ok {
		return "", ErrCodeNotFound
	}
	if time.Now().After(rec.expiresAt) {
		delete(s.codes, key)
		return "", ErrCodeExpired
	}
	return rec.code.Code, nil
}

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

func (s *service) getCodeKeyWithType(email string, codeType VerificationCodeType) string {
	return fmt.Sprintf("%s:%s", codeType, strings.ToLower(strings.TrimSpace(email)))
}

func (s *service) cleanupLoop() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now()
		s.mu.Lock()
		for key, rec := range s.codes {
			if now.After(rec.expiresAt) {
				delete(s.codes, key)
			}
		}
		for key, until := range s.sentOnce {
			if now.After(until) {
				delete(s.sentOnce, key)
			}
		}
		s.mu.Unlock()
	}
}
