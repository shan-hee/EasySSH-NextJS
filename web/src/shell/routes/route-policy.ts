import type { AppCapability, RuntimeInfo, RuntimeProfile } from "@/shell/runtime"
import { hasAllCapabilities, isDesktopRuntime } from "@/shell/runtime"

export type RoutePolicy = {
  pattern: RegExp
  requiredCapabilities?: AppCapability[]
  profiles?: RuntimeProfile[]
}

export type RoutePolicyResult = {
  allowed: boolean
  fallback: string
}

const routePolicies: RoutePolicy[] = [
  {
    pattern: /^\/dashboard\/desktop(?:\/.*)?$/,
    profiles: ["desktop"],
    requiredCapabilities: ["servers"],
  },
  {
    pattern: /^\/dashboard\/users(?:\/.*)?$/,
    requiredCapabilities: ["users"],
  },
  {
    pattern: /^\/dashboard\/logs\/login(?:\/.*)?$/,
    requiredCapabilities: ["login_logs"],
  },
  {
    pattern: /^\/dashboard\/logs(?:\/.*)?$/,
    requiredCapabilities: ["audit"],
  },
  {
    pattern: /^\/dashboard\/automation\/(?:schedules|history)(?:\/.*)?$/,
    requiredCapabilities: ["automation"],
  },
  {
    pattern: /^\/dashboard\/settings(?:\/.*)?$/,
    requiredCapabilities: ["settings"],
  },
  {
    pattern: /^\/dashboard\/servers(?:\/.*)?$/,
    requiredCapabilities: ["servers"],
  },
  {
    pattern: /^\/dashboard\/terminal(?:\/.*)?$/,
    requiredCapabilities: ["terminal"],
  },
  {
    pattern: /^\/dashboard\/scripts(?:\/.*)?$/,
    requiredCapabilities: ["scripts"],
  },
  {
    pattern: /^\/dashboard\/sftp(?:\/.*)?$/,
    requiredCapabilities: ["sftp"],
  },
  {
    pattern: /^\/dashboard\/storage(?:\/.*)?$/,
    requiredCapabilities: ["sftp"],
  },
  {
    pattern: /^\/dashboard\/transfers(?:\/.*)?$/,
    requiredCapabilities: ["transfers"],
  },
  {
    pattern: /^\/dashboard\/ai-assistant(?:\/.*)?$/,
    requiredCapabilities: ["ai"],
  },
]

export function getDefaultDashboardPath(runtime: RuntimeInfo | null | undefined): string {
  if (isDesktopRuntime(runtime)) {
    return "/dashboard/desktop"
  }
  return "/dashboard"
}

export function evaluateRoutePolicy(
  pathname: string | null | undefined,
  runtime: RuntimeInfo | null | undefined,
): RoutePolicyResult {
  const fallback = getDefaultDashboardPath(runtime)
  if (!pathname || !runtime) {
    return { allowed: true, fallback }
  }

  const policy = routePolicies.find((item) => item.pattern.test(pathname))
  if (!policy) {
    return { allowed: true, fallback }
  }

  if (policy.profiles && !policy.profiles.includes(runtime.profile)) {
    return { allowed: false, fallback }
  }

  if (!hasAllCapabilities(runtime, policy.requiredCapabilities)) {
    return { allowed: false, fallback }
  }

  return { allowed: true, fallback }
}
