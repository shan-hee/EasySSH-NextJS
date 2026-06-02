package aichat

import (
	"context"
	"encoding/json"

	"github.com/easyssh/server/internal/domain/aichat/registry"
	"github.com/google/uuid"
)

func (s *ToolExecutorService) BuildToolRegistry() *registry.ToolRegistry {
	if s == nil {
		return registry.NewToolRegistry(nil)
	}

	exec := func(fn func(ctx context.Context, userID uuid.UUID, toolCall *ToolCall) (*ToolResult, error), toolName string) registry.ToolExecutor {
		return func(ctx context.Context, userID uuid.UUID, args json.RawMessage) (registry.ExecutionResult, error) {
			result, err := fn(ctx, userID, &ToolCall{
				ID:        uuid.NewString(),
				Name:      toolName,
				Arguments: args,
			})
			if err != nil {
				return registry.ExecutionResult{}, err
			}
			return registry.ExecutionResult{
				Content: result.Content,
				IsError: result.IsError,
			}, nil
		}
	}

	specs := []registry.ToolSpec{
		{
			Name:            "list_servers",
			DisplayName:     "列出服务器",
			Description:     "列出用户的所有服务器。返回服务器列表，包含ID、名称、主机地址、状态等信息。",
			Parameters:      map[string]interface{}{"type": "object", "properties": map[string]interface{}{}, "required": []string{}},
			ConfirmStrategy: registry.ConfirmNone,
			SupportedModes:  []string{"readonly", "balanced", "privileged"},
			Executor:        exec(s.executeListServers, "list_servers"),
		},
		{
			Name:        "get_server_info",
			DisplayName: "获取服务器信息",
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
			ConfirmStrategy: registry.ConfirmNone,
			SupportedModes:  []string{"readonly", "balanced", "privileged"},
			Executor:        exec(s.executeGetServerInfo, "get_server_info"),
		},
		{
			Name:        "execute_command",
			DisplayName: "执行命令",
			Description: "在指定服务器上执行Shell命令。返回命令输出结果。",
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
			Dangerous:       true,
			ConfirmStrategy: registry.ConfirmUser,
			SupportedModes:  []string{"balanced", "privileged"},
			Executor:        exec(s.executeCommand, "execute_command"),
		},
		{
			Name:        "list_directory",
			DisplayName: "列出目录",
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
			ConfirmStrategy: registry.ConfirmNone,
			SupportedModes:  []string{"readonly", "balanced", "privileged"},
			Executor:        exec(s.executeListDirectory, "list_directory"),
		},
		{
			Name:        "read_file",
			DisplayName: "读取文件",
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
			ConfirmStrategy: registry.ConfirmNone,
			SupportedModes:  []string{"readonly", "balanced", "privileged"},
			Executor:        exec(s.executeReadFile, "read_file"),
		},
		{
			Name:        "write_file",
			DisplayName: "写入文件",
			Description: "向服务器上的文件写入内容。如果文件存在会被覆盖。",
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
			Dangerous:       true,
			ConfirmStrategy: registry.ConfirmUser,
			SupportedModes:  []string{"balanced", "privileged"},
			Executor:        exec(s.executeWriteFile, "write_file"),
		},
		{
			Name:        "create_directory",
			DisplayName: "创建目录",
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
			ConfirmStrategy: registry.ConfirmNone,
			SupportedModes:  []string{"balanced", "privileged"},
			Executor:        exec(s.executeCreateDirectory, "create_directory"),
		},
		{
			Name:        "delete_file",
			DisplayName: "删除文件",
			Description: "删除服务器上的文件或目录。目录会被递归删除。",
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
			Dangerous:       true,
			ConfirmStrategy: registry.ConfirmUser,
			SupportedModes:  []string{"balanced", "privileged"},
			Executor:        exec(s.executeDeleteFile, "delete_file"),
		},
		{
			Name:        "get_system_info",
			DisplayName: "系统信息",
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
			ConfirmStrategy: registry.ConfirmNone,
			SupportedModes:  []string{"readonly", "balanced", "privileged"},
			Executor:        exec(s.executeGetSystemInfo, "get_system_info"),
		},
	}

	return registry.NewToolRegistry(specs)
}
