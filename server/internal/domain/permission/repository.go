package permission

import (
	"context"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Repository 权限仓储接口
type Repository interface {
	List(ctx context.Context, offset, limit int, module string, q string) ([]*Permission, int64, error)
	ListAll(ctx context.Context) ([]*Permission, error)
	GetByID(ctx context.Context, id uuid.UUID) (*Permission, error)
	GetByCode(ctx context.Context, code string) (*Permission, error)
	Create(ctx context.Context, permission *Permission) error
	Update(ctx context.Context, permission *Permission) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) List(ctx context.Context, offset, limit int, module string, q string) ([]*Permission, int64, error) {
	var permissions []*Permission
	var total int64

	query := r.db.WithContext(ctx).Model(&Permission{})

	module = strings.TrimSpace(module)
	if module != "" && module != "all" {
		query = query.Where("module = ?", module)
	}

	q = strings.TrimSpace(q)
	if q != "" {
		like := "%" + strings.ToLower(q) + "%"
		query = query.Where("LOWER(name) LIKE ? OR LOWER(code) LIKE ?", like, like)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&permissions).Error; err != nil {
		return nil, 0, err
	}

	return permissions, total, nil
}

func (r *repository) ListAll(ctx context.Context) ([]*Permission, error) {
	var permissions []*Permission
	if err := r.db.WithContext(ctx).Order("created_at DESC").Find(&permissions).Error; err != nil {
		return nil, err
	}
	return permissions, nil
}

func (r *repository) GetByID(ctx context.Context, id uuid.UUID) (*Permission, error) {
	var permission Permission
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&permission).Error; err != nil {
		return nil, err
	}
	return &permission, nil
}

func (r *repository) GetByCode(ctx context.Context, code string) (*Permission, error) {
	var permission Permission
	if err := r.db.WithContext(ctx).Where("code = ?", code).First(&permission).Error; err != nil {
		return nil, err
	}
	return &permission, nil
}

func (r *repository) Create(ctx context.Context, permission *Permission) error {
	return r.db.WithContext(ctx).Create(permission).Error
}

func (r *repository) Update(ctx context.Context, permission *Permission) error {
	return r.db.WithContext(ctx).Save(permission).Error
}

func (r *repository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&Permission{}, "id = ?", id).Error
}
