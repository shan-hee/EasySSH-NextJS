"use client"

import type React from "react"
import { useEffect, useMemo } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useSystemConfig } from "@/contexts/system-config-context"

// 需要鉴权的业务路由前缀
const PROTECTED_PREFIXES = ["/dashboard"]

interface AuthGateProps {
  children: React.ReactNode
}

/**
 * 基于全局 authStatus 的路由级鉴权 Gate
 * - 在鉴权完成前拦截受保护路由,仅显示全局加载指示器
 * - 未认证/需要初始化时,统一重定向到 /login 或 /setup
 */
export function AuthGate({ children }: AuthGateProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { authStatus, isLoading } = useSystemConfig()

  const isProtectedRoute = useMemo(() => {
    if (!pathname) return false
    return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  }, [pathname])

  useEffect(() => {
    if (!isProtectedRoute) return
    if (isLoading) return

    // 后端不可用或返回数据异常,按未认证处理
    if (!authStatus) {
      const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : ""
      router.replace(`/login${next}`)
      return
    }

    if (authStatus.need_init) {
      router.replace("/setup")
      return
    }

    if (!authStatus.is_authenticated) {
      const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : ""
      router.replace(`/login${next}`)
    }
  }, [authStatus, isLoading, isProtectedRoute, pathname, router])

  // 非受保护路由不做拦截,交由各自页面处理
  if (!isProtectedRoute) {
    return <>{children}</>
  }

  // 鉴权进行中或正在重定向时统一显示全屏加载指示器
  if (isLoading || !authStatus || authStatus.need_init || !authStatus.is_authenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">正在加载...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
