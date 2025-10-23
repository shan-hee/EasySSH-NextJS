package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
)

var (
	ErrInvalidKey        = errors.New("invalid encryption key")
	ErrInvalidCiphertext = errors.New("invalid ciphertext")
)

// Encryptor AES 加密器
type Encryptor struct {
	key []byte
}

// NewEncryptor 创建加密器
// key 必须是 16、24 或 32 字节（对应 AES-128、AES-192、AES-256）
func NewEncryptor(key string) (*Encryptor, error) {
	keyBytes := []byte(key)
	keyLen := len(keyBytes)

	// 验证密钥长度
	if keyLen != 16 && keyLen != 24 && keyLen != 32 {
		return nil, ErrInvalidKey
	}

	return &Encryptor{key: keyBytes}, nil
}

// Encrypt 加密数据
func (e *Encryptor) Encrypt(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}

	// 创建 AES cipher
	block, err := aes.NewCipher(e.key)
	if err != nil {
		return "", err
	}

	// 使用 GCM 模式
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	// 生成随机 nonce
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	// 加密
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)

	// Base64 编码
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt 解密数据
func (e *Encryptor) Decrypt(ciphertext string) (string, error) {
	if ciphertext == "" {
		return "", nil
	}

	// Base64 解码
	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", ErrInvalidCiphertext
	}

	// 创建 AES cipher
	block, err := aes.NewCipher(e.key)
	if err != nil {
		return "", err
	}

	// 使用 GCM 模式
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	// 验证数据长度
	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", ErrInvalidCiphertext
	}

	// 提取 nonce 和 ciphertext
	nonce, cipherBytes := data[:nonceSize], data[nonceSize:]

	// 解密
	plaintext, err := gcm.Open(nil, nonce, cipherBytes, nil)
	if err != nil {
		return "", ErrInvalidCiphertext
	}

	return string(plaintext), nil
}
