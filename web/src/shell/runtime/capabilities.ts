import type { AppCapability, RuntimeInfo, RuntimeProfile } from "./types"

export function hasCapability(
  runtime: RuntimeInfo | null | undefined,
  capability: AppCapability,
): boolean {
  return runtime?.capabilities?.[capability] === true
}

export function hasAllCapabilities(
  runtime: RuntimeInfo | null | undefined,
  capabilities: AppCapability[] = [],
): boolean {
  return capabilities.every((capability) => hasCapability(runtime, capability))
}

export function hasAnyCapability(
  runtime: RuntimeInfo | null | undefined,
  capabilities: AppCapability[] = [],
): boolean {
  return capabilities.some((capability) => hasCapability(runtime, capability))
}

export function isRuntimeProfile(
  runtime: RuntimeInfo | null | undefined,
  profile: RuntimeProfile,
): boolean {
  return runtime?.profile === profile
}

export function isDesktopRuntime(runtime: RuntimeInfo | null | undefined): boolean {
  return isRuntimeProfile(runtime, "desktop")
}

export function isWebRuntime(runtime: RuntimeInfo | null | undefined): boolean {
  return isRuntimeProfile(runtime, "web")
}
