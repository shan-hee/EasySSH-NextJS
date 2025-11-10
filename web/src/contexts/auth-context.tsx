"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { authApi, type User, type LoginRequest } from "@/lib/api/auth"

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (credentials: LoginRequest) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// 不需要认证的公开路由
const PUBLIC_ROUTES = ["/login", "/setup"]

/**
 * 旧版 AuthProvider - 保留用于登录页等非受保护路由
 * 在 dashboard 中应使用新的 ClientAuthProvider
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false) // 登录页不需要全局 loading
  const router = useRouter()
  const pathname = usePathname()

  const isAuthenticated = !!user

  // 获取当前用户信息
  const refreshUser = useCallback(async () => {
    try {
      const userData = await authApi.getCurrentUser()
      setUser(userData)
    } catch (_error) {
      // 未认证或会话失效
      setUser(null)
      if (pathname && !PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
        router.replace("/login")
      }
    } finally {
      setIsLoading(false)
    }
  }, [pathname, router])

  // 登录
  const login = useCallback(
    async (credentials: LoginRequest) => {
      try {
        const { user: userData } = await authApi.login(credentials)
        // 后端已通过 HttpOnly Cookie 建立会话
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
  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch (error) {
      console.error("Logout API call failed:", error)
    }
    setUser(null)
    router.replace("/login")
  }, [router])

  // 初始化时加载用户信息(仅在非公开路由) - 已禁用,改由服务端验证
  useEffect(() => {
    // 不再自动加载用户信息,避免全局loading
    // 公开路由(如登录页)不需要认证检查
    const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname?.startsWith(route))
    if (isPublicRoute) {
      setIsLoading(false)
    }
     
  }, [pathname])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
// 注意：已废弃基于 token/localStorage 的方式，统一改为 HttpOnly Cookie。
