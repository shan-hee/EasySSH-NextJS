"use client"

import type React from "react"
import { useEffect, useRef } from "react"
import { useSystemConfig } from "@/contexts/system-config-context"
import { performRefreshToken } from "@/lib/session-refresh"

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

    let cancelled = false

    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    // 先清理旧定时器
    clearTimer()

    if (!authStatus || !authStatus.is_authenticated) {
      return
    }

    // 优先使用后端动态返回的当前 Access Token 剩余时间
    let baseTtlSeconds = authStatus.access_token_expires_in
    if (!baseTtlSeconds || baseTtlSeconds <= 0) {
      // 兜底: 若后端未提供动态剩余时间,退回到统一配置 TTL
      baseTtlSeconds = authStatus.access_token_ttl_seconds
    }

    if (!baseTtlSeconds || baseTtlSeconds <= 0) {
      return
    }

    const SAFE_RATIO = 0.8
    const MIN_DELAY_MS = 60 * 1000

    const scheduleRefresh = (ttlSeconds: number) => {
      if (cancelled) return

      const delayMs = Math.max(ttlSeconds * SAFE_RATIO * 1000, MIN_DELAY_MS)

      timerRef.current = window.setTimeout(async () => {
        try {
          // 统一调用刷新工具，内部会更新内存中的 access_token
          const { expiresIn } = await performRefreshToken()

          const nextTtl = expiresIn > 0 ? expiresIn : ttlSeconds
          if (nextTtl > 0) {
            scheduleRefresh(nextTtl)
          }
        } catch (error) {
          // 刷新失败的具体处理交给 apiFetch 全局 401 逻辑
          console.error("[SessionRefreshProvider] Scheduled refresh failed", error)
        }
      }, delayMs)
    }

    // 使用 /auth/status 返回的 TTL 作为首次倒计时基准
    scheduleRefresh(baseTtlSeconds)

    return () => {
      cancelled = true
      clearTimer()
    }
  }, [authStatus])

  return <>{children}</>
}
