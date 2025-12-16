package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

type RedisTicketConfig struct {
	Prefix string
	TTL    time.Duration
}

type redisTicketService struct {
	client *redis.Client
	prefix string
	ttl    time.Duration
}

type redisTicketRecord struct {
	UserID    string   `json:"user_id"`
	Username  string   `json:"username"`
	Email     string   `json:"email"`
	Role      string   `json:"role"`
	SessionID string   `json:"session_id,omitempty"`
	CreatedAt int64    `json:"created_at_ms"`
	ExpiresAt int64    `json:"expires_at_ms"`

	SFTPDownloadPath       string                 `json:"sftp_download_path,omitempty"`
	SFTPBatchDownloadInput *SFTPBatchDownloadPayload `json:"sftp_batch_download_input,omitempty"`
}

func NewRedisTicketService(client *redis.Client, cfg RedisTicketConfig) TicketService {
	prefix := strings.TrimSpace(cfg.Prefix)
	if prefix == "" {
		prefix = "easyssh:ticket"
	}
	ttl := cfg.TTL
	if ttl <= 0 {
		ttl = 30 * time.Second
	}
	return &redisTicketService{
		client: client,
		prefix: prefix,
		ttl:    ttl,
	}
}

func (s *redisTicketService) Create(req CreateTicketRequest) (string, int, error) {
	if s.client == nil {
		return "", 0, errors.New("redis client is nil")
	}
	if !req.Type.IsValid() {
		return "", 0, ErrInvalidTicket
	}
	if req.Ref == "" {
		return "", 0, ErrInvalidTicket
	}
	if req.UserID == (uuid.UUID{}) {
		return "", 0, ErrInvalidTicket
	}

	now := time.Now()
	value, err := newRandomTicketValue(32)
	if err != nil {
		return "", 0, err
	}

	rec := redisTicketRecord{
		UserID:    req.UserID.String(),
		Username:  req.Username,
		Email:     req.Email,
		Role:      string(req.Role),
		SessionID: req.SessionID.String(),
		CreatedAt: now.UnixMilli(),
		ExpiresAt: now.Add(s.ttl).UnixMilli(),

		SFTPDownloadPath:       req.SFTPDownloadPath,
		SFTPBatchDownloadInput: req.SFTPBatchDownloadInput,
	}
	if req.SessionID == (uuid.UUID{}) {
		rec.SessionID = ""
	}

	raw, err := json.Marshal(rec)
	if err != nil {
		return "", 0, err
	}

	key := s.key(req.Type, req.Ref, value)
	if err := s.client.Set(context.Background(), key, raw, s.ttl).Err(); err != nil {
		return "", 0, err
	}

	return value, int(s.ttl.Seconds()), nil
}

func (s *redisTicketService) Consume(ticket string, expect TicketExpectation) (*Ticket, error) {
	if s.client == nil {
		return nil, errors.New("redis client is nil")
	}
	if ticket == "" || !expect.Type.IsValid() || strings.TrimSpace(expect.Ref) == "" {
		return nil, ErrInvalidTicket
	}

	key := s.key(expect.Type, expect.Ref, ticket)
	rawAny, err := s.client.Eval(
		context.Background(),
		`local v = redis.call("GET", KEYS[1]); if not v then return nil end; redis.call("DEL", KEYS[1]); return v`,
		[]string{key},
	).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return nil, ErrInvalidTicket
		}
		return nil, err
	}
	raw, ok := rawAny.(string)
	if !ok || raw == "" {
		return nil, ErrInvalidTicket
	}

	var rec redisTicketRecord
	if err := json.Unmarshal([]byte(raw), &rec); err != nil {
		return nil, ErrInvalidTicket
	}

	userID, err := uuid.Parse(rec.UserID)
	if err != nil {
		return nil, ErrInvalidTicket
	}
	var sessionID uuid.UUID
	if strings.TrimSpace(rec.SessionID) != "" {
		if sid, err := uuid.Parse(rec.SessionID); err == nil {
			sessionID = sid
		}
	}

	now := time.Now()
	expiresAt := time.UnixMilli(rec.ExpiresAt)
	if rec.ExpiresAt > 0 && now.After(expiresAt) {
		return nil, ErrExpiredTicket
	}

	t := &Ticket{
		Value: ticket,
		Type:  expect.Type,
		Ref:   expect.Ref,

		UserID:    userID,
		Username:  rec.Username,
		Email:     rec.Email,
		Role:      UserRole(rec.Role),
		SessionID: sessionID,

		SFTPDownloadPath:       rec.SFTPDownloadPath,
		SFTPBatchDownloadInput: rec.SFTPBatchDownloadInput,

		CreatedAt: time.UnixMilli(rec.CreatedAt),
		ExpiresAt: expiresAt,
		UsedAt:    ptrTime(now),
	}

	return t, nil
}

func (s *redisTicketService) key(t TicketType, ref string, ticket string) string {
	refHash := sha256Hex(ref)
	return fmt.Sprintf("%s:%s:%s:%s", s.prefix, string(t), refHash, ticket)
}

func sha256Hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

func ptrTime(t time.Time) *time.Time {
	return &t
}
