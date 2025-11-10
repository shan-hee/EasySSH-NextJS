import { apiFetch } from "@/lib/api-client"

/**
 * 用户基础信息
 */
export interface User {
  id: string
  username: string
  email: string
  role: string  // 基础类型使用string,UserDetail中会强化为UserRole
  avatar?: string
  two_factor_enabled?: boolean
  notify_email_login?: boolean
  notify_email_alert?: boolean
  notify_browser?: boolean
  created_at: string
  updated_at: string
}

/**
 * 登录请求
 */
export interface LoginRequest {
  username: string
  password: string
}

/**
 * 登录响应
 */
export interface LoginResponse {
  access_token: string
  refresh_token: string
  user: User
  requires_2fa?: boolean
  temp_token?: string
}

/**
 * 注册请求
 */
export interface RegisterRequest {
  username: string
  email: string
  password: string
  run_mode?: "demo" | "development" | "production"
}

/**
 * 注册响应
 */
export interface RegisterResponse {
  user: User
}

/**
 * 刷新令牌请求
 */
export interface RefreshTokenRequest {
  refresh_token: string
}

/**
 * 刷新令牌响应
 */
export interface RefreshTokenResponse {
  access_token: string
  refresh_token: string
}

/**
 * 管理员状态响应
 */
export interface AdminStatusResponse {
  has_admin: boolean
  need_init: boolean
}

/**
 * 认证 API 服务
 */
export const authApi = {
  /**
   * 用户登录
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    return apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: data,
    })
  },

  /**
   * 用户注册
   */
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    return apiFetch<RegisterResponse>("/auth/register", {
      method: "POST",
      body: data,
    })
  },

  /**
   * 用户登出
   * Cookie 会自动携带,无需传递 token
   */
  async logout(): Promise<void> {
    return apiFetch<void>("/auth/logout", {
      method: "POST",
    })
  },

  /**
   * 刷新访问令牌
   * Cookie 会自动携带,无需传递 refresh_token
   */
  async refreshToken(data: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    return apiFetch<RefreshTokenResponse>("/auth/refresh", {
      method: "POST",
      body: data,
    })
  },

  /**
   * 获取当前用户信息
   * Cookie 会自动携带,无需传递 token
   */
  async getCurrentUser(): Promise<User> {
    return apiFetch<User>("/users/me")
  },

  /**
   * 更新用户资料
   * Cookie 会自动携带,无需传递 token
   */
  async updateProfile(data: Partial<User>): Promise<User> {
    return apiFetch<User>("/users/me", {
      method: "PUT",
      body: data,
    })
  },

  /**
   * 修改密码
   * Cookie 会自动携带,无需传递 token
   */
  async changePassword(data: { old_password: string; new_password: string }): Promise<void> {
    return apiFetch<void>("/users/me/password", {
      method: "PUT",
      body: data,
    })
  },

  /**
   * 检查管理员状态
   */
  async checkAdminStatus(): Promise<AdminStatusResponse> {
    return apiFetch<AdminStatusResponse>("/auth/admin-status", {
      method: "GET",
    })
  },

  /**
   * 初始化管理员账户
   */
  async initializeAdmin(data: RegisterRequest): Promise<LoginResponse> {
    return apiFetch<LoginResponse>("/auth/initialize-admin", {
      method: "POST",
      body: data,
    })
  },
}
