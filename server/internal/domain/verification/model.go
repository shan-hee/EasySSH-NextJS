package verification

import "time"

// VerificationCode 验证码数据结构
type VerificationCode struct {
	Code      string    `json:"code"`       // 验证码
	Email     string    `json:"email"`      // 邮箱地址
	Attempts  int       `json:"attempts"`   // 验证尝试次数
	CreatedAt time.Time `json:"created_at"` // 创建时间
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
