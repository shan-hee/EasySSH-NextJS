import { create } from "zustand"

interface AuthState {
  accessToken: string | null
  expiresAt: number | null // Unix 毫秒时间戳

  setToken: (token: string, expiresInSeconds: number) => void
  clearToken: () => void
}

/**
 * 全局认证状态（仅管理 access_token，refresh_token 始终保存在 HttpOnly Cookie 中）
 */
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  expiresAt: null,

  setToken: (token: string, expiresInSeconds: number) => {
    const now = Date.now()
    const expiresAt = now + expiresInSeconds * 1000
    set({
      accessToken: token,
      expiresAt,
    })
  },

  clearToken: () => {
    set({
      accessToken: null,
      expiresAt: null,
    })
  },
}))

/**
 * 非 Hook 方式获取当前 access_token（供 api-client 等非 React 上下文使用）
 */
export function getCurrentAccessToken(): string | null {
  try {
    return useAuthStore.getState().accessToken
  } catch {
    return null
  }
}
