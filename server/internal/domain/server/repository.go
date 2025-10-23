package server

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrServerNotFound      = errors.New("server not found")
	ErrServerAlreadyExists = errors.New("server already exists")
	ErrUnauthorized        = errors.New("unauthorized to access this server")
)

// Repository 服务器数据访问接口
type Repository interface {
	// Create 创建服务器
	Create(ctx context.Context, server *Server) error

	// FindByID 根据 ID 查找服务器
	FindByID(ctx context.Context, id uuid.UUID) (*Server, error)

	// FindByUserID 根据用户 ID 查找服务器列表
	FindByUserID(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*Server, int64, error)

	// FindByUserIDAndID 根据用户 ID 和服务器 ID 查找（权限检查）
	FindByUserIDAndID(ctx context.Context, userID, serverID uuid.UUID) (*Server, error)

	// Update 更新服务器信息
	Update(ctx context.Context, server *Server) error

	// Delete 删除服务器（软删除）
	Delete(ctx context.Context, id uuid.UUID) error

	// List 获取所有服务器列表（分页）
	List(ctx context.Context, limit, offset int) ([]*Server, int64, error)

	// Search 搜索服务器（按名称、主机、分组）
	Search(ctx context.Context, userID uuid.UUID, query string, limit, offset int) ([]*Server, int64, error)

	// FindByGroup 根据分组查找服务器
	FindByGroup(ctx context.Context, userID uuid.UUID, group string, limit, offset int) ([]*Server, int64, error)

	// CountByUserID 统计用户的服务器数量
	CountByUserID(ctx context.Context, userID uuid.UUID) (int64, error)
}

// gormRepository GORM 实现
type gormRepository struct {
	db *gorm.DB
}

// NewRepository 创建服务器仓储
func NewRepository(db *gorm.DB) Repository {
	return &gormRepository{db: db}
}

func (r *gormRepository) Create(ctx context.Context, server *Server) error {
	return r.db.WithContext(ctx).Create(server).Error
}

func (r *gormRepository) FindByID(ctx context.Context, id uuid.UUID) (*Server, error) {
	var server Server
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&server).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrServerNotFound
		}
		return nil, err
	}
	return &server, nil
}

func (r *gormRepository) FindByUserID(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*Server, int64, error) {
	var servers []*Server
	var total int64

	// 获取总数
	if err := r.db.WithContext(ctx).Model(&Server{}).
		Where("user_id = ?", userID).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 获取分页数据
	if err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Limit(limit).
		Offset(offset).
		Order("created_at DESC").
		Find(&servers).Error; err != nil {
		return nil, 0, err
	}

	return servers, total, nil
}

func (r *gormRepository) FindByUserIDAndID(ctx context.Context, userID, serverID uuid.UUID) (*Server, error) {
	var server Server
	if err := r.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", serverID, userID).
		First(&server).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrServerNotFound
		}
		return nil, err
	}
	return &server, nil
}

func (r *gormRepository) Update(ctx context.Context, server *Server) error {
	return r.db.WithContext(ctx).Save(server).Error
}

func (r *gormRepository) Delete(ctx context.Context, id uuid.UUID) error {
	result := r.db.WithContext(ctx).Delete(&Server{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrServerNotFound
	}
	return nil
}

func (r *gormRepository) List(ctx context.Context, limit, offset int) ([]*Server, int64, error) {
	var servers []*Server
	var total int64

	// 获取总数
	if err := r.db.WithContext(ctx).Model(&Server{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 获取分页数据
	if err := r.db.WithContext(ctx).
		Limit(limit).
		Offset(offset).
		Order("created_at DESC").
		Find(&servers).Error; err != nil {
		return nil, 0, err
	}

	return servers, total, nil
}

func (r *gormRepository) Search(ctx context.Context, userID uuid.UUID, query string, limit, offset int) ([]*Server, int64, error) {
	var servers []*Server
	var total int64

	searchPattern := "%" + query + "%"
	queryBuilder := r.db.WithContext(ctx).Model(&Server{}).
		Where("user_id = ?", userID).
		Where("name ILIKE ? OR host ILIKE ? OR \"group\" ILIKE ?", searchPattern, searchPattern, searchPattern)

	// 获取总数
	if err := queryBuilder.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 获取分页数据
	if err := queryBuilder.
		Limit(limit).
		Offset(offset).
		Order("created_at DESC").
		Find(&servers).Error; err != nil {
		return nil, 0, err
	}

	return servers, total, nil
}

func (r *gormRepository) FindByGroup(ctx context.Context, userID uuid.UUID, group string, limit, offset int) ([]*Server, int64, error) {
	var servers []*Server
	var total int64

	queryBuilder := r.db.WithContext(ctx).Model(&Server{}).
		Where("user_id = ? AND \"group\" = ?", userID, group)

	// 获取总数
	if err := queryBuilder.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 获取分页数据
	if err := queryBuilder.
		Limit(limit).
		Offset(offset).
		Order("created_at DESC").
		Find(&servers).Error; err != nil {
		return nil, 0, err
	}

	return servers, total, nil
}

func (r *gormRepository) CountByUserID(ctx context.Context, userID uuid.UUID) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).Model(&Server{}).
		Where("user_id = ?", userID).
		Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}
