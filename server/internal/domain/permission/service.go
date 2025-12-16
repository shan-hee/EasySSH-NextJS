package permission

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/easyssh/server/internal/domain/auth"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrPermissionNotFound   = errors.New("permission not found")
	ErrPermissionCodeExists = errors.New("permission code already exists")
	ErrInvalidPermission    = errors.New("invalid permission")
)

// Service 权限服务接口
type Service interface {
	List(ctx context.Context, page, limit int, module string, q string) ([]*Permission, int64, error)
	GetByID(ctx context.Context, id uuid.UUID) (*Permission, error)
	Create(ctx context.Context, name, code, description string, module Module, roles []auth.UserRole) (*Permission, error)
	Update(ctx context.Context, id uuid.UUID, name, code, description string, module Module, roles []auth.UserRole) (*Permission, error)
	Delete(ctx context.Context, id uuid.UUID) error

	// RoleHasPermission 判断角色是否拥有权限（用于中间件）
	RoleHasPermission(ctx context.Context, role auth.UserRole, code string) (bool, error)

	// EnsureDefaults 确保默认权限存在（仅创建缺失项，不覆盖已存在项）
	EnsureDefaults(ctx context.Context) error
}

type service struct {
	repo Repository

	cacheTTL time.Duration

	cacheMu      sync.RWMutex
	cacheByCode  map[string]*Permission
	cacheExpires time.Time
}

func NewService(repo Repository) Service {
	return &service{
		repo:     repo,
		cacheTTL: 10 * time.Second,
	}
}

func (s *service) List(ctx context.Context, page, limit int, module string, q string) ([]*Permission, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit
	return s.repo.List(ctx, offset, limit, module, q)
}

func (s *service) GetByID(ctx context.Context, id uuid.UUID) (*Permission, error) {
	p, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrPermissionNotFound
		}
		return nil, err
	}
	return p, nil
}

func (s *service) Create(ctx context.Context, name, code, description string, module Module, roles []auth.UserRole) (*Permission, error) {
	p, err := s.newPermission(name, code, description, module, roles)
	if err != nil {
		return nil, err
	}

	_, err = s.repo.GetByCode(ctx, p.Code)
	if err == nil {
		return nil, ErrPermissionCodeExists
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	if err := s.repo.Create(ctx, p); err != nil {
		return nil, err
	}
	s.invalidateCache()
	return p, nil
}

func (s *service) Update(ctx context.Context, id uuid.UUID, name, code, description string, module Module, roles []auth.UserRole) (*Permission, error) {
	existing, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrPermissionNotFound
		}
		return nil, err
	}

	name = strings.TrimSpace(name)
	code = strings.TrimSpace(code)
	description = strings.TrimSpace(description)

	if name == "" || code == "" {
		return nil, ErrInvalidPermission
	}
	if !module.IsValid() {
		return nil, ErrInvalidPermission
	}
	normalizedRoles, err := normalizeRoles(roles)
	if err != nil {
		return nil, err
	}

	// 如变更 code，需检查唯一性
	if code != "" && code != existing.Code {
		byCode, err := s.repo.GetByCode(ctx, code)
		if err == nil && byCode != nil && byCode.ID != id {
			return nil, ErrPermissionCodeExists
		}
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		existing.Code = code
	}

	existing.Name = name
	existing.Description = description
	existing.Module = module
	existing.Roles = RoleList(normalizedRoles)

	if err := s.repo.Update(ctx, existing); err != nil {
		return nil, err
	}
	s.invalidateCache()
	return existing, nil
}

func (s *service) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrPermissionNotFound
		}
		return err
	}
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	s.invalidateCache()
	return nil
}

func (s *service) RoleHasPermission(ctx context.Context, role auth.UserRole, code string) (bool, error) {
	code = strings.TrimSpace(code)
	if code == "" {
		return false, ErrInvalidPermission
	}
	role = auth.UserRole(strings.TrimSpace(string(role)))
	if role == "" {
		return false, ErrInvalidPermission
	}

	p, err := s.getByCodeCached(ctx, code)
	if err != nil {
		if errors.Is(err, ErrPermissionNotFound) {
			return false, nil
		}
		return false, err
	}

	for _, r := range p.Roles {
		if r == role {
			return true, nil
		}
	}
	return false, nil
}

func (s *service) EnsureDefaults(ctx context.Context) error {
	for _, def := range DefaultPermissions() {
		_, err := s.repo.GetByCode(ctx, def.Code)
		if err == nil {
			continue
		}
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		clone := def
		if clone.ID == uuid.Nil {
			clone.ID = uuid.New()
		}
		if err := s.repo.Create(ctx, &clone); err != nil {
			return err
		}
	}
	s.invalidateCache()
	return nil
}

func (s *service) invalidateCache() {
	s.cacheMu.Lock()
	defer s.cacheMu.Unlock()
	s.cacheByCode = nil
	s.cacheExpires = time.Time{}
}

func (s *service) getByCodeCached(ctx context.Context, code string) (*Permission, error) {
	now := time.Now()

	s.cacheMu.RLock()
	if s.cacheByCode != nil && now.Before(s.cacheExpires) {
		if p, ok := s.cacheByCode[code]; ok && p != nil {
			s.cacheMu.RUnlock()
			return p, nil
		}
		s.cacheMu.RUnlock()
		return nil, ErrPermissionNotFound
	}
	s.cacheMu.RUnlock()

	s.cacheMu.Lock()
	defer s.cacheMu.Unlock()

	// 双检，避免重复加载
	now = time.Now()
	if s.cacheByCode != nil && now.Before(s.cacheExpires) {
		if p, ok := s.cacheByCode[code]; ok && p != nil {
			return p, nil
		}
		return nil, ErrPermissionNotFound
	}

	all, err := s.repo.ListAll(ctx)
	if err != nil {
		return nil, err
	}
	m := make(map[string]*Permission, len(all))
	for _, p := range all {
		if p == nil {
			continue
		}
		m[p.Code] = p
	}
	s.cacheByCode = m
	s.cacheExpires = now.Add(s.cacheTTL)

	if p, ok := s.cacheByCode[code]; ok && p != nil {
		return p, nil
	}
	return nil, ErrPermissionNotFound
}

func (s *service) newPermission(name, code, description string, module Module, roles []auth.UserRole) (*Permission, error) {
	name = strings.TrimSpace(name)
	code = strings.TrimSpace(code)
	description = strings.TrimSpace(description)

	if name == "" || code == "" {
		return nil, ErrInvalidPermission
	}
	if !module.IsValid() {
		return nil, ErrInvalidPermission
	}

	normalizedRoles, err := normalizeRoles(roles)
	if err != nil {
		return nil, err
	}

	return &Permission{
		Name:        name,
		Code:        code,
		Description: description,
		Module:      module,
		Roles:       RoleList(normalizedRoles),
	}, nil
}

func normalizeRoles(roles []auth.UserRole) ([]auth.UserRole, error) {
	if len(roles) == 0 {
		return nil, ErrInvalidPermission
	}
	seen := map[auth.UserRole]struct{}{}
	out := make([]auth.UserRole, 0, len(roles))
	for _, r := range roles {
		r = auth.UserRole(strings.TrimSpace(string(r)))
		switch r {
		case auth.RoleAdmin, auth.RoleUser, auth.RoleViewer:
			if _, ok := seen[r]; ok {
				continue
			}
			seen[r] = struct{}{}
			out = append(out, r)
		default:
			return nil, fmt.Errorf("%w: invalid role %q", ErrInvalidPermission, r)
		}
	}
	if len(out) == 0 {
		return nil, ErrInvalidPermission
	}
	return out, nil
}

// DefaultPermissions 默认权限集合（与前端权限管理页保持一致）
func DefaultPermissions() []Permission {
	return []Permission{
		{
			Name:        "服务器管理",
			Code:        "server:manage",
			Description: "创建、编辑、删除服务器连接",
			Module:      ModuleServer,
			Roles:       RoleList{auth.RoleAdmin},
		},
		{
			Name:        "服务器查看",
			Code:        "server:view",
			Description: "查看服务器列表和详情",
			Module:      ModuleServer,
			Roles:       RoleList{auth.RoleAdmin, auth.RoleUser, auth.RoleViewer},
		},
		{
			Name:        "服务器连接",
			Code:        "server:connect",
			Description: "连接到远程服务器",
			Module:      ModuleServer,
			Roles:       RoleList{auth.RoleAdmin, auth.RoleUser},
		},
		{
			Name:        "文件管理",
			Code:        "file:manage",
			Description: "上传、下载、删除文件",
			Module:      ModuleFile,
			Roles:       RoleList{auth.RoleAdmin, auth.RoleUser},
		},
		{
			Name:        "文件查看",
			Code:        "file:view",
			Description: "浏览文件列表",
			Module:      ModuleFile,
			Roles:       RoleList{auth.RoleAdmin, auth.RoleUser, auth.RoleViewer},
		},
		{
			Name:        "终端执行",
			Code:        "terminal:execute",
			Description: "在终端中执行命令",
			Module:      ModuleTerminal,
			Roles:       RoleList{auth.RoleAdmin, auth.RoleUser},
		},
		{
			Name:        "审计日志查看",
			Code:        "audit:view",
			Description: "查看系统审计日志",
			Module:      ModuleAudit,
			Roles:       RoleList{auth.RoleAdmin},
		},
		{
			Name:        "系统设置",
			Code:        "system:settings",
			Description: "修改系统配置",
			Module:      ModuleSystem,
			Roles:       RoleList{auth.RoleAdmin},
		},
		{
			Name:        "用户管理",
			Code:        "user:manage",
			Description: "创建、编辑、删除用户",
			Module:      ModuleSystem,
			Roles:       RoleList{auth.RoleAdmin},
		},
	}
}
