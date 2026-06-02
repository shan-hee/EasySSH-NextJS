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
  | "activity_log"
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

export interface RuntimePrincipal {
  kind: "user" | "local_owner" | "service" | string
  role: "owner" | "admin" | "user" | string
}

export interface RuntimeInfo {
  profile: RuntimeProfile
  principal: RuntimePrincipal
  single_user: boolean
  portable: boolean
  managed: boolean
  data_dir?: string
  version?: string
  capabilities: Partial<Record<AppCapability, boolean>> & Record<string, boolean | undefined>
}
