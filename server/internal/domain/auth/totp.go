package auth

import (
	"crypto/rand"
	"encoding/base32"
	"encoding/json"
	"fmt"

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

// VerifyBackupCode 验证备份码并返回剩余的备份码
func (s *totpService) VerifyBackupCode(storedCodesJSON, code string) (bool, string, error) {
	var storedCodes []string
	if err := json.Unmarshal([]byte(storedCodesJSON), &storedCodes); err != nil {
		return false, "", fmt.Errorf("failed to unmarshal backup codes: %w", err)
	}

	// 查找并移除使用过的备份码
	for i, storedCode := range storedCodes {
		if storedCode == code {
			// 移除这个备份码
			storedCodes = append(storedCodes[:i], storedCodes[i+1:]...)

			// 序列化剩余的备份码
			updatedCodesJSON, err := json.Marshal(storedCodes)
			if err != nil {
				return false, "", fmt.Errorf("failed to marshal backup codes: %w", err)
			}

			return true, string(updatedCodesJSON), nil
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
