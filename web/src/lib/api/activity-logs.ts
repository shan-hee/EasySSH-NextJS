import { apiFetch } from "@/lib/api-client"
import type { AuditLog, AuditLogListResponse, AuditLogStatisticsResponse } from "@/lib/api/audit-logs"

export interface ActivityLogListParams {
  page?: number
  page_size?: number
  action?: string
  server_id?: string
  status?: string
  start_date?: string
  end_date?: string
}

export interface ActivityLogStatisticsParams {
  days?: number
  start_date?: string
  end_date?: string
}

function buildQueryParams(params?: object) {
  const queryParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {}) as Array<[string, string | number | undefined]>) {
    if (value !== undefined && value !== "") {
      queryParams.set(key, value.toString())
    }
  }
  return queryParams
}

export const activityLogsApi = {
  async listMine(params?: ActivityLogListParams): Promise<AuditLogListResponse> {
    const queryParams = buildQueryParams(params)
    const url = `/activity-logs/me${queryParams.toString() ? `?${queryParams}` : ""}`
    return apiFetch<AuditLogListResponse>(url)
  },

  async getMineById(id: string): Promise<AuditLog> {
    return apiFetch<AuditLog>(`/activity-logs/me/items/${id}`)
  },

  async getMineStatistics(params?: ActivityLogStatisticsParams): Promise<AuditLogStatisticsResponse> {
    const queryParams = buildQueryParams(params)
    const url = `/activity-logs/me/statistics${queryParams.toString() ? `?${queryParams}` : ""}`
    return apiFetch<AuditLogStatisticsResponse>(url)
  },
}
