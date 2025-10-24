package script

import (
	"errors"
	"math"

	"github.com/google/uuid"
)

var (
	ErrScriptNotFound      = errors.New("script not found")
	ErrUnauthorized        = errors.New("unauthorized to access this script")
	ErrInvalidScriptData   = errors.New("invalid script data")
	ErrScriptNameDuplicate = errors.New("script name already exists")
)

// Service 脚本业务逻辑接口
type Service interface {
	CreateScript(userID uuid.UUID, username string, req *CreateScriptRequest) (*Script, error)
	UpdateScript(userID uuid.UUID, scriptID uuid.UUID, req *UpdateScriptRequest) (*Script, error)
	DeleteScript(userID uuid.UUID, scriptID uuid.UUID) error
	GetScript(userID uuid.UUID, scriptID uuid.UUID) (*Script, error)
	ListScripts(userID uuid.UUID, req *ListScriptsRequest) (*ListScriptsResponse, error)
	ExecuteScript(userID uuid.UUID, scriptID uuid.UUID) error
}

type service struct {
	repo Repository
}

// NewService 创建脚本服务实例
func NewService(repo Repository) Service {
	return &service{
		repo: repo,
	}
}

// CreateScript 创建脚本
func (s *service) CreateScript(userID uuid.UUID, username string, req *CreateScriptRequest) (*Script, error) {
	// 验证输入
	if req.Name == "" || req.Content == "" {
		return nil, ErrInvalidScriptData
	}

	// 设置默认语言
	if req.Language == "" {
		req.Language = "bash"
	}

	// 创建脚本
	script := &Script{
		UserID:      userID,
		Name:        req.Name,
		Description: req.Description,
		Content:     req.Content,
		Language:    req.Language,
		Tags:        req.Tags,
		Author:      username,
		Executions:  0,
	}

	if err := s.repo.Create(script); err != nil {
		return nil, err
	}

	return script, nil
}

// UpdateScript 更新脚本
func (s *service) UpdateScript(userID uuid.UUID, scriptID uuid.UUID, req *UpdateScriptRequest) (*Script, error) {
	// 检查脚本是否存在且属于当前用户
	script, err := s.repo.GetByID(scriptID)
	if err != nil {
		return nil, ErrScriptNotFound
	}

	if script.UserID != userID {
		return nil, ErrUnauthorized
	}

	// 构建更新数据
	updates := make(map[string]interface{})
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.Content != "" {
		updates["content"] = req.Content
	}
	if req.Language != "" {
		updates["language"] = req.Language
	}
	if req.Tags != nil {
		updates["tags"] = req.Tags
	}

	// 更新脚本
	if err := s.repo.Update(scriptID, updates); err != nil {
		return nil, err
	}

	// 返回更新后的脚本
	return s.repo.GetByID(scriptID)
}

// DeleteScript 删除脚本
func (s *service) DeleteScript(userID uuid.UUID, scriptID uuid.UUID) error {
	// 检查脚本是否存在且属于当前用户
	script, err := s.repo.GetByID(scriptID)
	if err != nil {
		return ErrScriptNotFound
	}

	if script.UserID != userID {
		return ErrUnauthorized
	}

	return s.repo.Delete(scriptID)
}

// GetScript 获取脚本详情
func (s *service) GetScript(userID uuid.UUID, scriptID uuid.UUID) (*Script, error) {
	script, err := s.repo.GetByID(scriptID)
	if err != nil {
		return nil, ErrScriptNotFound
	}

	// 验证所有权
	if script.UserID != userID {
		return nil, ErrUnauthorized
	}

	return script, nil
}

// ListScripts 获取脚本列表
func (s *service) ListScripts(userID uuid.UUID, req *ListScriptsRequest) (*ListScriptsResponse, error) {
	// 设置默认值
	if req.Page < 1 {
		req.Page = 1
	}
	if req.Limit < 1 {
		req.Limit = 20
	}

	// 获取脚本列表
	scripts, total, err := s.repo.List(userID, req)
	if err != nil {
		return nil, err
	}

	// 计算总页数
	totalPages := int(math.Ceil(float64(total) / float64(req.Limit)))

	return &ListScriptsResponse{
		Data:       scripts,
		Total:      total,
		Page:       req.Page,
		PageSize:   req.Limit,
		TotalPages: totalPages,
	}, nil
}

// ExecuteScript 执行脚本（增加执行计数）
func (s *service) ExecuteScript(userID uuid.UUID, scriptID uuid.UUID) error {
	// 检查脚本是否存在且属于当前用户
	script, err := s.repo.GetByID(scriptID)
	if err != nil {
		return ErrScriptNotFound
	}

	if script.UserID != userID {
		return ErrUnauthorized
	}

	// 增加执行次数
	return s.repo.IncrementExecutions(scriptID)
}
