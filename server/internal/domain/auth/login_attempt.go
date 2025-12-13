package auth

import (
	"time"

	"gorm.io/gorm"
)

// LoginAttempt 登录尝试记录（用于审计和检测分布式攻击）
type LoginAttempt struct {
	ID         uint      `gorm:"primarykey" json:"id"`
	Email      string    `gorm:"size:100;index:idx_attempt_email_time,priority:1" json:"email"`       // 尝试登录的邮箱
	IPAddress  string    `gorm:"size:45;index:idx_attempt_ip_time,priority:1" json:"ip_address"`      // 来源 IP
	UserAgent  string    `gorm:"type:text" json:"user_agent"`                                         // User-Agent
	Success    bool      `gorm:"default:false;index" json:"success"`                                  // 是否成功
	FailReason string    `gorm:"size:100" json:"fail_reason"`                                         // 失败原因
	CreatedAt  time.Time `gorm:"index:idx_attempt_email_time,priority:2;index:idx_attempt_ip_time,priority:2;index" json:"created_at"`
}

// TableName 指定表名
func (LoginAttempt) TableName() string {
	return "login_attempts"
}

// BeforeCreate GORM 钩子
func (l *LoginAttempt) BeforeCreate(tx *gorm.DB) error {
	if l.CreatedAt.IsZero() {
		l.CreatedAt = time.Now()
	}
	return nil
}

// LoginAttemptRepository 登录尝试记录仓储接口
type LoginAttemptRepository interface {
	// Create 创建登录尝试记录
	Create(attempt *LoginAttempt) error

	// CountByEmail 统计指定邮箱在时间窗口内的失败次数
	CountFailedByEmail(email string, since time.Time) (int64, error)

	// CountByIP 统计指定 IP 在时间窗口内的失败次数
	CountFailedByIP(ip string, since time.Time) (int64, error)

	// ListByEmail 获取指定邮箱的登录尝试记录
	ListByEmail(email string, limit int) ([]*LoginAttempt, error)

	// ListByIP 获取指定 IP 的登录尝试记录
	ListByIP(ip string, limit int) ([]*LoginAttempt, error)

	// DeleteOlderThan 删除指定时间之前的记录（用于清理）
	DeleteOlderThan(before time.Time) (int64, error)
}

// gormLoginAttemptRepository GORM 实现
type gormLoginAttemptRepository struct {
	db *gorm.DB
}

// NewLoginAttemptRepository 创建登录尝试记录仓储
func NewLoginAttemptRepository(db *gorm.DB) LoginAttemptRepository {
	return &gormLoginAttemptRepository{db: db}
}

func (r *gormLoginAttemptRepository) Create(attempt *LoginAttempt) error {
	return r.db.Create(attempt).Error
}

func (r *gormLoginAttemptRepository) CountFailedByEmail(email string, since time.Time) (int64, error) {
	var count int64
	err := r.db.Model(&LoginAttempt{}).
		Where("email = ? AND success = ? AND created_at >= ?", email, false, since).
		Count(&count).Error
	return count, err
}

func (r *gormLoginAttemptRepository) CountFailedByIP(ip string, since time.Time) (int64, error) {
	var count int64
	err := r.db.Model(&LoginAttempt{}).
		Where("ip_address = ? AND success = ? AND created_at >= ?", ip, false, since).
		Count(&count).Error
	return count, err
}

func (r *gormLoginAttemptRepository) ListByEmail(email string, limit int) ([]*LoginAttempt, error) {
	var attempts []*LoginAttempt
	err := r.db.Where("email = ?", email).
		Order("created_at DESC").
		Limit(limit).
		Find(&attempts).Error
	return attempts, err
}

func (r *gormLoginAttemptRepository) ListByIP(ip string, limit int) ([]*LoginAttempt, error) {
	var attempts []*LoginAttempt
	err := r.db.Where("ip_address = ?", ip).
		Order("created_at DESC").
		Limit(limit).
		Find(&attempts).Error
	return attempts, err
}

func (r *gormLoginAttemptRepository) DeleteOlderThan(before time.Time) (int64, error) {
	result := r.db.Where("created_at < ?", before).Delete(&LoginAttempt{})
	return result.RowsAffected, result.Error
}
