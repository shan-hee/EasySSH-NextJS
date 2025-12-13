package sftp

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type TrashItemFilters struct {
	ServerID      *uuid.UUID
	ParentDir     *string
	Status        *TrashItemStatus
	DeletedBefore *time.Time
}

type TrashItemRepository interface {
	UpsertActive(ctx context.Context, item TrashItem) error
	List(ctx context.Context, userID uuid.UUID, filters TrashItemFilters, limit, offset int) ([]TrashItem, int64, error)
	GetByIDForUser(ctx context.Context, userID, id uuid.UUID) (*TrashItem, error)
	MarkRestored(ctx context.Context, userID, id uuid.UUID, restoredAt time.Time, restoredPath string) error
	MarkRestoredByTrashPath(ctx context.Context, userID, serverID uuid.UUID, trashPath string, restoredAt time.Time, restoredPath string) error
	MarkPurgedByID(ctx context.Context, userID, id uuid.UUID, purgedAt time.Time) error
	MarkPurgedByTrashPath(ctx context.Context, userID, serverID uuid.UUID, trashPath string, purgedAt time.Time, status TrashItemStatus) error
	// ListActiveByServer 列出指定服务器的活跃垃圾项（用于一致性检查）
	ListActiveByServer(ctx context.Context, userID, serverID uuid.UUID, limit, offset int) ([]TrashItem, error)
	// ListActiveByTrashDir 列出指定回收站目录下的活跃垃圾项（优化大目录查询性能）
	// trashDir 参数用于筛选 trash_dir 字段匹配或 trash_path 以 trashDir+"/" 为前缀的记录
	ListActiveByTrashDir(ctx context.Context, userID, serverID uuid.UUID, trashDir string, limit, offset int) ([]TrashItem, error)
	// MarkMissingBatch 批量标记丢失的项目
	MarkMissingBatch(ctx context.Context, ids []uuid.UUID, missingAt time.Time) error

	// === 乐观锁相关方法，用于解决竞态条件 ===

	// TryMarkPurging 尝试将 active 状态的项标记为 purging（乐观锁 CAS 操作）
	// 返回 affected 行数：1 表示成功，0 表示版本不匹配或状态已变更
	// 清理器在删除文件前必须先调用此方法，只有返回 1 才能执行删除
	TryMarkPurging(ctx context.Context, userID, serverID uuid.UUID, trashPath string, expectedVersion int64) (int64, error)

	// TryMarkRestoring 尝试将 active 状态的项标记为 restoring（乐观锁 CAS 操作）
	// 返回 affected 行数：1 表示成功，0 表示版本不匹配或状态已变更（可能正在被清理）
	// 用户恢复操作必须先调用此方法获取锁，再执行物理操作
	TryMarkRestoring(ctx context.Context, userID, id uuid.UUID, expectedVersion int64) (int64, error)

	// FinishRestore 完成恢复，将 restoring 状态更新为 restored
	FinishRestore(ctx context.Context, userID, id uuid.UUID, restoredAt time.Time, restoredPath string) error

	// RollbackRestoring 回滚 restoring 状态到 active（恢复失败时调用）
	RollbackRestoring(ctx context.Context, userID, id uuid.UUID) error

	// TryMarkRestored 尝试将 active 状态的项标记为 restored（乐观锁 CAS 操作）
	// 返回 affected 行数：1 表示成功，0 表示版本不匹配或状态已变更（可能正在被清理）
	// 已弃用：建议使用 TryMarkRestoring + FinishRestore 两阶段方式
	TryMarkRestored(ctx context.Context, userID, id uuid.UUID, expectedVersion int64, restoredAt time.Time, restoredPath string) (int64, error)

	// FinishPurge 完成清理，将 purging 状态更新为 purged
	FinishPurge(ctx context.Context, userID, serverID uuid.UUID, trashPath string, purgedAt time.Time) error

	// RollbackPurging 回滚 purging 状态到 active（清理失败时调用）
	RollbackPurging(ctx context.Context, userID, serverID uuid.UUID, trashPath string) error
}

type gormTrashItemRepository struct {
	db *gorm.DB
}

func NewTrashItemRepository(db *gorm.DB) TrashItemRepository {
	return &gormTrashItemRepository{db: db}
}

func (r *gormTrashItemRepository) UpsertActive(ctx context.Context, item TrashItem) error {
	item.Status = TrashItemStatusActive
	if item.DeletedAt.IsZero() {
		item.DeletedAt = time.Now()
	}
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "user_id"},
			{Name: "server_id"},
			{Name: "trash_path"},
		},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"parent_dir":    item.ParentDir,
			"original_path": item.OriginalPath,
			"original_name": item.OriginalName,
			"trash_dir":     item.TrashDir,
			"trash_name":    item.TrashName,
			"is_dir":        item.IsDir,
			"size":          item.Size,
			"mode":          item.Mode,
			"deleted_at":    item.DeletedAt,
			"status":        TrashItemStatusActive,
			"restored_at":   nil,
			"restored_path": "",
			"purged_at":     nil,
		}),
	}).Create(&item).Error
}

func (r *gormTrashItemRepository) List(ctx context.Context, userID uuid.UUID, filters TrashItemFilters, limit, offset int) ([]TrashItem, int64, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	q := r.db.WithContext(ctx).Model(&TrashItem{}).Where("user_id = ?", userID)
	if filters.ServerID != nil {
		q = q.Where("server_id = ?", *filters.ServerID)
	}
	if filters.ParentDir != nil && *filters.ParentDir != "" {
		q = q.Where("parent_dir = ?", *filters.ParentDir)
	}
	if filters.Status != nil && *filters.Status != "" {
		q = q.Where("status = ?", *filters.Status)
	}
	if filters.DeletedBefore != nil && !filters.DeletedBefore.IsZero() {
		q = q.Where("deleted_at <= ?", *filters.DeletedBefore)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var rows []TrashItem
	err := q.Order("deleted_at DESC").Limit(limit).Offset(offset).Find(&rows).Error
	return rows, total, err
}

func (r *gormTrashItemRepository) GetByIDForUser(ctx context.Context, userID, id uuid.UUID) (*TrashItem, error) {
	var item TrashItem
	if err := r.db.WithContext(ctx).Where("id = ? AND user_id = ?", id, userID).First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *gormTrashItemRepository) MarkRestored(ctx context.Context, userID, id uuid.UUID, restoredAt time.Time, restoredPath string) error {
	return r.db.WithContext(ctx).Model(&TrashItem{}).
		Where("id = ? AND user_id = ?", id, userID).
		Updates(map[string]interface{}{
			"status":        TrashItemStatusRestored,
			"restored_at":   restoredAt,
			"restored_path": restoredPath,
		}).Error
}

func (r *gormTrashItemRepository) MarkRestoredByTrashPath(ctx context.Context, userID, serverID uuid.UUID, trashPath string, restoredAt time.Time, restoredPath string) error {
	return r.db.WithContext(ctx).Model(&TrashItem{}).
		Where("user_id = ? AND server_id = ? AND trash_path = ?", userID, serverID, trashPath).
		Updates(map[string]interface{}{
			"status":        TrashItemStatusRestored,
			"restored_at":   restoredAt,
			"restored_path": restoredPath,
		}).Error
}

func (r *gormTrashItemRepository) MarkPurgedByID(ctx context.Context, userID, id uuid.UUID, purgedAt time.Time) error {
	return r.db.WithContext(ctx).Model(&TrashItem{}).
		Where("id = ? AND user_id = ?", id, userID).
		Updates(map[string]interface{}{
			"status":    TrashItemStatusPurged,
			"purged_at": purgedAt,
		}).Error
}

func (r *gormTrashItemRepository) MarkPurgedByTrashPath(ctx context.Context, userID, serverID uuid.UUID, trashPath string, purgedAt time.Time, status TrashItemStatus) error {
	if status == "" {
		status = TrashItemStatusPurged
	}
	return r.db.WithContext(ctx).Model(&TrashItem{}).
		Where("user_id = ? AND server_id = ? AND trash_path = ?", userID, serverID, trashPath).
		Updates(map[string]interface{}{
			"status":    status,
			"purged_at": purgedAt,
		}).Error
}

func (r *gormTrashItemRepository) ListActiveByServer(ctx context.Context, userID, serverID uuid.UUID, limit, offset int) ([]TrashItem, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	var rows []TrashItem
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND server_id = ? AND status = ?", userID, serverID, TrashItemStatusActive).
		Order("deleted_at ASC").
		Limit(limit).
		Offset(offset).
		Find(&rows).Error
	return rows, err
}

// ListActiveByTrashDir 列出指定回收站目录下的活跃垃圾项
// 在数据库层面直接过滤，避免内存中过滤整个服务器的数据
func (r *gormTrashItemRepository) ListActiveByTrashDir(ctx context.Context, userID, serverID uuid.UUID, trashDir string, limit, offset int) ([]TrashItem, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	var rows []TrashItem
	// 查询 trash_dir 完全匹配 或 trash_path 以 trashDir+"/" 为前缀的记录
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND server_id = ? AND status = ? AND (trash_dir = ? OR trash_path LIKE ?)",
			userID, serverID, TrashItemStatusActive, trashDir, trashDir+"/%").
		Order("deleted_at ASC").
		Limit(limit).
		Offset(offset).
		Find(&rows).Error
	return rows, err
}

func (r *gormTrashItemRepository) MarkMissingBatch(ctx context.Context, ids []uuid.UUID, missingAt time.Time) error {
	if len(ids) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).Model(&TrashItem{}).
		Where("id IN ?", ids).
		Updates(map[string]interface{}{
			"status":    TrashItemStatusMissing,
			"purged_at": missingAt,
		}).Error
}

// TryMarkPurging 尝试将 active 状态的项标记为 purging（乐观锁 CAS 操作）
// 使用版本号确保操作的原子性，防止与用户恢复操作产生竞态条件
func (r *gormTrashItemRepository) TryMarkPurging(ctx context.Context, userID, serverID uuid.UUID, trashPath string, expectedVersion int64) (int64, error) {
	result := r.db.WithContext(ctx).Model(&TrashItem{}).
		Where("user_id = ? AND server_id = ? AND trash_path = ? AND status = ? AND version = ?",
			userID, serverID, trashPath, TrashItemStatusActive, expectedVersion).
		Updates(map[string]interface{}{
			"status":  TrashItemStatusPurging,
			"version": expectedVersion + 1,
		})
	return result.RowsAffected, result.Error
}

// TryMarkRestored 尝试将 active 状态的项标记为 restored（乐观锁 CAS 操作）
// 如果项目正在被清理（status=purging）或版本不匹配，则返回 0
func (r *gormTrashItemRepository) TryMarkRestored(ctx context.Context, userID, id uuid.UUID, expectedVersion int64, restoredAt time.Time, restoredPath string) (int64, error) {
	result := r.db.WithContext(ctx).Model(&TrashItem{}).
		Where("id = ? AND user_id = ? AND status = ? AND version = ?",
			id, userID, TrashItemStatusActive, expectedVersion).
		Updates(map[string]interface{}{
			"status":        TrashItemStatusRestored,
			"restored_at":   restoredAt,
			"restored_path": restoredPath,
			"version":       expectedVersion + 1,
		})
	return result.RowsAffected, result.Error
}

// FinishPurge 完成清理，将 purging 状态更新为 purged
func (r *gormTrashItemRepository) FinishPurge(ctx context.Context, userID, serverID uuid.UUID, trashPath string, purgedAt time.Time) error {
	return r.db.WithContext(ctx).Model(&TrashItem{}).
		Where("user_id = ? AND server_id = ? AND trash_path = ? AND status = ?",
			userID, serverID, trashPath, TrashItemStatusPurging).
		Updates(map[string]interface{}{
			"status":    TrashItemStatusPurged,
			"purged_at": purgedAt,
			"version":   gorm.Expr("version + 1"),
		}).Error
}

// RollbackPurging 回滚 purging 状态到 active（清理失败时调用）
func (r *gormTrashItemRepository) RollbackPurging(ctx context.Context, userID, serverID uuid.UUID, trashPath string) error {
	return r.db.WithContext(ctx).Model(&TrashItem{}).
		Where("user_id = ? AND server_id = ? AND trash_path = ? AND status = ?",
			userID, serverID, trashPath, TrashItemStatusPurging).
		Updates(map[string]interface{}{
			"status":  TrashItemStatusActive,
			"version": gorm.Expr("version + 1"),
		}).Error
}

// TryMarkRestoring 尝试将 active 状态的项标记为 restoring（乐观锁 CAS 操作）
// 用户恢复操作必须先调用此方法获取锁，再执行物理操作
func (r *gormTrashItemRepository) TryMarkRestoring(ctx context.Context, userID, id uuid.UUID, expectedVersion int64) (int64, error) {
	result := r.db.WithContext(ctx).Model(&TrashItem{}).
		Where("id = ? AND user_id = ? AND status = ? AND version = ?",
			id, userID, TrashItemStatusActive, expectedVersion).
		Updates(map[string]interface{}{
			"status":  TrashItemStatusRestoring,
			"version": expectedVersion + 1,
		})
	return result.RowsAffected, result.Error
}

// FinishRestore 完成恢复，将 restoring 状态更新为 restored
func (r *gormTrashItemRepository) FinishRestore(ctx context.Context, userID, id uuid.UUID, restoredAt time.Time, restoredPath string) error {
	return r.db.WithContext(ctx).Model(&TrashItem{}).
		Where("id = ? AND user_id = ? AND status = ?",
			id, userID, TrashItemStatusRestoring).
		Updates(map[string]interface{}{
			"status":        TrashItemStatusRestored,
			"restored_at":   restoredAt,
			"restored_path": restoredPath,
			"version":       gorm.Expr("version + 1"),
		}).Error
}

// RollbackRestoring 回滚 restoring 状态到 active（恢复失败时调用）
func (r *gormTrashItemRepository) RollbackRestoring(ctx context.Context, userID, id uuid.UUID) error {
	return r.db.WithContext(ctx).Model(&TrashItem{}).
		Where("id = ? AND user_id = ? AND status = ?",
			id, userID, TrashItemStatusRestoring).
		Updates(map[string]interface{}{
			"status":  TrashItemStatusActive,
			"version": gorm.Expr("version + 1"),
		}).Error
}
