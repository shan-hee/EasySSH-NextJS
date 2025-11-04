import { apiFetch } from "@/lib/api-client"

/**
 * 会话信息
 */
export interface Session {
  id: string
  device_type: string
  device_name: string
  ip_address: string
  location: string
  last_activity: string
  created_at: string
  is_current: boolean
}

/**
 * 会话列表响应
 */
export interface SessionsResponse {
  sessions: Session[]
  total: number
}

/**
 * 会话管理 API 服务
 */
export const sessionsApi = {
  /**
   * 获取所有活跃会话
   */
  async list(token: string): Promise<SessionsResponse> {
    return apiFetch<SessionsResponse>("/users/me/sessions", { token })
  },

  /**
   * 撤销指定会话
   */
  async revoke(token: string, sessionId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/users/me/sessions/${sessionId}`, {
      token,
      method: "DELETE",
    })
  },

  /**
   * 撤销所有其他会话
   */
  async revokeAllOthers(token: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>("/users/me/sessions/revoke-others", {
      token,
      method: "POST",
    })
  },
}
