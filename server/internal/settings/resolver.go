package settings

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/easyssh/server/internal/domain/aichat/provider"
	"github.com/easyssh/server/internal/domain/aiconfig"
	"github.com/easyssh/server/internal/domain/useraiconfig"
	"github.com/easyssh/server/internal/platform"
	"github.com/google/uuid"
)

type Scope string

const (
	ScopeDefault   Scope = "default"
	ScopeSystem    Scope = "system"
	ScopeWorkspace Scope = "workspace"
	ScopeProfile   Scope = "profile"
	ScopeSession   Scope = "session"
)

var ErrAINotConfigured = errors.New("AI service is not configured")

type EffectiveAIConfig = provider.Config

type SettingsResolver interface {
	ResolveAIConfig(ctx context.Context, principal platform.Principal) (EffectiveAIConfig, error)
}

type Resolver struct {
	profile             platform.RuntimeProfile
	aiConfigService     aiconfig.Service
	userAIConfigService useraiconfig.Service
}

func NewResolver(
	profile platform.RuntimeProfile,
	aiConfigService aiconfig.Service,
	userAIConfigService useraiconfig.Service,
) SettingsResolver {
	return &Resolver{
		profile:             platform.NormalizeProfile(profile),
		aiConfigService:     aiConfigService,
		userAIConfigService: userAIConfigService,
	}
}

func (r *Resolver) ResolveAIConfig(ctx context.Context, principal platform.Principal) (EffectiveAIConfig, error) {
	if strings.TrimSpace(string(principal.Profile)) != "" {
		principal.Profile = platform.NormalizeProfile(principal.Profile)
	} else {
		principal.Profile = r.profile
	}

	userID, err := uuid.Parse(strings.TrimSpace(principal.ID))
	if err != nil {
		return EffectiveAIConfig{}, fmt.Errorf("invalid principal id: %w", err)
	}

	if principal.Profile == platform.RuntimeProfileDesktop {
		return r.resolveDesktopAIConfig(ctx, userID)
	}

	if userConfig, ok, err := r.resolveProfileAIConfig(ctx, userID); err != nil {
		return EffectiveAIConfig{}, err
	} else if ok {
		return userConfig, nil
	}

	return r.resolveSystemAIConfig(ctx)
}

func (r *Resolver) resolveDesktopAIConfig(ctx context.Context, userID uuid.UUID) (EffectiveAIConfig, error) {
	if r.userAIConfigService == nil {
		return r.resolveSystemAIConfig(ctx)
	}

	userConfig, err := r.userAIConfigService.GetUserConfig(ctx, userID)
	if err != nil {
		return EffectiveAIConfig{}, err
	}
	if userConfig == nil || userConfig.UseSystemConfig {
		return r.resolveSystemAIConfig(ctx)
	}
	if !userConfig.CustomEnabled {
		return EffectiveAIConfig{}, ErrAINotConfigured
	}

	models := parseConfiguredModels(userConfig.CustomModels)
	return EffectiveAIConfig{
		Provider: normalizeConfiguredProviderName(userConfig.CustomProvider),
		APIKey:   userConfig.CustomAPIKey,
		Endpoint: strings.TrimSpace(userConfig.CustomEndpoint),
		Model:    firstConfiguredModel(models),
		Models:   models,
	}, nil
}

func (r *Resolver) resolveProfileAIConfig(ctx context.Context, userID uuid.UUID) (EffectiveAIConfig, bool, error) {
	if r.userAIConfigService == nil {
		return EffectiveAIConfig{}, false, nil
	}

	userConfig, err := r.userAIConfigService.GetUserConfig(ctx, userID)
	if err != nil {
		return EffectiveAIConfig{}, false, err
	}
	if userConfig == nil || userConfig.UseSystemConfig || !userConfig.CustomEnabled {
		return EffectiveAIConfig{}, false, nil
	}

	models := parseConfiguredModels(userConfig.CustomModels)
	return EffectiveAIConfig{
		Provider: normalizeConfiguredProviderName(userConfig.CustomProvider),
		APIKey:   userConfig.CustomAPIKey,
		Endpoint: strings.TrimSpace(userConfig.CustomEndpoint),
		Model:    firstConfiguredModel(models),
		Models:   models,
	}, true, nil
}

func (r *Resolver) resolveSystemAIConfig(ctx context.Context) (EffectiveAIConfig, error) {
	if r.aiConfigService == nil {
		return EffectiveAIConfig{}, ErrAINotConfigured
	}

	systemConfig, err := r.aiConfigService.GetSystemConfig(ctx)
	if err != nil {
		return EffectiveAIConfig{}, errors.Join(errors.New("failed to get system AI config"), err)
	}
	if systemConfig == nil || !systemConfig.SystemEnabled {
		return EffectiveAIConfig{}, ErrAINotConfigured
	}

	models := parseConfiguredModels(systemConfig.SystemModels)
	return EffectiveAIConfig{
		Provider: normalizeConfiguredProviderName(systemConfig.SystemProvider),
		APIKey:   systemConfig.SystemAPIKey,
		Endpoint: strings.TrimSpace(systemConfig.SystemAPIEndpoint),
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
