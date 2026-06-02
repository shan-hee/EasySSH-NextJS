package platform

import (
	"os"
	"strings"
)

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
	CapabilityActivityLog    Capability = "activity_log"
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

type Principal struct {
	Kind string `json:"kind"`
	Role string `json:"role"`
}

type RuntimeInfo struct {
	Profile      RuntimeProfile      `json:"profile"`
	Principal    Principal           `json:"principal"`
	SingleUser   bool                `json:"single_user"`
	Portable     bool                `json:"portable"`
	Managed      bool                `json:"managed"`
	DataDir      string              `json:"data_dir,omitempty"`
	Version      string              `json:"version,omitempty"`
	Capabilities map[Capability]bool `json:"capabilities"`
}

type RuntimeOptions struct {
	Profile RuntimeProfile
	DataDir string
	Version string
}

func ResolveRuntimeProfile(value string) RuntimeProfile {
	switch RuntimeProfile(strings.ToLower(strings.TrimSpace(value))) {
	case RuntimeProfileDesktop:
		return RuntimeProfileDesktop
	default:
		return RuntimeProfileWeb
	}
}

func ProfileFromEnvironment() RuntimeProfile {
	return ResolveRuntimeProfile(os.Getenv("EASYSSH_RUNTIME_PROFILE"))
}

func NewRuntimeInfo(options RuntimeOptions) RuntimeInfo {
	profile := options.Profile
	if profile == "" {
		profile = RuntimeProfileWeb
	}

	if profile == RuntimeProfileDesktop {
		return RuntimeInfo{
			Profile:    RuntimeProfileDesktop,
			Principal:  Principal{Kind: "local_owner", Role: "owner"},
			SingleUser: true,
			Portable:   true,
			Managed:    false,
			DataDir:    options.DataDir,
			Version:    options.Version,
			Capabilities: capabilitiesMap(
				CapabilityServers,
				CapabilityTerminal,
				CapabilitySFTP,
				CapabilityTransfers,
				CapabilityScripts,
				CapabilityAutomation,
				CapabilityMonitoring,
				CapabilityDocker,
				CapabilityAI,
				CapabilityActivityLog,
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
		Principal:  Principal{Kind: "user", Role: "user"},
		SingleUser: false,
		Portable:   false,
		Managed:    true,
		DataDir:    options.DataDir,
		Version:    options.Version,
		Capabilities: capabilitiesMap(
			CapabilityServers,
			CapabilityTerminal,
			CapabilitySFTP,
			CapabilityTransfers,
			CapabilityScripts,
			CapabilityAutomation,
			CapabilityMonitoring,
			CapabilityDocker,
			CapabilityAI,
			CapabilityActivityLog,
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

func capabilitiesMap(capabilities ...Capability) map[Capability]bool {
	result := make(map[Capability]bool, len(capabilities))
	for _, capability := range capabilities {
		result[capability] = true
	}
	return result
}
