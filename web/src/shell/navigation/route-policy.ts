import type { AppCapability, RuntimeInfo, RuntimeProfile } from "@/shell/runtime/types"
import { hasAllCapabilities } from "@/shell/runtime/capabilities"

export interface RoutePolicy {
  pattern: RegExp
  requiredCapabilities: AppCapability[]
  profiles?: RuntimeProfile[]
  adminOnly?: boolean
  fallbackPath: string
}

export const routePolicies: RoutePolicy[] = [
  { pattern: /^\/dashboard\/activity(?:\/|$)/, requiredCapabilities: ["activity_log"], fallbackPath: "/dashboard/servers" },
  { pattern: /^\/dashboard\/audit(?:\/|$)/, requiredCapabilities: ["audit"], profiles: ["web"], adminOnly: true, fallbackPath: "/dashboard/activity" },
  { pattern: /^\/dashboard\/users(?:\/|$)/, requiredCapabilities: ["users"], profiles: ["web"], adminOnly: true, fallbackPath: "/dashboard/activity" },
  { pattern: /^\/dashboard\/settings(?:\/|$)/, requiredCapabilities: ["settings"], profiles: ["web"], adminOnly: true, fallbackPath: "/dashboard/activity" },
  { pattern: /^\/dashboard\/automation(?:\/|$)/, requiredCapabilities: ["automation"], fallbackPath: "/dashboard/servers" },
  { pattern: /^\/dashboard\/scripts(?:\/|$)/, requiredCapabilities: ["scripts"], fallbackPath: "/dashboard/servers" },
  { pattern: /^\/dashboard\/sftp(?:\/|$)/, requiredCapabilities: ["sftp"], fallbackPath: "/dashboard/servers" },
  { pattern: /^\/dashboard\/storage(?:\/|$)/, requiredCapabilities: ["sftp"], fallbackPath: "/dashboard/servers" },
  { pattern: /^\/dashboard\/transfers(?:\/|$)/, requiredCapabilities: ["transfers"], fallbackPath: "/dashboard/servers" },
  { pattern: /^\/dashboard\/terminal(?:\/|$)/, requiredCapabilities: ["terminal"], fallbackPath: "/dashboard/servers" },
]

export function getRoutePolicy(pathname: string | null | undefined) {
  if (!pathname) {
    return null
  }

  return routePolicies.find((policy) => policy.pattern.test(pathname)) ?? null
}

export function isRouteAllowed(
  runtime: RuntimeInfo | null | undefined,
  pathname: string | null | undefined,
  isAdmin = false,
) {
  const policy = getRoutePolicy(pathname)
  if (!policy || !runtime) {
    return true
  }
  if (policy.adminOnly && !isAdmin) {
    return false
  }
  if (policy.profiles && !policy.profiles.includes(runtime.profile)) {
    return false
  }

  return hasAllCapabilities(runtime, policy.requiredCapabilities)
}

export function getRouteFallback(pathname: string | null | undefined) {
  return getRoutePolicy(pathname)?.fallbackPath ?? "/dashboard"
}
