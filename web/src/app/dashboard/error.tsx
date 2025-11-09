"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, RefreshCw } from "lucide-react"

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

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <CardTitle>出错了</CardTitle>
          </div>
          <CardDescription>页面加载时发生错误</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm font-mono text-muted-foreground">
              {error.message || "未知错误"}
            </p>
            {error.digest && (
              <p className="mt-2 text-xs text-muted-foreground">错误 ID: {error.digest}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={reset} className="flex-1">
              <RefreshCw className="mr-2 h-4 w-4" />
              重试
            </Button>
            <Button variant="outline" onClick={() => window.location.href = "/dashboard"}>
              返回首页
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
