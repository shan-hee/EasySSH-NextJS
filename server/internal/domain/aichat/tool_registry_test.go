package aichat

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBuildToolRegistryRespectsPermissionModes(t *testing.T) {
	t.Parallel()

	reg := (&ToolExecutorService{}).BuildToolRegistry()

	readonlyTools := reg.VisibleForMode("readonly")
	balancedTools := reg.VisibleForMode("balanced")

	readonlyNames := make(map[string]bool, len(readonlyTools))
	for _, tool := range readonlyTools {
		readonlyNames[tool.Name] = true
	}

	balancedNames := make(map[string]bool, len(balancedTools))
	for _, tool := range balancedTools {
		balancedNames[tool.Name] = true
	}

	require.True(t, readonlyNames["list_servers"])
	require.True(t, readonlyNames["read_file"])
	require.False(t, readonlyNames["execute_command"])
	require.False(t, readonlyNames["write_file"])
	require.False(t, readonlyNames["delete_file"])

	require.True(t, balancedNames["execute_command"])
	require.True(t, balancedNames["write_file"])
	require.True(t, balancedNames["delete_file"])
}
