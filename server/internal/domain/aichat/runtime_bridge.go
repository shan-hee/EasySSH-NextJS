package aichat

import (
	"time"

	"github.com/easyssh/server/internal/domain/aichat/provider"
	"github.com/easyssh/server/internal/domain/aichat/registry"
	"github.com/easyssh/server/internal/domain/aichat/runtime"
	"github.com/easyssh/server/internal/domain/aiconfig"
	"github.com/easyssh/server/internal/domain/useraiconfig"
)

func NewRuntimeManager(
	aiConfigService aiconfig.Service,
	userAIConfigService useraiconfig.Service,
	toolExecutor *ToolExecutorService,
) *runtime.Manager {
	toolRegistry := registry.NewToolRegistry(nil)
	if toolExecutor != nil {
		toolRegistry = toolExecutor.BuildToolRegistry()
	}

	return runtime.NewManager(
		NewConfigResolver(aiConfigService, userAIConfigService),
		provider.NewFactory(),
		toolRegistry,
		30*time.Minute,
	)
}
