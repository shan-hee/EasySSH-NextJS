import { serverApiFetch } from "@/lib/server-api"
import type {
  ListSSHSessionsResponse,
  SSHSessionStatistics,
  ListSSHSessionsParams,
} from "./ssh-sessions"

/**
 * 获取 SSH 会话列表（服务端）
 */
export async function getSSHSessionsList(
  params?: ListSSHSessionsParams
): Promise<ListSSHSessionsResponse> {
  const queryParams = new URLSearchParams()
  if (params?.page) queryParams.append("page", params.page.toString())
  if (params?.limit) queryParams.append("limit", params.limit.toString())
  if (params?.status) queryParams.append("status", params.status)
  if (params?.server_id) queryParams.append("server_id", params.server_id)
  if (params?.user_id) queryParams.append("user_id", params.user_id)

  const url = `/ssh-sessions${queryParams.toString() ? `?${queryParams}` : ""}`
  return serverApiFetch<ListSSHSessionsResponse>(url)
}

/**
 * 获取 SSH 会话统计信息（服务端）
 */
export async function getSSHSessionsStatistics(): Promise<SSHSessionStatistics> {
  return serverApiFetch<SSHSessionStatistics>("/ssh-sessions/statistics")
}

/**
 * 获取 SSH 会话页面初始数据
 * 并行加载会话列表和统计信息
 */
export async function getSSHSessionsPageData(page = 1, pageSize = 20) {
  const [sessionsResponse, statistics] = await Promise.all([
    getSSHSessionsList({ page, limit: pageSize }),
    getSSHSessionsStatistics(),
  ])

  return {
    sessions: sessionsResponse.data || [],
    totalPages: sessionsResponse.total_pages || 1,
    totalCount: sessionsResponse.total || 0,
    currentPage: sessionsResponse.page || 1,
    pageSize: sessionsResponse.limit || pageSize,
    statistics,
  }
}

export type SSHSessionsPageData = Awaited<ReturnType<typeof getSSHSessionsPageData>>
