"use client"

import { useEffect, useReducer } from "react"
import { useRouter } from "next/navigation"
import { useSystemConfig } from "@/contexts/system-config-context"

type EntryPage = "home" | "login"

interface UseAuthStatusRedirectResult {
  isChecking: boolean
}

interface AuthRedirectState {
  hasSettled: boolean
  isChecking: boolean
}

type AuthRedirectAction = {
  isChecking: boolean
  type: "settle"
}

function authRedirectReducer(state: AuthRedirectState, action: AuthRedirectAction): AuthRedirectState {
  switch (action.type) {
    case "settle":
      if (state.hasSettled && state.isChecking === action.isChecking) {
        return state
      }
      return { hasSettled: true, isChecking: action.isChecking }
  }
}

/**
 * 统一处理入口页的认证/初始化状态检查与跳转逻辑
 *
 * - home: 根据状态跳转到 /setup /dashboard /login
 * - login: 已初始化且未登录时才停留在当前页,其他情况跳转
 *
 * 对 login 页有一个额外优化:
 * - 只在首次加载时根据 authStatus 决定是否显示全屏"正在加载..."
 * - 后续 refreshConfig 触发的 isLoading 不再重置为全屏加载,避免登录成功后黑屏
 */
export function useAuthStatusRedirect(page: EntryPage): UseAuthStatusRedirectResult {
  const router = useRouter()
  const { authStatus, isLoading } = useSystemConfig()
  const [redirectState, dispatchRedirect] = useReducer(authRedirectReducer, {
    hasSettled: false,
    isChecking: true,
  })

  useEffect(() => {
    if (page !== "login" || redirectState.hasSettled) {
      return
    }

    const timer = window.setTimeout(() => {
      dispatchRedirect({ type: "settle", isChecking: false })
    }, 5000)

    return () => window.clearTimeout(timer)
  }, [page, redirectState.hasSettled])

  useEffect(() => {
    // login 页: 如果已经完成过一次初始检查(确认停留在登录页),
    // 后续仅关注"已认证"的场景,避免再次进入全屏加载态
    if (page === "login" && redirectState.hasSettled) {
      // 仅在 authStatus 表示已认证时重定向到 dashboard
      if (!isLoading && authStatus && authStatus.is_authenticated) {
        router.replace("/dashboard")
      }
      return
    }

    // 等待系统配置 / 认证状态加载完成；初始 isChecking 已经为 true。
    if (isLoading) {
      return
    }

    // 如果加载失败（authStatus 为空），按“未认证且已初始化失败未知”处理
    if (!authStatus) {
      if (page === "home") {
        router.replace("/login")
      } else {
        dispatchRedirect({ type: "settle", isChecking: false })
      }
      return
    }

    const status = authStatus

    // 需要初始化 → 统一跳转到 /setup
    if (status.need_init) {
      router.replace("/setup")
      return
    }

    // 账户被锁定 → 跳转到登录页并显示锁定提示
    if (status.account_locked) {
      if (page === "login") {
        // 已在登录页，显示锁定提示
        dispatchRedirect({ type: "settle", isChecking: false })
      } else {
        const params = new URLSearchParams()
        params.set("locked", "true")
        if (status.locked_until) {
          params.set("locked_until", status.locked_until)
        }
        if (status.lock_reason) {
          params.set("lock_reason", status.lock_reason)
        }
        router.replace(`/login?${params.toString()}`)
      }
      return
    }

    // 已认证 → 统一跳转到 /dashboard
    if (status.is_authenticated) {
      router.replace("/dashboard")
      return
    }

    // 未认证
    if (page === "home") {
      router.replace("/login")
    } else {
      dispatchRedirect({ type: "settle", isChecking: false })
    }
  }, [authStatus, isLoading, page, redirectState.hasSettled, router])

  return { isChecking: redirectState.isChecking }
}
