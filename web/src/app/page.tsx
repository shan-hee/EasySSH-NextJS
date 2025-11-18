"use client"

import { useAuthStatusRedirect } from "@/hooks/use-auth-status-redirect"

export default function Home() {
  const { isChecking } = useAuthStatusRedirect("home")

  // 显示加载状态
  if (!isChecking) {
    // 理论上首页总是会重定向,不会渲染真实内容
    // 这里返回 null 以防止在极端情况下渲染多余内容
    return null
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">正在加载...</p>
      </div>
    </div>
  )
}
