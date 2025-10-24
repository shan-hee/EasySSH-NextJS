/**
 * 脚本管理 API 客户端
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8521/api/v1"

// 脚本类型定义
export interface Script {
  id: string
  user_id: string
  name: string
  description: string
  content: string
  language: string
  tags: string[]
  executions: number
  author: string
  created_at: string
  updated_at: string
}

export interface CreateScriptRequest {
  name: string
  description?: string
  content: string
  language?: string
  tags?: string[]
}

export interface UpdateScriptRequest {
  name?: string
  description?: string
  content?: string
  language?: string
  tags?: string[]
}

export interface ListScriptsParams {
  page?: number
  limit?: number
  search?: string
  tags?: string[]
  language?: string
}

export interface ListScriptsResponse {
  data: Script[]
  total: number
  page: number
  limit: number
  total_pages: number
}

/**
 * 脚本API客户端
 */
export const scriptsApi = {
  /**
   * 获取脚本列表
   */
  async list(token: string, params?: ListScriptsParams): Promise<ListScriptsResponse> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append("page", params.page.toString())
    if (params?.limit) queryParams.append("limit", params.limit.toString())
    if (params?.search) queryParams.append("search", params.search)
    if (params?.language) queryParams.append("language", params.language)
    if (params?.tags && params.tags.length > 0) {
      params.tags.forEach(tag => queryParams.append("tags", tag))
    }

    const url = `${API_BASE_URL}/scripts${queryParams.toString() ? `?${queryParams}` : ""}`

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to fetch scripts")
    }

    return response.json()
  },

  /**
   * 获取脚本详情
   */
  async getById(token: string, id: string): Promise<{ data: Script }> {
    const response = await fetch(`${API_BASE_URL}/scripts/${id}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to fetch script")
    }

    return response.json()
  },

  /**
   * 创建脚本
   */
  async create(token: string, data: CreateScriptRequest): Promise<{ data: Script }> {
    const response = await fetch(`${API_BASE_URL}/scripts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to create script")
    }

    return response.json()
  },

  /**
   * 更新脚本
   */
  async update(token: string, id: string, data: UpdateScriptRequest): Promise<{ data: Script }> {
    const response = await fetch(`${API_BASE_URL}/scripts/${id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to update script")
    }

    return response.json()
  },

  /**
   * 删除脚本
   */
  async delete(token: string, id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/scripts/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to delete script")
    }
  },

  /**
   * 执行脚本（增加执行计数）
   */
  async execute(token: string, id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/scripts/${id}/execute`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to execute script")
    }
  },
}
