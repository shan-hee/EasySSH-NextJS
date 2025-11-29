package auth

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
)

var (
	// ErrInvalidEncryptionKey 加密密钥无效
	ErrInvalidEncryptionKey = errors.New("invalid encryption key: must be 32 bytes")
	// ErrInvalidCiphertext 密文无效
	ErrInvalidCiphertext = errors.New("invalid ciphertext")
)

// getEncryptionKey 从环境变量获取加密密钥（32字节）
// 使用现有的 ENCRYPTION_KEY 环境变量
func getEncryptionKey() ([]byte, error) {
	keyStr := os.Getenv("ENCRYPTION_KEY")
	if keyStr == "" {
		return nil, fmt.Errorf("ENCRYPTION_KEY environment variable not set")
	}

	// 将 ENCRYPTION_KEY 视为 Base64 编码的密钥
	key, err := base64.StdEncoding.DecodeString(keyStr)
	if err != nil || len(key) != 32 {
		return nil, ErrInvalidEncryptionKey
	}

	return key, nil
}

// EncryptBackupCodes 使用 AES-256-GCM 加密备份码列表
// 返回 Base64 编码的密文（格式：nonce + ciphertext）
func EncryptBackupCodes(codes []string) (string, error) {
	key, err := getEncryptionKey()
	if err != nil {
		return "", err
	}

	// 序列化为 JSON
	plaintext, err := json.Marshal(codes)
	if err != nil {
		return "", fmt.Errorf("failed to marshal codes: %w", err)
	}

	// 创建 AES cipher
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	// 创建 GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	// 生成随机 nonce
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("failed to generate nonce: %w", err)
	}

	// 加密（nonce + ciphertext）
	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)

	// Base64 编码
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// DecryptBackupCodes 解密备份码列表
// 输入为 Base64 编码的密文，返回备份码数组
func DecryptBackupCodes(encrypted string) ([]string, error) {
	key, err := getEncryptionKey()
	if err != nil {
		return nil, err
	}

	// Base64 解码
	ciphertext, err := base64.StdEncoding.DecodeString(encrypted)
	if err != nil {
		return nil, fmt.Errorf("failed to decode ciphertext: %w", err)
	}

	// 创建 AES cipher
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	// 创建 GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	// 检查密文长度
	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, ErrInvalidCiphertext
	}

	// 提取 nonce 和实际密文
	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]

	// 解密
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt: %w", err)
	}

	// 反序列化 JSON
	var codes []string
	if err := json.Unmarshal(plaintext, &codes); err != nil {
		return nil, fmt.Errorf("failed to unmarshal codes: %w", err)
	}

	return codes, nil
}
