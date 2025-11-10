package sshhostkey

import (
	"time"

	"gorm.io/gorm"
)

// SSHHostKey represents a trusted SSH host key for server verification
// Implements TOFU (Trust On First Use) security model
type SSHHostKey struct {
	ID          uint           `gorm:"primarykey" json:"id"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	Host        string         `gorm:"type:varchar(255);not null;index:idx_host_port" json:"host"`
	Port        int            `gorm:"not null;index:idx_host_port" json:"port"`
	KeyType     string         `gorm:"type:varchar(50);not null" json:"key_type"` // ssh-rsa, ecdsa-sha2-nistp256, ssh-ed25519
	PublicKey   string         `gorm:"type:text;not null" json:"public_key"`      // Base64编码的公钥
	Fingerprint string         `gorm:"type:varchar(100);not null;uniqueIndex" json:"fingerprint"` // SHA256指纹
	FirstSeen   time.Time      `gorm:"not null" json:"first_seen"`
	LastSeen    time.Time      `gorm:"not null" json:"last_seen"`
	TrustStatus string         `gorm:"type:varchar(20);not null;default:'trusted'" json:"trust_status"` // trusted, changed, revoked
	UserID      *uint          `gorm:"index" json:"user_id,omitempty"` // 可选：记录是哪个用户首次信任的
}

// TableName specifies the table name for SSHHostKey model
func (SSHHostKey) TableName() string {
	return "ssh_host_keys"
}

// HostKeyVerificationError represents a host key verification failure
type HostKeyVerificationError struct {
	Host            string `json:"host"`
	Port            int    `json:"port"`
	ExpectedKey     string `json:"expected_key"`
	ReceivedKey     string `json:"received_key"`
	ExpectedKeyType string `json:"expected_key_type"`
	ReceivedKeyType string `json:"received_key_type"`
	Message         string `json:"message"`
}

func (e *HostKeyVerificationError) Error() string {
	return e.Message
}

// TrustHostKeyRequest represents a request to manually trust a host key
type TrustHostKeyRequest struct {
	Host        string `json:"host" binding:"required"`
	Port        int    `json:"port" binding:"required,min=1,max=65535"`
	Fingerprint string `json:"fingerprint" binding:"required"`
}

// HostKeyInfo represents host key information for API responses
type HostKeyInfo struct {
	ID          uint      `json:"id"`
	Host        string    `json:"host"`
	Port        int       `json:"port"`
	KeyType     string    `json:"key_type"`
	Fingerprint string    `json:"fingerprint"`
	FirstSeen   time.Time `json:"first_seen"`
	LastSeen    time.Time `json:"last_seen"`
	TrustStatus string    `json:"trust_status"`
}
