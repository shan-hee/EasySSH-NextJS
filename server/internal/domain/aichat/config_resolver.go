package aichat

import (
	"context"
	"errors"
	"strings"

	"github.com/easyssh/server/internal/domain/aichat/provider"
	"github.com/easyssh/server/internal/domain/aiconfig"
	"github.com/easyssh/server/internal/domain/useraiconfig"
	"github.com/google/uuid"
)

var (
	ErrAINotConfigured = errors.New("AI service is not configured")
)

type ConfigResolver interface {
	Resolve(ctx context.Context, userID uuid.UUID) (provider.Config, error)
}

type effectiveConfigResolver struct {
	aiConfigService     aiconfig.Service
	userAIConfigService useraiconfig.Service
}

func NewConfigResolver(
	aiConfigService aiconfig.Service,
	userAIConfigService useraiconfig.Service,
) ConfigResolver {
	return &effectiveConfigResolver{
		aiConfigService:     aiConfigService,
		userAIConfigService: userAIConfigService,
	}
}

func (r *effectiveConfigResolver) Resolve(ctx context.Context, userID uuid.UUID) (provider.Config, error) {
	userConfig, err := r.userAIConfigService.GetUserConfig(ctx, userID)
	if err == nil && userConfig != nil && !userConfig.UseSystemConfig && userConfig.CustomEnabled {
		models := parseConfiguredModels(userConfig.CustomModels)

		return provider.Config{
			Provider: normalizeConfiguredProviderName(userConfig.CustomProvider),
			APIKey:   userConfig.CustomAPIKey,
			Endpoint: userConfig.CustomEndpoint,
			Model:    firstConfiguredModel(models),
			Models:   models,
		}, nil
	}

	systemConfig, err := r.aiConfigService.GetSystemConfig(ctx)
	if err != nil {
		return provider.Config{}, errors.Join(errors.New("failed to get system AI config"), err)
	}

	if !systemConfig.SystemEnabled {
		return provider.Config{}, ErrAINotConfigured
	}

	models := parseConfiguredModels(systemConfig.SystemModels)
	return provider.Config{
		Provider: normalizeConfiguredProviderName(systemConfig.SystemProvider),
		APIKey:   systemConfig.SystemAPIKey,
		Endpoint: systemConfig.SystemAPIEndpoint,
		Model:    firstConfiguredModel(models),
		Models:   models,
	}, nil
}

func parseConfiguredModels(models string) []string {
	if strings.TrimSpace(models) == "" {
		return []string{}
	}

	parts := strings.Split(models, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func firstConfiguredModel(models []string) string {
	if len(models) == 0 {
		return ""
	}
	return models[0]
}

func normalizeConfiguredProviderName(providerName string) string {
	normalized := strings.ToLower(strings.TrimSpace(providerName))
	if normalized == "" {
		return "openai"
	}
	return normalized
}
