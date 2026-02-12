package aichat

import (
	"errors"
	"fmt"
	"strings"
)

// PermissionMode 会话权限模式
type PermissionMode string

const (
	PermissionModeReadOnly   PermissionMode = "readonly"
	PermissionModeBalanced   PermissionMode = "balanced"
	PermissionModePrivileged PermissionMode = "privileged"
)

var (
	// ErrToolPermissionDenied 工具权限拒绝（可用 errors.Is 判断）
	ErrToolPermissionDenied = errors.New("tool permission denied")
)

type ToolPermissionError struct {
	Mode     PermissionMode
	ToolName string
}

func (e *ToolPermissionError) Error() string {
	return fmt.Sprintf("当前权限模式(%s)不允许执行工具: %s", e.Mode, e.ToolName)
}

func (e *ToolPermissionError) Is(target error) bool {
	return target == ErrToolPermissionDenied
}

// NormalizePermissionMode 规范化权限模式，默认 balanced
func NormalizePermissionMode(raw string) PermissionMode {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case string(PermissionModeReadOnly):
		return PermissionModeReadOnly
	case string(PermissionModePrivileged):
		return PermissionModePrivileged
	case string(PermissionModeBalanced):
		fallthrough
	default:
		return PermissionModeBalanced
	}
}

// IsToolAllowedInMode 判断指定权限模式是否允许执行工具
func IsToolAllowedInMode(mode PermissionMode, toolName string) bool {
	normalized := NormalizePermissionMode(string(mode))
	switch normalized {
	case PermissionModeReadOnly:
		// 严格只读：禁止任何可能修改系统状态的工具
		switch toolName {
		case "execute_command", "write_file", "create_directory", "delete_file":
			return false
		default:
			return true
		}
	case PermissionModeBalanced, PermissionModePrivileged:
		return true
	default:
		return true
	}
}

// GetAvailableToolsByPermission 根据权限模式返回可见工具列表
func GetAvailableToolsByPermission(mode PermissionMode) []ToolDefinition {
	allTools := GetAvailableTools()
	filtered := make([]ToolDefinition, 0, len(allTools))
	for _, tool := range allTools {
		if IsToolAllowedInMode(mode, tool.Name) {
			filtered = append(filtered, tool)
		}
	}
	return filtered
}

// GetPermissionModeRule 返回当前权限模式的系统规则描述
func GetPermissionModeRule(mode PermissionMode) string {
	normalized := NormalizePermissionMode(string(mode))
	switch normalized {
	case PermissionModeReadOnly:
		return "当前是只读分析模式：仅允许查询、读取、分析。严禁执行 execute_command、write_file、create_directory、delete_file；如果用户要求这些操作，请明确说明权限限制并给出只读替代方案。"
	case PermissionModePrivileged:
		return "当前是高权限模式：可使用系统允许的全部工具；涉及高风险操作前，必须先说明风险与回滚方案。"
	case PermissionModeBalanced:
		fallthrough
	default:
		return "当前是标准模式：可使用系统允许的全部工具；涉及高风险操作时，遵循系统确认流程。"
	}
}
