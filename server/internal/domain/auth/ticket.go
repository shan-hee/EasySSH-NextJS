package auth

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

var (
	ErrInvalidTicket = errors.New("invalid ticket")
	ErrExpiredTicket = errors.New("expired ticket")
	ErrTicketUsed    = errors.New("ticket already used")
)

type TicketType string

const (
	TicketTypeWSTerminal     TicketType = "ws_terminal"
	TicketTypeWSMonitor      TicketType = "ws_monitor"
	TicketTypeWSSFTPUpload   TicketType = "ws_sftp_upload"
	TicketTypeWSSFTPTransfer TicketType = "ws_sftp_transfer"

	TicketTypeSFTPDownload      TicketType = "sftp_download"
	TicketTypeSFTPBatchDownload TicketType = "sftp_batch_download"
)

func (t TicketType) IsValid() bool {
	switch t {
	case TicketTypeWSTerminal,
		TicketTypeWSMonitor,
		TicketTypeWSSFTPUpload,
		TicketTypeWSSFTPTransfer,
		TicketTypeSFTPDownload,
		TicketTypeSFTPBatchDownload:
		return true
	default:
		return false
	}
}

type SFTPBatchDownloadPayload struct {
	Paths           []string
	Mode            string
	ExcludePatterns []string
}

type Ticket struct {
	Value string
	Type  TicketType
	Ref   string

	UserID    uuid.UUID
	Username  string
	Email     string
	Role      UserRole
	SessionID uuid.UUID

	SFTPDownloadPath       string
	SFTPBatchDownloadInput *SFTPBatchDownloadPayload

	CreatedAt time.Time
	ExpiresAt time.Time
	UsedAt    *time.Time
}

type CreateTicketRequest struct {
	Type TicketType
	Ref  string

	UserID    uuid.UUID
	Username  string
	Email     string
	Role      UserRole
	SessionID uuid.UUID

	SFTPDownloadPath       string
	SFTPBatchDownloadInput *SFTPBatchDownloadPayload
}

type TicketExpectation struct {
	Type TicketType
	Ref  string
}

type TicketService interface {
	Create(req CreateTicketRequest) (ticket string, expiresInSeconds int, err error)
	Consume(ticket string, expect TicketExpectation) (*Ticket, error)
}

type InMemoryTicketConfig struct {
	TTL time.Duration
}

type inMemoryTicketService struct {
	ttl time.Duration

	mu      sync.Mutex
	byValue map[string]*Ticket
}

func NewInMemoryTicketService(cfg InMemoryTicketConfig) TicketService {
	ttl := cfg.TTL
	if ttl <= 0 {
		ttl = 30 * time.Second
	}
	return &inMemoryTicketService{
		ttl:     ttl,
		byValue: make(map[string]*Ticket),
	}
}

func (s *inMemoryTicketService) Create(req CreateTicketRequest) (string, int, error) {
	if !req.Type.IsValid() {
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

	t := &Ticket{
		Value: value,
		Type:  req.Type,
		Ref:   req.Ref,

		UserID:    req.UserID,
		Username:  req.Username,
		Email:     req.Email,
		Role:      req.Role,
		SessionID: req.SessionID,

		SFTPDownloadPath:       req.SFTPDownloadPath,
		SFTPBatchDownloadInput: req.SFTPBatchDownloadInput,

		CreatedAt: now,
		ExpiresAt: now.Add(s.ttl),
	}

	s.mu.Lock()
	s.byValue[value] = t
	s.mu.Unlock()

	return value, int(s.ttl.Seconds()), nil
}

func (s *inMemoryTicketService) Consume(ticket string, expect TicketExpectation) (*Ticket, error) {
	if ticket == "" || !expect.Type.IsValid() {
		return nil, ErrInvalidTicket
	}

	now := time.Now()

	s.mu.Lock()
	defer s.mu.Unlock()

	t, ok := s.byValue[ticket]
	if !ok {
		return nil, ErrInvalidTicket
	}

	if t.UsedAt != nil {
		return nil, ErrTicketUsed
	}
	if now.After(t.ExpiresAt) {
		delete(s.byValue, ticket)
		return nil, ErrExpiredTicket
	}

	if t.Type != expect.Type {
		return nil, ErrInvalidTicket
	}
	if expect.Ref != "" && t.Ref != expect.Ref {
		return nil, ErrInvalidTicket
	}

	used := now
	t.UsedAt = &used
	delete(s.byValue, ticket) // one-time

	return t, nil
}

func newRandomTicketValue(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	// URL-safe，避免 +/=
	return base64.RawURLEncoding.EncodeToString(b), nil
}
