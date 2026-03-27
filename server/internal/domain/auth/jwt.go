package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

var (
	ErrInvalidToken       = errors.New("invalid token")
	ErrExpiredToken       = errors.New("token expired")
	ErrTokenBlacklisted   = errors.New("token has been blacklisted")
	ErrTokenFamilyRevoked = errors.New("token family has been revoked")
	ErrTokenReuseDetected = errors.New("refresh token reuse detected")
)

// Claims JWT 声明
type Claims struct {
	UserID         uuid.UUID `json:"user_id"`
	Username       string    `json:"username"`
	Email          string    `json:"email"`
	Role           UserRole  `json:"role"`
	SessionID      uuid.UUID `json:"session_id,omitempty"`      // 会话ID（用于标记当前会话）
	TokenFamily    string    `json:"token_family,omitempty"`    // 令牌家族ID（用于轮换）
	TokenVersion   int       `json:"token_version,omitempty"`   // 令牌版本号
	AbsoluteExpiry int64     `json:"absolute_expiry,omitempty"` // 绝对过期时间戳
	LastUsed       int64     `json:"last_used,omitempty"`       // 最后使用时间戳
	jwt.RegisteredClaims
}

// JWTService JWT 服务接口
type JWTService interface {
	// GenerateTokens 生成访问令牌和刷新令牌
	GenerateTokens(user *User) (accessToken, refreshToken string, err error)

	// GenerateTokensForSession 为指定会话生成访问令牌和刷新令牌（在 access_token 中包含 session_id）
	GenerateTokensForSession(user *User, sessionID uuid.UUID) (accessToken, refreshToken string, err error)

	// ValidateToken 验证令牌
	ValidateToken(tokenString string) (*Claims, error)

	// RefreshToken 刷新令牌（返回新的访问令牌和刷新令牌）
	RefreshToken(refreshToken string) (accessToken, newRefreshToken string, err error)

	// BlacklistToken 将令牌加入黑名单
	BlacklistToken(tokenString string, expiration time.Duration) error

	// IsBlacklisted 检查令牌是否在黑名单中
	IsBlacklisted(tokenString string) (bool, error)

	// GenerateTempToken 生成临时令牌（用于 2FA 验证）
	GenerateTempToken(userID string) (string, error)

	// ValidateTempToken 验证临时令牌
	ValidateTempToken(tokenString string) (string, error)
}

// jwtService JWT 服务实现
type jwtService struct {
	secretKey                     []byte
	accessTokenDuration           time.Duration
	refreshIdleExpireDuration     time.Duration // 闲置过期时间
	refreshAbsoluteExpireDuration time.Duration // 绝对过期时间
	refreshRotate                 bool          // 是否启用令牌轮换
	refreshReuseDetection         bool          // 是否启用复用检测
	redisClient                   *redis.Client
}

// JWTConfig JWT 配置
type JWTConfig struct {
	SecretKey                     string
	AccessTokenDuration           time.Duration
	RefreshIdleExpireDuration     time.Duration // 闲置过期时间
	RefreshAbsoluteExpireDuration time.Duration // 绝对过期时间
	RefreshRotate                 bool          // 是否启用令牌轮换
	RefreshReuseDetection         bool          // 是否启用复用检测
}

// markRefreshTokenUsedScript 以原子方式处理 refresh token 复用检测。
// 返回值：
// - "ok"：首次使用，已成功标记
// - "family_revoked"：该 token family 已被撤销
// - "reuse_detected"：检测到同一 refresh token 被重复使用，脚本已撤销整个 family
var markRefreshTokenUsedScript = redis.NewScript(`
	local revokedKey = KEYS[1]
	local usedKey = KEYS[2]
	local familyKey = KEYS[3]
	local ttl = tonumber(ARGV[1])

	if redis.call('EXISTS', revokedKey) == 1 then
		return "family_revoked"
	end

	if redis.call('SETNX', usedKey, "1") == 1 then
		if ttl and ttl > 0 then
			redis.call('EXPIRE', usedKey, ttl)
		end
		return "ok"
	end

	if ttl and ttl > 0 then
		redis.call('SET', revokedKey, "1", 'EX', ttl)
	else
		redis.call('SET', revokedKey, "1")
	end
	redis.call('DEL', familyKey)
	return "reuse_detected"
`)

// NewJWTService 创建 JWT 服务
func NewJWTService(config JWTConfig, redisClient *redis.Client) JWTService {
	return &jwtService{
		secretKey:                     []byte(config.SecretKey),
		accessTokenDuration:           config.AccessTokenDuration,
		refreshIdleExpireDuration:     config.RefreshIdleExpireDuration,
		refreshAbsoluteExpireDuration: config.RefreshAbsoluteExpireDuration,
		refreshRotate:                 config.RefreshRotate,
		refreshReuseDetection:         config.RefreshReuseDetection,
		redisClient:                   redisClient,
	}
}

func (s *jwtService) GenerateTokens(user *User) (string, string, error) {
	now := time.Now()

	// 生成令牌家族ID（用于轮换检测）
	tokenFamily := uuid.New().String()

	// 计算绝对过期时间
	absoluteExpiry := now.Add(s.refreshAbsoluteExpireDuration).Unix()

	// 生成访问令牌（不包含会话标识，适用于不需要会话管理的场景）
	accessToken, err := s.generateAccessToken(user, now, nil)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate access token: %w", err)
	}

	// 生成刷新令牌（包含滑动过期和轮换字段，不绑定会话）
	refreshToken, err := s.generateRefreshToken(user, now, tokenFamily, 1, absoluteExpiry, nil)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate refresh token: %w", err)
	}

	// 如果启用了轮换，存储令牌家族信息到Redis
	if s.refreshRotate {
		ctx := context.Background()
		familyKey := fmt.Sprintf("token_family:%s", tokenFamily)
		// 存储令牌家族信息，过期时间为绝对过期时间
		err = s.redisClient.Set(ctx, familyKey, "1", s.refreshAbsoluteExpireDuration).Err()
		if err != nil {
			return "", "", fmt.Errorf("failed to store token family: %w", err)
		}
	}

	return accessToken, refreshToken, nil
}

// GenerateTokensForSession 为指定会话生成访问/刷新令牌（在 access_token 中嵌入 session_id）
func (s *jwtService) GenerateTokensForSession(user *User, sessionID uuid.UUID) (string, string, error) {
	now := time.Now()

	// 生成令牌家族ID（用于轮换检测）
	tokenFamily := uuid.New().String()

	// 计算绝对过期时间
	absoluteExpiry := now.Add(s.refreshAbsoluteExpireDuration).Unix()

	// 生成包含 session_id 的访问令牌
	accessToken, err := s.generateAccessToken(user, now, &sessionID)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate access token: %w", err)
	}

	// 生成刷新令牌（写入相同的 session_id，用于后续刷新时保持会话关联）
	refreshToken, err := s.generateRefreshToken(user, now, tokenFamily, 1, absoluteExpiry, &sessionID)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate refresh token: %w", err)
	}

	// 如果启用了轮换，存储令牌家族信息到Redis
	if s.refreshRotate {
		ctx := context.Background()
		familyKey := fmt.Sprintf("token_family:%s", tokenFamily)
		// 存储令牌家族信息，过期时间为绝对过期时间
		err = s.redisClient.Set(ctx, familyKey, "1", s.refreshAbsoluteExpireDuration).Err()
		if err != nil {
			return "", "", fmt.Errorf("failed to store token family: %w", err)
		}
	}

	return accessToken, refreshToken, nil
}

// generateAccessToken 生成访问令牌，可选包含 session_id
func (s *jwtService) generateAccessToken(user *User, now time.Time, sessionID *uuid.UUID) (string, error) {
	claims := Claims{
		UserID:   user.ID,
		Username: user.Username,
		Email:    user.Email,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(s.accessTokenDuration)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Issuer:    "easyssh-api",
			Subject:   user.ID.String(),
		},
	}

	// 可选设置会话ID
	if sessionID != nil {
		claims.SessionID = *sessionID
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.secretKey)
}

func (s *jwtService) generateRefreshToken(user *User, now time.Time, tokenFamily string, version int, absoluteExpiry int64, sessionID *uuid.UUID) (string, error) {
	// 刷新令牌的过期时间使用闲置过期时间
	claims := Claims{
		UserID:         user.ID,
		Username:       user.Username,
		Email:          user.Email,
		Role:           user.Role,
		TokenFamily:    tokenFamily,
		TokenVersion:   version,
		AbsoluteExpiry: absoluteExpiry,
		LastUsed:       now.Unix(),
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(s.refreshIdleExpireDuration)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Issuer:    "easyssh-api",
			Subject:   user.ID.String(),
			Audience:  jwt.ClaimStrings{"refresh"}, // 标记为刷新令牌
		},
	}

	// 将会话ID也写入刷新令牌（用于刷新时保持与会话表的关联）
	if sessionID != nil {
		claims.SessionID = *sessionID
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.secretKey)
}

func (s *jwtService) ValidateToken(tokenString string) (*Claims, error) {
	ctx := context.Background()

	// 检查令牌是否在黑名单中
	blacklisted, err := s.IsBlacklisted(tokenString)
	if err != nil {
		return nil, err
	}
	if blacklisted {
		return nil, ErrTokenBlacklisted
	}

	// 解析令牌
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		// 验证签名方法
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.secretKey, nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrExpiredToken
		}
		return nil, ErrInvalidToken
	}

	if !token.Valid {
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(*Claims)
	if !ok {
		return nil, ErrInvalidToken
	}

	// 如果启用了复用检测，检查令牌家族是否被撤销
	if s.refreshReuseDetection && claims.TokenFamily != "" {
		revokedKey := fmt.Sprintf("revoked_family:%s", claims.TokenFamily)
		exists, err := s.redisClient.Exists(ctx, revokedKey).Result()
		if err == nil && exists > 0 {
			return nil, ErrTokenFamilyRevoked
		}
	}

	return claims, nil
}

func (s *jwtService) RefreshToken(refreshToken string) (string, string, error) {
	ctx := context.Background()
	now := time.Now()

	// 验证刷新令牌
	claims, err := s.ValidateToken(refreshToken)
	if err != nil {
		return "", "", err
	}

	// 验证是否是刷新令牌
	if len(claims.Audience) == 0 || claims.Audience[0] != "refresh" {
		return "", "", errors.New("not a refresh token")
	}

	// 检查绝对过期时间
	if claims.AbsoluteExpiry > 0 && now.Unix() > claims.AbsoluteExpiry {
		return "", "", errors.New("refresh token has reached absolute expiration")
	}

	// 检查闲置过期（当前时间 - 最后使用时间 > 闲置时间）
	if claims.LastUsed > 0 {
		idleTime := now.Unix() - claims.LastUsed
		if idleTime > int64(s.refreshIdleExpireDuration.Seconds()) {
			return "", "", errors.New("refresh token has been idle for too long")
		}
	}

	// 复用检测：检查令牌是否已被使用过
	if s.refreshReuseDetection && claims.TokenFamily != "" {
		ttl := time.Until(time.Unix(claims.AbsoluteExpiry, 0))
		if ttl <= 0 {
			return "", "", ErrExpiredToken
		}

		ttlSeconds := int64(ttl / time.Second)
		if ttlSeconds < 1 {
			ttlSeconds = 1
		}

		revokedKey := fmt.Sprintf("revoked_family:%s", claims.TokenFamily)
		usedKey := fmt.Sprintf("used_token:%s:v%d", claims.TokenFamily, claims.TokenVersion)
		familyKey := fmt.Sprintf("token_family:%s", claims.TokenFamily)

		result, err := markRefreshTokenUsedScript.Run(
			ctx,
			s.redisClient,
			[]string{revokedKey, usedKey, familyKey},
			ttlSeconds,
		).Result()
		if err != nil {
			return "", "", fmt.Errorf("failed to enforce token reuse detection: %w", err)
		}

		status, ok := result.(string)
		if !ok {
			return "", "", fmt.Errorf("failed to parse token reuse detection result")
		}

		switch status {
		case "ok":
		case "family_revoked":
			return "", "", ErrTokenFamilyRevoked
		case "reuse_detected":
			return "", "", ErrTokenReuseDetected
		default:
			return "", "", fmt.Errorf("unexpected token reuse detection result: %s", status)
		}
	}

	// 构造用户对象
	user := &User{
		ID:       claims.UserID,
		Username: claims.Username,
		Email:    claims.Email,
		Role:     claims.Role,
	}

	// 生成新的访问令牌，沿用刷新令牌中的会话ID（如果存在）
	var sessionIDPtr *uuid.UUID
	if claims.SessionID != (uuid.UUID{}) {
		sid := claims.SessionID
		sessionIDPtr = &sid
	}
	newAccessToken, err := s.generateAccessToken(user, now, sessionIDPtr)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate new access token: %w", err)
	}

	// 如果启用了令牌轮换，生成新的刷新令牌
	if s.refreshRotate && claims.TokenFamily != "" {
		// 生成新版本的刷新令牌
		newRefreshToken, err := s.generateRefreshToken(
			user,
			now,
			claims.TokenFamily,    // 保持相同的家族ID
			claims.TokenVersion+1, // 版本号+1
			claims.AbsoluteExpiry, // 保持相同的绝对过期时间
			sessionIDPtr,          // 保持相同的会话ID（如有）
		)
		if err != nil {
			return "", "", fmt.Errorf("failed to generate new refresh token: %w", err)
		}

		// 将旧的刷新令牌加入黑名单
		ttl := time.Until(time.Unix(claims.AbsoluteExpiry, 0))
		if ttl > 0 {
			_ = s.BlacklistToken(refreshToken, ttl)
		}

		// 返回新的访问令牌和刷新令牌
		return newAccessToken, newRefreshToken, nil
	}

	// 未启用轮换时，只返回新的访问令牌，刷新令牌返回空字符串
	return newAccessToken, "", nil
}

// hashTokenForKey 计算令牌的 SHA-256 哈希，用于 Redis Key（避免完整令牌作为 Key 影响性能）
func hashTokenForKey(tokenString string) string {
	hash := sha256.Sum256([]byte(tokenString))
	return hex.EncodeToString(hash[:])
}

func (s *jwtService) BlacklistToken(tokenString string, expiration time.Duration) error {
	ctx := context.Background()
	// 使用令牌的 SHA-256 哈希作为 Key，避免完整令牌过长影响 Redis 性能
	key := fmt.Sprintf("blacklist:%s", hashTokenForKey(tokenString))
	return s.redisClient.Set(ctx, key, "1", expiration).Err()
}

func (s *jwtService) IsBlacklisted(tokenString string) (bool, error) {
	ctx := context.Background()
	// 使用令牌的 SHA-256 哈希作为 Key，与 BlacklistToken 保持一致
	key := fmt.Sprintf("blacklist:%s", hashTokenForKey(tokenString))

	result, err := s.redisClient.Get(ctx, key).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return false, nil
		}
		return false, err
	}

	return result == "1", nil
}

// GenerateTempToken 生成临时令牌（用于 2FA 验证，有效期 5 分钟，存储在 Redis）
func (s *jwtService) GenerateTempToken(userID string) (string, error) {
	now := time.Now()

	// 生成唯一的 token ID
	tokenID := uuid.New().String()

	claims := jwt.RegisteredClaims{
		ID:        tokenID,                                      // JWT ID，用于 Redis 存储
		ExpiresAt: jwt.NewNumericDate(now.Add(5 * time.Minute)), // 5 分钟有效期
		IssuedAt:  jwt.NewNumericDate(now),
		NotBefore: jwt.NewNumericDate(now),
		Issuer:    "easyssh-api",
		Subject:   userID,
		Audience:  jwt.ClaimStrings{"2fa-verification"}, // 特殊标记
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(s.secretKey)
	if err != nil {
		return "", err
	}

	// 将 token ID 存储到 Redis（用于一次性使用验证）
	ctx := context.Background()
	key := fmt.Sprintf("2fa_token:%s", tokenID)
	if err := s.redisClient.Set(ctx, key, userID, 5*time.Minute).Err(); err != nil {
		return "", fmt.Errorf("failed to store 2FA token in Redis: %w", err)
	}

	return tokenString, nil
}

// validate2FATokenScript Lua 脚本：原子性验证并删除 2FA 临时令牌
// 返回值：
// - 成功：返回 userID
// - 失败：返回空字符串
// 参数：
// - KEYS[1]: token key (2fa_token:<token_id>)
// - ARGV[1]: 期望的 userID（从 JWT 解析）
var validate2FATokenScript = redis.NewScript(`
	local key = KEYS[1]
	local expectedUserID = ARGV[1]

	-- 获取当前值
	local storedUserID = redis.call('GET', key)

	-- 如果不存在或已过期，返回空
	if not storedUserID then
		return ""
	end

	-- 验证 userID 是否匹配
	if storedUserID ~= expectedUserID then
		return ""
	end

	-- 原子性删除并返回 userID
	redis.call('DEL', key)
	return storedUserID
`)

// ValidateTempToken 验证临时令牌并返回用户 ID
// 使用 Redis Lua 脚本实现原子性验证+删除，防止竞态条件下的令牌复用
func (s *jwtService) ValidateTempToken(tokenString string) (string, error) {
	token, err := jwt.ParseWithClaims(tokenString, &jwt.RegisteredClaims{}, func(token *jwt.Token) (interface{}, error) {
		// 验证签名算法
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.secretKey, nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return "", ErrExpiredToken
		}
		return "", ErrInvalidToken
	}

	if !token.Valid {
		return "", ErrInvalidToken
	}

	claims, ok := token.Claims.(*jwt.RegisteredClaims)
	if !ok {
		return "", ErrInvalidToken
	}

	// 验证是否是 2FA 临时令牌
	if len(claims.Audience) == 0 || claims.Audience[0] != "2fa-verification" {
		return "", errors.New("not a 2FA temp token")
	}

	// 使用 Lua 脚本原子性地验证并删除 token
	// 这确保了即使在高并发场景下，每个 token 也只能被使用一次
	ctx := context.Background()
	key := fmt.Sprintf("2fa_token:%s", claims.ID)

	result, err := validate2FATokenScript.Run(ctx, s.redisClient, []string{key}, claims.Subject).Result()
	if err != nil {
		return "", fmt.Errorf("failed to verify 2FA token in Redis: %w", err)
	}

	userID, ok := result.(string)
	if !ok || userID == "" {
		return "", errors.New("2FA token has already been used or expired")
	}

	return userID, nil
}
