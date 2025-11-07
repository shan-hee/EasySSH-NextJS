"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
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

const TOKEN_KEY = "easyssh_access_token"
const REFRESH_TOKEN_KEY = "easyssh_refresh_token"

interface ClientAuthProviderProps {
  children: ReactNode
  initialUser: User | null
}

/**
 * 客户端认证 Provider
 * 接收服务端验证的初始用户数据,避免客户端加载闪烁
 */
export function ClientAuthProvider({ children, initialUser }: ClientAuthProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser)
  const router = useRouter()

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
    // 同时保存到cookie供middleware和server components使用
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

  // 刷新用户信息
  const refreshUser = useCallback(async () => {
    const token = getToken()
    if (!token) {
      setUser(null)
      return
    }

    try {
      const userData = await authApi.getCurrentUser(token)
      setUser(userData)
    } catch {
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
        } catch {
          // 刷新失败,清除令牌并重定向到登录页
          clearTokens()
          setUser(null)
          router.replace("/login")
        }
      } else {
        clearTokens()
        setUser(null)
        router.replace("/login")
      }
    }
  }, [getToken, getRefreshToken, setTokens, clearTokens, router])

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
