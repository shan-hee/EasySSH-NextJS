import { getApiUrl } from "../config"

const API_BASE_URL = getApiUrl()

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

export const sshSessionsApi = {
  /**
   * 获取SSH会话列表
   */
  async list(token: string, params?: ListSSHSessionsParams): Promise<ListSSHSessionsResponse> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append("page", params.page.toString())
    if (params?.limit) queryParams.append("limit", params.limit.toString())
    if (params?.status) queryParams.append("status", params.status)
    if (params?.server_id) queryParams.append("server_id", params.server_id)
    if (params?.user_id) queryParams.append("user_id", params.user_id)

    const url = `${API_BASE_URL}/ssh-sessions${queryParams.toString() ? `?${queryParams}` : ""}`
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to fetch SSH sessions")
    }

    const result = await response.json()
    return result.data
  },

  /**
   * 获取SSH会话详情
   */
  async getById(token: string, id: string): Promise<{ data: SSHSessionDetail }> {
    const response = await fetch(`${API_BASE_URL}/ssh-sessions/${id}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to fetch SSH session")
    }

    return response.json()
  },

  /**
   * 删除SSH会话记录
   */
  async delete(token: string, id: string): Promise<{ data: { message: string } }> {
    const response = await fetch(`${API_BASE_URL}/ssh-sessions/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to delete SSH session")
    }

    return response.json()
  },

  /**
   * 获取SSH会话统计信息
   */
  async getStatistics(token: string): Promise<{ data: SSHSessionStatistics }> {
    const response = await fetch(`${API_BASE_URL}/ssh-sessions/statistics`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to fetch SSH session statistics")
    }

    return response.json()
  },

  /**
   * 关闭SSH会话
   */
  async close(token: string, id: string): Promise<{ data: { message: string } }> {
    const response = await fetch(`${API_BASE_URL}/ssh-sessions/${id}/close`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to close SSH session")
    }

    return response.json()
  },
}
