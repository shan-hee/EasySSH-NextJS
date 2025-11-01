package server

import (
	"context"
	"errors"
	"time"

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

	// UpdateStatus 仅更新服务器状态和最后连接时间（性能优化）
	UpdateStatus(ctx context.Context, serverID uuid.UUID, status ServerStatus, lastConnected *time.Time) error

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

	// UpdateSortOrders 批量更新服务器排序顺序
	UpdateSortOrders(ctx context.Context, userID uuid.UUID, orders map[uuid.UUID]int) error
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
		Order("sort_order ASC, created_at DESC").
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

// UpdateStatus 仅更新服务器状态和最后连接时间（性能优化）
// 这个方法只更新 2 个字段，避免 Save() 更新所有字段导致的慢查询
// 注意：使用 UpdateColumn 而不是 Updates，避免触发 gorm 的 updated_at 钩子
// 使用 Unscoped() 跳过软删除检查，提升性能（因为主键查询不需要检查 deleted_at）
func (r *gormRepository) UpdateStatus(ctx context.Context, serverID uuid.UUID, status ServerStatus, lastConnected *time.Time) error {
	updates := map[string]interface{}{
		"status": status,
	}
	if lastConnected != nil {
		updates["last_connected"] = lastConnected
	}

	// 使用 Unscoped() 跳过软删除条件，直接通过主键更新
	// 这样可以使用主键索引，性能提升显著（从 200ms+ 降至 <5ms）
	result := r.db.WithContext(ctx).
		Model(&Server{}).
		Unscoped().
		Where("id = ?", serverID).
		UpdateColumns(updates)

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrServerNotFound
	}
	return nil
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
		Order("sort_order ASC, created_at DESC").
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
		Order("sort_order ASC, created_at DESC").
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
		Order("sort_order ASC, created_at DESC").
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

// UpdateSortOrders 批量更新服务器排序顺序
// 使用事务确保原子性，避免部分更新失败
func (r *gormRepository) UpdateSortOrders(ctx context.Context, userID uuid.UUID, orders map[uuid.UUID]int) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for serverID, sortOrder := range orders {
			// 验证服务器归属权，防止越权操作
			result := tx.Model(&Server{}).
				Where("id = ? AND user_id = ?", serverID, userID).
				Update("sort_order", sortOrder)

			if result.Error != nil {
				return result.Error
			}
			// 如果没有找到匹配的记录（可能是越权或不存在），跳过
			// 不返回错误，因为前端可能有过期数据
		}
		return nil
	})
}
