package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/easyssh/server/internal/pkg/geoip"
	"github.com/google/uuid"
)

// LoginDetectionService 登录检测服务接口
type LoginDetectionService interface {
	// CheckNewDevice 检查是否为新设备
	CheckNewDevice(ctx context.Context, userID uuid.UUID, fingerprint string) (isNew bool, err error)

	// CheckNewLocation 检查是否为新地理位置
	CheckNewLocation(ctx context.Context, userID uuid.UUID, ip string) (isNew bool, location string, err error)

	// RecordLogin 记录登录信息并触发通知
	RecordLogin(ctx context.Context, userID uuid.UUID, session *Session, fingerprint string) error

	// AddTrustedDevice 添加可信设备
	AddTrustedDevice(ctx context.Context, userID uuid.UUID, fingerprint, deviceType, deviceName, ip, location string) error

	// ListTrustedDevices 获取用户的可信设备列表
	ListTrustedDevices(ctx context.Context, userID uuid.UUID) ([]*TrustedDevice, error)

	// RemoveTrustedDevice 移除可信设备
	RemoveTrustedDevice(ctx context.Context, userID uuid.UUID, deviceID uuid.UUID) error

	// ListLoginAlerts 获取登录告警列表
	ListLoginAlerts(ctx context.Context, userID uuid.UUID, limit int) ([]*LoginAlert, error)

	// AcknowledgeAlert 确认告警
	AcknowledgeAlert(ctx context.Context, userID, alertID uuid.UUID) error

	// GetUnacknowledgedAlertCount 获取未确认告警数量
	GetUnacknowledgedAlertCount(ctx context.Context, userID uuid.UUID) (int64, error)
}

// loginDetectionService 登录检测服务实现
type loginDetectionService struct {
	trustedDeviceRepo TrustedDeviceRepository
	loginAlertRepo    LoginAlertRepository
	userRepo          Repository
	geoipClient       *geoip.Client
	emailService      EmailService
}

// NewLoginDetectionService 创建登录检测服务
func NewLoginDetectionService(
	trustedDeviceRepo TrustedDeviceRepository,
	loginAlertRepo LoginAlertRepository,
	userRepo Repository,
	geoipClient *geoip.Client,
	emailService EmailService,
) LoginDetectionService {
	return &loginDetectionService{
		trustedDeviceRepo: trustedDeviceRepo,
		loginAlertRepo:    loginAlertRepo,
		userRepo:          userRepo,
		geoipClient:       geoipClient,
		emailService:      emailService,
	}
}

// GenerateDeviceFingerprint 生成设备指纹（后端基础版本）
func GenerateDeviceFingerprint(userAgent, acceptLanguage, acceptEncoding string) string {
	data := fmt.Sprintf("%s|%s|%s", userAgent, acceptLanguage, acceptEncoding)
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

func (s *loginDetectionService) CheckNewDevice(ctx context.Context, userID uuid.UUID, fingerprint string) (bool, error) {
	if fingerprint == "" {
		return false, nil // 没有指纹信息，无法判断
	}

	device, err := s.trustedDeviceRepo.FindByUserAndFingerprint(ctx, userID, fingerprint)
	if err != nil {
		return false, err
	}

	return device == nil, nil
}

func (s *loginDetectionService) CheckNewLocation(ctx context.Context, userID uuid.UUID, ip string) (bool, string, error) {
	// 获取当前 IP 的地理位置
	var location string
	if s.geoipClient != nil {
		loc, err := s.geoipClient.Lookup(ctx, ip)
		if err == nil && loc != nil {
			if loc.City != "" {
				location = fmt.Sprintf("%s, %s, %s", loc.City, loc.Region, loc.Country)
			} else if loc.Region != "" {
				location = fmt.Sprintf("%s, %s", loc.Region, loc.Country)
			} else {
				location = loc.Country
			}
		}
	}

	// 获取用户的可信设备列表，检查是否有相同位置
	devices, err := s.trustedDeviceRepo.ListByUser(ctx, userID)
	if err != nil {
		return false, location, err
	}

	// 如果没有任何可信设备，第一次登录不算新位置
	if len(devices) == 0 {
		return false, location, nil
	}

	// 检查是否有相同位置的设备
	for _, device := range devices {
		if device.LastLocation == location {
			return false, location, nil
		}
	}

	return true, location, nil
}

func (s *loginDetectionService) RecordLogin(ctx context.Context, userID uuid.UUID, session *Session, fingerprint string) error {
	// 获取用户信息
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return err
	}

	// 获取地理位置
	var location string
	if s.geoipClient != nil && session.IPAddress != "" {
		loc, err := s.geoipClient.Lookup(ctx, session.IPAddress)
		if err == nil && loc != nil {
			if loc.City != "" {
				location = fmt.Sprintf("%s, %s, %s", loc.City, loc.Region, loc.Country)
			} else if loc.Region != "" {
				location = fmt.Sprintf("%s, %s", loc.Region, loc.Country)
			} else {
				location = loc.Country
			}
		}
	}

	// 检查是否为新设备
	isNewDevice := false
	if fingerprint != "" {
		device, err := s.trustedDeviceRepo.FindByUserAndFingerprint(ctx, userID, fingerprint)
		if err == nil && device == nil {
			isNewDevice = true
		}
	}

	// 检查是否为新位置
	isNewLocation := false
	devices, _ := s.trustedDeviceRepo.ListByUser(ctx, userID)
	if len(devices) > 0 && location != "" {
		isNewLocation = true
		for _, d := range devices {
			if d.LastLocation == location {
				isNewLocation = false
				break
			}
		}
	}

	// 更新会话信息
	session.Location = location
	session.IsNewDevice = isNewDevice
	session.IsNewLocation = isNewLocation
	session.DeviceFingerprint = fingerprint

	// 如果是新设备，添加到可信设备列表
	if isNewDevice && fingerprint != "" {
		newDevice := &TrustedDevice{
			UserID:            userID,
			DeviceFingerprint: fingerprint,
			DeviceType:        session.DeviceType,
			DeviceName:        session.DeviceName,
			LastIPAddress:     session.IPAddress,
			LastLocation:      location,
			TrustLevel:        1,
			LastUsed:          time.Now(),
		}
		if err := s.trustedDeviceRepo.Create(ctx, newDevice); err != nil {
			fmt.Printf("Warning: failed to create trusted device: %v\n", err)
		}
	} else if fingerprint != "" {
		// 更新现有设备的最后使用信息
		device, _ := s.trustedDeviceRepo.FindByUserAndFingerprint(ctx, userID, fingerprint)
		if device != nil {
			device.LastIPAddress = session.IPAddress
			device.LastLocation = location
			device.LastUsed = time.Now()
			device.TrustLevel++ // 增加信任等级
			if device.TrustLevel > 10 {
				device.TrustLevel = 10
			}
			s.trustedDeviceRepo.Update(ctx, device)
		}
	}

	// 创建告警并发送通知
	if isNewDevice && user.NotifyNewDevice {
		alert := &LoginAlert{
			UserID:     userID,
			SessionID:  session.ID,
			AlertType:  AlertTypeNewDevice,
			IPAddress:  session.IPAddress,
			Location:   location,
			DeviceInfo: fmt.Sprintf("%s - %s", session.DeviceType, session.DeviceName),
		}
		if err := s.loginAlertRepo.Create(ctx, alert); err != nil {
			fmt.Printf("Warning: failed to create login alert: %v\n", err)
		}

		// 发送邮件通知
		if s.emailService != nil {
			go func() {
				notifyCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				defer cancel()

				if err := s.emailService.SendNewDeviceAlert(
					notifyCtx,
					user.Email,
					user.Username,
					session.DeviceName,
					session.IPAddress,
					location,
					time.Now(),
				); err != nil {
					fmt.Printf("Warning: failed to send new device alert email: %v\n", err)
				} else {
					// 更新通知时间
					now := time.Now()
					alert.NotifiedAt = &now
					s.loginAlertRepo.Update(notifyCtx, alert)
				}
			}()
		}
	}

	if isNewLocation && user.NotifyNewLocation {
		alert := &LoginAlert{
			UserID:     userID,
			SessionID:  session.ID,
			AlertType:  AlertTypeNewLocation,
			IPAddress:  session.IPAddress,
			Location:   location,
			DeviceInfo: fmt.Sprintf("%s - %s", session.DeviceType, session.DeviceName),
		}
		if err := s.loginAlertRepo.Create(ctx, alert); err != nil {
			fmt.Printf("Warning: failed to create login alert: %v\n", err)
		}

		// 发送邮件通知
		if s.emailService != nil {
			go func() {
				notifyCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				defer cancel()

				if err := s.emailService.SendNewLocationAlert(
					notifyCtx,
					user.Email,
					user.Username,
					location,
					session.IPAddress,
					time.Now(),
				); err != nil {
					fmt.Printf("Warning: failed to send new location alert email: %v\n", err)
				} else {
					now := time.Now()
					alert.NotifiedAt = &now
					s.loginAlertRepo.Update(notifyCtx, alert)
				}
			}()
		}
	}

	return nil
}

func (s *loginDetectionService) AddTrustedDevice(ctx context.Context, userID uuid.UUID, fingerprint, deviceType, deviceName, ip, location string) error {
	device := &TrustedDevice{
		UserID:            userID,
		DeviceFingerprint: fingerprint,
		DeviceType:        deviceType,
		DeviceName:        deviceName,
		LastIPAddress:     ip,
		LastLocation:      location,
		TrustLevel:        5, // 手动添加的设备给予较高信任等级
		LastUsed:          time.Now(),
	}
	return s.trustedDeviceRepo.Create(ctx, device)
}

func (s *loginDetectionService) ListTrustedDevices(ctx context.Context, userID uuid.UUID) ([]*TrustedDevice, error) {
	return s.trustedDeviceRepo.ListByUser(ctx, userID)
}

func (s *loginDetectionService) RemoveTrustedDevice(ctx context.Context, userID uuid.UUID, deviceID uuid.UUID) error {
	// 验证设备属于该用户
	devices, err := s.trustedDeviceRepo.ListByUser(ctx, userID)
	if err != nil {
		return err
	}

	for _, d := range devices {
		if d.ID == deviceID {
			return s.trustedDeviceRepo.Delete(ctx, deviceID)
		}
	}

	return fmt.Errorf("device not found or does not belong to user")
}

func (s *loginDetectionService) ListLoginAlerts(ctx context.Context, userID uuid.UUID, limit int) ([]*LoginAlert, error) {
	return s.loginAlertRepo.ListByUser(ctx, userID, limit)
}

func (s *loginDetectionService) AcknowledgeAlert(ctx context.Context, userID, alertID uuid.UUID) error {
	// 验证告警属于该用户
	alert, err := s.loginAlertRepo.FindByID(ctx, alertID)
	if err != nil {
		return err
	}
	if alert == nil {
		return fmt.Errorf("alert not found")
	}
	if alert.UserID != userID {
		return fmt.Errorf("alert does not belong to user")
	}

	return s.loginAlertRepo.Acknowledge(ctx, alertID)
}

func (s *loginDetectionService) GetUnacknowledgedAlertCount(ctx context.Context, userID uuid.UUID) (int64, error) {
	return s.loginAlertRepo.CountUnacknowledged(ctx, userID)
}
