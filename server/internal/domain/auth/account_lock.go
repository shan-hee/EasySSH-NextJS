package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sync"
	"time"
)

// AccountLockConfig 账户锁定配置
type AccountLockConfig struct {
	Enabled                bool
	MaxIPFailAttempts      int
	IPLockDuration         time.Duration
	MaxAccountFailAttempts int
	AccountLockDuration    time.Duration
	FailCountWindow        time.Duration
}

// DefaultAccountLockConfig 默认账户锁定配置
var DefaultAccountLockConfig = AccountLockConfig{
	Enabled:                true,
	MaxIPFailAttempts:      10,
	IPLockDuration:         30 * time.Minute,
	MaxAccountFailAttempts: 5,
	AccountLockDuration:    60 * time.Minute,
	FailCountWindow:        15 * time.Minute,
}

// AccountLockService 账户锁定服务接口
type AccountLockService interface {
	CheckIPLock(ctx context.Context, ip string) (locked bool, unlockAt *time.Time, err error)
	CheckAccountLock(ctx context.Context, email string) (locked bool, unlockAt *time.Time, err error)
	RecordFailedLogin(ctx context.Context, email, ip, userAgent, failReason string) (ipLocked, accountLocked bool, err error)
	RecordSuccessLogin(ctx context.Context, email, ip, userAgent string) error
	ClearFailedAttempts(ctx context.Context, email, ip string) error
	LockAccount(ctx context.Context, email string, reason string, duration time.Duration) error
	UnlockAccount(ctx context.Context, email string) error
	UnlockIP(ctx context.Context, ip string) error
	GetIPFailCount(ctx context.Context, ip string) (int, error)
	GetAccountFailCount(ctx context.Context, email string) (int, error)
}

type failCounter struct {
	count    int
	windowTo time.Time
}

type accountLockService struct {
	repo     LoginAttemptRepository
	userRepo Repository
	config   AccountLockConfig

	mu           sync.Mutex
	ipFails      map[string]failCounter
	accountFails map[string]failCounter
	ipLocks      map[string]time.Time
}

// NewAccountLockService 创建账户锁定服务。短期失败计数保存在进程内，账户锁定状态同步写入数据库。
func NewAccountLockService(repo LoginAttemptRepository, userRepo Repository, config AccountLockConfig) AccountLockService {
	return &accountLockService{
		repo:         repo,
		userRepo:     userRepo,
		config:       config,
		ipFails:      make(map[string]failCounter),
		accountFails: make(map[string]failCounter),
		ipLocks:      make(map[string]time.Time),
	}
}

func hashEmail(email string) string {
	hash := sha256.Sum256([]byte(email))
	return hex.EncodeToString(hash[:16])
}

func (s *accountLockService) CheckIPLock(ctx context.Context, ip string) (bool, *time.Time, error) {
	if !s.config.Enabled {
		return false, nil, nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	unlockAt, ok := s.ipLocks[ip]
	if !ok {
		return false, nil, nil
	}
	if time.Now().After(unlockAt) {
		delete(s.ipLocks, ip)
		return false, nil, nil
	}
	return true, &unlockAt, nil
}

func (s *accountLockService) CheckAccountLock(ctx context.Context, email string) (bool, *time.Time, error) {
	if !s.config.Enabled {
		return false, nil, nil
	}
	if s.userRepo == nil {
		return false, nil, nil
	}

	user, err := s.userRepo.FindByEmail(ctx, email)
	if err != nil {
		if err == ErrUserNotFound {
			return false, nil, nil
		}
		return false, nil, err
	}
	if user.IsLocked() {
		return true, user.LockedUntil, nil
	}
	return false, nil, nil
}

func (s *accountLockService) RecordFailedLogin(ctx context.Context, email, ip, userAgent, failReason string) (bool, bool, error) {
	if s.repo != nil {
		attempt := &LoginAttempt{
			Email:      email,
			IPAddress:  ip,
			UserAgent:  userAgent,
			Success:    false,
			FailReason: failReason,
		}
		if err := s.repo.Create(attempt); err != nil {
			fmt.Printf("Warning: failed to record login attempt: %v\n", err)
		}
	}

	if !s.config.Enabled {
		return false, false, nil
	}

	now := time.Now()
	accountKey := hashEmail(email)

	s.mu.Lock()
	ipCount := s.incrementCounterLocked(s.ipFails, ip, now)
	accountCount := s.incrementCounterLocked(s.accountFails, accountKey, now)

	var ipLocked bool
	if ipCount >= s.config.MaxIPFailAttempts {
		ipLocked = true
		s.ipLocks[ip] = now.Add(s.config.IPLockDuration)
	}
	s.mu.Unlock()

	var accountLocked bool
	if accountCount >= s.config.MaxAccountFailAttempts {
		accountLocked = true
		unlockTime := now.Add(s.config.AccountLockDuration)
		if s.userRepo != nil {
			user, err := s.userRepo.FindByEmail(ctx, email)
			if err == nil {
				user.FailedLoginAttempts = accountCount
				user.LastFailedLogin = &now
				user.LockedUntil = &unlockTime
				user.LockReason = fmt.Sprintf("连续 %d 次登录失败", accountCount)
				_ = s.userRepo.Update(ctx, user)
			}
		}
	} else if s.userRepo != nil {
		user, err := s.userRepo.FindByEmail(ctx, email)
		if err == nil {
			user.FailedLoginAttempts = accountCount
			user.LastFailedLogin = &now
			_ = s.userRepo.Update(ctx, user)
		}
	}

	return ipLocked, accountLocked, nil
}

func (s *accountLockService) incrementCounterLocked(counters map[string]failCounter, key string, now time.Time) int {
	rec := counters[key]
	if rec.windowTo.IsZero() || now.After(rec.windowTo) {
		rec = failCounter{windowTo: now.Add(s.config.FailCountWindow)}
	}
	rec.count++
	counters[key] = rec
	return rec.count
}

func (s *accountLockService) RecordSuccessLogin(ctx context.Context, email, ip, userAgent string) error {
	if s.repo != nil {
		attempt := &LoginAttempt{
			Email:     email,
			IPAddress: ip,
			UserAgent: userAgent,
			Success:   true,
		}
		if err := s.repo.Create(attempt); err != nil {
			fmt.Printf("Warning: failed to record login attempt: %v\n", err)
		}
	}
	return s.ClearFailedAttempts(ctx, email, ip)
}

func (s *accountLockService) ClearFailedAttempts(ctx context.Context, email, ip string) error {
	s.mu.Lock()
	delete(s.ipFails, ip)
	delete(s.accountFails, hashEmail(email))
	s.mu.Unlock()

	if s.userRepo != nil {
		user, err := s.userRepo.FindByEmail(ctx, email)
		if err == nil {
			user.FailedLoginAttempts = 0
			user.LastFailedLogin = nil
			return s.userRepo.Update(ctx, user)
		}
	}
	return nil
}

func (s *accountLockService) LockAccount(ctx context.Context, email string, reason string, duration time.Duration) error {
	if duration <= 0 {
		duration = s.config.AccountLockDuration
	}
	unlockTime := time.Now().Add(duration)

	if s.userRepo == nil {
		return nil
	}
	user, err := s.userRepo.FindByEmail(ctx, email)
	if err != nil {
		return err
	}
	user.LockedUntil = &unlockTime
	user.LockReason = reason
	return s.userRepo.Update(ctx, user)
}

func (s *accountLockService) UnlockAccount(ctx context.Context, email string) error {
	s.mu.Lock()
	delete(s.accountFails, hashEmail(email))
	s.mu.Unlock()

	if s.userRepo != nil {
		user, err := s.userRepo.FindByEmail(ctx, email)
		if err == nil {
			user.FailedLoginAttempts = 0
			user.LastFailedLogin = nil
			user.LockedUntil = nil
			user.LockReason = ""
			return s.userRepo.Update(ctx, user)
		}
	}
	return nil
}

func (s *accountLockService) UnlockIP(ctx context.Context, ip string) error {
	s.mu.Lock()
	delete(s.ipLocks, ip)
	delete(s.ipFails, ip)
	s.mu.Unlock()
	return nil
}

func (s *accountLockService) GetIPFailCount(ctx context.Context, ip string) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	rec := s.ipFails[ip]
	if rec.windowTo.IsZero() || time.Now().After(rec.windowTo) {
		delete(s.ipFails, ip)
		return 0, nil
	}
	return rec.count, nil
}

func (s *accountLockService) GetAccountFailCount(ctx context.Context, email string) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	key := hashEmail(email)
	rec := s.accountFails[key]
	if rec.windowTo.IsZero() || time.Now().After(rec.windowTo) {
		delete(s.accountFails, key)
		return 0, nil
	}
	return rec.count, nil
}
