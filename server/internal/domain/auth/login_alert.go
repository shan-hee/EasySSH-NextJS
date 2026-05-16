package auth

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AlertType 告警类型
type AlertType string

const (
	AlertTypeNewDevice     AlertType = "new_device"     // 新设备登录
	AlertTypeNewLocation   AlertType = "new_location"   // 新地理位置登录
	AlertTypeSuspiciousIP  AlertType = "suspicious_ip"  // 可疑 IP 登录
	AlertTypeMultipleFails AlertType = "multiple_fails" // 多次登录失败
)

// LoginAlert 登录告警记录
type LoginAlert struct {
	ID           uuid.UUID  `gorm:"type:char(36);primary_key" json:"id"`
	UserID       uuid.UUID  `gorm:"type:char(36);not null;index:idx_alert_user_time,priority:1" json:"user_id"`
	SessionID    uuid.UUID  `gorm:"type:char(36)" json:"session_id"`
	AlertType    AlertType  `gorm:"size:50;index" json:"alert_type"` // new_device, new_location, suspicious_ip
	IPAddress    string     `gorm:"size:45" json:"ip_address"`
	Location     string     `gorm:"size:200" json:"location"`
	DeviceInfo   string     `gorm:"type:text" json:"device_info"`
	NotifiedAt   *time.Time `json:"notified_at"`                             // 通知发送时间
	Acknowledged bool       `gorm:"default:false;index" json:"acknowledged"` // 用户是否确认
	CreatedAt    time.Time  `gorm:"index:idx_alert_user_time,priority:2,sort:desc" json:"created_at"`
}

// TableName 指定表名
func (LoginAlert) TableName() string {
	return "login_alerts"
}

// BeforeCreate GORM 钩子
func (l *LoginAlert) BeforeCreate(tx *gorm.DB) error {
	if l.ID == uuid.Nil {
		l.ID = uuid.New()
	}
	if l.CreatedAt.IsZero() {
		l.CreatedAt = time.Now()
	}
	return nil
}

// LoginAlertRepository 登录告警仓储接口
type LoginAlertRepository interface {
	// Create 创建登录告警
	Create(ctx context.Context, alert *LoginAlert) error

	// FindByID 根据 ID 查找告警
	FindByID(ctx context.Context, id uuid.UUID) (*LoginAlert, error)

	// ListByUser 获取用户的告警列表
	ListByUser(ctx context.Context, userID uuid.UUID, limit int) ([]*LoginAlert, error)

	// ListUnacknowledged 获取用户未确认的告警
	ListUnacknowledged(ctx context.Context, userID uuid.UUID) ([]*LoginAlert, error)

	// Update 更新告警
	Update(ctx context.Context, alert *LoginAlert) error

	// Acknowledge 确认告警
	Acknowledge(ctx context.Context, id uuid.UUID) error

	// CountUnacknowledged 统计未确认告警数量
	CountUnacknowledged(ctx context.Context, userID uuid.UUID) (int64, error)

	// DeleteOlderThan 删除指定时间之前的记录
	DeleteOlderThan(ctx context.Context, before time.Time) (int64, error)
}

// gormLoginAlertRepository GORM 实现
type gormLoginAlertRepository struct {
	db *gorm.DB
}

// NewLoginAlertRepository 创建登录告警仓储
func NewLoginAlertRepository(db *gorm.DB) LoginAlertRepository {
	return &gormLoginAlertRepository{db: db}
}

func (r *gormLoginAlertRepository) Create(ctx context.Context, alert *LoginAlert) error {
	return r.db.WithContext(ctx).Create(alert).Error
}

func (r *gormLoginAlertRepository) FindByID(ctx context.Context, id uuid.UUID) (*LoginAlert, error) {
	var alert LoginAlert
	err := r.db.WithContext(ctx).First(&alert, "id = ?", id).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &alert, nil
}

func (r *gormLoginAlertRepository) ListByUser(ctx context.Context, userID uuid.UUID, limit int) ([]*LoginAlert, error) {
	var alerts []*LoginAlert
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Find(&alerts).Error
	return alerts, err
}

func (r *gormLoginAlertRepository) ListUnacknowledged(ctx context.Context, userID uuid.UUID) ([]*LoginAlert, error) {
	var alerts []*LoginAlert
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND acknowledged = ?", userID, false).
		Order("created_at DESC").
		Find(&alerts).Error
	return alerts, err
}

func (r *gormLoginAlertRepository) Update(ctx context.Context, alert *LoginAlert) error {
	return r.db.WithContext(ctx).Save(alert).Error
}

func (r *gormLoginAlertRepository) Acknowledge(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).
		Model(&LoginAlert{}).
		Where("id = ?", id).
		Update("acknowledged", true).Error
}

func (r *gormLoginAlertRepository) CountUnacknowledged(ctx context.Context, userID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&LoginAlert{}).
		Where("user_id = ? AND acknowledged = ?", userID, false).
		Count(&count).Error
	return count, err
}

func (r *gormLoginAlertRepository) DeleteOlderThan(ctx context.Context, before time.Time) (int64, error) {
	result := r.db.WithContext(ctx).Where("created_at < ?", before).Delete(&LoginAlert{})
	return result.RowsAffected, result.Error
}
