package sshkey

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ed25519"
	"crypto/md5"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"strings"

	"golang.org/x/crypto/ssh"
)

// Service defines the interface for SSH key business logic
type Service interface {
	GenerateKeyPair(req *CreateSSHKeyRequest, userID uint) (*SSHKeyResponse, error)
	ImportKeyPair(req *ImportSSHKeyRequest, userID uint) (*SSHKeyResponse, error)
	GetUserKeys(userID uint) ([]SSHKey, error)
	DeleteKey(keyID uint, userID uint) error
}

type service struct {
	repo          Repository
	encryptionKey []byte
}

// NewService creates a new SSH key service
func NewService(repo Repository, encryptionKey string) Service {
	// 使用MD5哈希encryptionKey以获得固定长度的密钥
	hash := md5.Sum([]byte(encryptionKey))
	return &service{
		repo:          repo,
		encryptionKey: hash[:],
	}
}

// GenerateKeyPair generates a new SSH key pair
func (s *service) GenerateKeyPair(req *CreateSSHKeyRequest, userID uint) (*SSHKeyResponse, error) {
	var privateKey interface{}
	var err error
	var algorithm string
	var keySize int

	switch req.Algorithm {
	case "rsa":
		algorithm = "rsa"
		keySize = req.KeySize
		if keySize == 0 {
			keySize = 2048 // 默认2048位
		}
		if keySize < 2048 || keySize > 4096 {
			return nil, errors.New("RSA key size must be between 2048 and 4096")
		}
		privateKey, err = rsa.GenerateKey(rand.Reader, keySize)
		if err != nil {
			return nil, fmt.Errorf("failed to generate RSA key: %w", err)
		}
	case "ed25519":
		algorithm = "ed25519"
		keySize = 0
		_, privateKey, err = ed25519.GenerateKey(rand.Reader)
		if err != nil {
			return nil, fmt.Errorf("failed to generate ED25519 key: %w", err)
		}
	default:
		return nil, errors.New("unsupported algorithm, must be rsa or ed25519")
	}

	// 将私钥转换为PEM格式
	privateKeyPEM, err := encodePrivateKeyToPEM(privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to encode private key: %w", err)
	}

	// 生成公钥
	publicKey, err := generatePublicKey(privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to generate public key: %w", err)
	}

	// 计算指纹
	fingerprint, err := calculateFingerprint(publicKey)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate fingerprint: %w", err)
	}

	// 加密私钥
	encryptedPrivateKey, err := s.encryptPrivateKey(privateKeyPEM)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt private key: %w", err)
	}

	// 保存到数据库
	sshKey := &SSHKey{
		UserID:      userID,
		Name:        req.Name,
		PublicKey:   publicKey,
		PrivateKey:  encryptedPrivateKey,
		Fingerprint: fingerprint,
		Algorithm:   algorithm,
		KeySize:     keySize,
	}

	if err := s.repo.Create(sshKey); err != nil {
		return nil, fmt.Errorf("failed to save SSH key: %w", err)
	}

	// 返回响应（包含未加密的私钥，仅此一次）
	return &SSHKeyResponse{
		ID:          sshKey.ID,
		CreatedAt:   sshKey.CreatedAt,
		UserID:      sshKey.UserID,
		Name:        sshKey.Name,
		PublicKey:   sshKey.PublicKey,
		PrivateKey:  privateKeyPEM, // 返回原始私钥
		Fingerprint: sshKey.Fingerprint,
		Algorithm:   sshKey.Algorithm,
		KeySize:     sshKey.KeySize,
	}, nil
}

// ImportKeyPair imports an existing SSH key pair
func (s *service) ImportKeyPair(req *ImportSSHKeyRequest, userID uint) (*SSHKeyResponse, error) {
	// 解析私钥
	privateKeyPEM := strings.TrimSpace(req.PrivateKey)

	// 验证私钥格式
	block, _ := pem.Decode([]byte(privateKeyPEM))
	if block == nil {
		return nil, errors.New("invalid private key format: failed to decode PEM block")
	}

	// 尝试解析私钥
	var privateKey interface{}
	var err error
	var algorithm string
	var keySize int

	// 尝试解析为不同类型的私钥
	if strings.Contains(block.Type, "RSA") {
		privateKey, err = x509.ParsePKCS1PrivateKey(block.Bytes)
		if err != nil {
			// 尝试PKCS8格式
			privateKey, err = x509.ParsePKCS8PrivateKey(block.Bytes)
			if err != nil {
				return nil, fmt.Errorf("failed to parse RSA private key: %w", err)
			}
		}
		if rsaKey, ok := privateKey.(*rsa.PrivateKey); ok {
			algorithm = "rsa"
			keySize = rsaKey.N.BitLen()
		}
	} else if strings.Contains(block.Type, "OPENSSH") || strings.Contains(block.Type, "PRIVATE KEY") {
		// 尝试解析为OpenSSH格式
		privateKey, err = ssh.ParseRawPrivateKey([]byte(privateKeyPEM))
		if err != nil {
			return nil, fmt.Errorf("failed to parse private key: %w", err)
		}

		// 确定算法类型
		switch key := privateKey.(type) {
		case *rsa.PrivateKey:
			algorithm = "rsa"
			keySize = key.N.BitLen()
		case *ed25519.PrivateKey:
			algorithm = "ed25519"
			keySize = 0
		default:
			return nil, errors.New("unsupported key type, only RSA and ED25519 are supported")
		}
	} else {
		return nil, errors.New("unsupported private key type")
	}

	// 生成公钥
	publicKey, err := generatePublicKey(privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to generate public key: %w", err)
	}

	// 计算指纹
	fingerprint, err := calculateFingerprint(publicKey)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate fingerprint: %w", err)
	}

	// 加密私钥
	encryptedPrivateKey, err := s.encryptPrivateKey(privateKeyPEM)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt private key: %w", err)
	}

	// 保存到数据库
	sshKey := &SSHKey{
		UserID:      userID,
		Name:        req.Name,
		PublicKey:   publicKey,
		PrivateKey:  encryptedPrivateKey,
		Fingerprint: fingerprint,
		Algorithm:   algorithm,
		KeySize:     keySize,
	}

	if err := s.repo.Create(sshKey); err != nil {
		return nil, fmt.Errorf("failed to save SSH key: %w", err)
	}

	// 返回响应（包含原始私钥，仅此一次）
	return &SSHKeyResponse{
		ID:          sshKey.ID,
		CreatedAt:   sshKey.CreatedAt,
		UserID:      sshKey.UserID,
		Name:        sshKey.Name,
		PublicKey:   sshKey.PublicKey,
		PrivateKey:  privateKeyPEM,
		Fingerprint: sshKey.Fingerprint,
		Algorithm:   sshKey.Algorithm,
		KeySize:     sshKey.KeySize,
	}, nil
}

// GetUserKeys retrieves all SSH keys for a user
func (s *service) GetUserKeys(userID uint) ([]SSHKey, error) {
	return s.repo.FindByUserID(userID)
}

// DeleteKey deletes an SSH key
func (s *service) DeleteKey(keyID uint, userID uint) error {
	return s.repo.Delete(keyID, userID)
}

// encryptPrivateKey encrypts the private key using AES
func (s *service) encryptPrivateKey(privateKeyPEM string) (string, error) {
	block, err := aes.NewCipher(s.encryptionKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(privateKeyPEM), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// decryptPrivateKey decrypts the private key using AES (for future use)
func (s *service) decryptPrivateKey(encryptedKey string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(encryptedKey)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(s.encryptionKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", errors.New("ciphertext too short")
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

// encodePrivateKeyToPEM encodes a private key to PEM format
func encodePrivateKeyToPEM(privateKey interface{}) (string, error) {
	var pemBlock *pem.Block

	switch key := privateKey.(type) {
	case *rsa.PrivateKey:
		pemBlock = &pem.Block{
			Type:  "RSA PRIVATE KEY",
			Bytes: x509.MarshalPKCS1PrivateKey(key),
		}
	case ed25519.PrivateKey:
		bytes, err := x509.MarshalPKCS8PrivateKey(key)
		if err != nil {
			return "", err
		}
		pemBlock = &pem.Block{
			Type:  "PRIVATE KEY",
			Bytes: bytes,
		}
	default:
		return "", errors.New("unsupported private key type")
	}

	return string(pem.EncodeToMemory(pemBlock)), nil
}

// generatePublicKey generates an SSH public key from a private key
func generatePublicKey(privateKey interface{}) (string, error) {
	var publicKey ssh.PublicKey
	var err error

	switch key := privateKey.(type) {
	case *rsa.PrivateKey:
		publicKey, err = ssh.NewPublicKey(&key.PublicKey)
	case ed25519.PrivateKey:
		publicKey, err = ssh.NewPublicKey(key.Public())
	default:
		return "", errors.New("unsupported private key type")
	}

	if err != nil {
		return "", err
	}

	return string(ssh.MarshalAuthorizedKey(publicKey)), nil
}

// calculateFingerprint calculates the MD5 fingerprint of an SSH public key
func calculateFingerprint(publicKeyStr string) (string, error) {
	publicKeyStr = strings.TrimSpace(publicKeyStr)

	// 解析公钥
	publicKey, _, _, _, err := ssh.ParseAuthorizedKey([]byte(publicKeyStr))
	if err != nil {
		return "", err
	}

	// 计算MD5指纹
	hash := md5.Sum(publicKey.Marshal())

	// 格式化为 xx:xx:xx:xx:... 格式
	fingerprint := fmt.Sprintf("%02x", hash[0])
	for i := 1; i < len(hash); i++ {
		fingerprint += fmt.Sprintf(":%02x", hash[i])
	}

	return fingerprint, nil
}
