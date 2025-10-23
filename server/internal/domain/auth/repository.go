package auth

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrUserNotFound      = errors.New("user not found")
	ErrUserAlreadyExists = errors.New("user already exists")
	ErrInvalidCredentials = errors.New("invalid credentials")
)

// Repository 用户数据访问接口
type Repository interface {
	// Create 创建用户
	Create(ctx context.Context, user *User) error

	// FindByID 根据 ID 查找用户
	FindByID(ctx context.Context, id uuid.UUID) (*User, error)

	// FindByUsername 根据用户名查找用户
	FindByUsername(ctx context.Context, username string) (*User, error)

	// FindByEmail 根据邮箱查找用户
	FindByEmail(ctx context.Context, email string) (*User, error)

	// Update 更新用户信息
	Update(ctx context.Context, user *User) error

	// Delete 删除用户（软删除）
	Delete(ctx context.Context, id uuid.UUID) error

	// List 获取用户列表（分页）
	List(ctx context.Context, limit, offset int) ([]*User, int64, error)

	// HasAdmin 检查是否存在管理员用户
	HasAdmin(ctx context.Context) (bool, error)

	// CountAdmins 统计管理员数量
	CountAdmins(ctx context.Context) (int64, error)
}

// gormRepository GORM 实现
type gormRepository struct {
	db *gorm.DB
}

// NewRepository 创建用户仓储
func NewRepository(db *gorm.DB) Repository {
	return &gormRepository{db: db}
}

func (r *gormRepository) Create(ctx context.Context, user *User) error {
	// 检查用户名是否已存在
	var count int64
	if err := r.db.WithContext(ctx).Model(&User{}).
		Where("username = ?", user.Username).
		Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return ErrUserAlreadyExists
	}

	// 检查邮箱是否已存在
	if err := r.db.WithContext(ctx).Model(&User{}).
		Where("email = ?", user.Email).
		Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return ErrUserAlreadyExists
	}

	return r.db.WithContext(ctx).Create(user).Error
}

func (r *gormRepository) FindByID(ctx context.Context, id uuid.UUID) (*User, error) {
	var user User
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &user, nil
}

func (r *gormRepository) FindByUsername(ctx context.Context, username string) (*User, error) {
	var user User
	if err := r.db.WithContext(ctx).Where("username = ?", username).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &user, nil
}

func (r *gormRepository) FindByEmail(ctx context.Context, email string) (*User, error) {
	var user User
	if err := r.db.WithContext(ctx).Where("email = ?", email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &user, nil
}

func (r *gormRepository) Update(ctx context.Context, user *User) error {
	return r.db.WithContext(ctx).Save(user).Error
}

func (r *gormRepository) Delete(ctx context.Context, id uuid.UUID) error {
	result := r.db.WithContext(ctx).Delete(&User{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrUserNotFound
	}
	return nil
}

func (r *gormRepository) List(ctx context.Context, limit, offset int) ([]*User, int64, error) {
	var users []*User
	var total int64

	// 获取总数
	if err := r.db.WithContext(ctx).Model(&User{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 获取分页数据
	if err := r.db.WithContext(ctx).
		Limit(limit).
		Offset(offset).
		Order("created_at DESC").
		Find(&users).Error; err != nil {
		return nil, 0, err
	}

	return users, total, nil
}

// HasAdmin 检查是否存在管理员用户
func (r *gormRepository) HasAdmin(ctx context.Context) (bool, error) {
	var count int64
	if err := r.db.WithContext(ctx).Model(&User{}).Where("role = ?", RoleAdmin).Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

// CountAdmins 统计管理员数量
func (r *gormRepository) CountAdmins(ctx context.Context) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).Model(&User{}).Where("role = ?", RoleAdmin).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}
