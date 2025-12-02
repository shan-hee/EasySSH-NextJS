import { apiFetch } from "@/lib/api-client"
import { performRefreshToken } from "@/lib/session-refresh"

/**
 * 用户基础信息
 */
export interface User {
  id: string
  username: string
  email: string
  role: string  // 基础类型使用string,UserDetail中会强化为UserRole
  avatar?: string
  language?: string
  timezone?: string
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

// 刷新令牌响应
// 当前仅使用 expires_in 字段,用于基于后端返回的有效期安排下一次刷新
export interface RefreshTokenResponse {
  expires_in?: number
}

/**
 * 系统和认证状态响应
 */
export interface AuthStatusResponse {
  need_init: boolean        // 是否需要初始化（无管理员）
  is_authenticated: boolean // 是否已登录
  user?: User               // 已登录时返回用户信息
  system_config?: import("@/lib/api/settings").SystemConfig // 系统公共配置（可选）
  access_token?: string     // 可选：后端通过 refresh_token 自动续期时返回新的 access_token
  access_token_ttl_seconds?: number // Access Token 统一配置的有效期(秒)
  access_token_expires_in?: number  // 当前 Access Token 剩余有效期(秒),用于前端定时刷新
}

/**
 * 认证 API 服务
 */
export const authApi = {
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
   * 检查系统和认证状态
   */
  async checkStatus(): Promise<AuthStatusResponse> {
    // 第一步：直接查询当前状态（如果已有有效 access_token，会被视为已认证）
    let status = await apiFetch<AuthStatusResponse>("/auth/status", {
      method: "GET",
    })

    // 已认证或运行在服务端环境时，直接返回
    if (status.is_authenticated || typeof window === "undefined") {
      return status
    }

    // 未认证（可能仅存在 refresh_token Cookie），尝试静默刷新一次
    // 注意：refresh_token 保存在 HttpOnly 且 Path=/oauth 的 Cookie 中，
    // 无法通过 document.cookie 在 /login 或 /dashboard 等路径检测是否存在，
    // 因此这里不再依赖前端读取 Cookie，而是直接尝试调用统一的 refresh 工具。
    try {
      // 统一调用刷新工具，内部会更新内存中的 access_token
      await performRefreshToken()

      // 第二步：在拥有新的 access_token 情况下再次查询状态
      status = await apiFetch<AuthStatusResponse>("/auth/status", {
        method: "GET",
      })
      return status
    } catch {
      // 刷新过程中出现异常时，不影响原始状态，按未认证处理
      return status
    }
  },

  /**
   * 初始化管理员账户
   */
  async initializeAdmin(data: RegisterRequest): Promise<RegisterResponse> {
    return apiFetch<RegisterResponse>("/auth/initialize-admin", {
      method: "POST",
      body: data,
    })
  },

  /**
   * 使用 Authorization Code + PKCE 方式发起登录（开发版 JSON 接口）
   * 注意：仅在浏览器端调用
   */
  async authorizeWithPkce(params: {
    username: string
    password: string
    client_id: string
    redirect_uri: string
    scope?: string
    code_challenge: string
    code_challenge_method: string
    state?: string
  }): Promise<{ code?: string; state?: string; requires_2fa?: boolean; temp_token?: string }> {
    return apiFetch<{ code?: string; state?: string; requires_2fa?: boolean; temp_token?: string }>("/oauth/authorize", {
      method: "POST",
      body: {
        response_type: "code",
        client_id: params.client_id,
        redirect_uri: params.redirect_uri,
        scope: params.scope ?? "openid profile easyssh",
        code_challenge: params.code_challenge,
        code_challenge_method: params.code_challenge_method,
        state: params.state ?? "",
        username: params.username,
        password: params.password,
      },
    })
  },

  /**
   * 使用授权码和 PKCE code_verifier 换取 access_token
   */
  async exchangeCodeForToken(params: {
    code: string
    client_id: string
    redirect_uri: string
    code_verifier: string
  }): Promise<{ access_token: string; token_type: string; expires_in?: number }> {
    return apiFetch<{ access_token: string; token_type: string; expires_in?: number }>("/oauth/token", {
      method: "POST",
      body: {
        grant_type: "authorization_code",
        code: params.code,
        redirect_uri: params.redirect_uri,
        client_id: params.client_id,
        code_verifier: params.code_verifier,
      },
    })
  },

  /**
   * 验证 Google ID Token 并登录/注册
   */
  async verifyGoogleToken(idToken: string): Promise<{
    access_token: string
    refresh_token: string
    token_type: string
    expires_in: number
    user: User
  }> {
    return apiFetch<{
      access_token: string
      refresh_token: string
      token_type: string
      expires_in: number
      user: User
    }>("/oauth/google/verify", {
      method: "POST",
      body: {
        id_token: idToken,
      },
    })
  },
}
