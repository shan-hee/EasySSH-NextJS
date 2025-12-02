"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"
import { useTranslations } from "next-intl"

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
  title,
  description,
  showHomeButton = true,
}: ErrorFallbackProps) {
  const tErrors = useTranslations("errors")

  const finalTitle = title ?? tErrors("defaultTitle")
  const finalDescription = description ?? tErrors("defaultDescription")

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <CardTitle>{finalTitle}</CardTitle>
          </div>
          <CardDescription>{finalDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm font-mono text-muted-foreground break-words">
              {error.message || tErrors("unknownError")}
            </p>
            {error.digest && (
              <p className="mt-2 text-xs text-muted-foreground">
                {tErrors("errorId", { id: error.digest })}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={reset} className="flex-1">
              <RefreshCw className="mr-2 h-4 w-4" />
              {tErrors("retryButton")}
            </Button>
            {showHomeButton && (
              <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
                <Home className="mr-2 h-4 w-4" />
                {tErrors("homeButton")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
