"use client"

import type React from "react"
import { useEffect, useRef } from "react"
import { getApiBase } from "@/lib/config"
import { useAuthStore } from "@/stores/auth-store"
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
          // 直接调用 /oauth/token 执行 refresh_token 流程，复用与 api-client 相同逻辑
          const apiBase = getApiBase()
          let url: string

          if (apiBase) {
            url = `${apiBase.replace(/\/+$/, "")}/oauth/token`
          } else {
            url = `${window.location.origin}/oauth/token`
          }

          let credentials: RequestCredentials = "same-origin"
          try {
            const reqUrl = new URL(url, window.location.href)
            if (reqUrl.origin !== window.location.origin) {
              credentials = "include"
            }
          } catch {
            // ignore
          }

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
            throw new Error(`Scheduled refresh failed: ${res.status}`)
          }

          const json = (await res.json()) as
            | { access_token?: string; expires_in?: number }
            | { data?: { access_token?: string; expires_in?: number } }

          const payload =
            json && typeof json === "object" && "data" in json && json.data
              ? json.data!
              : (json as { access_token?: string; expires_in?: number })

          if (payload.access_token) {
            const expiresIn =
              typeof payload.expires_in === "number" ? payload.expires_in : ttlSeconds
            useAuthStore.getState().setToken(payload.access_token, expiresIn)
            scheduleRefresh(expiresIn)
          } else {
            // 未返回 access_token，交给全局 401 逻辑处理
            console.error("[SessionRefreshProvider] Missing access_token in refresh response")
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
