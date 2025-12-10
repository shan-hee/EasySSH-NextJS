package monitoring

import (
	"context"
	"fmt"
	"time"

	"github.com/easyssh/server/internal/domain/auth"
	"github.com/easyssh/server/internal/domain/server"
	"github.com/easyssh/server/internal/pkg/crypto"
	"github.com/google/uuid"
)

// Service 监控服务接口
type Service interface {
	// GetAllServersResources 获取所有服务器的资源概览（单次SSH批量采集）
	GetAllServersResources(ctx context.Context) (*AllServersResources, error)
	// StreamServersResources 流式获取服务器资源（每台服务器采集完成立即通过 channel 返回）
	StreamServersResources(ctx context.Context, resultChan chan<- *ServerResourceSummary) error
	// GetAllServersResourcesWithUser 使用指定用户配置获取所有服务器的资源概览
	GetAllServersResourcesWithUser(ctx context.Context, user *auth.User) (*AllServersResources, error)
	// StreamServersResourcesWithUser 使用指定用户配置流式获取服务器资源
	StreamServersResourcesWithUser(ctx context.Context, user *auth.User, resultChan chan<- *ServerResourceSummary) error
	// TestDataSourceConnection 测试数据源连接
	TestDataSourceConnection(ctx context.Context, config *DataSourceConfig, user *auth.User) error
}

// service 监控服务实现
type service struct {
	serverService     server.Service
	encryptor         *crypto.Encryptor
	dataSourceFactory *DataSourceFactory
}

// NewService 创建监控服务
func NewService(serverService server.Service, encryptor *crypto.Encryptor) Service {
	return &service{
		serverService:     serverService,
		encryptor:         encryptor,
		dataSourceFactory: NewDataSourceFactory(serverService, encryptor),
	}
}

// GetAllServersResources 获取所有服务器的资源概览（使用 EasySSH 数据源）
func (s *service) GetAllServersResources(ctx context.Context) (*AllServersResources, error) {
	// 从 context 获取用户 ID
	userIDValue, ok := ctx.Value("user_id").(string)
	if !ok {
		return nil, fmt.Errorf("user_id not found in context")
	}

	userID, err := uuid.Parse(userIDValue)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}

	// 创建 EasySSH 数据源
	dataSource := NewEasySSHDataSource(s.serverService, s.encryptor, userID)

	// 使用数据源获取资源
	summaries, err := dataSource.GetServersResources(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get servers resources: %w", err)
	}

	return &AllServersResources{
		Servers:     summaries,
		CollectedAt: time.Now(),
	}, nil
}

// StreamServersResources 流式获取服务器资源（使用 EasySSH 数据源）
func (s *service) StreamServersResources(ctx context.Context, resultChan chan<- *ServerResourceSummary) error {
	defer close(resultChan)

	// 从 context 获取用户 ID
	userIDValue, ok := ctx.Value("user_id").(string)
	if !ok {
		return fmt.Errorf("user_id not found in context")
	}

	userID, err := uuid.Parse(userIDValue)
	if err != nil {
		return fmt.Errorf("invalid user_id: %w", err)
	}

	// 创建 EasySSH 数据源
	dataSource := NewEasySSHDataSource(s.serverService, s.encryptor, userID)

	// 使用数据源流式获取资源
	return dataSource.StreamServersResources(ctx, resultChan)
}

// GetAllServersResourcesWithUser 使用指定用户配置获取所有服务器的资源概览
func (s *service) GetAllServersResourcesWithUser(ctx context.Context, user *auth.User) (*AllServersResources, error) {
	// 根据用户配置创建数据源
	dataSource, err := s.dataSourceFactory.CreateDataSource(user)
	if err != nil {
		return nil, fmt.Errorf("failed to create data source: %w", err)
	}

	// 使用数据源获取资源
	summaries, err := dataSource.GetServersResources(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get servers resources from %s: %w", dataSource.Name(), err)
	}

	return &AllServersResources{
		Servers:     summaries,
		CollectedAt: time.Now(),
	}, nil
}

// StreamServersResourcesWithUser 使用指定用户配置流式获取服务器资源
func (s *service) StreamServersResourcesWithUser(ctx context.Context, user *auth.User, resultChan chan<- *ServerResourceSummary) error {
	defer close(resultChan)

	// 根据用户配置创建数据源
	dataSource, err := s.dataSourceFactory.CreateDataSource(user)
	if err != nil {
		return fmt.Errorf("failed to create data source: %w", err)
	}

	// 使用数据源流式获取资源
	return dataSource.StreamServersResources(ctx, resultChan)
}

// TestDataSourceConnection 测试数据源连接
func (s *service) TestDataSourceConnection(ctx context.Context, config *DataSourceConfig, user *auth.User) error {
	// 根据配置创建数据源
	dataSource, err := s.dataSourceFactory.CreateDataSourceFromConfig(config, user)
	if err != nil {
		return fmt.Errorf("failed to create data source: %w", err)
	}

	// 测试连接
	return dataSource.TestConnection(ctx)
}
