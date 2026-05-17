package runtime

import (
	"context"
	"encoding/json"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/easyssh/server/internal/domain/aichat/provider"
	"github.com/easyssh/server/internal/domain/aichat/registry"
	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type memorySessionStore struct {
	mu        sync.Mutex
	snapshots map[string]SessionSnapshot
}

func newMemorySessionStore() *memorySessionStore {
	return &memorySessionStore{snapshots: make(map[string]SessionSnapshot)}
}

func (s *memorySessionStore) Save(ctx context.Context, snapshot SessionSnapshot) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.snapshots[snapshot.ID] = snapshot
	return nil
}

func (s *memorySessionStore) Get(ctx context.Context, userID uuid.UUID, sessionID string) (*SessionSnapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	snapshot, ok := s.snapshots[sessionID]
	if !ok || snapshot.UserID != userID {
		return nil, ErrSessionNotFound
	}
	return &snapshot, nil
}

func (s *memorySessionStore) GetLatestActive(ctx context.Context, userID uuid.UUID) (*SessionSnapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var latest *SessionSnapshot
	for _, snapshot := range s.snapshots {
		if snapshot.UserID != userID || snapshot.Status == SessionStatusClosed {
			continue
		}
		candidate := snapshot
		if latest == nil || candidate.UpdatedAt.After(latest.UpdatedAt) {
			latest = &candidate
		}
	}
	if latest == nil {
		return nil, ErrSessionNotFound
	}
	return latest, nil
}

func (s *memorySessionStore) List(ctx context.Context, userID uuid.UUID, query string, limit, offset int) ([]SessionSnapshot, int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	snapshots := make([]SessionSnapshot, 0)
	for _, snapshot := range s.snapshots {
		if snapshot.UserID != userID {
			continue
		}
		if query != "" && !strings.Contains(strings.ToLower(sessionListItemFromSnapshot(snapshot).Title), strings.ToLower(query)) {
			continue
		}
		snapshots = append(snapshots, snapshot)
	}
	sort.SliceStable(snapshots, func(i, j int) bool {
		return snapshots[i].UpdatedAt.After(snapshots[j].UpdatedAt)
	})
	total := int64(len(snapshots))
	if limit <= 0 || limit > 100 {
		limit = 30
	}
	if offset < 0 {
		offset = 0
	}
	if offset >= len(snapshots) {
		return nil, total, nil
	}
	end := offset + limit
	if end > len(snapshots) {
		end = len(snapshots)
	}
	return snapshots[offset:end], total, nil
}

func (s *memorySessionStore) Rename(ctx context.Context, userID uuid.UUID, sessionID, title string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	snapshot, ok := s.snapshots[sessionID]
	if !ok || snapshot.UserID != userID {
		return ErrSessionNotFound
	}
	snapshot.Title = title
	snapshot.UpdatedAt = time.Now()
	s.snapshots[sessionID] = snapshot
	return nil
}

func (s *memorySessionStore) Delete(ctx context.Context, userID uuid.UUID, sessionID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	snapshot, ok := s.snapshots[sessionID]
	if !ok || snapshot.UserID != userID {
		return ErrSessionNotFound
	}
	delete(s.snapshots, sessionID)
	return nil
}

func TestSessionSnapshotRecordRoundTrip(t *testing.T) {
	t.Parallel()

	userID := uuid.New()
	now := time.Now().UTC().Truncate(time.Second)
	snapshot := SessionSnapshot{
		ID:             uuid.NewString(),
		UserID:         userID,
		Model:          "gpt-test",
		PermissionMode: "balanced",
		Status:         SessionStatusWaitingConfirmation,
		CreatedAt:      now,
		UpdatedAt:      now.Add(time.Minute),
		Messages: []provider.Message{
			{Role: "user", Content: "执行 uptime"},
			{
				Role:    "assistant",
				Content: "准备执行。",
				ToolCalls: []registry.ToolCall{{
					ID:        "call-1",
					Name:      "execute_command",
					Arguments: json.RawMessage(`{"server_id":"srv-1","command":"uptime"}`),
				}},
			},
		},
		MessageViews: []MessageView{
			{ID: "msg-1", Role: "user", Content: "执行 uptime", CreatedAt: now},
			{ID: "msg-2", Role: "assistant", Content: "准备执行。", CreatedAt: now.Add(time.Second)},
		},
		Tasks: []PersistedTask{{
			ToolCall: registry.ToolCall{ID: "call-1", Name: "execute_command", Arguments: json.RawMessage(`{"server_id":"srv-1","command":"uptime"}`)},
			View: TaskView{
				ID:                   "task-1",
				ToolCallID:           "call-1",
				ToolName:             "execute_command",
				Status:               TaskStatusWaitingConfirm,
				Dangerous:            true,
				RequiresConfirmation: true,
				CreatedAt:            now,
				UpdatedAt:            now,
			},
		}},
		TaskOrder: []string{"task-1"},
	}

	record, err := snapshot.toRecord()
	require.NoError(t, err)

	restored, err := record.toSnapshot()
	require.NoError(t, err)
	require.Equal(t, snapshot.ID, restored.ID)
	require.Equal(t, snapshot.UserID, restored.UserID)
	require.Equal(t, snapshot.Status, restored.Status)
	require.Len(t, restored.Messages, 2)
	require.Len(t, restored.MessageViews, 2)
	require.Len(t, restored.Tasks, 1)
	require.Equal(t, "task-1", restored.TaskOrder[0])
	require.JSONEq(t, `{"server_id":"srv-1","command":"uptime"}`, string(restored.Tasks[0].ToolCall.Arguments))
}

func TestGormSessionStoreListScansSQLiteJSONText(t *testing.T) {
	t.Parallel()

	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&AISessionRecord{}))

	store := NewGormSessionStore(db)
	userID := uuid.New()
	now := time.Now().UTC().Truncate(time.Second)
	snapshot := SessionSnapshot{
		ID:             uuid.NewString(),
		UserID:         userID,
		Model:          "gpt-test",
		Title:          "SQLite 会话",
		PermissionMode: "balanced",
		Status:         SessionStatusIdle,
		CreatedAt:      now,
		UpdatedAt:      now,
		Messages: []provider.Message{
			{Role: "user", Content: "你好"},
		},
		MessageViews: []MessageView{
			{ID: "msg-1", Role: "user", Content: "你好", CreatedAt: now},
		},
		Tasks:     []PersistedTask{},
		TaskOrder: []string{},
	}

	require.NoError(t, store.Save(context.Background(), snapshot))

	items, total, err := store.List(context.Background(), userID, "", 10, 0)
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, items, 1)
	require.Equal(t, snapshot.ID, items[0].ID)
	require.Equal(t, snapshot.Messages[0].Content, items[0].Messages[0].Content)
	require.Equal(t, snapshot.MessageViews[0].Content, items[0].MessageViews[0].Content)
}

func TestManagerPersistsRestoresAndListsSessions(t *testing.T) {
	t.Parallel()

	userID := uuid.New()
	store := newMemorySessionStore()
	runner := &fakeTurnRunner{
		scripts: []fakeTurnScript{{
			result: provider.TurnResult{Content: "完成。"},
		}},
	}

	manager := NewManager(
		fakeResolver{config: provider.Config{Model: "fake-model"}},
		runner,
		registry.NewToolRegistry(nil),
		time.Minute,
	)
	manager.SetSessionStore(store)

	session, err := manager.CreateSession(context.Background(), userID, CreateSessionInput{
		Model:          "gpt-test",
		PermissionMode: "balanced",
	})
	require.NoError(t, err)
	require.NoError(t, manager.SendUserMessage(context.Background(), userID, session.ID, "你好"))

	require.Eventually(t, func() bool {
		latest, err := store.GetLatestActive(context.Background(), userID)
		return err == nil && latest.ID == session.ID && len(latest.MessageViews) >= 2 && latest.Status == SessionStatusIdle
	}, 2*time.Second, 20*time.Millisecond)

	items, total, err := manager.ListSessions(context.Background(), userID, "", 10, 0)
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, items, 1)
	require.Equal(t, session.ID, items[0].ID)
	require.Equal(t, "你好", items[0].Title)
	require.Equal(t, 2, items[0].MessageCount)

	require.NoError(t, manager.RenameSession(context.Background(), userID, session.ID, "巡检会话"))
	items, total, err = manager.ListSessions(context.Background(), userID, "巡检", 10, 0)
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Equal(t, "巡检会话", items[0].Title)
	require.True(t, items[0].CustomTitle)

	restoredManager := NewManager(
		fakeResolver{config: provider.Config{Model: "fake-model"}},
		nil,
		registry.NewToolRegistry(nil),
		time.Minute,
	)
	restoredManager.SetSessionStore(store)

	restored, err := restoredManager.GetLatestActiveSession(context.Background(), userID)
	require.NoError(t, err)
	require.Equal(t, session.ID, restored.ID)
	require.Equal(t, SessionStatusIdle, restored.Status)
	require.Len(t, restored.Messages, 2)

	require.NoError(t, manager.DeleteSession(context.Background(), userID, session.ID))
	items, total, err = manager.ListSessions(context.Background(), userID, "", 10, 0)
	require.NoError(t, err)
	require.Equal(t, int64(0), total)
	require.Empty(t, items)

}
