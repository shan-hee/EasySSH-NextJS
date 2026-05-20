package auth

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/easyssh/server/internal/pkg/ttlcache"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
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
	GenerateTokens(user *User) (accessToken, refreshToken string, err error)
	GenerateTokensForSession(user *User, sessionID uuid.UUID) (accessToken, refreshToken string, err error)
	ValidateToken(tokenString string) (*Claims, error)
	RefreshToken(refreshToken string) (accessToken, newRefreshToken string, err error)
	RefreshTokenWithinGrace(refreshToken string) (accessToken string, err error)
	BlacklistToken(tokenString string, expiration time.Duration) error
	IsBlacklisted(tokenString string) (bool, error)
	GenerateTempToken(userID string) (string, error)
	ValidateTempToken(tokenString string) (string, error)
}

type jwtService struct {
	secretKey                     []byte
	accessTokenDuration           time.Duration
	refreshIdleExpireDuration     time.Duration
	refreshAbsoluteExpireDuration time.Duration
	refreshRotate                 bool
	refreshReuseDetection         bool

	blacklistedTokens *ttlcache.Cache[string]
	usedRefreshTokens *ttlcache.Cache[string]
	revokedFamilies   *ttlcache.Cache[string]
	tempTokens        *ttlcache.Cache[string]
}

// JWTConfig JWT 配置
type JWTConfig struct {
	SecretKey                     string
	AccessTokenDuration           time.Duration
	RefreshIdleExpireDuration     time.Duration
	RefreshAbsoluteExpireDuration time.Duration
	RefreshRotate                 bool
	RefreshReuseDetection         bool
}

// NewJWTService 创建 JWT 服务。
func NewJWTService(config JWTConfig) JWTService {
	return &jwtService{
		secretKey:                     []byte(config.SecretKey),
		accessTokenDuration:           config.AccessTokenDuration,
		refreshIdleExpireDuration:     config.RefreshIdleExpireDuration,
		refreshAbsoluteExpireDuration: config.RefreshAbsoluteExpireDuration,
		refreshRotate:                 config.RefreshRotate,
		refreshReuseDetection:         config.RefreshReuseDetection,
		blacklistedTokens:             ttlcache.New[string](time.Minute),
		usedRefreshTokens:             ttlcache.New[string](time.Minute),
		revokedFamilies:               ttlcache.New[string](time.Minute),
		tempTokens:                    ttlcache.New[string](time.Minute),
	}
}

func (s *jwtService) GenerateTokens(user *User) (string, string, error) {
	return s.generateTokenPair(user, nil, time.Now(), uuid.New().String(), 1, 0)
}

// GenerateTokensForSession 为指定会话生成访问/刷新令牌（在 access_token 中嵌入 session_id）
func (s *jwtService) GenerateTokensForSession(user *User, sessionID uuid.UUID) (string, string, error) {
	return s.generateTokenPair(user, &sessionID, time.Now(), uuid.New().String(), 1, 0)
}

func (s *jwtService) generateTokenPair(user *User, sessionID *uuid.UUID, now time.Time, tokenFamily string, version int, absoluteExpiry int64) (string, string, error) {
	if absoluteExpiry <= 0 {
		absoluteExpiry = now.Add(s.refreshAbsoluteExpireDuration).Unix()
	}

	accessToken, err := s.generateAccessToken(user, now, sessionID)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate access token: %w", err)
	}

	refreshToken, err := s.generateRefreshToken(user, now, tokenFamily, version, absoluteExpiry, sessionID)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate refresh token: %w", err)
	}

	return accessToken, refreshToken, nil
}

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

	if sessionID != nil {
		claims.SessionID = *sessionID
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.secretKey)
}

func (s *jwtService) generateRefreshToken(user *User, now time.Time, tokenFamily string, version int, absoluteExpiry int64, sessionID *uuid.UUID) (string, error) {
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
			Audience:  jwt.ClaimStrings{"refresh"},
		},
	}

	if sessionID != nil {
		claims.SessionID = *sessionID
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.secretKey)
}

func (s *jwtService) ValidateToken(tokenString string) (*Claims, error) {
	return s.validateToken(tokenString, true)
}

func (s *jwtService) validateToken(tokenString string, checkBlacklist bool) (*Claims, error) {
	if checkBlacklist {
		blacklisted, err := s.IsBlacklisted(tokenString)
		if err != nil {
			return nil, err
		}
		if blacklisted {
			return nil, ErrTokenBlacklisted
		}
	}

	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
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

	if s.refreshReuseDetection && claims.TokenFamily != "" && s.revokedFamilies.Exists(claims.TokenFamily) {
		return nil, ErrTokenFamilyRevoked
	}

	return claims, nil
}

func (s *jwtService) validateRefreshClaims(claims *Claims, now time.Time) error {
	if len(claims.Audience) == 0 || claims.Audience[0] != "refresh" {
		return errors.New("not a refresh token")
	}

	if claims.AbsoluteExpiry > 0 && now.Unix() > claims.AbsoluteExpiry {
		return errors.New("refresh token has reached absolute expiration")
	}

	if claims.LastUsed > 0 {
		idleTime := now.Unix() - claims.LastUsed
		if idleTime > int64(s.refreshIdleExpireDuration.Seconds()) {
			return errors.New("refresh token has been idle for too long")
		}
	}

	return nil
}

func (s *jwtService) RefreshToken(refreshToken string) (string, string, error) {
	now := time.Now()

	claims, err := s.ValidateToken(refreshToken)
	if err != nil {
		return "", "", err
	}

	if err := s.validateRefreshClaims(claims, now); err != nil {
		return "", "", err
	}

	if s.refreshReuseDetection && claims.TokenFamily != "" {
		ttl := time.Until(time.Unix(claims.AbsoluteExpiry, 0))
		if ttl <= 0 {
			return "", "", ErrExpiredToken
		}

		usedKey := fmt.Sprintf("%s:v%d", claims.TokenFamily, claims.TokenVersion)
		if s.usedRefreshTokens.Exists(usedKey) {
			s.revokedFamilies.Set(claims.TokenFamily, "1", ttl)
			return "", "", ErrTokenReuseDetected
		}
		s.usedRefreshTokens.Set(usedKey, "1", ttl)
	}

	user := &User{
		ID:       claims.UserID,
		Username: claims.Username,
		Email:    claims.Email,
		Role:     claims.Role,
	}

	var sessionIDPtr *uuid.UUID
	if claims.SessionID != (uuid.UUID{}) {
		sid := claims.SessionID
		sessionIDPtr = &sid
	}

	newAccessToken, err := s.generateAccessToken(user, now, sessionIDPtr)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate new access token: %w", err)
	}

	if s.refreshRotate && claims.TokenFamily != "" {
		newRefreshToken, err := s.generateRefreshToken(
			user,
			now,
			claims.TokenFamily,
			claims.TokenVersion+1,
			claims.AbsoluteExpiry,
			sessionIDPtr,
		)
		if err != nil {
			return "", "", fmt.Errorf("failed to generate new refresh token: %w", err)
		}

		ttl := time.Until(time.Unix(claims.AbsoluteExpiry, 0))
		if ttl > 0 {
			_ = s.BlacklistToken(refreshToken, ttl)
		}

		return newAccessToken, newRefreshToken, nil
	}

	return newAccessToken, "", nil
}

// RefreshTokenWithinGrace 为短暂并发刷新宽限场景签发新的 access_token。
// 该路径仍校验 refresh token 的签名、类型和过期时间，但跳过黑名单/已使用缓存，
// 避免同一浏览器多标签页同时刷新时把合法旧 token 误判为复用攻击。
func (s *jwtService) RefreshTokenWithinGrace(refreshToken string) (string, error) {
	now := time.Now()

	claims, err := s.validateToken(refreshToken, false)
	if err != nil {
		return "", err
	}
	if err := s.validateRefreshClaims(claims, now); err != nil {
		return "", err
	}

	user := &User{
		ID:       claims.UserID,
		Username: claims.Username,
		Email:    claims.Email,
		Role:     claims.Role,
	}

	var sessionIDPtr *uuid.UUID
	if claims.SessionID != (uuid.UUID{}) {
		sid := claims.SessionID
		sessionIDPtr = &sid
	}

	return s.generateAccessToken(user, now, sessionIDPtr)
}

func hashTokenForKey(tokenString string) string {
	hash := sha256.Sum256([]byte(tokenString))
	return hex.EncodeToString(hash[:])
}

func (s *jwtService) BlacklistToken(tokenString string, expiration time.Duration) error {
	if tokenString == "" {
		return nil
	}
	s.blacklistedTokens.Set(hashTokenForKey(tokenString), "1", expiration)
	return nil
}

func (s *jwtService) IsBlacklisted(tokenString string) (bool, error) {
	if tokenString == "" {
		return false, nil
	}
	return s.blacklistedTokens.Exists(hashTokenForKey(tokenString)), nil
}

// GenerateTempToken 生成临时令牌（用于 2FA 验证，有效期 5 分钟，一次性使用）
func (s *jwtService) GenerateTempToken(userID string) (string, error) {
	now := time.Now()
	tokenID := uuid.New().String()

	claims := jwt.RegisteredClaims{
		ID:        tokenID,
		ExpiresAt: jwt.NewNumericDate(now.Add(5 * time.Minute)),
		IssuedAt:  jwt.NewNumericDate(now),
		NotBefore: jwt.NewNumericDate(now),
		Issuer:    "easyssh-api",
		Subject:   userID,
		Audience:  jwt.ClaimStrings{"2fa-verification"},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(s.secretKey)
	if err != nil {
		return "", err
	}

	s.tempTokens.Set(tokenID, userID, 5*time.Minute)
	return tokenString, nil
}

// ValidateTempToken 验证临时令牌并返回用户 ID。
func (s *jwtService) ValidateTempToken(tokenString string) (string, error) {
	token, err := jwt.ParseWithClaims(tokenString, &jwt.RegisteredClaims{}, func(token *jwt.Token) (interface{}, error) {
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
	if len(claims.Audience) == 0 || claims.Audience[0] != "2fa-verification" {
		return "", errors.New("not a 2FA temp token")
	}

	userID, ok := s.tempTokens.Consume(claims.ID)
	if !ok || userID == "" || userID != claims.Subject {
		return "", errors.New("2FA token has already been used or expired")
	}

	return userID, nil
}
