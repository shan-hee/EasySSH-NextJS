"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSystemConfig } from "@/contexts/system-config-context"
import {
  getAuthRedirectDecision,
  getCurrentBrowserPath,
  isLoginPath,
  type AuthGatePage,
} from "@/lib/auth-redirect"

type EntryPage = Extract<AuthGatePage, "home" | "login">

interface UseAuthStatusRedirectResult {
  isChecking: boolean
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
  const [hasCompletedInitialCheck, setHasCompletedInitialCheck] = useState(false)

  useEffect(() => {
    if (isLoading) {
      return
    }

    const currentPath = getCurrentBrowserPath()
    const decision = getAuthRedirectDecision(page, authStatus, { currentPath })
    if (decision.type === "redirect") {
      router.replace(decision.href)
      if (page === "login" && isLoginPath(decision.href)) {
        setHasCompletedInitialCheck(true)
      }
      return
    }

    setHasCompletedInitialCheck(true)
  }, [authStatus, isLoading, page, router])

  return {
    isChecking: page === "login" ? !hasCompletedInitialCheck : true,
  }
}
