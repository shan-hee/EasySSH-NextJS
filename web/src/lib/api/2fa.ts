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
 * 登录场景下 2FA + PKCE 校验请求
 */
export interface Verify2FALoginRequest {
  tempToken: string
  code: string
  clientId: string
  redirectUri: string
  scope?: string
  codeChallenge: string
  codeChallengeMethod: string
  state?: string
}

/**
 * 登录场景下 2FA + PKCE 校验响应（返回授权码）
 */
export interface Verify2FALoginResponse {
  code: string
  state?: string
}

/**
 * 2FA API 服务
 */
export const twoFactorApi = {
  /**
   * 生成 2FA secret（第一步）
   */
  async generateSecret(): Promise<Generate2FAResponse> {
    return apiFetch<Generate2FAResponse>("/users/me/2fa/generate")
  },

  /**
   * 启用双因子认证（第二步：验证代码并启用）
   */
  async enable(code: string): Promise<Enable2FAResponse> {
    return apiFetch<Enable2FAResponse>("/users/me/2fa/enable", {
      method: "POST",
      body: JSON.stringify({ code }),
    })
  },

  /**
   * 禁用双因子认证
   */
  async disable(code: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>("/users/me/2fa/disable", {
      method: "POST",
      body: JSON.stringify({ code }),
    })
  },

  /**
   * 验证 2FA 代码（用于登录 + PKCE）
   */
  async verifyLogin(params: Verify2FALoginRequest): Promise<Verify2FALoginResponse> {
    return apiFetch<Verify2FALoginResponse>("/auth/2fa/verify", {
      method: "POST",
      body: JSON.stringify({
        temp_token: params.tempToken,
        code: params.code,
        client_id: params.clientId,
        redirect_uri: params.redirectUri,
        scope: params.scope ?? "openid profile easyssh",
        code_challenge: params.codeChallenge,
        code_challenge_method: params.codeChallengeMethod,
        state: params.state ?? "",
      }),
    })
  },
}
