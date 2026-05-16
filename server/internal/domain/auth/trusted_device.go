package auth

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// TrustedDevice 可信设备记录
type TrustedDevice struct {
	ID                uuid.UUID `gorm:"type:char(36);primary_key" json:"id"`
	UserID            uuid.UUID `gorm:"type:char(36);not null;index:idx_trusted_user_fp,priority:1" json:"user_id"`
	DeviceFingerprint string    `gorm:"size:64;index:idx_trusted_user_fp,priority:2" json:"device_fingerprint"` // 设备指纹（哈希）
	DeviceType        string    `gorm:"size:50" json:"device_type"`                                             // desktop, mobile, tablet
	DeviceName        string    `gorm:"size:200" json:"device_name"`                                            // 浏览器/设备名称
	LastIPAddress     string    `gorm:"size:45" json:"last_ip_address"`                                         // 最后使用的 IP
	LastLocation      string    `gorm:"size:200" json:"last_location"`                                          // 最后使用的位置
	TrustLevel        int       `gorm:"default:1" json:"trust_level"`                                           // 信任等级 1-10
	LastUsed          time.Time `json:"last_used"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// TableName 指定表名
func (TrustedDevice) TableName() string {
	return "trusted_devices"
}

// BeforeCreate GORM 钩子
func (t *TrustedDevice) BeforeCreate(tx *gorm.DB) error {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	if t.LastUsed.IsZero() {
		t.LastUsed = time.Now()
	}
	return nil
}

// TrustedDeviceRepository 可信设备仓储接口
type TrustedDeviceRepository interface {
	// Create 创建可信设备记录
	Create(ctx context.Context, device *TrustedDevice) error

	// FindByUserAndFingerprint 根据用户ID和设备指纹查找
	FindByUserAndFingerprint(ctx context.Context, userID uuid.UUID, fingerprint string) (*TrustedDevice, error)

	// ListByUser 获取用户的所有可信设备
	ListByUser(ctx context.Context, userID uuid.UUID) ([]*TrustedDevice, error)

	// Update 更新可信设备
	Update(ctx context.Context, device *TrustedDevice) error

	// Delete 删除可信设备
	Delete(ctx context.Context, id uuid.UUID) error

	// DeleteByUser 删除用户的所有可信设备
	DeleteByUser(ctx context.Context, userID uuid.UUID) error
}

// gormTrustedDeviceRepository GORM 实现
type gormTrustedDeviceRepository struct {
	db *gorm.DB
}

// NewTrustedDeviceRepository 创建可信设备仓储
func NewTrustedDeviceRepository(db *gorm.DB) TrustedDeviceRepository {
	return &gormTrustedDeviceRepository{db: db}
}

func (r *gormTrustedDeviceRepository) Create(ctx context.Context, device *TrustedDevice) error {
	return r.db.WithContext(ctx).Create(device).Error
}

func (r *gormTrustedDeviceRepository) FindByUserAndFingerprint(ctx context.Context, userID uuid.UUID, fingerprint string) (*TrustedDevice, error) {
	var device TrustedDevice
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND device_fingerprint = ?", userID, fingerprint).
		First(&device).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &device, nil
}

func (r *gormTrustedDeviceRepository) ListByUser(ctx context.Context, userID uuid.UUID) ([]*TrustedDevice, error) {
	var devices []*TrustedDevice
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("last_used DESC").
		Find(&devices).Error
	return devices, err
}

func (r *gormTrustedDeviceRepository) Update(ctx context.Context, device *TrustedDevice) error {
	return r.db.WithContext(ctx).Save(device).Error
}

func (r *gormTrustedDeviceRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&TrustedDevice{}, "id = ?", id).Error
}

func (r *gormTrustedDeviceRepository) DeleteByUser(ctx context.Context, userID uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&TrustedDevice{}, "user_id = ?", userID).Error
}
