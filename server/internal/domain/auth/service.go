package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Service 认证服务接口
type Service interface {
	// Register 注册新用户
	Register(ctx context.Context, username, email, password string, role UserRole) (*User, error)

	// Login 用户登录
	Login(ctx context.Context, username, password string) (*User, string, string, error)

	// Logout 用户登出
	Logout(ctx context.Context, accessToken string) error

	// GetUserByID 根据 ID 获取用户
	GetUserByID(ctx context.Context, userID uuid.UUID) (*User, error)

	// RefreshAccessToken 刷新访问令牌
	RefreshAccessToken(ctx context.Context, refreshToken string) (string, error)

	// ChangePassword 修改密码
	ChangePassword(ctx context.Context, userID uuid.UUID, oldPassword, newPassword string) error

	// UpdateProfile 更新用户资料
	UpdateProfile(ctx context.Context, userID uuid.UUID, email, avatar string) error

	// ListUsers 获取用户列表（管理员功能）
	ListUsers(ctx context.Context, limit, offset int) ([]*User, int64, error)

	// DeleteUser 删除用户（管理员功能）
	DeleteUser(ctx context.Context, userID uuid.UUID) error

	// HasAdmin 检查是否存在管理员
	HasAdmin(ctx context.Context) (bool, error)

	// InitializeAdmin 初始化管理员账户（仅在没有管理员时）
	InitializeAdmin(ctx context.Context, username, email, password string) (*User, string, string, error)
}

// authService 认证服务实现
type authService struct {
	repo       Repository
	jwtService JWTService
}

// NewService 创建认证服务
func NewService(repo Repository, jwtService JWTService) Service {
	return &authService{
		repo:       repo,
		jwtService: jwtService,
	}
}

func (s *authService) Register(ctx context.Context, username, email, password string, role UserRole) (*User, error) {
	// 参数验证
	if username == "" || email == "" || password == "" {
		return nil, errors.New("username, email and password are required")
	}

	// 密码长度验证
	if len(password) < 6 {
		return nil, errors.New("password must be at least 6 characters")
	}

	// 创建用户
	user := &User{
		Username: username,
		Email:    email,
		Role:     role,
	}

	// 设置密码（bcrypt 加密）
	if err := user.SetPassword(password); err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// 保存到数据库
	if err := s.repo.Create(ctx, user); err != nil {
		return nil, err
	}

	return user, nil
}

func (s *authService) Login(ctx context.Context, username, password string) (*User, string, string, error) {
	// 查找用户
	user, err := s.repo.FindByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			return nil, "", "", ErrInvalidCredentials
		}
		return nil, "", "", err
	}

	// 验证密码
	if !user.CheckPassword(password) {
		return nil, "", "", ErrInvalidCredentials
	}

	// 生成令牌
	accessToken, refreshToken, err := s.jwtService.GenerateTokens(user)
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to generate tokens: %w", err)
	}

	return user, accessToken, refreshToken, nil
}

func (s *authService) Logout(ctx context.Context, accessToken string) error {
	// 将令牌加入黑名单
	// 设置过期时间为令牌的剩余有效时间
	if err := s.jwtService.BlacklistToken(accessToken, 24*time.Hour); err != nil {
		return fmt.Errorf("failed to blacklist token: %w", err)
	}
	return nil
}

func (s *authService) GetUserByID(ctx context.Context, userID uuid.UUID) (*User, error) {
	return s.repo.FindByID(ctx, userID)
}

func (s *authService) RefreshAccessToken(ctx context.Context, refreshToken string) (string, error) {
	return s.jwtService.RefreshToken(refreshToken)
}

func (s *authService) ChangePassword(ctx context.Context, userID uuid.UUID, oldPassword, newPassword string) error {
	// 查找用户
	user, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return err
	}

	// 验证旧密码
	if !user.CheckPassword(oldPassword) {
		return errors.New("invalid old password")
	}

	// 验证新密码长度
	if len(newPassword) < 6 {
		return errors.New("new password must be at least 6 characters")
	}

	// 设置新密码
	if err := user.SetPassword(newPassword); err != nil {
		return fmt.Errorf("failed to hash new password: %w", err)
	}

	// 更新用户
	return s.repo.Update(ctx, user)
}

func (s *authService) UpdateProfile(ctx context.Context, userID uuid.UUID, email, avatar string) error {
	// 查找用户
	user, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return err
	}

	// 更新字段
	if email != "" {
		user.Email = email
	}
	if avatar != "" {
		user.Avatar = avatar
	}

	return s.repo.Update(ctx, user)
}

func (s *authService) ListUsers(ctx context.Context, limit, offset int) ([]*User, int64, error) {
	return s.repo.List(ctx, limit, offset)
}

func (s *authService) DeleteUser(ctx context.Context, userID uuid.UUID) error {
	return s.repo.Delete(ctx, userID)
}

// HasAdmin 检查是否存在管理员
func (s *authService) HasAdmin(ctx context.Context) (bool, error) {
	return s.repo.HasAdmin(ctx)
}

// InitializeAdmin 初始化管理员账户（仅在没有管理员时）
func (s *authService) InitializeAdmin(ctx context.Context, username, email, password string) (*User, string, string, error) {
	// 检查是否已存在管理员
	hasAdmin, err := s.repo.HasAdmin(ctx)
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to check admin existence: %w", err)
	}

	if hasAdmin {
		return nil, "", "", errors.New("admin already exists")
	}

	// 参数验证
	if username == "" || email == "" || password == "" {
		return nil, "", "", errors.New("username, email and password are required")
	}

	// 密码长度验证
	if len(password) < 6 {
		return nil, "", "", errors.New("password must be at least 6 characters")
	}

	// 创建管理员用户
	user := &User{
		Username: username,
		Email:    email,
		Role:     RoleAdmin,
	}

	// 设置密码（bcrypt 加密）
	if err := user.SetPassword(password); err != nil {
		return nil, "", "", fmt.Errorf("failed to hash password: %w", err)
	}

	// 保存到数据库
	if err := s.repo.Create(ctx, user); err != nil {
		return nil, "", "", fmt.Errorf("failed to create admin: %w", err)
	}

	// 生成令牌
	accessToken, refreshToken, err := s.jwtService.GenerateTokens(user)
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to generate tokens: %w", err)
	}

	return user, accessToken, refreshToken, nil
}
