package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// AccountLockConfig 账户锁定配置
type AccountLockConfig struct {
	Enabled                    bool          // 是否启用账户锁定
	MaxIPFailAttempts          int           // IP 最大失败次数
	IPLockDuration             time.Duration // IP 锁定时长
	MaxAccountFailAttempts     int           // 账户最大失败次数
	AccountLockDuration        time.Duration // 账户锁定时长
	FailCountWindow            time.Duration // 失败计数时间窗口
}

// DefaultAccountLockConfig 默认账户锁定配置
var DefaultAccountLockConfig = AccountLockConfig{
	Enabled:                    true,
	MaxIPFailAttempts:          10,
	IPLockDuration:             30 * time.Minute,
	MaxAccountFailAttempts:     5,
	AccountLockDuration:        60 * time.Minute,
	FailCountWindow:            15 * time.Minute,
}

// AccountLockService 账户锁定服务接口
type AccountLockService interface {
	// CheckIPLock 检查 IP 是否被锁定
	CheckIPLock(ctx context.Context, ip string) (locked bool, unlockAt *time.Time, err error)

	// CheckAccountLock 检查账户是否被锁定
	CheckAccountLock(ctx context.Context, email string) (locked bool, unlockAt *time.Time, err error)

	// RecordFailedLogin 记录登录失败（更新计数器，可能触发锁定）
	RecordFailedLogin(ctx context.Context, email, ip, userAgent, failReason string) (ipLocked, accountLocked bool, err error)

	// RecordSuccessLogin 记录登录成功（清除失败计数）
	RecordSuccessLogin(ctx context.Context, email, ip, userAgent string) error

	// ClearFailedAttempts 清除失败尝试记录
	ClearFailedAttempts(ctx context.Context, email, ip string) error

	// LockAccount 手动锁定账户
	LockAccount(ctx context.Context, email string, reason string, duration time.Duration) error

	// UnlockAccount 手动解锁账户
	UnlockAccount(ctx context.Context, email string) error

	// UnlockIP 手动解锁 IP
	UnlockIP(ctx context.Context, ip string) error

	// GetIPFailCount 获取 IP 失败次数
	GetIPFailCount(ctx context.Context, ip string) (int, error)

	// GetAccountFailCount 获取账户失败次数
	GetAccountFailCount(ctx context.Context, email string) (int, error)
}

// accountLockService 账户锁定服务实现
type accountLockService struct {
	redisClient *redis.Client
	repo        LoginAttemptRepository
	userRepo    Repository
	config      AccountLockConfig
}

// NewAccountLockService 创建账户锁定服务
func NewAccountLockService(redisClient *redis.Client, repo LoginAttemptRepository, userRepo Repository, config AccountLockConfig) AccountLockService {
	return &accountLockService{
		redisClient: redisClient,
		repo:        repo,
		userRepo:    userRepo,
		config:      config,
	}
}

// Redis Key 前缀
const (
	keyPrefixIPFail      = "login_fail:ip:"
	keyPrefixIPLock      = "login_lock:ip:"
	keyPrefixAccountFail = "login_fail:account:"
	keyPrefixAccountLock = "login_lock:account:"
)

// hashEmail 对邮箱进行哈希处理（用于 Redis Key）
func hashEmail(email string) string {
	hash := sha256.Sum256([]byte(email))
	return hex.EncodeToString(hash[:16]) // 使用前 16 字节
}

func (s *accountLockService) CheckIPLock(ctx context.Context, ip string) (bool, *time.Time, error) {
	if !s.config.Enabled {
		return false, nil, nil
	}

	key := keyPrefixIPLock + ip
	result, err := s.redisClient.Get(ctx, key).Result()
	if err == redis.Nil {
		return false, nil, nil
	}
	if err != nil {
		return false, nil, err
	}

	// 解析锁定截止时间
	unlockTime, err := time.Parse(time.RFC3339, result)
	if err != nil {
		return false, nil, err
	}

	if time.Now().After(unlockTime) {
		// 锁定已过期，删除 key
		s.redisClient.Del(ctx, key)
		return false, nil, nil
	}

	return true, &unlockTime, nil
}

func (s *accountLockService) CheckAccountLock(ctx context.Context, email string) (bool, *time.Time, error) {
	if !s.config.Enabled {
		return false, nil, nil
	}

	// 首先检查 Redis 缓存
	key := keyPrefixAccountLock + hashEmail(email)
	result, err := s.redisClient.Get(ctx, key).Result()
	if err == nil {
		unlockTime, parseErr := time.Parse(time.RFC3339, result)
		if parseErr == nil && time.Now().Before(unlockTime) {
			return true, &unlockTime, nil
		}
	}

	// 检查数据库中的锁定状态
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
	// 记录到数据库
	if s.repo != nil {
		attempt := &LoginAttempt{
			Email:      email,
			IPAddress:  ip,
			UserAgent:  userAgent,
			Success:    false,
			FailReason: failReason,
		}
		if err := s.repo.Create(attempt); err != nil {
			// 记录失败不应阻止后续流程
			fmt.Printf("Warning: failed to record login attempt: %v\n", err)
		}
	}

	if !s.config.Enabled {
		return false, false, nil
	}

	var ipLocked, accountLocked bool

	// 更新 IP 失败计数
	ipKey := keyPrefixIPFail + ip
	ipCount, err := s.redisClient.Incr(ctx, ipKey).Result()
	if err != nil {
		return false, false, err
	}
	if ipCount == 1 {
		s.redisClient.Expire(ctx, ipKey, s.config.FailCountWindow)
	}

	// 检查是否需要锁定 IP
	if int(ipCount) >= s.config.MaxIPFailAttempts {
		ipLocked = true
		lockKey := keyPrefixIPLock + ip
		unlockTime := time.Now().Add(s.config.IPLockDuration)
		s.redisClient.Set(ctx, lockKey, unlockTime.Format(time.RFC3339), s.config.IPLockDuration)
	}

	// 更新账户失败计数
	accountKey := keyPrefixAccountFail + hashEmail(email)
	accountCount, err := s.redisClient.Incr(ctx, accountKey).Result()
	if err != nil {
		return ipLocked, false, err
	}
	if accountCount == 1 {
		s.redisClient.Expire(ctx, accountKey, s.config.FailCountWindow)
	}

	// 检查是否需要锁定账户
	if int(accountCount) >= s.config.MaxAccountFailAttempts {
		accountLocked = true
		unlockTime := time.Now().Add(s.config.AccountLockDuration)

		// 更新 Redis 缓存
		lockKey := keyPrefixAccountLock + hashEmail(email)
		s.redisClient.Set(ctx, lockKey, unlockTime.Format(time.RFC3339), s.config.AccountLockDuration)

		// 更新数据库
		if s.userRepo != nil {
			user, err := s.userRepo.FindByEmail(ctx, email)
			if err == nil {
				now := time.Now()
				user.FailedLoginAttempts = int(accountCount)
				user.LastFailedLogin = &now
				user.LockedUntil = &unlockTime
				user.LockReason = fmt.Sprintf("连续 %d 次登录失败", accountCount)
				s.userRepo.Update(ctx, user)
			}
		}
	} else if s.userRepo != nil {
		// 更新失败次数（不锁定）
		user, err := s.userRepo.FindByEmail(ctx, email)
		if err == nil {
			now := time.Now()
			user.FailedLoginAttempts = int(accountCount)
			user.LastFailedLogin = &now
			s.userRepo.Update(ctx, user)
		}
	}

	return ipLocked, accountLocked, nil
}

func (s *accountLockService) RecordSuccessLogin(ctx context.Context, email, ip, userAgent string) error {
	// 记录到数据库
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

	// 清除失败计数
	return s.ClearFailedAttempts(ctx, email, ip)
}

func (s *accountLockService) ClearFailedAttempts(ctx context.Context, email, ip string) error {
	// 清除 Redis 中的失败计数
	ipKey := keyPrefixIPFail + ip
	accountKey := keyPrefixAccountFail + hashEmail(email)

	pipe := s.redisClient.Pipeline()
	pipe.Del(ctx, ipKey)
	pipe.Del(ctx, accountKey)
	_, err := pipe.Exec(ctx)
	if err != nil {
		return err
	}

	// 清除数据库中的失败计数
	if s.userRepo != nil {
		user, err := s.userRepo.FindByEmail(ctx, email)
		if err == nil {
			user.FailedLoginAttempts = 0
			user.LastFailedLogin = nil
			s.userRepo.Update(ctx, user)
		}
	}

	return nil
}

func (s *accountLockService) LockAccount(ctx context.Context, email string, reason string, duration time.Duration) error {
	unlockTime := time.Now().Add(duration)

	// 设置 Redis 锁定
	lockKey := keyPrefixAccountLock + hashEmail(email)
	if err := s.redisClient.Set(ctx, lockKey, unlockTime.Format(time.RFC3339), duration).Err(); err != nil {
		return err
	}

	// 更新数据库
	if s.userRepo != nil {
		user, err := s.userRepo.FindByEmail(ctx, email)
		if err != nil {
			if err == ErrUserNotFound {
				return err
			}
			return fmt.Errorf("failed to find user: %w", err)
		}
		user.LockedUntil = &unlockTime
		user.LockReason = reason
		return s.userRepo.Update(ctx, user)
	}

	return nil
}

func (s *accountLockService) UnlockAccount(ctx context.Context, email string) error {
	// 清除 Redis 锁定
	lockKey := keyPrefixAccountLock + hashEmail(email)
	failKey := keyPrefixAccountFail + hashEmail(email)

	pipe := s.redisClient.Pipeline()
	pipe.Del(ctx, lockKey)
	pipe.Del(ctx, failKey)
	_, err := pipe.Exec(ctx)
	if err != nil {
		return err
	}

	// 清除数据库锁定
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
	lockKey := keyPrefixIPLock + ip
	failKey := keyPrefixIPFail + ip

	pipe := s.redisClient.Pipeline()
	pipe.Del(ctx, lockKey)
	pipe.Del(ctx, failKey)
	_, err := pipe.Exec(ctx)
	return err
}

func (s *accountLockService) GetIPFailCount(ctx context.Context, ip string) (int, error) {
	key := keyPrefixIPFail + ip
	result, err := s.redisClient.Get(ctx, key).Int()
	if err == redis.Nil {
		return 0, nil
	}
	return result, err
}

func (s *accountLockService) GetAccountFailCount(ctx context.Context, email string) (int, error) {
	key := keyPrefixAccountFail + hashEmail(email)
	result, err := s.redisClient.Get(ctx, key).Int()
	if err == redis.Nil {
		return 0, nil
	}
	return result, err
}
