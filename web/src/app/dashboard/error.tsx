"use client"

import { useEffect } from "react"
import { ErrorFallback } from "@/components/error-fallback"

/**
 * Dashboard 错误边界
 * 捕获并显示页面错误，提供重试功能
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // 记录错误到控制台
    console.error("Dashboard error:", error)
  }, [error])

  return <ErrorFallback error={error} reset={reset} />
}
