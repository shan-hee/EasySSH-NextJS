package aichat

import (
	"context"

	"github.com/easyssh/server/internal/domain/aichat/provider"
	"github.com/easyssh/server/internal/domain/aiconfig"
	"github.com/easyssh/server/internal/domain/useraiconfig"
	"github.com/easyssh/server/internal/platform"
	settingsresolver "github.com/easyssh/server/internal/settings"
	"github.com/google/uuid"
)

var ErrAINotConfigured = settingsresolver.ErrAINotConfigured

type ConfigResolver interface {
	Resolve(ctx context.Context, userID uuid.UUID) (provider.Config, error)
}

type effectiveConfigResolver struct {
	resolver settingsresolver.SettingsResolver
	profile  platform.RuntimeProfile
}

func NewConfigResolver(
	aiConfigService aiconfig.Service,
	userAIConfigService useraiconfig.Service,
) ConfigResolver {
	return NewConfigResolverWithSettings(
		settingsresolver.NewResolver(platform.RuntimeProfileWeb, aiConfigService, userAIConfigService),
		platform.RuntimeProfileWeb,
	)
}

func NewConfigResolverWithSettings(
	resolver settingsresolver.SettingsResolver,
	profile platform.RuntimeProfile,
) ConfigResolver {
	return &effectiveConfigResolver{
		resolver: resolver,
		profile:  platform.NormalizeProfile(profile),
	}
}

func (r *effectiveConfigResolver) Resolve(ctx context.Context, userID uuid.UUID) (provider.Config, error) {
	if r.resolver == nil {
		return provider.Config{}, ErrAINotConfigured
	}

	profile := platform.NormalizeProfile(r.profile)
	kind := platform.PrincipalKindUser
	role := platform.PrincipalRoleUser
	if profile == platform.RuntimeProfileDesktop {
		kind = platform.PrincipalKindLocalOwner
		role = platform.PrincipalRoleOwner
	}

	return r.resolver.ResolveAIConfig(ctx, platform.NewPrincipal(userID.String(), kind, role, profile))
}
