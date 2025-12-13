package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// RSAKeyStatus RSA 密钥状态
type RSAKeyStatus string

const (
	RSAKeyStatusActive   RSAKeyStatus = "active"   // 活跃（用于签名和验证）
	RSAKeyStatusRotating RSAKeyStatus = "rotating" // 轮换中（仅用于验证）
	RSAKeyStatusRetired  RSAKeyStatus = "retired"  // 已退役（不再使用）
)

// RSAKeyPair RSA 密钥对模型
type RSAKeyPair struct {
	ID         uint         `gorm:"primarykey" json:"id"`
	KeyID      string       `gorm:"uniqueIndex;size:64" json:"key_id"`    // 密钥标识（用于 JWT kid header）
	PrivateKey string       `gorm:"type:text" json:"-"`                   // 私钥（PEM 格式）
	PublicKey  string       `gorm:"type:text" json:"public_key"`          // 公钥（PEM 格式）
	Algorithm  string       `gorm:"size:10;default:'RS256'" json:"algorithm"`
	Status     RSAKeyStatus `gorm:"size:20;default:'active'" json:"status"` // active, rotating, retired
	ExpiresAt  *time.Time   `json:"expires_at"`                             // 密钥过期时间
	CreatedAt  time.Time    `json:"created_at"`
	UpdatedAt  time.Time    `json:"updated_at"`
}

// TableName 指定表名
func (RSAKeyPair) TableName() string {
	return "rsa_key_pairs"
}

// BeforeCreate GORM 钩子
func (k *RSAKeyPair) BeforeCreate(tx *gorm.DB) error {
	if k.KeyID == "" {
		k.KeyID = uuid.New().String()
	}
	return nil
}

// RSAKeyRepository RSA 密钥仓储接口
type RSAKeyRepository interface {
	// Create 创建密钥对
	Create(ctx context.Context, key *RSAKeyPair) error

	// FindByKeyID 根据 KeyID 查找
	FindByKeyID(ctx context.Context, keyID string) (*RSAKeyPair, error)

	// FindActive 查找活跃的密钥
	FindActive(ctx context.Context) (*RSAKeyPair, error)

	// ListAll 获取所有密钥
	ListAll(ctx context.Context) ([]*RSAKeyPair, error)

	// ListForVerification 获取可用于验证的密钥（active + rotating）
	ListForVerification(ctx context.Context) ([]*RSAKeyPair, error)

	// Update 更新密钥
	Update(ctx context.Context, key *RSAKeyPair) error

	// UpdateStatus 更新密钥状态
	UpdateStatus(ctx context.Context, keyID string, status RSAKeyStatus) error

	// Delete 删除密钥
	Delete(ctx context.Context, id uint) error
}

// gormRSAKeyRepository GORM 实现
type gormRSAKeyRepository struct {
	db *gorm.DB
}

// NewRSAKeyRepository 创建 RSA 密钥仓储
func NewRSAKeyRepository(db *gorm.DB) RSAKeyRepository {
	return &gormRSAKeyRepository{db: db}
}

func (r *gormRSAKeyRepository) Create(ctx context.Context, key *RSAKeyPair) error {
	return r.db.WithContext(ctx).Create(key).Error
}

func (r *gormRSAKeyRepository) FindByKeyID(ctx context.Context, keyID string) (*RSAKeyPair, error) {
	var key RSAKeyPair
	err := r.db.WithContext(ctx).Where("key_id = ?", keyID).First(&key).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &key, nil
}

func (r *gormRSAKeyRepository) FindActive(ctx context.Context) (*RSAKeyPair, error) {
	var key RSAKeyPair
	err := r.db.WithContext(ctx).Where("status = ?", RSAKeyStatusActive).First(&key).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &key, nil
}

func (r *gormRSAKeyRepository) ListAll(ctx context.Context) ([]*RSAKeyPair, error) {
	var keys []*RSAKeyPair
	err := r.db.WithContext(ctx).Order("created_at DESC").Find(&keys).Error
	return keys, err
}

func (r *gormRSAKeyRepository) ListForVerification(ctx context.Context) ([]*RSAKeyPair, error) {
	var keys []*RSAKeyPair
	err := r.db.WithContext(ctx).
		Where("status IN ?", []RSAKeyStatus{RSAKeyStatusActive, RSAKeyStatusRotating}).
		Find(&keys).Error
	return keys, err
}

func (r *gormRSAKeyRepository) Update(ctx context.Context, key *RSAKeyPair) error {
	return r.db.WithContext(ctx).Save(key).Error
}

func (r *gormRSAKeyRepository) UpdateStatus(ctx context.Context, keyID string, status RSAKeyStatus) error {
	return r.db.WithContext(ctx).
		Model(&RSAKeyPair{}).
		Where("key_id = ?", keyID).
		Update("status", status).Error
}

func (r *gormRSAKeyRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&RSAKeyPair{}, id).Error
}

// RSAKeyStore 内存密钥存储（用于快速验证）
type RSAKeyStore struct {
	keys       map[string]*rsa.PublicKey // keyID -> publicKey
	privateKey *rsa.PrivateKey           // 当前活跃私钥
	activeKID  string                    // 当前活跃密钥 ID
	mu         sync.RWMutex
}

// NewRSAKeyStore 创建密钥存储
func NewRSAKeyStore() *RSAKeyStore {
	return &RSAKeyStore{
		keys: make(map[string]*rsa.PublicKey),
	}
}

// LoadFromRepository 从仓储加载密钥
func (s *RSAKeyStore) LoadFromRepository(ctx context.Context, repo RSAKeyRepository) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 加载所有可用于验证的密钥
	keys, err := repo.ListForVerification(ctx)
	if err != nil {
		return err
	}

	s.keys = make(map[string]*rsa.PublicKey)

	for _, key := range keys {
		pubKey, err := ParseRSAPublicKeyFromPEM(key.PublicKey)
		if err != nil {
			fmt.Printf("Warning: failed to parse public key %s: %v\n", key.KeyID, err)
			continue
		}
		s.keys[key.KeyID] = pubKey

		// 加载活跃密钥的私钥
		if key.Status == RSAKeyStatusActive {
			privKey, err := ParseRSAPrivateKeyFromPEM(key.PrivateKey)
			if err != nil {
				fmt.Printf("Warning: failed to parse private key %s: %v\n", key.KeyID, err)
				continue
			}
			s.privateKey = privKey
			s.activeKID = key.KeyID
		}
	}

	return nil
}

// GetPublicKey 获取公钥
func (s *RSAKeyStore) GetPublicKey(keyID string) (*rsa.PublicKey, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	key, ok := s.keys[keyID]
	return key, ok
}

// GetActivePrivateKey 获取当前活跃私钥
func (s *RSAKeyStore) GetActivePrivateKey() (*rsa.PrivateKey, string, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.privateKey == nil {
		return nil, "", false
	}
	return s.privateKey, s.activeKID, true
}

// GetAllPublicKeys 获取所有公钥（用于 JWKS）
func (s *RSAKeyStore) GetAllPublicKeys() map[string]*rsa.PublicKey {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make(map[string]*rsa.PublicKey)
	for k, v := range s.keys {
		result[k] = v
	}
	return result
}

// GenerateRSAKeyPair 生成 RSA 密钥对
func GenerateRSAKeyPair(bits int) (*RSAKeyPair, error) {
	if bits < 2048 {
		bits = 2048 // 最小 2048 位
	}

	// 生成私钥
	privateKey, err := rsa.GenerateKey(rand.Reader, bits)
	if err != nil {
		return nil, fmt.Errorf("failed to generate RSA key: %w", err)
	}

	// 编码私钥为 PEM
	privateKeyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(privateKey),
	})

	// 编码公钥为 PEM
	publicKeyBytes, err := x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal public key: %w", err)
	}
	publicKeyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: publicKeyBytes,
	})

	return &RSAKeyPair{
		KeyID:      uuid.New().String(),
		PrivateKey: string(privateKeyPEM),
		PublicKey:  string(publicKeyPEM),
		Algorithm:  "RS256",
		Status:     RSAKeyStatusActive,
	}, nil
}

// ParseRSAPrivateKeyFromPEM 从 PEM 解析私钥
func ParseRSAPrivateKeyFromPEM(pemStr string) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode([]byte(pemStr))
	if block == nil {
		return nil, errors.New("failed to decode PEM block")
	}

	switch block.Type {
	case "RSA PRIVATE KEY":
		return x509.ParsePKCS1PrivateKey(block.Bytes)
	case "PRIVATE KEY":
		key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
		if err != nil {
			return nil, err
		}
		rsaKey, ok := key.(*rsa.PrivateKey)
		if !ok {
			return nil, errors.New("not an RSA private key")
		}
		return rsaKey, nil
	default:
		return nil, fmt.Errorf("unsupported key type: %s", block.Type)
	}
}

// ParseRSAPublicKeyFromPEM 从 PEM 解析公钥
func ParseRSAPublicKeyFromPEM(pemStr string) (*rsa.PublicKey, error) {
	block, _ := pem.Decode([]byte(pemStr))
	if block == nil {
		return nil, errors.New("failed to decode PEM block")
	}

	switch block.Type {
	case "RSA PUBLIC KEY":
		return x509.ParsePKCS1PublicKey(block.Bytes)
	case "PUBLIC KEY":
		key, err := x509.ParsePKIXPublicKey(block.Bytes)
		if err != nil {
			return nil, err
		}
		rsaKey, ok := key.(*rsa.PublicKey)
		if !ok {
			return nil, errors.New("not an RSA public key")
		}
		return rsaKey, nil
	default:
		return nil, fmt.Errorf("unsupported key type: %s", block.Type)
	}
}
