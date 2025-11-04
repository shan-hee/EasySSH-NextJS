package sshkey

import (
	"gorm.io/gorm"
)

// Repository defines the interface for SSH key persistence operations
type Repository interface {
	Create(key *SSHKey) error
	FindByID(id uint, userID uint) (*SSHKey, error)
	FindByUserID(userID uint) ([]SSHKey, error)
	Delete(id uint, userID uint) error
	Update(key *SSHKey) error
}

type repository struct {
	db *gorm.DB
}

// NewRepository creates a new SSH key repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// Create creates a new SSH key record
func (r *repository) Create(key *SSHKey) error {
	return r.db.Create(key).Error
}

// FindByID finds an SSH key by ID and user ID
func (r *repository) FindByID(id uint, userID uint) (*SSHKey, error) {
	var key SSHKey
	err := r.db.Where("id = ? AND user_id = ?", id, userID).First(&key).Error
	if err != nil {
		return nil, err
	}
	return &key, nil
}

// FindByUserID finds all SSH keys for a specific user
func (r *repository) FindByUserID(userID uint) ([]SSHKey, error) {
	var keys []SSHKey
	err := r.db.Where("user_id = ?", userID).Order("created_at DESC").Find(&keys).Error
	return keys, err
}

// Delete deletes an SSH key by ID and user ID
func (r *repository) Delete(id uint, userID uint) error {
	return r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&SSHKey{}).Error
}

// Update updates an SSH key record
func (r *repository) Update(key *SSHKey) error {
	return r.db.Save(key).Error
}
