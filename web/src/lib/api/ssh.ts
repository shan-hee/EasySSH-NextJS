import { apiFetch } from "@/lib/api-client"
import { getWsUrl } from "@/lib/config"

/**
 * SSH会话信息
 */
export interface SSHSession {
  id: string
  server_id: string
  user_id: string
  server_name?: string
  status: "active" | "closed"
  started_at: string
  ended_at?: string
  duration?: number
  commands_count?: number
}

/**
 * SSH会话列表响应
 */
export interface SSHSessionListResponse {
  data: SSHSession[]
  total: number
}

/**
 * SSH统计响应
 */
export interface SSHStatisticsResponse {
  total_sessions: number
  active_sessions: number
  total_commands: number
  avg_session_duration: number
}

/**
 * SSH API 服务
 */
export const sshApi = {
  /**
   * 获取SSH会话列表
   */
  async listSessions(params?: {
    server_id?: string
    status?: string
    limit?: number
    offset?: number
  }): Promise<SSHSessionListResponse> {
    const queryParams = new URLSearchParams()
    if (params?.server_id) queryParams.set("server_id", params.server_id)
    if (params?.status) queryParams.set("status", params.status)
    if (params?.limit) queryParams.set("limit", params.limit.toString())
    if (params?.offset) queryParams.set("offset", params.offset.toString())

    const url = `/ssh/sessions${queryParams.toString() ? `?${queryParams}` : ""}`
    return apiFetch<SSHSessionListResponse>(url)
  },

  /**
   * 获取SSH会话详情
   */
  async getSession(id: string): Promise<SSHSession> {
    return apiFetch<SSHSession>(`/ssh/sessions/${id}`)
  },

  /**
   * 关闭SSH会话
   */
  async closeSession(id: string): Promise<void> {
    return apiFetch<void>(`/ssh/sessions/${id}`, {
      method: "DELETE",
    })
  },

  /**
   * 获取SSH统计信息
   */
  async getStatistics(): Promise<SSHStatisticsResponse> {
    return apiFetch<SSHStatisticsResponse>("/ssh/statistics")
  },

  /**
   * 获取WebSocket终端URL
   */
  getTerminalUrl(serverId: string): string {
    // 统一通过同域 /api 走 Next.js rewrites，避免浏览器访问 Docker 内部主机名
    return getWsUrl(`/api/v1/ssh/terminal/${serverId}`)
  },
}
