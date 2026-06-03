package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	_ "modernc.org/sqlite"
)

type DesktopActivityLogStatus string

const (
	DesktopActivityLogSuccess DesktopActivityLogStatus = "success"
	DesktopActivityLogFailure DesktopActivityLogStatus = "failure"
	DesktopActivityLogWarning DesktopActivityLogStatus = "warning"
)

type DesktopActivityLogItem struct {
	ID         string                   `json:"id"`
	Action     string                   `json:"action"`
	Resource   string                   `json:"resource"`
	Status     DesktopActivityLogStatus `json:"status"`
	ServerID   string                   `json:"serverId,omitempty"`
	DurationMs int64                    `json:"durationMs,omitempty"`
	Detail     string                   `json:"detail,omitempty"`
	CreatedAt  string                   `json:"createdAt"`
}

type DesktopActivityLogListParams struct {
	Page      int                      `json:"page,omitempty"`
	Limit     int                      `json:"limit,omitempty"`
	Action    string                   `json:"action,omitempty"`
	ServerID  string                   `json:"serverId,omitempty"`
	Status    DesktopActivityLogStatus `json:"status,omitempty"`
	StartDate string                   `json:"startDate,omitempty"`
	EndDate   string                   `json:"endDate,omitempty"`
}

type DesktopActivityLogListResult struct {
	Items      []DesktopActivityLogItem `json:"items"`
	Total      int                      `json:"total"`
	Page       int                      `json:"page"`
	PageSize   int                      `json:"pageSize"`
	TotalPages int                      `json:"totalPages"`
}

type DesktopActivityLogStatistics struct {
	Total        int            `json:"total"`
	SuccessCount int            `json:"successCount"`
	FailureCount int            `json:"failureCount"`
	ByAction     map[string]int `json:"byAction"`
}

type DesktopActivityLogRecordInput struct {
	Action     string                   `json:"action"`
	Resource   string                   `json:"resource"`
	Status     DesktopActivityLogStatus `json:"status"`
	ServerID   string                   `json:"serverId,omitempty"`
	DurationMs int64                    `json:"durationMs,omitempty"`
	Detail     string                   `json:"detail,omitempty"`
}

type ActivityLogService struct {
	mu sync.Mutex
	db *sql.DB
}

func NewActivityLogService() *ActivityLogService {
	return &ActivityLogService{}
}

func (s *ActivityLogService) ServiceName() string {
	return "ActivityLogService"
}

func (s *ActivityLogService) ServiceStartup(_ context.Context, _ application.ServiceOptions) error {
	_, err := s.database()
	return err
}

func (s *ActivityLogService) ServiceShutdown() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.db == nil {
		return nil
	}

	err := s.db.Close()
	s.db = nil
	return err
}

func (s *ActivityLogService) List(params DesktopActivityLogListParams) (DesktopActivityLogListResult, error) {
	database, err := s.database()
	if err != nil {
		return DesktopActivityLogListResult{}, err
	}

	params = normalizeActivityListParams(params)
	where, args := buildActivityLogWhere(params)

	var total int
	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM activity_logs WHERE %s", where)
	if err := database.QueryRow(countSQL, args...).Scan(&total); err != nil {
		return DesktopActivityLogListResult{}, err
	}

	offset := (params.Page - 1) * params.Limit
	queryArgs := append(append([]any{}, args...), params.Limit, offset)
	querySQL := fmt.Sprintf(`
		SELECT id, action, resource, status, COALESCE(server_id, ''), COALESCE(duration_ms, 0), COALESCE(detail, ''), created_at
		FROM activity_logs
		WHERE %s
		ORDER BY created_at DESC, id DESC
		LIMIT ? OFFSET ?`, where)

	rows, err := database.Query(querySQL, queryArgs...)
	if err != nil {
		return DesktopActivityLogListResult{}, err
	}
	defer rows.Close()

	items := make([]DesktopActivityLogItem, 0)
	for rows.Next() {
		var item DesktopActivityLogItem
		if err := rows.Scan(&item.ID, &item.Action, &item.Resource, &item.Status, &item.ServerID, &item.DurationMs, &item.Detail, &item.CreatedAt); err != nil {
			return DesktopActivityLogListResult{}, err
		}
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return DesktopActivityLogListResult{}, err
	}

	totalPages := 0
	if total > 0 {
		totalPages = int(math.Ceil(float64(total) / float64(params.Limit)))
	}

	return DesktopActivityLogListResult{
		Items:      items,
		Total:      total,
		Page:       params.Page,
		PageSize:   params.Limit,
		TotalPages: totalPages,
	}, nil
}

func (s *ActivityLogService) GetById(id string) (DesktopActivityLogItem, error) {
	database, err := s.database()
	if err != nil {
		return DesktopActivityLogItem{}, err
	}

	id = strings.TrimSpace(id)
	if id == "" {
		return DesktopActivityLogItem{}, errors.New("activity log id is required")
	}

	var item DesktopActivityLogItem
	err = database.QueryRow(`
		SELECT id, action, resource, status, COALESCE(server_id, ''), COALESCE(duration_ms, 0), COALESCE(detail, ''), created_at
		FROM activity_logs
		WHERE id = ?`, id).Scan(&item.ID, &item.Action, &item.Resource, &item.Status, &item.ServerID, &item.DurationMs, &item.Detail, &item.CreatedAt)
	if err != nil {
		return DesktopActivityLogItem{}, err
	}

	return item, nil
}

func (s *ActivityLogService) GetStatistics(params DesktopActivityLogListParams) (DesktopActivityLogStatistics, error) {
	database, err := s.database()
	if err != nil {
		return DesktopActivityLogStatistics{}, err
	}

	where, args := buildActivityLogWhere(DesktopActivityLogListParams{
		StartDate: params.StartDate,
		EndDate:   params.EndDate,
	})
	stats := DesktopActivityLogStatistics{ByAction: map[string]int{}}

	countSQL := fmt.Sprintf(`
		SELECT
			COUNT(*),
			COALESCE(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END), 0)
		FROM activity_logs
		WHERE %s`, where)
	if err := database.QueryRow(countSQL, args...).Scan(&stats.Total, &stats.SuccessCount, &stats.FailureCount); err != nil {
		return DesktopActivityLogStatistics{}, err
	}

	actionSQL := fmt.Sprintf(`
		SELECT action, COUNT(*)
		FROM activity_logs
		WHERE %s
		GROUP BY action`, where)
	rows, err := database.Query(actionSQL, args...)
	if err != nil {
		return DesktopActivityLogStatistics{}, err
	}
	defer rows.Close()

	for rows.Next() {
		var action string
		var count int
		if err := rows.Scan(&action, &count); err != nil {
			return DesktopActivityLogStatistics{}, err
		}
		stats.ByAction[action] = count
	}

	if err := rows.Err(); err != nil {
		return DesktopActivityLogStatistics{}, err
	}

	return stats, nil
}

func (s *ActivityLogService) Record(input DesktopActivityLogRecordInput) (DesktopActivityLogItem, error) {
	database, err := s.database()
	if err != nil {
		return DesktopActivityLogItem{}, err
	}

	item, err := normalizeActivityLogInput(input)
	if err != nil {
		return DesktopActivityLogItem{}, err
	}

	_, err = database.Exec(`
		INSERT INTO activity_logs (id, action, resource, status, server_id, duration_ms, detail, created_at, updated_at)
		VALUES (?, ?, ?, ?, NULLIF(?, ''), NULLIF(?, 0), NULLIF(?, ''), ?, ?)`,
		item.ID, item.Action, item.Resource, item.Status, item.ServerID, item.DurationMs, item.Detail, item.CreatedAt, item.CreatedAt)
	if err != nil {
		return DesktopActivityLogItem{}, err
	}

	return item, nil
}

func (s *ActivityLogService) Clear(before string) (int64, error) {
	database, err := s.database()
	if err != nil {
		return 0, err
	}

	before = normalizeActivityDate(before)
	var result sql.Result
	if before == "" {
		result, err = database.Exec("DELETE FROM activity_logs")
	} else {
		result, err = database.Exec("DELETE FROM activity_logs WHERE created_at < ?", before)
	}

	if err != nil {
		return 0, err
	}

	return result.RowsAffected()
}

func (s *ActivityLogService) database() (*sql.DB, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.db != nil {
		return s.db, nil
	}

	dataDir := desktopDataDir()
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, fmt.Errorf("failed to create desktop data directory: %w", err)
	}

	dbPath := filepath.Join(dataDir, "easyssh-desktop.sqlite")
	database, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}

	if err := configureActivityDatabase(database); err != nil {
		database.Close()
		return nil, err
	}

	s.db = database
	return s.db, nil
}

func configureActivityDatabase(database *sql.DB) error {
	database.SetMaxOpenConns(1)

	statements := []string{
		"PRAGMA journal_mode=WAL",
		"PRAGMA busy_timeout=5000",
		"PRAGMA foreign_keys=ON",
		`CREATE TABLE IF NOT EXISTS activity_logs (
			id TEXT PRIMARY KEY,
			action TEXT NOT NULL,
			resource TEXT NOT NULL DEFAULT '',
			status TEXT NOT NULL DEFAULT 'success',
			server_id TEXT,
			duration_ms INTEGER,
			detail TEXT,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`,
		"CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs (created_at DESC)",
		"CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs (action)",
		"CREATE INDEX IF NOT EXISTS idx_activity_logs_status ON activity_logs (status)",
		"CREATE INDEX IF NOT EXISTS idx_activity_logs_server ON activity_logs (server_id)",
	}

	for _, statement := range statements {
		if _, err := database.Exec(statement); err != nil {
			return err
		}
	}

	return database.Ping()
}

func normalizeActivityListParams(params DesktopActivityLogListParams) DesktopActivityLogListParams {
	if params.Page < 1 {
		params.Page = 1
	}

	if params.Limit < 1 {
		params.Limit = 20
	}

	if params.Limit > 100 {
		params.Limit = 100
	}

	params.Action = strings.TrimSpace(params.Action)
	params.ServerID = strings.TrimSpace(params.ServerID)
	params.StartDate = normalizeActivityDate(params.StartDate)
	params.EndDate = normalizeActivityDate(params.EndDate)
	if !isValidActivityStatus(params.Status) {
		params.Status = ""
	}

	return params
}

func buildActivityLogWhere(params DesktopActivityLogListParams) (string, []any) {
	params = normalizeActivityListParams(params)
	clauses := []string{"1 = 1"}
	args := make([]any, 0)

	if params.Action != "" {
		clauses = append(clauses, "action = ?")
		args = append(args, params.Action)
	}

	if params.ServerID != "" {
		clauses = append(clauses, "server_id = ?")
		args = append(args, params.ServerID)
	}

	if params.Status != "" {
		clauses = append(clauses, "status = ?")
		args = append(args, params.Status)
	}

	if params.StartDate != "" {
		clauses = append(clauses, "created_at >= ?")
		args = append(args, params.StartDate)
	}

	if params.EndDate != "" {
		clauses = append(clauses, "created_at <= ?")
		args = append(args, params.EndDate)
	}

	return strings.Join(clauses, " AND "), args
}

func normalizeActivityLogInput(input DesktopActivityLogRecordInput) (DesktopActivityLogItem, error) {
	action := strings.TrimSpace(input.Action)
	if action == "" {
		return DesktopActivityLogItem{}, errors.New("activity action is required")
	}

	status := input.Status
	if status == "" {
		status = DesktopActivityLogSuccess
	}
	if !isValidActivityStatus(status) {
		return DesktopActivityLogItem{}, fmt.Errorf("unsupported activity status: %s", status)
	}

	return DesktopActivityLogItem{
		ID:         newActivityLogID(),
		Action:     action,
		Resource:   strings.TrimSpace(input.Resource),
		Status:     status,
		ServerID:   strings.TrimSpace(input.ServerID),
		DurationMs: input.DurationMs,
		Detail:     strings.TrimSpace(input.Detail),
		CreatedAt:  time.Now().UTC().Format(time.RFC3339Nano),
	}, nil
}

func isValidActivityStatus(status DesktopActivityLogStatus) bool {
	switch status {
	case DesktopActivityLogSuccess, DesktopActivityLogFailure, DesktopActivityLogWarning:
		return true
	default:
		return false
	}
}

func normalizeActivityDate(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}

	for _, layout := range []string{time.RFC3339Nano, time.RFC3339, "2006-01-02"} {
		date, err := time.Parse(layout, value)
		if err == nil {
			if layout == "2006-01-02" {
				date = date.UTC()
			}
			return date.UTC().Format(time.RFC3339Nano)
		}
	}

	return value
}

func newActivityLogID() string {
	var randomBytes [8]byte
	if _, err := rand.Read(randomBytes[:]); err == nil {
		return fmt.Sprintf("act_%d_%s", time.Now().UnixNano(), hex.EncodeToString(randomBytes[:]))
	}

	return fmt.Sprintf("act_%d", time.Now().UnixNano())
}
