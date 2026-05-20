package password

import (
	"errors"
	"strconv"
	"strings"
	"unicode"

	zxcvbn "github.com/nbutton23/zxcvbn-go"
)

const (
	defaultMinZxcvbnScore = 2
	strictMinZxcvbnScore  = 3
)

// ValidationError 密码验证错误
type ValidationError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e *ValidationError) Error() string {
	return e.Message
}

// Policy 密码策略配置
type Policy struct {
	MinLength        int  // 最小长度（默认 8）
	MaxLength        int  // 最大长度（默认 128）
	RequireUppercase bool // 是否需要大写字母
	RequireLowercase bool // 是否需要小写字母
	RequireDigit     bool // 是否需要数字
	RequireSpecial   bool // 是否需要特殊字符
}

// DefaultPolicy 默认密码策略
func DefaultPolicy() *Policy {
	return &Policy{
		MinLength:        8,
		MaxLength:        128,
		RequireUppercase: true,
		RequireLowercase: true,
		RequireDigit:     true,
		RequireSpecial:   false, // 特殊字符为可选，提升用户体验
	}
}

// StrictPolicy 严格密码策略（用于管理员账户）
func StrictPolicy() *Policy {
	return &Policy{
		MinLength:        10,
		MaxLength:        128,
		RequireUppercase: true,
		RequireLowercase: true,
		RequireDigit:     true,
		RequireSpecial:   true,
	}
}

// Validate 验证密码是否符合策略
func Validate(password string, policy *Policy) error {
	if policy == nil {
		policy = DefaultPolicy()
	}

	// 检查长度
	length := len(password)
	if length < policy.MinLength {
		return &ValidationError{
			Code:    "password_too_short",
			Message: "密码长度至少需要 " + strconv.Itoa(policy.MinLength) + " 个字符",
		}
	}
	if length > policy.MaxLength {
		return &ValidationError{
			Code:    "password_too_long",
			Message: "密码长度不能超过 128 个字符",
		}
	}

	var hasUpper, hasLower, hasDigit, hasSpecial bool

	for _, char := range password {
		switch {
		case unicode.IsUpper(char):
			hasUpper = true
		case unicode.IsLower(char):
			hasLower = true
		case unicode.IsDigit(char):
			hasDigit = true
		case isSpecialChar(char):
			hasSpecial = true
		}
	}

	// 检查各项要求
	if policy.RequireUppercase && !hasUpper {
		return &ValidationError{
			Code:    "password_missing_uppercase",
			Message: "密码需要包含至少一个大写字母",
		}
	}

	if policy.RequireLowercase && !hasLower {
		return &ValidationError{
			Code:    "password_missing_lowercase",
			Message: "密码需要包含至少一个小写字母",
		}
	}

	if policy.RequireDigit && !hasDigit {
		return &ValidationError{
			Code:    "password_missing_digit",
			Message: "密码需要包含至少一个数字",
		}
	}

	if policy.RequireSpecial && !hasSpecial {
		return &ValidationError{
			Code:    "password_missing_special",
			Message: "密码需要包含至少一个特殊字符（如 !@#$%^&*）",
		}
	}

	// 检查常见弱密码
	if isCommonPassword(password) {
		return &ValidationError{
			Code:    "password_too_common",
			Message: "密码过于简单，请使用更复杂的密码",
		}
	}

	minScore := defaultMinZxcvbnScore
	if policy.RequireSpecial || policy.MinLength >= 10 {
		minScore = strictMinZxcvbnScore
	}
	if zxcvbn.PasswordStrength(password, nil).Score < minScore {
		return &ValidationError{
			Code:    "password_too_weak",
			Message: "密码强度不足，请避免常见词、连续字符或容易猜测的组合",
		}
	}
	if err := ValidateNotPwned(password); err != nil {
		return err
	}

	return nil
}

// ValidateWithDefault 使用默认策略验证密码
func ValidateWithDefault(password string) error {
	return Validate(password, DefaultPolicy())
}

// isSpecialChar 检查是否为特殊字符
func isSpecialChar(char rune) bool {
	specialChars := "!@#$%^&*()_+-=[]{}|;':\",./<>?`~"
	return strings.ContainsRune(specialChars, char)
}

// isCommonPassword 检查是否为常见弱密码
func isCommonPassword(password string) bool {
	lower := strings.ToLower(password)

	// 常见弱密码列表
	commonPasswords := []string{
		"password", "123456", "12345678", "qwerty", "abc123",
		"monkey", "1234567", "letmein", "trustno1", "dragon",
		"baseball", "iloveyou", "master", "sunshine", "ashley",
		"bailey", "shadow", "123123", "654321", "superman",
		"qazwsx", "michael", "football", "password1", "password123",
		"welcome", "welcome1", "admin", "admin123", "root",
		"toor", "pass", "test", "guest", "master",
		"changeme", "passwd", "administrator", "login", "hello",
	}

	for _, common := range commonPasswords {
		if lower == common {
			return true
		}
	}

	// 检查简单序列
	if isSequentialPattern(password) {
		return true
	}

	// 检查重复字符
	if isRepeatedPattern(password) {
		return true
	}

	return false
}

// isSequentialPattern 检查是否为顺序模式（如 12345678, abcdefgh）
func isSequentialPattern(password string) bool {
	if len(password) < 4 {
		return false
	}

	sequential := true
	reverseSequential := true

	for i := 1; i < len(password); i++ {
		diff := int(password[i]) - int(password[i-1])
		if diff != 1 {
			sequential = false
		}
		if diff != -1 {
			reverseSequential = false
		}
	}

	return sequential || reverseSequential
}

// isRepeatedPattern 检查是否为重复模式（如 aaaaaaaa, abababab）
func isRepeatedPattern(password string) bool {
	if len(password) < 4 {
		return false
	}

	// 检查单字符重复
	allSame := true
	for i := 1; i < len(password); i++ {
		if password[i] != password[0] {
			allSame = false
			break
		}
	}
	if allSame {
		return true
	}

	// 检查双字符重复（如 abab）
	if len(password) >= 4 && len(password)%2 == 0 {
		pattern := password[:2]
		repeated := strings.Repeat(pattern, len(password)/2)
		if password == repeated {
			return true
		}
	}

	return false
}

// CheckStrength 检查密码强度并返回分数（0-4）
// 0: 非常弱, 1: 弱, 2: 一般, 3: 强, 4: 非常强
func CheckStrength(password string) int {
	if strings.TrimSpace(password) == "" {
		return 0
	}

	score := zxcvbn.PasswordStrength(password, nil).Score
	if score < 0 {
		return 0
	}
	if score > 4 {
		return 4
	}
	return score
}

func checkStrengthByRules(password string) int {
	score := 0

	if len(password) >= 8 {
		score++
	}
	if len(password) >= 12 {
		score++
	}

	var hasUpper, hasLower, hasDigit, hasSpecial bool
	for _, char := range password {
		switch {
		case unicode.IsUpper(char):
			hasUpper = true
		case unicode.IsLower(char):
			hasLower = true
		case unicode.IsDigit(char):
			hasDigit = true
		case isSpecialChar(char):
			hasSpecial = true
		}
	}

	charTypes := 0
	if hasUpper {
		charTypes++
	}
	if hasLower {
		charTypes++
	}
	if hasDigit {
		charTypes++
	}
	if hasSpecial {
		charTypes++
	}

	if charTypes >= 3 {
		score++
	}
	if charTypes >= 4 {
		score++
	}

	// 如果是常见密码，强制降低分数
	if isCommonPassword(password) {
		return 0
	}

	return score
}

// IsValidationError 检查是否为密码验证错误
func IsValidationError(err error) bool {
	var validationErr *ValidationError
	return errors.As(err, &validationErr)
}
