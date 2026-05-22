package sshhostkey

import (
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"log"
	"net"
	"time"

	"golang.org/x/crypto/ssh"
	"gorm.io/gorm"
)

var (
	ErrHostKeyRecordNotFound = errors.New("host key record not found")
	ErrHostKeyRevoked        = errors.New("host key trust has been revoked")
)

// Service handles SSH host key verification and management
type Service struct {
	db *gorm.DB
}

// NewService creates a new SSH host key service
func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

// VerifyHostKey implements ssh.HostKeyCallback for secure host key verification
// This implements TOFU (Trust On First Use) security model
func (s *Service) VerifyHostKey(hostname string, remote net.Addr, key ssh.PublicKey) error {
	// 解析主机名和端口
	host, portStr, err := net.SplitHostPort(hostname)
	if err != nil {
		// 如果没有端口，使用默认SSH端口
		host = hostname
		portStr = "22"
	}

	var port int
	fmt.Sscanf(portStr, "%d", &port)

	// 计算密钥指纹（SHA256）
	fingerprint := s.calculateFingerprint(key)
	keyType := key.Type()
	publicKeyBytes := key.Marshal()
	publicKeyB64 := base64.StdEncoding.EncodeToString(publicKeyBytes)

	// 查找现有的主机密钥记录
	var existingKey SSHHostKey
	result := s.db.Where("host = ? AND port = ?", host, port).First(&existingKey)

	if result.Error == gorm.ErrRecordNotFound {
		// 首次连接：记录主机密钥（TOFU）
		newKey := SSHHostKey{
			Host:        host,
			Port:        port,
			KeyType:     keyType,
			PublicKey:   publicKeyB64,
			Fingerprint: fingerprint,
			FirstSeen:   time.Now(),
			LastSeen:    time.Now(),
			TrustStatus: "trusted",
		}

		if err := s.db.Create(&newKey).Error; err != nil {
			log.Printf("⚠️  Failed to save host key for %s:%d: %v", host, port, err)
			// 即使保存失败，也允许连接（降级到不安全模式）
			return nil
		}

		log.Printf("✅ New SSH host key trusted for %s:%d (fingerprint: %s)", host, port, fingerprint)
		return nil
	}

	if result.Error != nil {
		log.Printf("⚠️  Failed to query host key for %s:%d: %v", host, port, result.Error)
		// 数据库查询失败，降级到不安全模式
		return nil
	}

	if existingKey.TrustStatus == "revoked" {
		return fmt.Errorf("%w for %s:%d", ErrHostKeyRevoked, host, port)
	}

	// 验证密钥是否匹配
	if existingKey.Fingerprint != fingerprint {
		// 主机密钥已更改！可能是中间人攻击
		log.Printf("🚨 SSH HOST KEY VERIFICATION FAILED for %s:%d", host, port)
		log.Printf("   Expected: %s (%s)", existingKey.Fingerprint, existingKey.KeyType)
		log.Printf("   Received: %s (%s)", fingerprint, keyType)

		// 更新状态为已更改
		s.db.Model(&existingKey).Updates(map[string]interface{}{
			"trust_status": "changed",
			"updated_at":   time.Now(),
		})

		return &HostKeyVerificationError{
			Host:            host,
			Port:            port,
			ExpectedKey:     existingKey.Fingerprint,
			ReceivedKey:     fingerprint,
			ExpectedKeyType: existingKey.KeyType,
			ReceivedKeyType: keyType,
			Message: fmt.Sprintf(
				"SSH host key verification failed for %s:%d. "+
					"Expected fingerprint %s (%s), but received %s (%s). "+
					"This could indicate a man-in-the-middle attack or the server's key has changed. "+
					"If you trust this new key, please manually approve it.",
				host, port, existingKey.Fingerprint, existingKey.KeyType, fingerprint, keyType,
			),
		}
	}

	// 密钥匹配，更新最后见到时间
	updates := map[string]interface{}{
		"last_seen": time.Now(),
	}
	if existingKey.TrustStatus == "changed" {
		updates["trust_status"] = "trusted"
	}
	s.db.Model(&existingKey).Updates(updates)

	return nil
}

// GetHostKeyCallback returns a ssh.HostKeyCallback function for use with ssh.ClientConfig
func (s *Service) GetHostKeyCallback() ssh.HostKeyCallback {
	return s.VerifyHostKey
}

// GetTrustOnChangeHostKeyCallback returns a callback that asks the caller
// whether a changed key should replace the stored key before continuing.
func (s *Service) GetTrustOnChangeHostKeyCallback(
	approve func(*HostKeyVerificationError) (bool, error),
) ssh.HostKeyCallback {
	return func(hostname string, remote net.Addr, key ssh.PublicKey) error {
		err := s.VerifyHostKey(hostname, remote, key)
		if err == nil {
			return nil
		}

		var hostKeyErr *HostKeyVerificationError
		if !errors.As(err, &hostKeyErr) {
			return err
		}

		approved, approveErr := approve(hostKeyErr)
		if approveErr != nil {
			return approveErr
		}
		if !approved {
			return err
		}

		return s.trustVerifiedHostKey(hostKeyErr.Host, hostKeyErr.Port, key, nil)
	}
}

// calculateFingerprint computes SHA256 fingerprint of a public key
func (s *Service) calculateFingerprint(key ssh.PublicKey) string {
	hash := sha256.Sum256(key.Marshal())
	return fmt.Sprintf("SHA256:%s", base64.RawStdEncoding.EncodeToString(hash[:]))
}

func (s *Service) trustVerifiedHostKey(host string, port int, key ssh.PublicKey, userID *uint) error {
	var existingKey SSHHostKey
	result := s.db.Where("host = ? AND port = ?", host, port).First(&existingKey)

	if result.Error == gorm.ErrRecordNotFound {
		return fmt.Errorf("%w for %s:%d", ErrHostKeyRecordNotFound, host, port)
	}

	if result.Error != nil {
		return fmt.Errorf("failed to query host key: %w", result.Error)
	}

	now := time.Now()
	publicKeyBytes := key.Marshal()
	updates := map[string]interface{}{
		"key_type":     key.Type(),
		"public_key":   base64.StdEncoding.EncodeToString(publicKeyBytes),
		"fingerprint":  s.calculateFingerprint(key),
		"last_seen":    now,
		"trust_status": "trusted",
		"updated_at":   now,
	}

	if userID != nil {
		updates["user_id"] = *userID
	}

	if err := s.db.Model(&existingKey).Updates(updates).Error; err != nil {
		return fmt.Errorf("failed to update trust status: %w", err)
	}

	return nil
}

// RevokeHostKey revokes trust for a host key
func (s *Service) RevokeHostKey(host string, port int) error {
	result := s.db.Model(&SSHHostKey{}).
		Where("host = ? AND port = ?", host, port).
		Update("trust_status", "revoked")

	if result.Error != nil {
		return fmt.Errorf("failed to revoke host key: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("no host key found for %s:%d", host, port)
	}

	log.Printf("⚠️  Host key revoked for %s:%d", host, port)
	return nil
}

// DeleteHostKey removes a host key record
func (s *Service) DeleteHostKey(id uint) error {
	result := s.db.Delete(&SSHHostKey{}, id)

	if result.Error != nil {
		return fmt.Errorf("failed to delete host key: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("host key not found")
	}

	return nil
}

// ListHostKeys returns all host keys
func (s *Service) ListHostKeys() ([]HostKeyInfo, error) {
	var keys []SSHHostKey
	if err := s.db.Order("host, port").Find(&keys).Error; err != nil {
		return nil, fmt.Errorf("failed to list host keys: %w", err)
	}

	result := make([]HostKeyInfo, len(keys))
	for i, key := range keys {
		result[i] = HostKeyInfo{
			ID:          key.ID,
			Host:        key.Host,
			Port:        key.Port,
			KeyType:     key.KeyType,
			Fingerprint: key.Fingerprint,
			FirstSeen:   key.FirstSeen,
			LastSeen:    key.LastSeen,
			TrustStatus: key.TrustStatus,
		}
	}

	return result, nil
}

// GetHostKey retrieves a specific host key by ID
func (s *Service) GetHostKey(id uint) (*HostKeyInfo, error) {
	var key SSHHostKey
	if err := s.db.First(&key, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("host key not found")
		}
		return nil, fmt.Errorf("failed to get host key: %w", err)
	}

	return &HostKeyInfo{
		ID:          key.ID,
		Host:        key.Host,
		Port:        key.Port,
		KeyType:     key.KeyType,
		Fingerprint: key.Fingerprint,
		FirstSeen:   key.FirstSeen,
		LastSeen:    key.LastSeen,
		TrustStatus: key.TrustStatus,
	}, nil
}
