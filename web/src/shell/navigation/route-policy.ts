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
  { pattern: /^\/dashboard\/logs(?:\/|$)/, requiredCapabilities: ["audit"], profiles: ["web"], adminOnly: true, fallbackPath: "/dashboard/terminal" },
  { pattern: /^\/dashboard\/users(?:\/|$)/, requiredCapabilities: ["users"], profiles: ["web"], adminOnly: true, fallbackPath: "/dashboard/terminal" },
  { pattern: /^\/dashboard\/settings(?:\/|$)/, requiredCapabilities: ["settings"], profiles: ["web"], adminOnly: true, fallbackPath: "/dashboard/terminal" },
  { pattern: /^\/dashboard\/automation(?:\/|$)/, requiredCapabilities: ["automation"], fallbackPath: "/dashboard/terminal" },
  { pattern: /^\/dashboard\/scripts(?:\/|$)/, requiredCapabilities: ["scripts"], fallbackPath: "/dashboard/terminal" },
  { pattern: /^\/dashboard\/sftp(?:\/|$)/, requiredCapabilities: ["sftp"], fallbackPath: "/dashboard/terminal" },
  { pattern: /^\/dashboard\/terminal(?:\/|$)/, requiredCapabilities: ["servers", "terminal"], fallbackPath: "/dashboard" },
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
