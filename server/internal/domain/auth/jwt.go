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
	UserID   uuid.UUID `json:"user_id"`
	Username string    `json:"username"`
	Email    string    `json:"email"`
	Role     UserRole  `json:"role"`
	jwt.RegisteredClaims
}

// JWTService JWT 服务接口
type JWTService interface {
	// GenerateTokens 生成访问令牌和刷新令牌
	GenerateTokens(user *User) (accessToken, refreshToken string, err error)

	// ValidateToken 验证令牌
	ValidateToken(tokenString string) (*Claims, error)

	// RefreshToken 刷新令牌
	RefreshToken(refreshToken string) (accessToken string, err error)

	// BlacklistToken 将令牌加入黑名单
	BlacklistToken(tokenString string, expiration time.Duration) error

	// IsBlacklisted 检查令牌是否在黑名单中
	IsBlacklisted(tokenString string) (bool, error)
}

// jwtService JWT 服务实现
type jwtService struct {
	secretKey            []byte
	accessTokenDuration  time.Duration
	refreshTokenDuration time.Duration
	redisClient          *redis.Client
}

// JWTConfig JWT 配置
type JWTConfig struct {
	SecretKey            string
	AccessTokenDuration  time.Duration
	RefreshTokenDuration time.Duration
}

// NewJWTService 创建 JWT 服务
func NewJWTService(config JWTConfig, redisClient *redis.Client) JWTService {
	return &jwtService{
		secretKey:            []byte(config.SecretKey),
		accessTokenDuration:  config.AccessTokenDuration,
		refreshTokenDuration: config.RefreshTokenDuration,
		redisClient:          redisClient,
	}
}

func (s *jwtService) GenerateTokens(user *User) (string, string, error) {
	// 生成访问令牌
	accessToken, err := s.generateToken(user, s.accessTokenDuration)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate access token: %w", err)
	}

	// 生成刷新令牌
	refreshToken, err := s.generateToken(user, s.refreshTokenDuration)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate refresh token: %w", err)
	}

	return accessToken, refreshToken, nil
}

func (s *jwtService) generateToken(user *User, duration time.Duration) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID:   user.ID,
		Username: user.Username,
		Email:    user.Email,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(duration)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Issuer:    "easyssh-api",
			Subject:   user.ID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.secretKey)
}

func (s *jwtService) ValidateToken(tokenString string) (*Claims, error) {
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

	return claims, nil
}

func (s *jwtService) RefreshToken(refreshToken string) (string, error) {
	// 验证刷新令牌
	claims, err := s.ValidateToken(refreshToken)
	if err != nil {
		return "", err
	}

	// 查找用户（这里简化处理，实际应该注入 repository）
	user := &User{
		ID:       claims.UserID,
		Username: claims.Username,
		Email:    claims.Email,
		Role:     claims.Role,
	}

	// 生成新的访问令牌
	newAccessToken, err := s.generateToken(user, s.accessTokenDuration)
	if err != nil {
		return "", fmt.Errorf("failed to generate new access token: %w", err)
	}

	return newAccessToken, nil
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
