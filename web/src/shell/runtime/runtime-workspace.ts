import type { SshWorkspaceCapabilities } from "@/lib/session/workspace"
import type { RuntimeInfo } from "@/shell/runtime/types"
import { hasCapability } from "@/shell/runtime/capabilities"

export interface RuntimeWorkspaceCapabilitiesOptions {
  defaults?: SshWorkspaceCapabilities
  overrides?: SshWorkspaceCapabilities
}

export function createWorkspaceCapabilitiesFromRuntime(
  runtime: RuntimeInfo | null | undefined,
  { defaults = {}, overrides = {} }: RuntimeWorkspaceCapabilitiesOptions = {},
): SshWorkspaceCapabilities {
  const capabilities: SshWorkspaceCapabilities = {
    terminal: resolveRuntimeCapability(runtime, "terminal", defaults.terminal),
    sftp: resolveRuntimeCapability(runtime, "sftp", defaults.sftp),
    transfers: resolveRuntimeCapability(runtime, "transfers", defaults.transfers),
    ai: resolveRuntimeCapability(runtime, "ai", defaults.ai),
    monitor: resolveRuntimeCapability(runtime, "monitoring", defaults.monitor),
    docker: resolveRuntimeCapability(runtime, "docker", defaults.docker),
    activityLog: resolveRuntimeCapability(runtime, "activity_log", defaults.activityLog),
    fullscreen: defaults.fullscreen,
    crossSessionDrag: defaults.crossSessionDrag,
  }

  return {
    ...capabilities,
    ...overrides,
  }
}

function resolveRuntimeCapability(
  runtime: RuntimeInfo | null | undefined,
  capability: Parameters<typeof hasCapability>[1],
  fallback: boolean | undefined,
) {
  if (!runtime) {
    return fallback
  }

  return hasCapability(runtime, capability)
}
