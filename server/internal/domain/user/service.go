package user

import (
	"context"
	"errors"
	"fmt"

	"github.com/easyssh/server/internal/domain/auth"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var (
	ErrUserNotFound      = errors.New("user not found")
	ErrUserAlreadyExists = errors.New("user already exists")
	ErrInvalidInput      = errors.New("invalid input")
	ErrCannotDeleteSelf  = errors.New("cannot delete yourself")
	ErrCannotDeleteAdmin = errors.New("cannot delete the last admin")
)

// Service 用户服务接口
type Service interface {
	// ListUsers 获取用户列表
	ListUsers(ctx context.Context, page, limit int, role string) ([]*auth.User, int64, error)
	// GetUser 获取用户详情
	GetUser(ctx context.Context, id uuid.UUID) (*auth.User, error)
	// CreateUser 创建用户
	CreateUser(ctx context.Context, username, email, password string, role auth.UserRole) (*auth.User, error)
	// UpdateUser 更新用户信息
	UpdateUser(ctx context.Context, id uuid.UUID, username, email string, role auth.UserRole, avatar string) (*auth.User, error)
	// DeleteUser 删除用户
	DeleteUser(ctx context.Context, id, currentUserID uuid.UUID) error
	// ChangePassword 修改密码
	ChangePassword(ctx context.Context, id uuid.UUID, newPassword string) error
	// GetStatistics 获取用户统计信息
	GetStatistics(ctx context.Context) (map[string]interface{}, error)
}

// service 用户服务实现
type service struct {
	repo Repository
}

// NewService 创建用户服务
func NewService(repo Repository) Service {
	return &service{repo: repo}
}

// ListUsers 获取用户列表
func (s *service) ListUsers(ctx context.Context, page, limit int, role string) ([]*auth.User, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	offset := (page - 1) * limit
	return s.repo.List(ctx, offset, limit, role)
}

// GetUser 获取用户详情
func (s *service) GetUser(ctx context.Context, id uuid.UUID) (*auth.User, error) {
	user, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return user, nil
}

// CreateUser 创建用户
func (s *service) CreateUser(ctx context.Context, username, email, password string, role auth.UserRole) (*auth.User, error) {
	// 验证输入
	if username == "" || email == "" || password == "" {
		return nil, ErrInvalidInput
	}

	// 检查用户名是否已存在
	existingUser, err := s.repo.GetByUsername(ctx, username)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if existingUser != nil {
		return nil, fmt.Errorf("%w: username already taken", ErrUserAlreadyExists)
	}

	// 检查邮箱是否已存在
	existingUser, err = s.repo.GetByEmail(ctx, email)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if existingUser != nil {
		return nil, fmt.Errorf("%w: email already taken", ErrUserAlreadyExists)
	}

	// 验证角色
	if role != auth.RoleAdmin && role != auth.RoleUser && role != auth.RoleViewer {
		role = auth.RoleUser // 默认为普通用户
	}

	// 创建用户
	user := &auth.User{
		Username: username,
		Email:    email,
		Role:     role,
	}

	// 设置密码
	if err := user.SetPassword(password); err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// 保存到数据库
	if err := s.repo.Create(ctx, user); err != nil {
		return nil, err
	}

	return user, nil
}

// UpdateUser 更新用户信息
func (s *service) UpdateUser(ctx context.Context, id uuid.UUID, username, email string, role auth.UserRole, avatar string) (*auth.User, error) {
	// 获取用户
	user, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	// 如果修改了用户名，检查是否与其他用户重复
	if username != "" && username != user.Username {
		existingUser, err := s.repo.GetByUsername(ctx, username)
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		if existingUser != nil && existingUser.ID != id {
			return nil, fmt.Errorf("%w: username already taken", ErrUserAlreadyExists)
		}
		user.Username = username
	}

	// 如果修改了邮箱，检查是否与其他用户重复
	if email != "" && email != user.Email {
		existingUser, err := s.repo.GetByEmail(ctx, email)
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		if existingUser != nil && existingUser.ID != id {
			return nil, fmt.Errorf("%w: email already taken", ErrUserAlreadyExists)
		}
		user.Email = email
	}

	// 更新角色
	if role != "" {
		if role == auth.RoleAdmin || role == auth.RoleUser || role == auth.RoleViewer {
			user.Role = role
		}
	}

	// 更新头像
	if avatar != "" {
		user.Avatar = avatar
	}

	// 保存更新
	if err := s.repo.Update(ctx, user); err != nil {
		return nil, err
	}

	return user, nil
}

// DeleteUser 删除用户
func (s *service) DeleteUser(ctx context.Context, id, currentUserID uuid.UUID) error {
	// 不能删除自己
	if id == currentUserID {
		return ErrCannotDeleteSelf
	}

	// 获取要删除的用户
	user, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrUserNotFound
		}
		return err
	}

	// 如果要删除的是管理员，检查是否是最后一个管理员
	if user.Role == auth.RoleAdmin {
		adminCount := int64(0)
		roleCounts, err := s.repo.CountByRole(ctx)
		if err == nil {
			adminCount = roleCounts["admin"]
		}

		if adminCount <= 1 {
			return ErrCannotDeleteAdmin
		}
	}

	// 执行删除
	return s.repo.Delete(ctx, id)
}

// ChangePassword 修改密码
func (s *service) ChangePassword(ctx context.Context, id uuid.UUID, newPassword string) error {
	if newPassword == "" {
		return ErrInvalidInput
	}

	// 验证用户存在
	_, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrUserNotFound
		}
		return err
	}

	// 加密新密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// 更新密码
	return s.repo.UpdatePassword(ctx, id, string(hashedPassword))
}

// GetStatistics 获取用户统计信息
func (s *service) GetStatistics(ctx context.Context) (map[string]interface{}, error) {
	// 总用户数
	totalCount, err := s.repo.Count(ctx)
	if err != nil {
		return nil, err
	}

	// 按角色统计
	roleCounts, err := s.repo.CountByRole(ctx)
	if err != nil {
		return nil, err
	}

	stats := map[string]interface{}{
		"total_users": totalCount,
		"by_role":     roleCounts,
	}

	return stats, nil
}
