package operationrecord

import (
	"context"

	"github.com/google/uuid"
)

type Service interface {
	Upsert(ctx context.Context, record *OperationRecord) error
	List(ctx context.Context, req *ListRequest) (*ListResponse, error)
	GetByID(ctx context.Context, id uuid.UUID) (*OperationRecord, error)
	GetStatistics(ctx context.Context, req *StatisticsRequest) (*Statistics, error)
	DeleteBySource(ctx context.Context, sourceTable string, sourceID string) error
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{repo: repo}
}

func (s *service) Upsert(ctx context.Context, record *OperationRecord) error {
	return s.repo.Upsert(ctx, record)
}

func (s *service) List(ctx context.Context, req *ListRequest) (*ListResponse, error) {
	return s.repo.List(ctx, req)
}

func (s *service) GetByID(ctx context.Context, id uuid.UUID) (*OperationRecord, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *service) GetStatistics(ctx context.Context, req *StatisticsRequest) (*Statistics, error) {
	if req == nil {
		req = &StatisticsRequest{}
	}
	if req.Days <= 0 && req.StartTime == nil {
		req.Days = 30
	}
	return s.repo.GetStatistics(ctx, req)
}

func (s *service) DeleteBySource(ctx context.Context, sourceTable string, sourceID string) error {
	return s.repo.DeleteBySource(ctx, sourceTable, sourceID)
}
