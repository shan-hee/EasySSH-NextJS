"use client"

import type React from "react"
import { useEffect, useRef } from "react"
import { authApi } from "@/lib/api/auth"
import { useSystemConfig } from "@/contexts/system-config-context"

interface SessionRefreshProviderProps {
  children: React.ReactNode
}

/**
 * 会话自动刷新 Provider
 *
 * 基于后端返回的 access_token_ttl_seconds:
 * - 在用户已认证时,按 TTL 的 80% 安排一次定时刷新
 * - 失败时不做额外处理,交由 apiFetch 的 401 兜底逻辑负责跳转登录
 */
export function SessionRefreshProvider({ children }: SessionRefreshProviderProps) {
  const { authStatus } = useSystemConfig()
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return

    // 清理旧定时器
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (!authStatus || !authStatus.is_authenticated) {
      return
    }

    const ttlSeconds = authStatus.access_token_ttl_seconds
    if (!ttlSeconds || ttlSeconds <= 0) {
      return
    }

    // 安全提前量: 80% 的有效期,且至少 60 秒
    const SAFE_RATIO = 0.8
    const MIN_DELAY_MS = 60 * 1000
    const delayMs = Math.max(ttlSeconds * SAFE_RATIO * 1000, MIN_DELAY_MS)

    timerRef.current = window.setTimeout(async () => {
      try {
        await authApi.refreshToken()
      } catch (error) {
        // 刷新失败的具体处理交给 apiFetch 全局 401 逻辑
        console.error("[SessionRefreshProvider] Scheduled refresh failed", error)
      }
    }, delayMs)

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [authStatus])

  return <>{children}</>
}

