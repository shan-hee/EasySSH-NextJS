"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"

interface ErrorFallbackProps {
  error: Error & { digest?: string }
  reset: () => void
  title?: string
  description?: string
  showHomeButton?: boolean
}

/**
 * 通用错误回退组件
 * 可在任何错误边界中复用
 */
export function ErrorFallback({
  error,
  reset,
  title = "出错了",
  description = "页面加载时发生错误",
  showHomeButton = true,
}: ErrorFallbackProps) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <CardTitle>{title}</CardTitle>
          </div>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm font-mono text-muted-foreground break-words">
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
            {showHomeButton && (
              <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
                <Home className="mr-2 h-4 w-4" />
                首页
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
