package taskexecution

import (
	"errors"

	"github.com/google/uuid"
)

// 错误定义
var (
	ErrUnauthorized = errors.New("unauthorized access")
	ErrNotFound     = errors.New("execution not found")
)

// Service 执行历史服务接口
type Service interface {
	GetExecution(userID, executionID uuid.UUID) (*TaskExecution, error)
	GetExecutionWithResults(userID, executionID uuid.UUID) (*ExecutionDetailResponse, error)
	ListExecutions(userID uuid.UUID, req *ListExecutionsRequest) (*ListExecutionsResponse, error)
	GetStatistics(userID uuid.UUID, days int) (*ExecutionStatistics, error)
	GetServerResults(userID, executionID uuid.UUID) ([]TaskExecutionServer, error)
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{repo: repo}
}

func (s *service) GetExecution(userID, executionID uuid.UUID) (*TaskExecution, error) {
	execution, err := s.repo.GetByID(executionID)
	if err != nil {
		return nil, ErrNotFound
	}

	// 验证所有权
	if execution.UserID != userID {
		return nil, ErrUnauthorized
	}

	return execution, nil
}

func (s *service) GetExecutionWithResults(userID, executionID uuid.UUID) (*ExecutionDetailResponse, error) {
	execution, err := s.repo.GetByIDWithResults(executionID)
	if err != nil {
		return nil, ErrNotFound
	}

	// 验证所有权
	if execution.UserID != userID {
		return nil, ErrUnauthorized
	}

	return &ExecutionDetailResponse{
		TaskExecution: *execution,
		ServerResults: execution.ServerResults,
	}, nil
}

func (s *service) ListExecutions(userID uuid.UUID, req *ListExecutionsRequest) (*ListExecutionsResponse, error) {
	if req.Page < 1 {
		req.Page = 1
	}
	if req.Limit < 1 {
		req.Limit = 20
	}
	if req.Limit > 100 {
		req.Limit = 100
	}

	executions, total, err := s.repo.List(userID, req)
	if err != nil {
		return nil, err
	}

	totalPages := int(total) / req.Limit
	if int(total)%req.Limit > 0 {
		totalPages++
	}

	return &ListExecutionsResponse{
		Data:       executions,
		Total:      total,
		Page:       req.Page,
		PageSize:   req.Limit,
		TotalPages: totalPages,
	}, nil
}

func (s *service) GetStatistics(userID uuid.UUID, days int) (*ExecutionStatistics, error) {
	if days <= 0 {
		days = 30
	}
	if days > 365 {
		days = 365
	}
	return s.repo.GetStatistics(userID, days)
}

func (s *service) GetServerResults(userID, executionID uuid.UUID) ([]TaskExecutionServer, error) {
	// 先验证执行记录所有权
	execution, err := s.repo.GetByID(executionID)
	if err != nil {
		return nil, ErrNotFound
	}
	if execution.UserID != userID {
		return nil, ErrUnauthorized
	}

	return s.repo.GetServerResults(executionID)
}
