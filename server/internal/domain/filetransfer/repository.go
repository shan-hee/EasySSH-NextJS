package filetransfer

import (
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Repository 文件传输数据访问接口
type Repository interface {
	Create(transfer *FileTransfer) error
	Update(id uuid.UUID, updates map[string]interface{}) error
	Delete(id uuid.UUID) error
	GetByID(id uuid.UUID) (*FileTransfer, error)
	List(userID uuid.UUID, req *ListFileTransfersRequest) ([]FileTransfer, int64, error)
	GetStatistics(userID uuid.UUID) (*FileTransferStatistics, error)
}

type repository struct {
	db *gorm.DB
}

// NewRepository 创建文件传输数据访问实例
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// Create 创建文件传输记录
func (r *repository) Create(transfer *FileTransfer) error {
	return r.db.Create(transfer).Error
}

// Update 更新文件传输记录
func (r *repository) Update(id uuid.UUID, updates map[string]interface{}) error {
	return r.db.Model(&FileTransfer{}).Where("id = ?", id).Updates(updates).Error
}

// Delete 删除文件传输记录（软删除）
func (r *repository) Delete(id uuid.UUID) error {
	return r.db.Delete(&FileTransfer{}, "id = ?", id).Error
}

// GetByID 根据ID获取文件传输记录
func (r *repository) GetByID(id uuid.UUID) (*FileTransfer, error) {
	var transfer FileTransfer
	err := r.db.Where("id = ?", id).First(&transfer).Error
	if err != nil {
		return nil, err
	}
	return &transfer, nil
}

// List 获取文件传输列表
func (r *repository) List(userID uuid.UUID, req *ListFileTransfersRequest) ([]FileTransfer, int64, error) {
	var transfers []FileTransfer
	var total int64

	// 构建查询
	query := r.db.Model(&FileTransfer{}).Where("user_id = ?", userID)

	// 应用筛选条件
	if req.Status != "" {
		query = query.Where("status = ?", req.Status)
	}

	if req.TransferType != "" {
		query = query.Where("transfer_type = ?", req.TransferType)
	}

	if req.ServerID != "" {
		serverUUID, err := uuid.Parse(req.ServerID)
		if err == nil {
			query = query.Where("server_id = ?", serverUUID)
		}
	}

	// 计算总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页查询
	offset := (req.Page - 1) * req.Limit
	err := query.
		Order("created_at DESC").
		Limit(req.Limit).
		Offset(offset).
		Find(&transfers).Error

	if err != nil {
		return nil, 0, err
	}

	return transfers, total, nil
}

// GetStatistics 获取文件传输统计信息
func (r *repository) GetStatistics(userID uuid.UUID) (*FileTransferStatistics, error) {
	stats := &FileTransferStatistics{
		ByType:   make(map[string]int),
		ByStatus: make(map[string]int),
	}

	// 查询总传输数
	if err := r.db.Model(&FileTransfer{}).
		Where("user_id = ?", userID).
		Count(&stats.TotalTransfers).Error; err != nil {
		return nil, err
	}

	// 查询已完成传输数
	if err := r.db.Model(&FileTransfer{}).
		Where("user_id = ? AND status = ?", userID, "completed").
		Count(&stats.CompletedTransfers).Error; err != nil {
		return nil, err
	}

	// 查询失败传输数
	if err := r.db.Model(&FileTransfer{}).
		Where("user_id = ? AND status = ?", userID, "failed").
		Count(&stats.FailedTransfers).Error; err != nil {
		return nil, err
	}

	// 查询上传总字节数
	var uploadResult struct {
		Total int64
	}
	if err := r.db.Model(&FileTransfer{}).
		Select("COALESCE(SUM(bytes_transferred), 0) as total").
		Where("user_id = ? AND transfer_type = ? AND status = ?", userID, "upload", "completed").
		Scan(&uploadResult).Error; err != nil {
		return nil, err
	}
	stats.TotalBytesUploaded = uploadResult.Total

	// 查询下载总字节数
	var downloadResult struct {
		Total int64
	}
	if err := r.db.Model(&FileTransfer{}).
		Select("COALESCE(SUM(bytes_transferred), 0) as total").
		Where("user_id = ? AND transfer_type = ? AND status = ?", userID, "download", "completed").
		Scan(&downloadResult).Error; err != nil {
		return nil, err
	}
	stats.TotalBytesDownloaded = downloadResult.Total

	// 按类型统计
	var typeStats []struct {
		TransferType string
		Count        int
	}
	if err := r.db.Model(&FileTransfer{}).
		Select("transfer_type, COUNT(*) as count").
		Where("user_id = ?", userID).
		Group("transfer_type").
		Scan(&typeStats).Error; err != nil {
		return nil, err
	}
	for _, stat := range typeStats {
		stats.ByType[stat.TransferType] = stat.Count
	}

	// 按状态统计
	var statusStats []struct {
		Status string
		Count  int
	}
	if err := r.db.Model(&FileTransfer{}).
		Select("status, COUNT(*) as count").
		Where("user_id = ?", userID).
		Group("status").
		Scan(&statusStats).Error; err != nil {
		return nil, err
	}
	for _, stat := range statusStats {
		stats.ByStatus[stat.Status] = stat.Count
	}

	return stats, nil
}
