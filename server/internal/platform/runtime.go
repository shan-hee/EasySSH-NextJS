package platform

import "strings"

type RuntimeProfile string

const (
	RuntimeProfileWeb     RuntimeProfile = "web"
	RuntimeProfileDesktop RuntimeProfile = "desktop"
)

type Capability string

const (
	CapabilityServers        Capability = "servers"
	CapabilityTerminal       Capability = "terminal"
	CapabilitySFTP           Capability = "sftp"
	CapabilityTransfers      Capability = "transfers"
	CapabilityScripts        Capability = "scripts"
	CapabilityAutomation     Capability = "automation"
	CapabilityMonitoring     Capability = "monitoring"
	CapabilityDocker         Capability = "docker"
	CapabilityAI             Capability = "ai"
	CapabilityBackup         Capability = "backup"
	CapabilitySettings       Capability = "settings"
	CapabilityUsers          Capability = "users"
	CapabilityPermissions    Capability = "permissions"
	CapabilityAudit          Capability = "audit"
	CapabilityLoginLogs      Capability = "login_logs"
	CapabilityNotifications  Capability = "notifications"
	CapabilityOAuth          Capability = "oauth"
	CapabilitySecurityPolicy Capability = "security_policy"
	CapabilityDesktopDataDir Capability = "desktop_data_dir"
	CapabilityOpenDataDir    Capability = "open_data_dir"
	CapabilityPortableMode   Capability = "portable_mode"
)

type RuntimeInfo struct {
	Profile      RuntimeProfile      `json:"profile"`
	Principal    PrincipalDescriptor `json:"principal"`
	Version      string              `json:"version,omitempty"`
	SingleUser   bool                `json:"single_user"`
	Portable     bool                `json:"portable"`
	Managed      bool                `json:"managed"`
	DataDir      string              `json:"data_dir,omitempty"`
	Capabilities map[Capability]bool `json:"capabilities"`
}

var Version = "dev"

func NormalizeProfile(profile RuntimeProfile) RuntimeProfile {
	switch RuntimeProfile(strings.ToLower(strings.TrimSpace(string(profile)))) {
	case RuntimeProfileDesktop:
		return RuntimeProfileDesktop
	default:
		return RuntimeProfileWeb
	}
}

func RuntimeInfoForProfile(profile RuntimeProfile, dataDir string) RuntimeInfo {
	profile = NormalizeProfile(profile)
	if profile == RuntimeProfileDesktop {
		return RuntimeInfo{
			Profile:    RuntimeProfileDesktop,
			Principal:  DesktopLocalOwnerPrincipal(),
			Version:    Version,
			SingleUser: true,
			Portable:   true,
			Managed:    false,
			DataDir:    dataDir,
			Capabilities: capabilities(
				CapabilityServers,
				CapabilityTerminal,
				CapabilitySFTP,
				CapabilityTransfers,
				CapabilityScripts,
				CapabilityMonitoring,
				CapabilityDocker,
				CapabilityAI,
				CapabilityBackup,
				CapabilitySettings,
				CapabilityDesktopDataDir,
				CapabilityOpenDataDir,
				CapabilityPortableMode,
			),
		}
	}

	return RuntimeInfo{
		Profile:    RuntimeProfileWeb,
		Principal:  WebUserPrincipal(),
		Version:    Version,
		SingleUser: false,
		Portable:   false,
		Managed:    true,
		DataDir:    dataDir,
		Capabilities: capabilities(
			CapabilityServers,
			CapabilityTerminal,
			CapabilitySFTP,
			CapabilityTransfers,
			CapabilityScripts,
			CapabilityAutomation,
			CapabilityMonitoring,
			CapabilityDocker,
			CapabilityAI,
			CapabilityBackup,
			CapabilitySettings,
			CapabilityUsers,
			CapabilityPermissions,
			CapabilityAudit,
			CapabilityLoginLogs,
			CapabilityNotifications,
			CapabilityOAuth,
			CapabilitySecurityPolicy,
		),
	}
}

func capabilities(enabled ...Capability) map[Capability]bool {
	all := []Capability{
		CapabilityServers,
		CapabilityTerminal,
		CapabilitySFTP,
		CapabilityTransfers,
		CapabilityScripts,
		CapabilityAutomation,
		CapabilityMonitoring,
		CapabilityDocker,
		CapabilityAI,
		CapabilityBackup,
		CapabilitySettings,
		CapabilityUsers,
		CapabilityPermissions,
		CapabilityAudit,
		CapabilityLoginLogs,
		CapabilityNotifications,
		CapabilityOAuth,
		CapabilitySecurityPolicy,
		CapabilityDesktopDataDir,
		CapabilityOpenDataDir,
		CapabilityPortableMode,
	}

	result := make(map[Capability]bool, len(all))
	for _, capability := range all {
		result[capability] = false
	}
	for _, capability := range enabled {
		result[capability] = true
	}
	return result
}
