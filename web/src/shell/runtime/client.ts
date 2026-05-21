import { apiFetch } from "@/lib/api-client"
import type { RuntimeInfo } from "./types"

export async function getRuntimeInfo(): Promise<RuntimeInfo> {
  return apiFetch<RuntimeInfo>("/runtime", {
    retry: false,
  })
}
