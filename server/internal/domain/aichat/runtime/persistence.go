package runtime

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/easyssh/server/internal/domain/aichat/provider"
	"github.com/easyssh/server/internal/domain/aichat/registry"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type SessionStore interface {
	Save(ctx context.Context, snapshot SessionSnapshot) error
	Get(ctx context.Context, userID uuid.UUID, sessionID string) (*SessionSnapshot, error)
	GetLatestActive(ctx context.Context, userID uuid.UUID) (*SessionSnapshot, error)
	List(ctx context.Context, userID uuid.UUID, query string, limit, offset int) ([]SessionSnapshot, int64, error)
	Rename(ctx context.Context, userID uuid.UUID, sessionID, title string) error
	Delete(ctx context.Context, userID uuid.UUID, sessionID string) error
}

type AISessionRecord struct {
	ID             string         `gorm:"type:char(36);primaryKey" json:"id"`
	UserID         uuid.UUID      `gorm:"type:char(36);not null;index:idx_ai_sessions_user_updated" json:"user_id"`
	Model          string         `gorm:"type:text" json:"model"`
	Title          string         `gorm:"type:text" json:"title"`
	PermissionMode string         `gorm:"type:varchar(32);not null" json:"permission_mode"`
	Status         string         `gorm:"type:varchar(32);not null;index" json:"status"`
	Messages       jsonText       `gorm:"type:text;not null" json:"messages"`
	MessageViews   jsonText       `gorm:"type:text;not null" json:"message_views"`
	Tasks          jsonText       `gorm:"type:text;not null" json:"tasks"`
	TaskOrder      jsonText       `gorm:"type:text;not null" json:"task_order"`
	CreatedAt      time.Time      `gorm:"not null" json:"created_at"`
	UpdatedAt      time.Time      `gorm:"not null;index:idx_ai_sessions_user_updated" json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

type jsonText []byte

func (j *jsonText) Scan(value interface{}) error {
	if j == nil {
		return errors.New("jsonText: Scan on nil receiver")
	}

	switch v := value.(type) {
	case nil:
		*j = jsonText("null")
	case []byte:
		if len(v) == 0 {
			*j = jsonText("null")
			return nil
		}
		*j = append((*j)[:0], v...)
	case string:
		if v == "" {
			*j = jsonText("null")
			return nil
		}
		*j = append((*j)[:0], v...)
	default:
		return fmt.Errorf("jsonText: unsupported Scan type %T", value)
	}
	return nil
}

func (j jsonText) Value() (driver.Value, error) {
	if len(j) == 0 {
		return "null", nil
	}
	return string(j), nil
}

func (j jsonText) MarshalJSON() ([]byte, error) {
	if len(j) == 0 {
		return []byte("null"), nil
	}
	return json.RawMessage(j).MarshalJSON()
}

func (AISessionRecord) TableName() string {
	return "ai_sessions"
}

type SessionSnapshot struct {
	ID             string             `json:"id"`
	UserID         uuid.UUID          `json:"user_id"`
	Model          string             `json:"model"`
	Title          string             `json:"title"`
	PermissionMode string             `json:"permission_mode"`
	Scope          SessionScope       `json:"scope,omitempty"`
	Status         SessionStatus      `json:"status"`
	CreatedAt      time.Time          `json:"created_at"`
	UpdatedAt      time.Time          `json:"updated_at"`
	Messages       []provider.Message `json:"messages"`
	MessageViews   []MessageView      `json:"message_views"`
	Tasks          []PersistedTask    `json:"tasks"`
	TaskOrder      []string           `json:"task_order"`
}

type PersistedTask struct {
	ToolCall registry.ToolCall `json:"tool_call"`
	View     TaskView          `json:"view"`
}

type gormSessionStore struct {
	db *gorm.DB
}

func NewGormSessionStore(db *gorm.DB) SessionStore {
	return &gormSessionStore{db: db}
}

func (s *gormSessionStore) Save(ctx context.Context, snapshot SessionSnapshot) error {
	record, err := snapshot.toRecord()
	if err != nil {
		return err
	}

	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"user_id",
			"model",
			"title",
			"permission_mode",
			"status",
			"messages",
			"message_views",
			"tasks",
			"task_order",
			"created_at",
			"updated_at",
		}),
	}).Create(&record).Error
}

func (s *gormSessionStore) Get(ctx context.Context, userID uuid.UUID, sessionID string) (*SessionSnapshot, error) {
	var record AISessionRecord
	if err := s.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", sessionID, userID).
		First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrSessionNotFound
		}
		return nil, err
	}

	return record.toSnapshot()
}

func (s *gormSessionStore) GetLatestActive(ctx context.Context, userID uuid.UUID) (*SessionSnapshot, error) {
	var record AISessionRecord
	if err := s.db.WithContext(ctx).
		Where("user_id = ? AND status <> ?", userID, string(SessionStatusClosed)).
		Order("updated_at DESC").
		First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrSessionNotFound
		}
		return nil, err
	}

	return record.toSnapshot()
}

func (s *gormSessionStore) List(ctx context.Context, userID uuid.UUID, queryText string, limit, offset int) ([]SessionSnapshot, int64, error) {
	if limit <= 0 || limit > 100 {
		limit = 30
	}
	if offset < 0 {
		offset = 0
	}

	query := s.db.WithContext(ctx).Model(&AISessionRecord{}).Where("user_id = ?", userID)
	if queryText != "" {
		like := "%" + strings.ToLower(queryText) + "%"
		if s.db.Dialector.Name() == "mysql" {
			query = query.Where("LOWER(title) LIKE ? OR LOWER(CAST(message_views AS CHAR)) LIKE ?", like, like)
		} else {
			query = query.Where("LOWER(title) LIKE ? OR LOWER(CAST(message_views AS TEXT)) LIKE ?", like, like)
		}
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var records []AISessionRecord
	if err := query.
		Order("updated_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&records).Error; err != nil {
		return nil, 0, err
	}

	snapshots := make([]SessionSnapshot, 0, len(records))
	for _, record := range records {
		snapshot, err := record.toSnapshot()
		if err != nil {
			return nil, 0, err
		}
		snapshots = append(snapshots, *snapshot)
	}

	return snapshots, total, nil
}

func (s *gormSessionStore) Rename(ctx context.Context, userID uuid.UUID, sessionID, title string) error {
	result := s.db.WithContext(ctx).
		Model(&AISessionRecord{}).
		Where("id = ? AND user_id = ?", sessionID, userID).
		Updates(map[string]interface{}{
			"title":      title,
			"updated_at": time.Now(),
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrSessionNotFound
	}
	return nil
}

func (s *gormSessionStore) Delete(ctx context.Context, userID uuid.UUID, sessionID string) error {
	result := s.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", sessionID, userID).
		Delete(&AISessionRecord{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrSessionNotFound
	}
	return nil
}

func (snapshot SessionSnapshot) toRecord() (AISessionRecord, error) {
	messages, err := json.Marshal(snapshot.Messages)
	if err != nil {
		return AISessionRecord{}, err
	}
	messageViews, err := json.Marshal(snapshot.MessageViews)
	if err != nil {
		return AISessionRecord{}, err
	}
	tasks, err := json.Marshal(snapshot.Tasks)
	if err != nil {
		return AISessionRecord{}, err
	}
	taskOrder, err := json.Marshal(snapshot.TaskOrder)
	if err != nil {
		return AISessionRecord{}, err
	}

	return AISessionRecord{
		ID:             snapshot.ID,
		UserID:         snapshot.UserID,
		Model:          snapshot.Model,
		Title:          snapshot.Title,
		PermissionMode: snapshot.PermissionMode,
		Status:         string(snapshot.Status),
		Messages:       jsonText(messages),
		MessageViews:   jsonText(messageViews),
		Tasks:          jsonText(tasks),
		TaskOrder:      jsonText(taskOrder),
		CreatedAt:      snapshot.CreatedAt,
		UpdatedAt:      snapshot.UpdatedAt,
	}, nil
}

func (record AISessionRecord) toSnapshot() (*SessionSnapshot, error) {
	snapshot := SessionSnapshot{
		ID:             record.ID,
		UserID:         record.UserID,
		Model:          record.Model,
		Title:          record.Title,
		PermissionMode: record.PermissionMode,
		Status:         SessionStatus(record.Status),
		CreatedAt:      record.CreatedAt,
		UpdatedAt:      record.UpdatedAt,
	}

	if err := json.Unmarshal(record.Messages, &snapshot.Messages); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(record.MessageViews, &snapshot.MessageViews); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(record.Tasks, &snapshot.Tasks); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(record.TaskOrder, &snapshot.TaskOrder); err != nil {
		return nil, err
	}

	return &snapshot, nil
}
