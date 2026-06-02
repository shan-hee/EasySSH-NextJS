import { apiFetch } from "@/lib/api-client"
import type { RuntimeInfo } from "@/shell/runtime/types"

export const runtimeApi = {
  getRuntime(): Promise<RuntimeInfo> {
    return apiFetch<RuntimeInfo>("/runtime", {
      retry: false,
    })
  },
}
