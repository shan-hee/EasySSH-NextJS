import type { AppCapability, RuntimeInfo, RuntimeProfile } from "@/shell/runtime/types"

export function hasCapability(
  runtime: RuntimeInfo | null | undefined,
  capability: AppCapability,
) {
  return runtime?.capabilities?.[capability] === true
}

export function hasAllCapabilities(
  runtime: RuntimeInfo | null | undefined,
  capabilities: AppCapability[] | readonly AppCapability[] | undefined,
) {
  if (!capabilities || capabilities.length === 0) {
    return true
  }

  return capabilities.every((capability) => hasCapability(runtime, capability))
}

export function hasAnyCapability(
  runtime: RuntimeInfo | null | undefined,
  capabilities: AppCapability[] | readonly AppCapability[] | undefined,
) {
  if (!capabilities || capabilities.length === 0) {
    return true
  }

  return capabilities.some((capability) => hasCapability(runtime, capability))
}

export function isRuntimeProfile(
  runtime: RuntimeInfo | null | undefined,
  profile: RuntimeProfile,
) {
  return runtime?.profile === profile
}

export function isDesktop(runtime: RuntimeInfo | null | undefined) {
  return isRuntimeProfile(runtime, "desktop")
}

export function isWeb(runtime: RuntimeInfo | null | undefined) {
  return isRuntimeProfile(runtime, "web")
}
