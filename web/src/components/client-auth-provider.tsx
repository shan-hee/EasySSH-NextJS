"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { authApi, type User } from "@/lib/api/auth"
import { useSystemConfig } from "@/contexts/system-config-context"
import { useAuthStore } from "@/stores/auth-store"
import { useTerminalStore } from "@/stores/terminal-store"
import { isApiError } from "@/lib/api-client"

interface ClientAuthContextType {
  user: User | null
  isAuthenticated: boolean
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined)

// Bearer-only 主链路：access_token 仅存内存，refresh_token 仅存 HttpOnly Cookie

interface ClientAuthProviderProps {
  children: ReactNode
  initialUser: User | null
}

/**
 * 客户端认证 Provider
 * 接收服务端验证的初始用户数据,避免客户端加载闪烁
 *
 * 注意: access_token 仅保存在内存中，refresh_token 由后端通过 HttpOnly Cookie 管理
 */
export function ClientAuthProvider({ children, initialUser }: ClientAuthProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser)
  const router = useRouter()
  const { markLoggedOut } = useSystemConfig()
  const clearToken = useAuthStore((state) => state.clearToken)
  const resetTerminals = useTerminalStore((state) => state.resetAll)

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

      // 检查是否为账户锁定错误
      if (isApiError(error) && error.status === 403) {
        const detail = error.detail as { error?: string } | undefined
        if (detail?.error === 'account_locked') {
          router.replace("/login?locked=true")
          return
        }
      }

      router.replace("/login")
    }
  }, [router])

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
    resetTerminals()
    markLoggedOut()
    router.replace("/login")
  }, [clearToken, markLoggedOut, resetTerminals, router])

  return (
    <ClientAuthContext.Provider
      value={{
        user,
        isAuthenticated,
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
