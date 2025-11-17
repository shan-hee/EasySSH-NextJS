"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { authApi, type User, type LoginRequest } from "@/lib/api/auth"

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
  // 后端会自动设置 HttpOnly Cookie,前端无需手动存储 token
  const login = useCallback(
    async (credentials: LoginRequest) => {
      try {
        const { user: userData } = await authApi.login(credentials)
        setUser(userData)
        router.replace("/dashboard")
      } catch (error) {
        console.error("Login failed:", error)
        throw error
      }
    },
    [router]
  )

  // 登出
  // 后端会自动清除 HttpOnly Cookie
  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch (error) {
      console.error("Logout API call failed:", error)
    }
    setUser(null)
    router.replace("/login")
  }, [router])

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
