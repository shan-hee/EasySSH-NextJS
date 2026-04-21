import { apiFetch } from "@/lib/api-client"

export interface AIConfigStatus {
  configured: boolean
  provider?: string
  model?: string
  models?: string[]
  has_key?: boolean
  message?: string
}

export async function getAIConfig(): Promise<AIConfigStatus> {
  return apiFetch<AIConfigStatus>("/ai/config", { method: "GET" })
}
