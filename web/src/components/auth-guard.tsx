"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"

interface AuthGuardProps {
  children: React.ReactNode
}

/**
 * 认证守卫组件
 * 保护需要登录才能访问的路由
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // 等待认证状态加载完成
    if (isLoading) return

    // 如果未认证,重定向到登录页
    if (!isAuthenticated) {
      // 保存当前路径,登录后可以返回
      const returnUrl = encodeURIComponent(pathname || "/dashboard")
      router.replace(`/login?redirect=${returnUrl}`)
    }
  }, [isAuthenticated, isLoading, router, pathname])

  // 加载中显示loading
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  // 未认证时不渲染内容(避免闪烁)
  if (!isAuthenticated) {
    return null
  }

  // 已认证,渲染子组件
  return <>{children}</>
}
