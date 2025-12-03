import { useAuthStore } from "@/stores/auth-store"

export interface RefreshTokenResult {
  accessToken: string
  expiresIn: number
}

/**
 * 统一的 refresh_token 刷新逻辑
 *
 * - 仅在浏览器端调用（服务端会抛错）
 * - 向 /oauth/token 发起 grant_type=refresh_token 请求
 * - 解析响应并写入全局 AuthStore
 * - 返回 accessToken 和 expiresIn（秒，若后端未提供则为 0）
 */
export async function performRefreshToken(): Promise<RefreshTokenResult> {
  if (typeof window === "undefined") {
    throw new Error("Refresh not supported on server")
  }

  // 统一使用当前站点下的 /oauth/token 端点
  const url = "/oauth/token"
  const credentials: RequestCredentials = "same-origin"

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ grant_type: "refresh_token" }),
    credentials,
  })

  if (!res.ok) {
    throw new Error(`Refresh failed: ${res.status}`)
  }

  const json = (await res.json()) as
    | { access_token?: string; expires_in?: number }
    | { data?: { access_token?: string; expires_in?: number } }

  const payload =
    json && typeof json === "object" && "data" in json && json.data
      ? json.data!
      : (json as { access_token?: string; expires_in?: number })

  if (!payload.access_token) {
    throw new Error("Missing access_token in refresh response")
  }

  const expiresIn =
    typeof payload.expires_in === "number" ? payload.expires_in : 0

  useAuthStore.getState().setToken(payload.access_token, expiresIn)

  return {
    accessToken: payload.access_token,
    expiresIn,
  }
}
