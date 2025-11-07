import { apiFetch } from "@/lib/api-client"
import type { User } from "./auth"

/**
 * 用户角色
 */
export type UserRole = "admin" | "user" | "viewer"

/**
 * 用户详细信息(扩展基础User类型)
 */
export interface UserDetail extends User {
  role: UserRole
  last_login_at?: string
}

/**
 * 用户统计信息
 */
export interface UserStatistics {
  total_users: number
  by_role: {
    admin: number
    user: number
    viewer: number
  }
}

/**
 * 用户列表响应
 */
export interface UserListResponse {
  data: UserDetail[]
  total: number
  page: number
  limit: number
  total_pages: number
}

/**
 * 创建用户请求
 */
export interface CreateUserRequest {
  username: string
  email: string
  password: string
  role: UserRole
}

/**
 * 更新用户请求
 */
export interface UpdateUserRequest {
  username?: string
  email?: string
  role?: UserRole
  avatar?: string
}

/**
 * 修改密码请求
 */
export interface ChangePasswordRequest {
  new_password: string
}

/**
 * 用户管理 API 服务
 */
export const usersApi = {
  /**
   * 获取用户列表
   */
  async list(
    token: string,
    params?: {
      page?: number
      limit?: number
      role?: string
    }
  ): Promise<UserListResponse> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append("page", params.page.toString())
    if (params?.limit) queryParams.append("limit", params.limit.toString())
    if (params?.role) queryParams.append("role", params.role)

    const query = queryParams.toString()
    return apiFetch<UserListResponse>(`/users${query ? `?${query}` : ""}`, { token })
  },

  /**
   * 获取用户详情
   */
  async getById(token: string, userId: string): Promise<{ data: UserDetail }> {
    return apiFetch<{ data: UserDetail }>(`/users/${userId}`, { token })
  },

  /**
   * 创建用户
   */
  async create(token: string, data: CreateUserRequest): Promise<{ data: UserDetail; message: string }> {
    return apiFetch<{ data: UserDetail; message: string }>(`/users`, {
      token,
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  /**
   * 更新用户
   */
  async update(
    token: string,
    userId: string,
    data: UpdateUserRequest
  ): Promise<{ data: UserDetail; message: string }> {
    return apiFetch<{ data: UserDetail; message: string }>(`/users/${userId}`, {
      token,
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  /**
   * 删除用户
   */
  async delete(token: string, userId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/users/${userId}`, {
      token,
      method: "DELETE",
    })
  },

  /**
   * 修改用户密码
   */
  async changePassword(
    token: string,
    userId: string,
    data: ChangePasswordRequest
  ): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/users/${userId}/password`, {
      token,
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  /**
   * 获取用户统计信息
   */
  async getStatistics(token: string): Promise<{ data: UserStatistics }> {
    return apiFetch<{ data: UserStatistics }>(`/users/statistics`, { token })
  },
}
