package rest

import "gorm.io/gorm"

// BackupHandler handles unified JSON backup export and restore.
type BackupHandler struct {
	db *gorm.DB
}

// NewBackupHandler creates a unified backup handler.
func NewBackupHandler(db *gorm.DB) *BackupHandler {
	return &BackupHandler{db: db}
}
