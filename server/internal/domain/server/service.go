package server

import (
	"context"
	"errors"
	"fmt"
	"net"
	"time"

	"github.com/easyssh/server/internal/pkg/crypto"
	"github.com/google/uuid"
)

// Service 服务器服务接口
type Service interface {
	// Create 创建服务器
	Create(ctx context.Context, userID uuid.UUID, req *CreateServerRequest) (*Server, error)

	// GetByID 根据 ID 获取服务器
	GetByID(ctx context.Context, userID, serverID uuid.UUID) (*Server, error)

	// List 获取用户的服务器列表
	List(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*Server, int64, error)

	// Update 更新服务器信息
	Update(ctx context.Context, userID, serverID uuid.UUID, req *UpdateServerRequest) (*Server, error)

	// Delete 删除服务器
	Delete(ctx context.Context, userID, serverID uuid.UUID) error

	// Search 搜索服务器
	Search(ctx context.Context, userID uuid.UUID, query string, limit, offset int) ([]*Server, int64, error)

	// FindByGroup 根据分组查找服务器
	FindByGroup(ctx context.Context, userID uuid.UUID, group string, limit, offset int) ([]*Server, int64, error)

	// GetStatistics 获取统计信息
	GetStatistics(ctx context.Context, userID uuid.UUID) (*ServerStatistics, error)

	// ReorderServers 批量更新服务器排序顺序
	ReorderServers(ctx context.Context, userID uuid.UUID, serverIDs []uuid.UUID) error
}

// CreateServerRequest 创建服务器请求
type CreateServerRequest struct {
	Name        string     `json:"name"`
	Host        string     `json:"host" binding:"required"`
	Port        int        `json:"port"`
	Username    string     `json:"username" binding:"required"`
	AuthMethod  AuthMethod `json:"auth_method" binding:"required"`
	Password    string     `json:"password"`
	PrivateKey  string     `json:"private_key"`
	Group       string     `json:"group"`
	Tags        []string   `json:"tags"`
	Description string     `json:"description"`
}

// UpdateServerRequest 更新服务器请求
type UpdateServerRequest struct {
	Name        *string     `json:"name"`
	Host        *string     `json:"host"`
	Port        *int        `json:"port"`
	Username    *string     `json:"username"`
	AuthMethod  *AuthMethod `json:"auth_method"`
	Password    *string     `json:"password"`
	PrivateKey  *string     `json:"private_key"`
	Group       *string     `json:"group"`
	Tags        *[]string   `json:"tags"`
	Description *string     `json:"description"`
}

// ServerStatistics 服务器统计
type ServerStatistics struct {
	Total   int64              `json:"total"`
	Online  int64              `json:"online"`
	Offline int64              `json:"offline"`
	Error   int64              `json:"error"`
	Unknown int64              `json:"unknown"`
	ByGroup map[string]int64   `json:"by_group"`
	ByTag   map[string]int64   `json:"by_tag"`
}

// serverService 服务器服务实现
type serverService struct {
	repo      Repository
	encryptor *crypto.Encryptor
}

// NewService 创建服务器服务
func NewService(repo Repository, encryptor *crypto.Encryptor) Service {
	return &serverService{
		repo:      repo,
		encryptor: encryptor,
	}
}

func (s *serverService) Create(ctx context.Context, userID uuid.UUID, req *CreateServerRequest) (*Server, error) {
	// 参数验证
	if req.Host == "" || req.Username == "" {
		return nil, errors.New("host and username are required")
	}

	if req.Port == 0 {
		req.Port = 22
	}

	// 验证认证方式
	if req.AuthMethod == AuthMethodPassword && req.Password == "" {
		return nil, errors.New("password is required for password authentication")
	}
	if req.AuthMethod == AuthMethodKey && req.PrivateKey == "" {
		return nil, errors.New("private_key is required for key authentication")
	}

	// 创建服务器
	server := &Server{
		UserID:      userID,
		Name:        req.Name,
		Host:        req.Host,
		Port:        req.Port,
		Username:    req.Username,
		AuthMethod:  req.AuthMethod,
		Group:       req.Group,
		Tags:        req.Tags,
		Description: req.Description,
		Status:      StatusUnknown,
	}

	// 加密密码
	if req.Password != "" {
		encrypted, err := s.encryptor.Encrypt(req.Password)
		if err != nil {
			return nil, fmt.Errorf("failed to encrypt password: %w", err)
		}
		server.Password = encrypted
	}

	// 加密私钥
	if req.PrivateKey != "" {
		encrypted, err := s.encryptor.Encrypt(req.PrivateKey)
		if err != nil {
			return nil, fmt.Errorf("failed to encrypt private key: %w", err)
		}
		server.PrivateKey = encrypted
	}

	// 保存到数据库
	if err := s.repo.Create(ctx, server); err != nil {
		return nil, err
	}

	return server, nil
}

func (s *serverService) GetByID(ctx context.Context, userID, serverID uuid.UUID) (*Server, error) {
	return s.repo.FindByUserIDAndID(ctx, userID, serverID)
}

func (s *serverService) List(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*Server, int64, error) {
	return s.repo.FindByUserID(ctx, userID, limit, offset)
}

func (s *serverService) Update(ctx context.Context, userID, serverID uuid.UUID, req *UpdateServerRequest) (*Server, error) {
	// 查找服务器并验证权限
	server, err := s.repo.FindByUserIDAndID(ctx, userID, serverID)
	if err != nil {
		return nil, err
	}

	// 更新字段
	if req.Name != nil {
		server.Name = *req.Name
	}
	if req.Host != nil {
		server.Host = *req.Host
	}
	if req.Port != nil {
		server.Port = *req.Port
	}
	if req.Username != nil {
		server.Username = *req.Username
	}
	if req.AuthMethod != nil {
		server.AuthMethod = *req.AuthMethod
	}
	if req.Group != nil {
		server.Group = *req.Group
	}
	if req.Tags != nil {
		server.Tags = *req.Tags
	}
	if req.Description != nil {
		server.Description = *req.Description
	}

	// 更新密码
	if req.Password != nil {
		if *req.Password == "" {
			server.Password = ""
		} else {
			encrypted, err := s.encryptor.Encrypt(*req.Password)
			if err != nil {
				return nil, fmt.Errorf("failed to encrypt password: %w", err)
			}
			server.Password = encrypted
		}
	}

	// 更新私钥
	if req.PrivateKey != nil {
		if *req.PrivateKey == "" {
			server.PrivateKey = ""
		} else {
			encrypted, err := s.encryptor.Encrypt(*req.PrivateKey)
			if err != nil {
				return nil, fmt.Errorf("failed to encrypt private key: %w", err)
			}
			server.PrivateKey = encrypted
		}
	}

	// 保存更新
	if err := s.repo.Update(ctx, server); err != nil {
		return nil, err
	}

	return server, nil
}

func (s *serverService) Delete(ctx context.Context, userID, serverID uuid.UUID) error {
	// 验证权限
	if _, err := s.repo.FindByUserIDAndID(ctx, userID, serverID); err != nil {
		return err
	}

	return s.repo.Delete(ctx, serverID)
}

func (s *serverService) Search(ctx context.Context, userID uuid.UUID, query string, limit, offset int) ([]*Server, int64, error) {
	return s.repo.Search(ctx, userID, query, limit, offset)
}

func (s *serverService) FindByGroup(ctx context.Context, userID uuid.UUID, group string, limit, offset int) ([]*Server, int64, error) {
	return s.repo.FindByGroup(ctx, userID, group, limit, offset)
}

func (s *serverService) GetStatistics(ctx context.Context, userID uuid.UUID) (*ServerStatistics, error) {
	servers, _, err := s.repo.FindByUserID(ctx, userID, 1000, 0) // 获取所有服务器
	if err != nil {
		return nil, err
	}

	stats := &ServerStatistics{
		Total:   int64(len(servers)),
		ByGroup: make(map[string]int64),
		ByTag:   make(map[string]int64),
	}

	for _, server := range servers {
		// 统计状态
		switch server.Status {
		case StatusOnline:
			stats.Online++
		case StatusOffline:
			stats.Offline++
		case StatusError:
			stats.Error++
		default:
			stats.Unknown++
		}

		// 统计分组
		if server.Group != "" {
			stats.ByGroup[server.Group]++
		}

		// 统计标签
		if len(server.Tags) > 0 {
			for _, tag := range server.Tags {
				stats.ByTag[tag]++
			}
		}
	}

	return stats, nil
}

// ReorderServers 批量更新服务器排序顺序
// serverIDs: 按照新顺序排列的服务器 ID 数组
func (s *serverService) ReorderServers(ctx context.Context, userID uuid.UUID, serverIDs []uuid.UUID) error {
	if len(serverIDs) == 0 {
		return errors.New("server IDs cannot be empty")
	}

	// 构建 serverID -> sortOrder 的映射
	// sortOrder 从 1 开始，方便后续扩展（0 保留给未排序的服务器）
	orders := make(map[uuid.UUID]int)
	for i, serverID := range serverIDs {
		orders[serverID] = i + 1
	}

	// 调用 repository 层批量更新
	return s.repo.UpdateSortOrders(ctx, userID, orders)
}

// Helper function to check TCP connectivity
func checkTCPConnection(host string, port int, timeout time.Duration) error {
	addr := fmt.Sprintf("%s:%d", host, port)
	conn, err := net.DialTimeout("tcp", addr, timeout)
	if err != nil {
		return err
	}
	defer conn.Close()
	return nil
}
