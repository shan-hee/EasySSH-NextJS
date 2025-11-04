import { apiFetch } from "@/lib/api-client"

/**
 * 生成 2FA secret 响应
 */
export interface Generate2FAResponse {
  secret: string
  qr_code_url: string
}

/**
 * 启用 2FA 响应
 */
export interface Enable2FAResponse {
  backup_codes: string[]
  message: string
}

/**
 * 2FA API 服务
 */
export const twoFactorApi = {
  /**
   * 生成 2FA secret（第一步）
   */
  async generateSecret(token: string): Promise<Generate2FAResponse> {
    return apiFetch<Generate2FAResponse>("/users/me/2fa/generate", { token })
  },

  /**
   * 启用双因子认证（第二步：验证代码并启用）
   */
  async enable(token: string, code: string): Promise<Enable2FAResponse> {
    return apiFetch<Enable2FAResponse>("/users/me/2fa/enable", {
      token,
      method: "POST",
      body: JSON.stringify({ code }),
    })
  },

  /**
   * 禁用双因子认证
   */
  async disable(token: string, code: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>("/users/me/2fa/disable", {
      token,
      method: "POST",
      body: JSON.stringify({ code }),
    })
  },

  /**
   * 验证 2FA 代码（用于登录）
   */
  async verify(
    tempToken: string,
    code: string
  ): Promise<{
    user: any
    access_token: string
    refresh_token: string
    token_type: string
    expires_in: number
  }> {
    return apiFetch<{
      user: any
      access_token: string
      refresh_token: string
      token_type: string
      expires_in: number
    }>("/auth/2fa/verify", {
      method: "POST",
      body: JSON.stringify({
        temp_token: tempToken,
        code,
      }),
    })
  },
}
