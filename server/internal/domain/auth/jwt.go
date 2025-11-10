package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

var (
	ErrInvalidToken   = errors.New("invalid token")
	ErrExpiredToken   = errors.New("token expired")
	ErrTokenBlacklisted = errors.New("token has been blacklisted")
)

// Claims JWT 声明
type Claims struct {
	UserID         uuid.UUID `json:"user_id"`
	Username       string    `json:"username"`
	Email          string    `json:"email"`
	Role           UserRole  `json:"role"`
	TokenFamily    string    `json:"token_family,omitempty"`     // 令牌家族ID（用于轮换）
	TokenVersion   int       `json:"token_version,omitempty"`    // 令牌版本号
	AbsoluteExpiry int64     `json:"absolute_expiry,omitempty"`  // 绝对过期时间戳
	LastUsed       int64     `json:"last_used,omitempty"`        // 最后使用时间戳
	jwt.RegisteredClaims
}

// JWTService JWT 服务接口
type JWTService interface {
	// GenerateTokens 生成访问令牌和刷新令牌
	GenerateTokens(user *User) (accessToken, refreshToken string, err error)

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
	secretKey                 []byte
	accessTokenDuration       time.Duration
	refreshIdleExpireDuration time.Duration // 闲置过期时间
	refreshAbsoluteExpireDuration time.Duration // 绝对过期时间
	refreshRotate             bool          // 是否启用令牌轮换
	refreshReuseDetection     bool          // 是否启用复用检测
	redisClient               *redis.Client
}

// JWTConfig JWT 配置
type JWTConfig struct {
	SecretKey                 string
	AccessTokenDuration       time.Duration
	RefreshIdleExpireDuration time.Duration // 闲置过期时间
	RefreshAbsoluteExpireDuration time.Duration // 绝对过期时间
	RefreshRotate             bool          // 是否启用令牌轮换
	RefreshReuseDetection     bool          // 是否启用复用检测
}

// NewJWTService 创建 JWT 服务
func NewJWTService(config JWTConfig, redisClient *redis.Client) JWTService {
	return &jwtService{
		secretKey:                 []byte(config.SecretKey),
		accessTokenDuration:       config.AccessTokenDuration,
		refreshIdleExpireDuration: config.RefreshIdleExpireDuration,
		refreshAbsoluteExpireDuration: config.RefreshAbsoluteExpireDuration,
		refreshRotate:             config.RefreshRotate,
		refreshReuseDetection:     config.RefreshReuseDetection,
		redisClient:               redisClient,
	}
}

func (s *jwtService) GenerateTokens(user *User) (string, string, error) {
	now := time.Now()

	// 生成令牌家族ID（用于轮换检测）
	tokenFamily := uuid.New().String()

	// 计算绝对过期时间
	absoluteExpiry := now.Add(s.refreshAbsoluteExpireDuration).Unix()

	// 生成访问令牌（不包含刷新令牌特有字段）
	accessToken, err := s.generateAccessToken(user, now)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate access token: %w", err)
	}

	// 生成刷新令牌（包含滑动过期和轮换字段）
	refreshToken, err := s.generateRefreshToken(user, now, tokenFamily, 1, absoluteExpiry)
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

func (s *jwtService) generateAccessToken(user *User, now time.Time) (string, error) {
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

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.secretKey)
}

func (s *jwtService) generateRefreshToken(user *User, now time.Time, tokenFamily string, version int, absoluteExpiry int64) (string, error) {
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
			return nil, errors.New("token family has been revoked")
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
		usedKey := fmt.Sprintf("used_token:%s:v%d", claims.TokenFamily, claims.TokenVersion)
		exists, err := s.redisClient.Exists(ctx, usedKey).Result()
		if err != nil {
			return "", "", fmt.Errorf("failed to check token reuse: %w", err)
		}
		if exists > 0 {
			// 令牌被重复使用！这是安全威胁，立即撤销整个令牌家族
			s.revokeTokenFamily(claims.TokenFamily)
			return "", "", errors.New("refresh token reuse detected - all tokens in this family have been revoked")
		}

		// 标记此令牌已被使用
		ttl := time.Until(time.Unix(claims.AbsoluteExpiry, 0))
		if ttl > 0 {
			err = s.redisClient.Set(ctx, usedKey, "1", ttl).Err()
			if err != nil {
				return "", "", fmt.Errorf("failed to mark token as used: %w", err)
			}
		}
	}

	// 构造用户对象
	user := &User{
		ID:       claims.UserID,
		Username: claims.Username,
		Email:    claims.Email,
		Role:     claims.Role,
	}

	// 生成新的访问令牌
	newAccessToken, err := s.generateAccessToken(user, now)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate new access token: %w", err)
	}

	// 如果启用了令牌轮换，生成新的刷新令牌
	if s.refreshRotate && claims.TokenFamily != "" {
		// 生成新版本的刷新令牌
		newRefreshToken, err := s.generateRefreshToken(
			user,
			now,
			claims.TokenFamily,      // 保持相同的家族ID
			claims.TokenVersion+1,   // 版本号+1
			claims.AbsoluteExpiry,   // 保持相同的绝对过期时间
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

// revokeTokenFamily 撤销整个令牌家族（用于复用检测）
func (s *jwtService) revokeTokenFamily(tokenFamily string) {
	ctx := context.Background()
	familyKey := fmt.Sprintf("token_family:%s", tokenFamily)

	// 标记令牌家族为已撤销
	revokedKey := fmt.Sprintf("revoked_family:%s", tokenFamily)
	_ = s.redisClient.Set(ctx, revokedKey, "1", s.refreshAbsoluteExpireDuration).Err()

	// 删除令牌家族
	_ = s.redisClient.Del(ctx, familyKey).Err()
}

func (s *jwtService) BlacklistToken(tokenString string, expiration time.Duration) error {
	ctx := context.Background()
	key := fmt.Sprintf("blacklist:%s", tokenString)
	return s.redisClient.Set(ctx, key, "1", expiration).Err()
}

func (s *jwtService) IsBlacklisted(tokenString string) (bool, error) {
	ctx := context.Background()
	key := fmt.Sprintf("blacklist:%s", tokenString)

	result, err := s.redisClient.Get(ctx, key).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return false, nil
		}
		return false, err
	}

	return result == "1", nil
}

// GenerateTempToken 生成临时令牌（用于 2FA 验证，有效期 5 分钟）
func (s *jwtService) GenerateTempToken(userID string) (string, error) {
	now := time.Now()
	claims := jwt.RegisteredClaims{
		ExpiresAt: jwt.NewNumericDate(now.Add(5 * time.Minute)), // 5 分钟有效期
		IssuedAt:  jwt.NewNumericDate(now),
		NotBefore: jwt.NewNumericDate(now),
		Issuer:    "easyssh-api",
		Subject:   userID,
		Audience:  jwt.ClaimStrings{"2fa-verification"}, // 特殊标记
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.secretKey)
}

// ValidateTempToken 验证临时令牌并返回用户 ID
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

	return claims.Subject, nil
}
