import { serverApiFetch } from "@/lib/server-api"
import type { AuditLogListResponse, AuditLogStatisticsResponse } from "./audit-logs"

/**
 * 获取审计日志列表（服务端）
 */
export async function getAuditLogsList(params?: {
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
  return serverApiFetch<AuditLogListResponse>(url)
}

/**
 * 获取审计日志统计信息（服务端）
 */
export async function getAuditLogsStatistics(params?: {
  start_date?: string
  end_date?: string
}): Promise<AuditLogStatisticsResponse> {
  const queryParams = new URLSearchParams()
  if (params?.start_date) queryParams.set("start_date", params.start_date)
  if (params?.end_date) queryParams.set("end_date", params.end_date)

  const url = `/audit-logs/statistics${queryParams.toString() ? `?${queryParams}` : ""}`
  return serverApiFetch<AuditLogStatisticsResponse>(url)
}

/**
 * 获取审计日志页面初始数据
 * 并行加载日志列表和统计信息
 */
export async function getAuditLogsPageData(page = 1, pageSize = 20) {
  const [logsResponse, statistics] = await Promise.all([
    getAuditLogsList({ page, page_size: pageSize }),
    getAuditLogsStatistics(),
  ])

  return {
    logs: logsResponse.logs || [],
    totalPages: logsResponse.total_pages || 1,
    totalCount: logsResponse.total || 0,
    currentPage: logsResponse.page || 1,
    pageSize: logsResponse.page_size || pageSize,
    statistics,
  }
}

export type AuditLogsPageData = Awaited<ReturnType<typeof getAuditLogsPageData>>

/**
 * 检测异常IP（简单的内网IP检测）
 */
function isAbnormalIP(ip: string): boolean {
  // 内网IP范围
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^localhost/,
  ]

  // 检查是否为内网IP
  const isPrivate = privateRanges.some((range) => range.test(ip))
  return !isPrivate && ip !== "::1" && !ip.startsWith("fe80::")
}

/**
 * 获取登录日志页面初始数据
 * 并行加载登录日志列表，并在服务端预计算统计数据
 */
export async function getLoginLogsPageData(page = 1, pageSize = 20) {
  // 获取登录日志
  const logsResponse = await getAuditLogsList({
    page,
    page_size: pageSize,
    action: "login",
  })

  const logs = logsResponse.logs || []

  // 服务端预计算统计数据
  const loginStats = {
    total: logs.length,
    success: logs.filter((log) => log.status === "success").length,
    failure: logs.filter((log) => log.status === "failure").length,
    abnormalIP: logs.filter((log) => isAbnormalIP(log.ip)).length,
  }

  return {
    logs,
    totalPages: logsResponse.total_pages || 1,
    totalCount: logsResponse.total || 0,
    currentPage: logsResponse.page || 1,
    pageSize: logsResponse.page_size || pageSize,
    loginStats,
  }
}

export type LoginLogsPageData = Awaited<ReturnType<typeof getLoginLogsPageData>>
