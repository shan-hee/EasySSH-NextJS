"use client"

import { useTranslations } from "next-intl"
import { LoginForm } from "@/components/login-form"
import { useAuthStatusRedirect } from "@/hooks/use-auth-status-redirect"

export default function LoginPage() {
  const tCommon = useTranslations("common")
  const { isChecking } = useAuthStatusRedirect("login")

  // 显示加载状态
  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{tCommon("loading")}</p>
        </div>
      </div>
    )
  }

  return <LoginForm />
}
