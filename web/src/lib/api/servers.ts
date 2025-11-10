import { apiFetch } from "@/lib/api-client"

/**
 * 服务器认证方式
 */
export type AuthMethod = "password" | "key"

/**
 * 服务器状态
 */
export type ServerStatus = "online" | "offline" | "error" | "unknown"

/**
 * 服务器信息
 */
export interface Server {
  id: string
  user_id: string
  name?: string
  host: string
  port: number
  username: string
  auth_method: AuthMethod
  password?: string
  private_key?: string
  group?: string
  tags?: string[]
  status: ServerStatus
  last_connected?: string
  description?: string
  os?: string
  created_at: string
  updated_at: string
}

/**
 * 创建服务器请求
 */
export interface CreateServerRequest {
  name?: string
  host: string
  port: number
  username: string
  auth_method: AuthMethod
  password?: string
  private_key?: string
  group?: string
  tags?: string[]
  description?: string
}

/**
 * 更新服务器请求
 */
export interface UpdateServerRequest {
  name?: string
  host?: string
  port?: number
  username?: string
  auth_method?: AuthMethod
  password?: string
  private_key?: string
  group?: string
  tags?: string[]
  description?: string
}

/**
 * 服务器列表响应
 */
export interface ServerListResponse {
  data: Server[]
  total: number
  page: number
  limit: number
}

/**
 * 服务器统计响应
 */
export interface ServerStatisticsResponse {
  total: number
  online: number
  offline: number
  error: number
  unknown: number
  by_group: Record<string, number>
  by_tag: Record<string, number>
}

/**
 * 测试连接响应
 */
export interface TestConnectionResponse {
  success: boolean
  message: string
  latency_ms?: number
  server_info?: string
}

/**
 * 服务器 API 服务
 */
export const serversApi = {
  /**
   * 获取服务器列表
   */
  async list(params?: {
    page?: number
    limit?: number
    group?: string
    search?: string
  }): Promise<ServerListResponse> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.set("page", params.page.toString())
    if (params?.limit) queryParams.set("limit", params.limit.toString())
    if (params?.group) queryParams.set("group", params.group)
    if (params?.search) queryParams.set("search", params.search)

    const url = `/servers${queryParams.toString() ? `?${queryParams}` : ""}`
    return apiFetch<ServerListResponse>(url)
  },

  /**
   * 获取服务器详情
   */
  async getById(id: string): Promise<Server> {
    return apiFetch<Server>(`/servers/${id}`)
  },

  /**
   * 创建服务器
   */
  async create(data: CreateServerRequest): Promise<Server> {
    return apiFetch<Server>("/servers", {
      method: "POST",
      body: data,
    })
  },

  /**
   * 更新服务器
   */
  async update(id: string, data: UpdateServerRequest): Promise<Server> {
    return apiFetch<Server>(`/servers/${id}`, {
      method: "PUT",
      body: data,
    })
  },

  /**
   * 删除服务器
   */
  async delete(id: string): Promise<void> {
    return apiFetch<void>(`/servers/${id}`, {
      method: "DELETE",
    })
  },

  /**
   * 测试服务器连接
   */
  async testConnection(id: string): Promise<TestConnectionResponse> {
    return apiFetch<TestConnectionResponse>(`/servers/${id}/test`, {
      method: "POST",
    })
  },

  /**
   * 获取服务器统计信息
   */
  async getStatistics(): Promise<ServerStatisticsResponse> {
    return apiFetch<ServerStatisticsResponse>("/servers/statistics")
  },

  /**
   * 批量更新服务器排序顺序
   */
  async reorder(serverIds: string[]): Promise<void> {
    return apiFetch<void>("/servers/reorder", {
      method: "PATCH",
      body: { server_ids: serverIds },
    })
  },
}
