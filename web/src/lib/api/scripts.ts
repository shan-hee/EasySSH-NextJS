/**
 * 脚本管理 API 客户端
 */

import { apiFetch } from "@/lib/api-client"

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
  async list(params?: ListScriptsParams): Promise<ListScriptsResponse> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append("page", params.page.toString())
    if (params?.limit) queryParams.append("limit", params.limit.toString())
    if (params?.search) queryParams.append("search", params.search)
    if (params?.language) queryParams.append("language", params.language)
    if (params?.tags && params.tags.length > 0) {
      params.tags.forEach(tag => queryParams.append("tags", tag))
    }

    const url = `/scripts${queryParams.toString() ? `?${queryParams}` : ""}`
    return apiFetch<ListScriptsResponse>(url)
  },

  /**
   * 获取脚本详情
   */
  async getById(id: string): Promise<{ data: Script }> {
    return apiFetch<{ data: Script }>(`/scripts/${id}`)
  },

  /**
   * 创建脚本
   */
  async create(data: CreateScriptRequest): Promise<{ data: Script }> {
    return apiFetch<{ data: Script }>(`/scripts`, {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  /**
   * 更新脚本
   */
  async update(id: string, data: UpdateScriptRequest): Promise<{ data: Script }> {
    return apiFetch<{ data: Script }>(`/scripts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  /**
   * 删除脚本
   */
  async delete(id: string): Promise<void> {
    await apiFetch<void>(`/scripts/${id}`, {
      method: "DELETE",
    })
  },

  /**
   * 执行脚本（增加执行计数）
   */
  async execute(id: string): Promise<void> {
    await apiFetch<void>(`/scripts/${id}/execute`, {
      method: "POST",
    })
  },
}
