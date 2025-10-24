package user

import (
	"context"

	"github.com/easyssh/server/internal/domain/auth"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Repository 用户仓储接口
type Repository interface {
	// List 获取用户列表（分页）
	List(ctx context.Context, offset, limit int, role string) ([]*auth.User, int64, error)
	// GetByID 根据ID获取用户
	GetByID(ctx context.Context, id uuid.UUID) (*auth.User, error)
	// GetByUsername 根据用户名获取用户
	GetByUsername(ctx context.Context, username string) (*auth.User, error)
	// GetByEmail 根据邮箱获取用户
	GetByEmail(ctx context.Context, email string) (*auth.User, error)
	// Create 创建用户
	Create(ctx context.Context, user *auth.User) error
	// Update 更新用户
	Update(ctx context.Context, user *auth.User) error
	// Delete 删除用户（软删除）
	Delete(ctx context.Context, id uuid.UUID) error
	// UpdatePassword 更新密码
	UpdatePassword(ctx context.Context, id uuid.UUID, hashedPassword string) error
	// Count 统计用户数量
	Count(ctx context.Context) (int64, error)
	// CountByRole 按角色统计
	CountByRole(ctx context.Context) (map[string]int64, error)
}

// repository 用户仓储实现
type repository struct {
	db *gorm.DB
}

// NewRepository 创建用户仓储
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// List 获取用户列表
func (r *repository) List(ctx context.Context, offset, limit int, role string) ([]*auth.User, int64, error) {
	var users []*auth.User
	var total int64

	query := r.db.WithContext(ctx).Model(&auth.User{})

	// 按角色筛选
	if role != "" && role != "all" {
		query = query.Where("role = ?", role)
	}

	// 统计总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 获取分页数据
	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&users).Error; err != nil {
		return nil, 0, err
	}

	return users, total, nil
}

// GetByID 根据ID获取用户
func (r *repository) GetByID(ctx context.Context, id uuid.UUID) (*auth.User, error) {
	var user auth.User
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// GetByUsername 根据用户名获取用户
func (r *repository) GetByUsername(ctx context.Context, username string) (*auth.User, error) {
	var user auth.User
	if err := r.db.WithContext(ctx).Where("username = ?", username).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// GetByEmail 根据邮箱获取用户
func (r *repository) GetByEmail(ctx context.Context, email string) (*auth.User, error) {
	var user auth.User
	if err := r.db.WithContext(ctx).Where("email = ?", email).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// Create 创建用户
func (r *repository) Create(ctx context.Context, user *auth.User) error {
	return r.db.WithContext(ctx).Create(user).Error
}

// Update 更新用户
func (r *repository) Update(ctx context.Context, user *auth.User) error {
	return r.db.WithContext(ctx).Save(user).Error
}

// Delete 删除用户（软删除）
func (r *repository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&auth.User{}, "id = ?", id).Error
}

// UpdatePassword 更新密码
func (r *repository) UpdatePassword(ctx context.Context, id uuid.UUID, hashedPassword string) error {
	return r.db.WithContext(ctx).Model(&auth.User{}).Where("id = ?", id).Update("password", hashedPassword).Error
}

// Count 统计用户数量
func (r *repository) Count(ctx context.Context) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).Model(&auth.User{}).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// CountByRole 按角色统计
func (r *repository) CountByRole(ctx context.Context) (map[string]int64, error) {
	type RoleCount struct {
		Role  string
		Count int64
	}

	var results []RoleCount
	if err := r.db.WithContext(ctx).Model(&auth.User{}).
		Select("role, COUNT(*) as count").
		Group("role").
		Find(&results).Error; err != nil {
		return nil, err
	}

	counts := make(map[string]int64)
	for _, result := range results {
		counts[result.Role] = result.Count
	}

	return counts, nil
}
