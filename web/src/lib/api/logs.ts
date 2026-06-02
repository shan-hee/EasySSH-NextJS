import { apiFetch } from "@/lib/api-client"

export interface AuditLog {
  id: string
  user_id: string
  username: string
  server_id?: string
  action: string
  category: "activity" | "audit"
  resource: string
  status: "success" | "failure" | "warning"
  ip: string
  user_agent: string
  details?: string
  error_msg?: string
  duration?: number
  created_at: string
}

export interface AuditLogListResponse {
  logs: AuditLog[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface AuditLogStatisticsResponse {
  total_logs: number
  success_count: number
  failure_count: number
  action_stats: Record<string, number>
  recent_failures: AuditLog[]
  top_users: Array<{
    user_id: string
    username: string
    count: number
  }>
}

export interface AuditLogCleanupResponse {
  deleted_count: number
  retention_days: number
}

export const logsApi = {
  async list(params?: {
    page?: number
    page_size?: number
    user_id?: string
    server_id?: string
    action?: string
    category?: "activity" | "audit"
    status?: string
    start_date?: string
    end_date?: string
  }): Promise<AuditLogListResponse> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.set("page", params.page.toString())
    if (params?.page_size) queryParams.set("page_size", params.page_size.toString())
    if (params?.user_id) queryParams.set("user_id", params.user_id)
    if (params?.server_id) queryParams.set("server_id", params.server_id)
    if (params?.action) queryParams.set("action", params.action)
    if (params?.category) queryParams.set("category", params.category)
    if (params?.status) queryParams.set("status", params.status)
    if (params?.start_date) queryParams.set("start_date", params.start_date)
    if (params?.end_date) queryParams.set("end_date", params.end_date)

    const url = `/logs${queryParams.toString() ? `?${queryParams}` : ""}`
    return apiFetch<AuditLogListResponse>(url)
  },

  async getById(id: string): Promise<AuditLog> {
    return apiFetch<AuditLog>(`/logs/${id}`)
  },

  async getStatistics(params?: {
    category?: "activity" | "audit"
    start_date?: string
    end_date?: string
  }): Promise<AuditLogStatisticsResponse> {
    const queryParams = new URLSearchParams()
    if (params?.category) queryParams.set("category", params.category)
    if (params?.start_date) queryParams.set("start_date", params.start_date)
    if (params?.end_date) queryParams.set("end_date", params.end_date)

    const url = `/logs/statistics${queryParams.toString() ? `?${queryParams}` : ""}`
    return apiFetch<AuditLogStatisticsResponse>(url)
  },

  async cleanup(retentionDays: number): Promise<AuditLogCleanupResponse> {
    const queryParams = new URLSearchParams()
    queryParams.set("retention_days", retentionDays.toString())

    return apiFetch<AuditLogCleanupResponse>(`/logs/cleanup?${queryParams.toString()}`, {
      method: "DELETE",
      retry: false,
    })
  },
}
