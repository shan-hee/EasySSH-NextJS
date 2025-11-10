import { apiFetch } from "@/lib/api-client"

/**
 * 审计日志信息
 */
export interface AuditLog {
  id: string
  user_id: string
  username: string
  server_id?: string
  action: string
  resource: string
  status: "success" | "failure"
  ip: string
  user_agent: string
  details?: string
  error_msg?: string
  duration?: number
  created_at: string
}

/**
 * 审计日志列表响应
 * 注意: apiFetch 会自动解包 data 字段，所以这里的结构是解包后的
 */
export interface AuditLogListResponse {
  logs: AuditLog[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

/**
 * 审计日志统计响应
 */
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

/**
 * 审计日志 API 服务
 */
export const auditLogsApi = {
  /**
   * 获取审计日志列表
   */
  async list(params?: {
    page?: number
    page_size?: number
    user_id?: string
    server_id?: string
    action?: string
    resource?: string
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
    if (params?.resource) queryParams.set("resource", params.resource)
    if (params?.status) queryParams.set("status", params.status)
    if (params?.start_date) queryParams.set("start_date", params.start_date)
    if (params?.end_date) queryParams.set("end_date", params.end_date)

    const url = `/audit-logs${queryParams.toString() ? `?${queryParams}` : ""}`
    return apiFetch<AuditLogListResponse>(url)
  },

  /**
   * 获取当前用户的审计日志
   */
  async getMyLogs(params?: {
    page?: number
    page_size?: number
    action?: string
    start_date?: string
    end_date?: string
  }): Promise<AuditLogListResponse> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.set("page", params.page.toString())
    if (params?.page_size) queryParams.set("page_size", params.page_size.toString())
    if (params?.action) queryParams.set("action", params.action)
    if (params?.start_date) queryParams.set("start_date", params.start_date)
    if (params?.end_date) queryParams.set("end_date", params.end_date)

    const url = `/audit-logs/me${queryParams.toString() ? `?${queryParams}` : ""}`
    return apiFetch<AuditLogListResponse>(url)
  },

  /**
   * 获取审计日志详情
   */
  async getById(id: string): Promise<AuditLog> {
    return apiFetch<AuditLog>(`/audit-logs/${id}`)
  },

  /**
   * 获取审计日志统计信息
   */
  async getStatistics(params?: {
    start_date?: string
    end_date?: string
  }): Promise<AuditLogStatisticsResponse> {
    const queryParams = new URLSearchParams()
    if (params?.start_date) queryParams.set("start_date", params.start_date)
    if (params?.end_date) queryParams.set("end_date", params.end_date)

    const url = `/audit-logs/statistics${queryParams.toString() ? `?${queryParams}` : ""}`
    return apiFetch<AuditLogStatisticsResponse>(url)
  },

  /**
   * 清理旧日志
   */
  async cleanup(beforeDate: string): Promise<{ deleted: number }> {
    return apiFetch<{ deleted: number }>(`/audit-logs/cleanup`, {
      method: "DELETE",
      body: { before_date: beforeDate },
    })
  },
}
