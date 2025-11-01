package filetransfer

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrFileTransferNotFound    = errors.New("file transfer not found")
	ErrInvalidFileTransferData = errors.New("invalid file transfer data")
	ErrUnauthorized            = errors.New("unauthorized access to file transfer")
)

// Service 文件传输业务逻辑接口
type Service interface {
	CreateFileTransfer(req *CreateFileTransferRequest) (*FileTransfer, error)
	UpdateFileTransfer(userID uuid.UUID, id uuid.UUID, req *UpdateFileTransferRequest) (*FileTransfer, error)
	UpdateProgress(id uuid.UUID, bytesTransferred int64, progress int) error
	CompleteTransfer(id uuid.UUID) error
	FailTransfer(id uuid.UUID, errorMsg string) error
	DeleteFileTransfer(userID uuid.UUID, id uuid.UUID) error
	GetFileTransfer(userID uuid.UUID, id uuid.UUID) (*FileTransfer, error)
	ListFileTransfers(userID uuid.UUID, req *ListFileTransfersRequest) (*ListFileTransfersResponse, error)
	GetStatistics(userID uuid.UUID) (*FileTransferStatistics, error)
}

type service struct {
	repo Repository
}

// NewService 创建文件传输服务实例
func NewService(repo Repository) Service {
	return &service{repo: repo}
}

// CreateFileTransfer 创建文件传输记录
func (s *service) CreateFileTransfer(req *CreateFileTransferRequest) (*FileTransfer, error) {
	// 验证必填字段
	if req.UserID == uuid.Nil || req.ServerID == uuid.Nil {
		return nil, ErrInvalidFileTransferData
	}

	if req.TransferType != "upload" && req.TransferType != "download" {
		return nil, ErrInvalidFileTransferData
	}

	if req.FileName == "" || req.SourcePath == "" || req.DestPath == "" {
		return nil, ErrInvalidFileTransferData
	}

	// 构建文件传输记录
	now := time.Now()
	transfer := &FileTransfer{
		UserID:           req.UserID,
		ServerID:         req.ServerID,
		SessionID:        req.SessionID,
		TransferType:     req.TransferType,
		SourcePath:       req.SourcePath,
		DestPath:         req.DestPath,
		FileName:         req.FileName,
		FileSize:         req.FileSize,
		Status:           "transferring",
		Progress:         0,
		BytesTransferred: 0,
		StartedAt:        &now,
	}

	if err := s.repo.Create(transfer); err != nil {
		return nil, err
	}

	return transfer, nil
}

// UpdateFileTransfer 更新文件传输记录
func (s *service) UpdateFileTransfer(userID uuid.UUID, id uuid.UUID, req *UpdateFileTransferRequest) (*FileTransfer, error) {
	// 获取现有传输记录
	existingTransfer, err := s.repo.GetByID(id)
	if err != nil {
		return nil, ErrFileTransferNotFound
	}

	// 验证所有权
	if existingTransfer.UserID != userID {
		return nil, ErrUnauthorized
	}

	// 构建更新字段
	updates := make(map[string]interface{})

	if req.Status != "" {
		validStatuses := map[string]bool{
			"pending": true, "transferring": true, "completed": true, "failed": true,
		}
		if !validStatuses[req.Status] {
			return nil, errors.New("invalid status")
		}
		updates["status"] = req.Status

		if req.Status == "completed" || req.Status == "failed" {
			now := time.Now()
			updates["completed_at"] = now
			if existingTransfer.StartedAt != nil {
				duration := int(now.Sub(*existingTransfer.StartedAt).Seconds())
				updates["duration"] = duration

				// 计算传输速度 (字节/秒)
				if duration > 0 {
					speed := existingTransfer.BytesTransferred / int64(duration)
					updates["speed"] = speed
				}
			}
		}
	}

	if req.Progress != nil {
		if *req.Progress < 0 || *req.Progress > 100 {
			return nil, errors.New("progress must be between 0 and 100")
		}
		updates["progress"] = *req.Progress
	}

	if req.BytesTransferred != nil {
		updates["bytes_transferred"] = *req.BytesTransferred
	}

	if req.ErrorMessage != "" {
		updates["error_message"] = req.ErrorMessage
	}

	if len(updates) == 0 {
		return existingTransfer, nil
	}

	// 执行更新
	if err := s.repo.Update(id, updates); err != nil {
		return nil, err
	}

	// 返回更新后的传输记录
	return s.repo.GetByID(id)
}

// UpdateProgress 更新传输进度（用于实时更新）
func (s *service) UpdateProgress(id uuid.UUID, bytesTransferred int64, progress int) error {
	if progress < 0 || progress > 100 {
		return errors.New("progress must be between 0 and 100")
	}

	updates := map[string]interface{}{
		"bytes_transferred": bytesTransferred,
		"progress":          progress,
	}

	return s.repo.Update(id, updates)
}

// CompleteTransfer 完成传输
func (s *service) CompleteTransfer(id uuid.UUID) error {
	transfer, err := s.repo.GetByID(id)
	if err != nil {
		return ErrFileTransferNotFound
	}

	now := time.Now()
	updates := map[string]interface{}{
		"status":       "completed",
		"progress":     100,
		"completed_at": now,
	}

	if transfer.StartedAt != nil {
		duration := int(now.Sub(*transfer.StartedAt).Seconds())
		updates["duration"] = duration

		// 计算传输速度
		if duration > 0 && transfer.BytesTransferred > 0 {
			speed := transfer.BytesTransferred / int64(duration)
			updates["speed"] = speed
		}
	}

	return s.repo.Update(id, updates)
}

// FailTransfer 标记传输失败
func (s *service) FailTransfer(id uuid.UUID, errorMsg string) error {
	now := time.Now()
	updates := map[string]interface{}{
		"status":        "failed",
		"error_message": errorMsg,
		"completed_at":  now,
	}

	transfer, err := s.repo.GetByID(id)
	if err == nil && transfer.StartedAt != nil {
		duration := int(now.Sub(*transfer.StartedAt).Seconds())
		updates["duration"] = duration
	}

	return s.repo.Update(id, updates)
}

// DeleteFileTransfer 删除文件传输记录
func (s *service) DeleteFileTransfer(userID uuid.UUID, id uuid.UUID) error {
	// 获取现有传输记录
	existingTransfer, err := s.repo.GetByID(id)
	if err != nil {
		return ErrFileTransferNotFound
	}

	// 验证所有权
	if existingTransfer.UserID != userID {
		return ErrUnauthorized
	}

	return s.repo.Delete(id)
}

// GetFileTransfer 获取文件传输详情
func (s *service) GetFileTransfer(userID uuid.UUID, id uuid.UUID) (*FileTransfer, error) {
	transfer, err := s.repo.GetByID(id)
	if err != nil {
		return nil, ErrFileTransferNotFound
	}

	// 验证所有权
	if transfer.UserID != userID {
		return nil, ErrUnauthorized
	}

	return transfer, nil
}

// ListFileTransfers 获取文件传输列表
func (s *service) ListFileTransfers(userID uuid.UUID, req *ListFileTransfersRequest) (*ListFileTransfersResponse, error) {
	// 设置默认值
	if req.Page < 1 {
		req.Page = 1
	}
	if req.Limit < 1 {
		req.Limit = 20
	}
	if req.Limit > 100 {
		req.Limit = 100 // 限制最大每页数量
	}

	transfers, total, err := s.repo.List(userID, req)
	if err != nil {
		return nil, err
	}

	// 计算总页数
	totalPages := int(total) / req.Limit
	if int(total)%req.Limit > 0 {
		totalPages++
	}

	return &ListFileTransfersResponse{
		Data:       transfers,
		Total:      total,
		Page:       req.Page,
		PageSize:   req.Limit,
		TotalPages: totalPages,
	}, nil
}

// GetStatistics 获取文件传输统计信息
func (s *service) GetStatistics(userID uuid.UUID) (*FileTransferStatistics, error) {
	return s.repo.GetStatistics(userID)
}
