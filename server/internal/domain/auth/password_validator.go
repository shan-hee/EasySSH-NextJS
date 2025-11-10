package auth

import (
	"errors"
	"strings"
	"unicode"
)

// PasswordPolicy 密码策略配置
type PasswordPolicy struct {
	MinLength      int  // 最小长度
	RequireUpper   bool // 需要大写字母
	RequireLower   bool // 需要小写字母
	RequireDigit   bool // 需要数字
	RequireSpecial bool // 需要特殊字符
}

// DefaultPasswordPolicy 默认密码策略
var DefaultPasswordPolicy = PasswordPolicy{
	MinLength:      8,
	RequireUpper:   true,
	RequireLower:   true,
	RequireDigit:   true,
	RequireSpecial: false, // 特殊字符可选，避免过于严格
}

// CommonPasswords 常见弱密码黑名单（部分示例）
var CommonPasswords = map[string]bool{
	"password":   true,
	"12345678":   true,
	"123456789":  true,
	"qwerty":     true,
	"abc123":     true,
	"password1":  true,
	"password123": true,
	"admin":      true,
	"admin123":   true,
	"root":       true,
	"root123":    true,
	"user":       true,
	"user123":    true,
	"test":       true,
	"test123":    true,
	"welcome":    true,
	"welcome123": true,
	"letmein":    true,
	"monkey":     true,
	"dragon":     true,
	"master":     true,
	"sunshine":   true,
	"princess":   true,
	"football":   true,
	"baseball":   true,
	"superman":   true,
	"batman":     true,
	"trustno1":   true,
	"iloveyou":   true,
}

// ValidatePassword 验证密码是否符合策略
func ValidatePassword(password string, policy PasswordPolicy) error {
	// 检查长度
	if len(password) < policy.MinLength {
		return errors.New("密码长度至少需要 8 个字符")
	}

	// 检查常见弱密码
	if CommonPasswords[strings.ToLower(password)] {
		return errors.New("密码过于简单，请使用更复杂的密码")
	}

	var (
		hasUpper   bool
		hasLower   bool
		hasDigit   bool
		hasSpecial bool
	)

	// 遍历密码字符
	for _, char := range password {
		switch {
		case unicode.IsUpper(char):
			hasUpper = true
		case unicode.IsLower(char):
			hasLower = true
		case unicode.IsDigit(char):
			hasDigit = true
		case unicode.IsPunct(char) || unicode.IsSymbol(char):
			hasSpecial = true
		}
	}

	// 检查大写字母
	if policy.RequireUpper && !hasUpper {
		return errors.New("密码必须包含至少一个大写字母")
	}

	// 检查小写字母
	if policy.RequireLower && !hasLower {
		return errors.New("密码必须包含至少一个小写字母")
	}

	// 检查数字
	if policy.RequireDigit && !hasDigit {
		return errors.New("密码必须包含至少一个数字")
	}

	// 检查特殊字符
	if policy.RequireSpecial && !hasSpecial {
		return errors.New("密码必须包含至少一个特殊字符")
	}

	return nil
}

// ValidatePasswordWithDefault 使用默认策略验证密码
func ValidatePasswordWithDefault(password string) error {
	return ValidatePassword(password, DefaultPasswordPolicy)
}

// GetPasswordStrength 评估密码强度（0-4）
func GetPasswordStrength(password string) int {
	strength := 0

	// 长度评分
	if len(password) >= 8 {
		strength++
	}
	if len(password) >= 12 {
		strength++
	}

	var (
		hasUpper   bool
		hasLower   bool
		hasDigit   bool
		hasSpecial bool
	)

	for _, char := range password {
		switch {
		case unicode.IsUpper(char):
			hasUpper = true
		case unicode.IsLower(char):
			hasLower = true
		case unicode.IsDigit(char):
			hasDigit = true
		case unicode.IsPunct(char) || unicode.IsSymbol(char):
			hasSpecial = true
		}
	}

	// 复杂度评分
	complexity := 0
	if hasUpper {
		complexity++
	}
	if hasLower {
		complexity++
	}
	if hasDigit {
		complexity++
	}
	if hasSpecial {
		complexity++
	}

	// 至少3种字符类型
	if complexity >= 3 {
		strength++
	}
	// 全部4种字符类型
	if complexity == 4 {
		strength++
	}

	// 检查是否是常见密码
	if CommonPasswords[strings.ToLower(password)] {
		strength = 0
	}

	return strength
}
