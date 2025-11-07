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

const TOKEN_KEY = "easyssh_access_token"
const REFRESH_TOKEN_KEY = "easyssh_refresh_token"

// 不需要认证的公开路由
const PUBLIC_ROUTES = ["/login", "/setup"]

/**
 * 旧版 AuthProvider - 保留用于登录页等非受保护路由
 * 在 dashboard 中应使用新的 ClientAuthProvider
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false) // 修改: 登录页不需要loading
  const router = useRouter()
  const pathname = usePathname()

  const isAuthenticated = !!user

  // 从 localStorage 获取令牌
  const getToken = useCallback(() => {
    if (typeof window === "undefined") return null
    return localStorage.getItem(TOKEN_KEY)
  }, [])

  const getRefreshToken = useCallback(() => {
    if (typeof window === "undefined") return null
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  }, [])

  // 保存令牌到 localStorage 和 cookie
  const setTokens = useCallback((accessToken: string, refreshToken: string) => {
    if (typeof window === "undefined") return
    // 保存到localStorage
    localStorage.setItem(TOKEN_KEY, accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    // 同时保存到cookie供middleware使用
    document.cookie = `${TOKEN_KEY}=${accessToken}; path=/; max-age=3600; SameSite=Lax`
    document.cookie = `${REFRESH_TOKEN_KEY}=${refreshToken}; path=/; max-age=604800; SameSite=Lax`
  }, [])

  // 清除令牌
  const clearTokens = useCallback(() => {
    if (typeof window === "undefined") return
    // 清除localStorage
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    // 清除cookie
    document.cookie = `${TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
    document.cookie = `${REFRESH_TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
  }, [])

  // 获取当前用户信息
  const refreshUser = useCallback(async () => {
    const token = getToken()
    if (!token) {
      setUser(null)
      setIsLoading(false)
      return
    }

    try {
      const userData = await authApi.getCurrentUser(token)
      setUser(userData)
    } catch (_error) {
      // 令牌可能过期,尝试刷新
      const refreshToken = getRefreshToken()
      if (refreshToken) {
        try {
          const { access_token, refresh_token } = await authApi.refreshToken({
            refresh_token: refreshToken,
          })
          setTokens(access_token, refresh_token)
          const userData = await authApi.getCurrentUser(access_token)
          setUser(userData)
        } catch (_refreshError) {
          // 刷新失败,清除令牌并重定向到登录页
          clearTokens()
          setUser(null)
          // 如果当前在受保护路由,重定向到登录
          if (pathname && !PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
            router.replace("/login")
          }
        }
      } else {
        clearTokens()
        setUser(null)
        // 如果当前在受保护路由,重定向到登录
        if (pathname && !PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
          router.replace("/login")
        }
      }
    } finally {
      setIsLoading(false)
    }
  }, [getToken, getRefreshToken, setTokens, clearTokens, pathname, router])

  // 登录
  const login = useCallback(
    async (credentials: LoginRequest) => {
      try {
        const { access_token, refresh_token, user: userData } = await authApi.login(credentials)
        setTokens(access_token, refresh_token)
        setUser(userData)
        router.replace("/dashboard")
      } catch (error) {
        console.error("Login failed:", error)
        throw error
      }
    },
    [setTokens, router]
  )

  // 登出
  const logout = useCallback(async () => {
    const token = getToken()
    if (token) {
      try {
        await authApi.logout(token)
      } catch (error) {
        console.error("Logout API call failed:", error)
      }
    }
    clearTokens()
    setUser(null)
    router.replace("/login")
  }, [getToken, clearTokens, router])

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

// 导出令牌获取函数供 API 调用使用
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}
