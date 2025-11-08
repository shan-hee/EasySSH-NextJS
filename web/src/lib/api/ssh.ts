import { apiFetch } from "@/lib/api-client"

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
  async listSessions(token: string, params?: {
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
    return apiFetch<SSHSessionListResponse>(url, { token })
  },

  /**
   * 获取SSH会话详情
   */
  async getSession(token: string, id: string): Promise<SSHSession> {
    return apiFetch<SSHSession>(`/ssh/sessions/${id}`, { token })
  },

  /**
   * 关闭SSH会话
   */
  async closeSession(token: string, id: string): Promise<void> {
    return apiFetch<void>(`/ssh/sessions/${id}`, {
      method: "DELETE",
      token,
    })
  },

  /**
   * 获取SSH统计信息
   */
  async getStatistics(token: string): Promise<SSHStatisticsResponse> {
    return apiFetch<SSHStatisticsResponse>("/ssh/statistics", { token })
  },

  /**
   * 获取WebSocket终端URL
   */
  getTerminalUrl(serverId: string, token: string): string {
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:"

    // 优先使用环境变量，否则从 API_BASE 推导
    let wsHost = process.env.NEXT_PUBLIC_WS_HOST

    if (!wsHost) {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE
      if (apiBase) {
        try {
          // 从 API_BASE 提取主机和端口
          const url = new URL(apiBase)
          wsHost = url.host
        } catch (error) {
          console.warn("Failed to parse NEXT_PUBLIC_API_BASE:", error)
          // 回退到当前主机
          wsHost = window.location.host
        }
      } else {
        // 如果没有配置 API_BASE，使用当前主机
        wsHost = window.location.host
      }
    }

    return `${wsProtocol}//${wsHost}/api/v1/ssh/terminal/${serverId}?token=${token}`
  },
}
