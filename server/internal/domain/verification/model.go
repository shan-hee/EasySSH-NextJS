package verification

import "time"

// VerificationCodeType 验证码类型
type VerificationCodeType string

const (
	// TypeRegister 注册验证码
	TypeRegister VerificationCodeType = "register"
	// TypePasswordReset 密码重置验证码
	TypePasswordReset VerificationCodeType = "password_reset"
	// TypeEmailChange 邮箱变更验证码
	TypeEmailChange VerificationCodeType = "email_change"
)

// VerificationCode 验证码数据结构
type VerificationCode struct {
	Code      string               `json:"code"`       // 验证码
	Email     string               `json:"email"`      // 邮箱地址
	Type      VerificationCodeType `json:"type"`       // 验证码类型
	Attempts  int                  `json:"attempts"`   // 验证尝试次数
	CreatedAt time.Time            `json:"created_at"` // 创建时间
}

// VerificationCodeRequest 发送验证码请求
type VerificationCodeRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// VerificationCodeResponse 发送验证码响应
type VerificationCodeResponse struct {
	Message   string `json:"message"`
	ExpiresIn int    `json:"expires_in"` // 过期时间（秒）
}
