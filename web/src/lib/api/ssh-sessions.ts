import { apiFetch } from "@/lib/api-client"

/**
 * SSH会话详细信息(用于会话历史管理)
 * 注意: 与 ssh.ts 中的 SSHSession 不同,这是完整的会话记录
 */
export interface SSHSessionDetail {
  id: string
  user_id: string
  server_id: string
  server_name: string
  server_host: string
  session_id: string
  client_ip: string
  client_port: number
  terminal_type: string
  status: "active" | "closed" | "timeout"
  connected_at: string
  disconnected_at?: string
  duration?: number
  bytes_sent: number
  bytes_received: number
  error_message?: string
  created_at: string
  updated_at: string
}

export interface ListSSHSessionsParams {
  page?: number
  limit?: number
  status?: "active" | "closed" | "timeout"
  server_id?: string
  user_id?: string
}

export interface ListSSHSessionsResponse {
  data: SSHSessionDetail[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export interface SSHSessionStatistics {
  total_sessions: number
  active_sessions: number
  closed_sessions: number
  total_duration: number
  total_bytes_sent: number
  total_bytes_received: number
  by_server: {
    [key: string]: number
  }
}

/**
 * SSH 会话 API 服务
 */
export const sshSessionsApi = {
  /**
   * 获取SSH会话列表
   */
  async list(params?: ListSSHSessionsParams): Promise<ListSSHSessionsResponse> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append("page", params.page.toString())
    if (params?.limit) queryParams.append("limit", params.limit.toString())
    if (params?.status) queryParams.append("status", params.status)
    if (params?.server_id) queryParams.append("server_id", params.server_id)
    if (params?.user_id) queryParams.append("user_id", params.user_id)

    const url = `/ssh-sessions${queryParams.toString() ? `?${queryParams}` : ""}`
    return apiFetch<ListSSHSessionsResponse>(url)
  },

  /**
   * 获取SSH会话详情
   */
  async getById(id: string): Promise<SSHSessionDetail> {
    return apiFetch<SSHSessionDetail>(`/ssh-sessions/${id}`)
  },

  /**
   * 删除SSH会话记录
   */
  async delete(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/ssh-sessions/${id}`, {
      method: "DELETE",
    })
  },

  /**
   * 获取SSH会话统计信息
   */
  async getStatistics(): Promise<SSHSessionStatistics> {
    return apiFetch<SSHSessionStatistics>("/ssh-sessions/statistics")
  },

  /**
   * 关闭SSH会话
   */
  async close(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/ssh-sessions/${id}/close`, {
      method: "POST",
    })
  },
}
