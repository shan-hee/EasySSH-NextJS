export type RuntimeProfile = "web" | "desktop"

export type AppCapability =
  | "servers"
  | "terminal"
  | "sftp"
  | "transfers"
  | "scripts"
  | "automation"
  | "monitoring"
  | "docker"
  | "ai"
  | "backup"
  | "settings"
  | "users"
  | "permissions"
  | "audit"
  | "login_logs"
  | "notifications"
  | "oauth"
  | "security_policy"
  | "desktop_data_dir"
  | "open_data_dir"
  | "portable_mode"

export type RuntimeCapabilities = Record<AppCapability, boolean>

export type PrincipalKind = "user" | "local_owner" | "service"
export type PrincipalRole = "owner" | "admin" | "user"

export interface PrincipalDescriptor {
  kind: PrincipalKind
  role: PrincipalRole
}

export interface RuntimeInfo {
  profile: RuntimeProfile
  principal: PrincipalDescriptor
  version?: string
  single_user: boolean
  portable: boolean
  managed: boolean
  data_dir?: string
  capabilities: RuntimeCapabilities
}
