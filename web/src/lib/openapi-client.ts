import createClient from "openapi-fetch"
import type { paths } from "@/types/openapi"
import { getApiUrl } from "@/lib/config"

export function getOpenAPIClient(token?: string) {
  return createClient<paths>({
    baseUrl: getApiUrl(),
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
}

