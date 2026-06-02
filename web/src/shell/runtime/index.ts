export { runtimeApi } from "@/shell/runtime/api"
export {
  hasAllCapabilities,
  hasAnyCapability,
  hasCapability,
  isDesktop,
  isRuntimeProfile,
  isWeb,
} from "@/shell/runtime/capabilities"
export { RuntimeProvider, useRuntime } from "@/shell/runtime/runtime-provider"
export { createWorkspaceCapabilitiesFromRuntime } from "@/shell/runtime/runtime-workspace"
export type { RuntimeWorkspaceCapabilitiesOptions } from "@/shell/runtime/runtime-workspace"
export { runtimeInfoQueryKey, useRuntimeInfo } from "@/shell/runtime/use-runtime-info"
export type { AppCapability, RuntimeInfo, RuntimePrincipal, RuntimeProfile } from "@/shell/runtime/types"
