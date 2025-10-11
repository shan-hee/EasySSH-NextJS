import createClient from "openapi-fetch"
import type { paths } from "@/types/openapi"
import { env } from "@/lib/env"

export function getOpenAPIClient(token?: string) {
  return createClient<paths>({
    baseUrl: env.apiBaseUrl,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
}

