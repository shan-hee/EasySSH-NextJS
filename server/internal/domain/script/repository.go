package script

import (
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Repository 脚本数据访问接口
type Repository interface {
	Create(script *Script) error
	Update(id uuid.UUID, updates map[string]interface{}) error
	Delete(id uuid.UUID) error
	GetByID(id uuid.UUID) (*Script, error)
	List(userID uuid.UUID, req *ListScriptsRequest) ([]Script, int64, error)
	IncrementExecutions(id uuid.UUID) error
}

type repository struct {
	db *gorm.DB
}

// NewRepository 创建脚本仓储实例
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// Create 创建脚本
func (r *repository) Create(script *Script) error {
	return r.db.Create(script).Error
}

// Update 更新脚本
func (r *repository) Update(id uuid.UUID, updates map[string]interface{}) error {
	return r.db.Model(&Script{}).Where("id = ?", id).Updates(updates).Error
}

// Delete 删除脚本（软删除）
func (r *repository) Delete(id uuid.UUID) error {
	return r.db.Where("id = ?", id).Delete(&Script{}).Error
}

// GetByID 根据ID获取脚本
func (r *repository) GetByID(id uuid.UUID) (*Script, error) {
	var script Script
	err := r.db.Where("id = ?", id).First(&script).Error
	if err != nil {
		return nil, err
	}
	return &script, nil
}

// List 获取脚本列表
func (r *repository) List(userID uuid.UUID, req *ListScriptsRequest) ([]Script, int64, error) {
	var scripts []Script
	var total int64

	query := r.db.Model(&Script{}).Where("user_id = ?", userID)

	// 搜索关键词
	if req.Search != "" {
		searchPattern := "%" + req.Search + "%"
		query = query.Where("name LIKE ? OR description LIKE ?", searchPattern, searchPattern)
	}

	// 语言筛选
	if req.Language != "" {
		query = query.Where("language = ?", req.Language)
	}

	// 标签筛选
	if len(req.Tags) > 0 {
		for _, tag := range req.Tags {
			query = query.Where("tags @> ?", `["`+tag+`"]`)
		}
	}

	// 统计总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页
	if req.Page < 1 {
		req.Page = 1
	}
	if req.Limit < 1 {
		req.Limit = 20
	}
	offset := (req.Page - 1) * req.Limit

	// 查询数据
	err := query.Order("updated_at DESC").
		Offset(offset).
		Limit(req.Limit).
		Find(&scripts).Error

	if err != nil {
		return nil, 0, err
	}

	return scripts, total, nil
}

// IncrementExecutions 增加执行次数
func (r *repository) IncrementExecutions(id uuid.UUID) error {
	return r.db.Model(&Script{}).
		Where("id = ?", id).
		UpdateColumn("executions", gorm.Expr("executions + ?", 1)).
		Error
}
