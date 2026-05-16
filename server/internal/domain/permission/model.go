package permission

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/easyssh/server/internal/domain/auth"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Module 权限所属模块
type Module string

const (
	ModuleServer   Module = "server"
	ModuleFile     Module = "file"
	ModuleTerminal Module = "terminal"
	ModuleAudit    Module = "audit"
	ModuleSystem   Module = "system"
)

func (m Module) IsValid() bool {
	switch m {
	case ModuleServer, ModuleFile, ModuleTerminal, ModuleAudit, ModuleSystem:
		return true
	default:
		return false
	}
}

// RoleList 存储在数据库文本字段中的 JSON 角色列表
type RoleList []auth.UserRole

func (r RoleList) Value() (driver.Value, error) {
	raw, err := json.Marshal(r)
	if err != nil {
		return nil, err
	}
	return raw, nil
}

func (r *RoleList) Scan(value interface{}) error {
	if r == nil {
		return errors.New("RoleList: Scan on nil receiver")
	}
	if value == nil {
		*r = RoleList{}
		return nil
	}
	switch v := value.(type) {
	case []byte:
		if len(v) == 0 {
			*r = RoleList{}
			return nil
		}
		return json.Unmarshal(v, r)
	case string:
		if v == "" {
			*r = RoleList{}
			return nil
		}
		return json.Unmarshal([]byte(v), r)
	default:
		return fmt.Errorf("RoleList: unsupported Scan type %T", value)
	}
}

// Permission 权限定义（按角色授予）
type Permission struct {
	ID          uuid.UUID      `gorm:"type:char(36);primary_key" json:"id"`
	Name        string         `gorm:"not null;size:100" json:"name"`
	Code        string         `gorm:"not null;uniqueIndex;size:100" json:"code"`
	Description string         `gorm:"type:text" json:"description"`
	Module      Module         `gorm:"type:varchar(20);not null" json:"module"`
	Roles       RoleList       `gorm:"type:text;not null" json:"roles"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Permission) TableName() string {
	return "permissions"
}

func (p *Permission) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}
