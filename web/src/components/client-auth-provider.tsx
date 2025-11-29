"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { authApi, type User, type LoginRequest } from "@/lib/api/auth"
import { useSystemConfig } from "@/contexts/system-config-context"
import { useAuthStore } from "@/stores/auth-store"

interface ClientAuthContextType {
  user: User | null
  isAuthenticated: boolean
  login: (credentials: LoginRequest) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined)

// 纯 Cookie-only 模式：不在前端存储任何 token

interface ClientAuthProviderProps {
  children: ReactNode
  initialUser: User | null
}

/**
 * 客户端认证 Provider
 * 接收服务端验证的初始用户数据,避免客户端加载闪烁
 *
 * 注意: Token 现在由后端通过 HttpOnly Cookie 管理,前端不再直接操作 localStorage
 */
export function ClientAuthProvider({ children, initialUser }: ClientAuthProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser)
  const router = useRouter()
  const { refreshConfig } = useSystemConfig()
  const setToken = useAuthStore((state) => state.setToken)
  const clearToken = useAuthStore((state) => state.clearToken)

  // 同步 initialUser 的变化（用于乐观渲染场景）
  useEffect(() => {
    if (initialUser !== null) {
      setUser(initialUser)
    }
  }, [initialUser])

  const isAuthenticated = !!user

  // 刷新用户信息
  // Cookie 由后端自动管理,前端只需调用 API
  const refreshUser = useCallback(async () => {
    try {
      // API 请求会自动携带 HttpOnly Cookie
      const userData = await authApi.getCurrentUser()
      setUser(userData)
    } catch (error) {
      // 认证失败,清除用户状态
      console.error("Failed to refresh user:", error)
      setUser(null)
      router.replace("/login")
    }
  }, [router])

  // 登录
  // PKCE 开发版：通过 /oauth/authorize + /oauth/token 获取 access_token，并写入内存 Store
  const login = useCallback(
    async (credentials: LoginRequest) => {
      try {
        // 1. 使用 PKCE 授权获取授权码
        const { username, password } = credentials
        const redirectUri =
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback`
            : "/auth/callback"

        const { code } = await authApi.authorizeWithPkce({
          username,
          password,
          client_id: "easyssh-web",
          redirect_uri: redirectUri,
          scope: "openid profile easyssh",
          // code_challenge 与 code_verifier 由 login 页面统一管理；
          // 这里作为兜底登录方案，仅用于极少数场景，因此直接抛出错误以提示使用登录页面。
          code_challenge: "",
          code_challenge_method: "S256",
        })

        if (!code) {
          throw new Error("PKCE login via ClientAuthProvider is not fully supported, please use the /login page.")
        }

        // 此处仅作为兜底逻辑，正常情况下不会走到这里
        // 为避免引入重复的 PKCE 实现，不在此处继续交换令牌
        router.replace("/login")
      } catch (error) {
        console.error("Login failed:", error)
        throw error
      }
    },
    [router]
  )

  // 登出
  // 后端会自动清除 HttpOnly Cookie，同时前端清空内存中的 access_token
  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch (error) {
      console.error("Logout API call failed:", error)
    }
    setUser(null)
    clearToken()
    // 清除“曾登录”标记，避免未登录状态下多余的 refresh_token 请求
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem("easyssh_has_login")
      } catch {
        // ignore
      }
    }
    // 刷新全局认证状态,确保 SessionRefreshProvider 等及时停止工作
    try {
      await refreshConfig()
    } catch (error) {
      console.error("Failed to refresh system config after logout:", error)
    }
    router.replace("/login")
  }, [clearToken, refreshConfig, router])

  return (
    <ClientAuthContext.Provider
      value={{
        user,
        isAuthenticated,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </ClientAuthContext.Provider>
  )
}

/**
 * 使用客户端认证上下文
 */
export function useClientAuth() {
  const context = useContext(ClientAuthContext)
  if (context === undefined) {
    throw new Error("useClientAuth must be used within a ClientAuthProvider")
  }
  return context
}
