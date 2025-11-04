package sshkey

import (
	"time"

	"gorm.io/gorm"
)

// SSHKey represents an SSH key pair for a user
type SSHKey struct {
	ID          uint           `gorm:"primarykey" json:"id"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	UserID      uint           `gorm:"not null;index" json:"user_id"`
	Name        string         `gorm:"type:varchar(100);not null" json:"name"`
	PublicKey   string         `gorm:"type:text;not null" json:"public_key"`
	PrivateKey  string         `gorm:"type:text;not null" json:"-"` // 加密存储，不在JSON响应中返回
	Fingerprint string         `gorm:"type:varchar(100);not null" json:"fingerprint"`
	Algorithm   string         `gorm:"type:varchar(20);not null" json:"algorithm"` // rsa, ed25519
	KeySize     int            `gorm:"default:0" json:"key_size"`                  // RSA密钥长度，ED25519为0
}

// TableName specifies the table name for SSHKey model
func (SSHKey) TableName() string {
	return "ssh_keys"
}

// CreateSSHKeyRequest represents the request to generate a new SSH key
type CreateSSHKeyRequest struct {
	Name      string `json:"name" binding:"required"`
	Algorithm string `json:"algorithm" binding:"required,oneof=rsa ed25519"`
	KeySize   int    `json:"key_size"` // 仅RSA需要，默认2048
}

// ImportSSHKeyRequest represents the request to import an existing SSH key
type ImportSSHKeyRequest struct {
	Name       string `json:"name" binding:"required"`
	PrivateKey string `json:"private_key" binding:"required"`
}

// SSHKeyResponse represents the SSH key response with private key (only returned once)
type SSHKeyResponse struct {
	ID          uint      `json:"id"`
	CreatedAt   time.Time `json:"created_at"`
	UserID      uint      `json:"user_id"`
	Name        string    `json:"name"`
	PublicKey   string    `json:"public_key"`
	PrivateKey  string    `json:"private_key,omitempty"` // 仅在生成/导入时返回
	Fingerprint string    `json:"fingerprint"`
	Algorithm   string    `json:"algorithm"`
	KeySize     int       `json:"key_size,omitempty"`
}
