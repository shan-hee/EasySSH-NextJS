package aichat

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
)

// ToolDefinition 工具定义
type ToolDefinition struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
}

// ToolCall AI 请求的工具调用
type ToolCall struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments"`
}

// ToolResult 工具执行结果
type ToolResult struct {
	ToolCallID string `json:"tool_call_id"`
	Content    string `json:"content"`
	IsError    bool   `json:"is_error,omitempty"`
}

// ToolExecutor 工具执行器接口
type ToolExecutor interface {
	Execute(ctx context.Context, userID uuid.UUID, args json.RawMessage) (*ToolResult, error)
}

// GetAvailableTools 获取所有可用工具定义
func GetAvailableTools() []ToolDefinition {
	return []ToolDefinition{
		{
			Name:        "list_servers",
			Description: "列出用户的所有服务器。返回服务器列表，包含ID、名称、主机地址、状态等信息。",
			Parameters: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
				"required":   []string{},
			},
		},
		{
			Name:        "get_server_info",
			Description: "获取指定服务器的详细信息，包括主机地址、端口、用户名、状态、操作系统等。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"server_id": map[string]interface{}{
						"type":        "string",
						"description": "服务器ID",
					},
				},
				"required": []string{"server_id"},
			},
		},
		{
			Name:        "execute_command",
			Description: "在指定服务器上执行Shell命令。返回命令的输出结果。注意：此操作需要用户确认。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"server_id": map[string]interface{}{
						"type":        "string",
						"description": "要执行命令的服务器ID",
					},
					"command": map[string]interface{}{
						"type":        "string",
						"description": "要执行的Shell命令",
					},
					"timeout": map[string]interface{}{
						"type":        "integer",
						"description": "命令执行超时时间（秒），默认30秒，最大300秒",
						"default":     30,
					},
				},
				"required": []string{"server_id", "command"},
			},
		},
		{
			Name:        "list_directory",
			Description: "列出服务器上指定目录的内容，包括文件和子目录。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"server_id": map[string]interface{}{
						"type":        "string",
						"description": "服务器ID",
					},
					"path": map[string]interface{}{
						"type":        "string",
						"description": "目录路径，默认为用户主目录",
						"default":     "~",
					},
				},
				"required": []string{"server_id"},
			},
		},
		{
			Name:        "read_file",
			Description: "读取服务器上指定文件的内容。适用于文本文件，大文件会被截断。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"server_id": map[string]interface{}{
						"type":        "string",
						"description": "服务器ID",
					},
					"path": map[string]interface{}{
						"type":        "string",
						"description": "文件路径",
					},
					"max_lines": map[string]interface{}{
						"type":        "integer",
						"description": "最大读取行数，默认100行",
						"default":     100,
					},
				},
				"required": []string{"server_id", "path"},
			},
		},
		{
			Name:        "write_file",
			Description: "向服务器上的文件写入内容。如果文件存在会被覆盖。注意：此操作需要用户确认。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"server_id": map[string]interface{}{
						"type":        "string",
						"description": "服务器ID",
					},
					"path": map[string]interface{}{
						"type":        "string",
						"description": "文件路径",
					},
					"content": map[string]interface{}{
						"type":        "string",
						"description": "要写入的内容",
					},
				},
				"required": []string{"server_id", "path", "content"},
			},
		},
		{
			Name:        "create_directory",
			Description: "在服务器上创建目录。支持递归创建。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"server_id": map[string]interface{}{
						"type":        "string",
						"description": "服务器ID",
					},
					"path": map[string]interface{}{
						"type":        "string",
						"description": "目录路径",
					},
				},
				"required": []string{"server_id", "path"},
			},
		},
		{
			Name:        "delete_file",
			Description: "删除服务器上的文件或目录。目录会被递归删除。注意：此操作需要用户确认，删除的文件会移入回收站。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"server_id": map[string]interface{}{
						"type":        "string",
						"description": "服务器ID",
					},
					"path": map[string]interface{}{
						"type":        "string",
						"description": "文件或目录路径",
					},
				},
				"required": []string{"server_id", "path"},
			},
		},
		{
			Name:        "get_system_info",
			Description: "获取服务器的系统信息，包括CPU、内存、磁盘使用情况等。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"server_id": map[string]interface{}{
						"type":        "string",
						"description": "服务器ID",
					},
				},
				"required": []string{"server_id"},
			},
		},
	}
}

// GetToolsForOpenAI 获取 OpenAI 格式的工具定义
func GetToolsForOpenAI() []map[string]interface{} {
	tools := GetAvailableTools()
	result := make([]map[string]interface{}, len(tools))
	for i, tool := range tools {
		result[i] = map[string]interface{}{
			"type": "function",
			"function": map[string]interface{}{
				"name":        tool.Name,
				"description": tool.Description,
				"parameters":  tool.Parameters,
			},
		}
	}
	return result
}

// GetToolsForAnthropic 获取 Anthropic 格式的工具定义
func GetToolsForAnthropic() []map[string]interface{} {
	tools := GetAvailableTools()
	result := make([]map[string]interface{}, len(tools))
	for i, tool := range tools {
		result[i] = map[string]interface{}{
			"name":         tool.Name,
			"description":  tool.Description,
			"input_schema": tool.Parameters,
		}
	}
	return result
}

// IsDangerousTool 判断工具是否需要用户确认
func IsDangerousTool(toolName string) bool {
	dangerousTools := map[string]bool{
		"execute_command": true,
		"write_file":      true,
		"delete_file":     true,
	}
	return dangerousTools[toolName]
}

// FormatToolCallForDisplay 格式化工具调用用于显示
func FormatToolCallForDisplay(toolCall *ToolCall) string {
	var args map[string]interface{}
	if err := json.Unmarshal(toolCall.Arguments, &args); err != nil {
		return fmt.Sprintf("工具: %s\n参数: %s", toolCall.Name, string(toolCall.Arguments))
	}

	argsJSON, _ := json.MarshalIndent(args, "", "  ")
	return fmt.Sprintf("工具: %s\n参数:\n%s", toolCall.Name, string(argsJSON))
}

// toolActionDescriptions 工具执行时的友好描述（动作进行时）
var toolActionDescriptions = map[string]string{
	"list_servers":     "正在查询服务器列表",
	"get_server_info":  "正在获取服务器信息",
	"execute_command":  "正在执行命令",
	"list_directory":   "正在浏览目录",
	"read_file":        "正在读取文件",
	"write_file":       "正在写入文件",
	"create_directory": "正在创建目录",
	"delete_file":      "正在删除文件",
	"get_system_info":  "正在获取系统信息",
}

// GetToolActionDescription 获取工具执行时的友好描述
func GetToolActionDescription(toolName string) string {
	if desc, ok := toolActionDescriptions[toolName]; ok {
		return desc
	}
	return "正在执行操作"
}
