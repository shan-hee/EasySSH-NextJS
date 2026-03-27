package auth

import (
	"crypto/rand"
	"encoding/base32"
	"fmt"
	"strings"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
)

// TOTPService TOTP 服务接口
type TOTPService interface {
	// GenerateSecret 生成 TOTP secret
	GenerateSecret(username string) (string, string, error)

	// ValidateCode 验证 TOTP 代码
	ValidateCode(secret, code string) bool

	// GenerateBackupCodes 生成备份码
	GenerateBackupCodes() ([]string, error)

	// VerifyBackupCode 验证备份码
	VerifyBackupCode(storedCodes, code string) (bool, string, error)
}

type totpService struct{}

// NewTOTPService 创建 TOTP 服务
func NewTOTPService() TOTPService {
	return &totpService{}
}

// GenerateSecret 生成 TOTP secret 和二维码 URL
func (s *totpService) GenerateSecret(username string) (string, string, error) {
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "EasySSH",
		AccountName: username,
		Period:      30,
		Digits:      otp.DigitsSix,
		Algorithm:   otp.AlgorithmSHA1,
	})
	if err != nil {
		return "", "", fmt.Errorf("failed to generate TOTP key: %w", err)
	}

	return key.Secret(), key.URL(), nil
}

// ValidateCode 验证 TOTP 代码
func (s *totpService) ValidateCode(secret, code string) bool {
	return totp.Validate(code, secret)
}

// GenerateBackupCodes 生成 8 个备份码
func (s *totpService) GenerateBackupCodes() ([]string, error) {
	codes := make([]string, 8)
	for i := 0; i < 8; i++ {
		code, err := generateRandomCode(8)
		if err != nil {
			return nil, fmt.Errorf("failed to generate backup code: %w", err)
		}
		codes[i] = code
	}
	return codes, nil
}

// VerifyBackupCode 验证备份码并返回更新后的存储值。
// 备份码仅以带前缀的 HMAC 哈希列表形式存储。
func (s *totpService) VerifyBackupCode(storedCodes, code string) (bool, string, error) {
	normalizedCode := strings.ToUpper(strings.TrimSpace(code))
	if normalizedCode == "" {
		return false, "", nil
	}

	key, err := getEncryptionKey()
	if err != nil {
		return false, "", err
	}

	hashes, err := decodeBackupCodeHashes(storedCodes)
	if err != nil {
		return false, "", fmt.Errorf("failed to decode backup code hashes: %w", err)
	}

	for i, storedHash := range hashes {
		if verifyHashedBackupCode(storedHash, normalizedCode, key) {
			hashes = append(hashes[:i], hashes[i+1:]...)
			updatedHashes, err := encodeBackupCodeHashes(hashes)
			if err != nil {
				return false, "", fmt.Errorf("failed to encode updated backup code hashes: %w", err)
			}
			return true, updatedHashes, nil
		}
	}

	return false, "", nil
}

// generateRandomCode 生成随机代码
func generateRandomCode(length int) (string, error) {
	// 生成随机字节
	randomBytes := make([]byte, length)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", err
	}

	// 使用 base32 编码（去除填充符）
	code := base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(randomBytes)

	// 截取指定长度并转为大写
	if len(code) > length {
		code = code[:length]
	}

	return code, nil
}

// BackupCode 备份码响应结构
type BackupCode struct {
	Code string `json:"code"`
}

// BackupCodesResponse 备份码列表响应
type BackupCodesResponse struct {
	Codes []string `json:"codes"`
}
