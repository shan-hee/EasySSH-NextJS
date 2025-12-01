"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "@/components/ui/sonner"
import { authApi } from "@/lib/api/auth"
import { useAuthStore } from "@/stores/auth-store"
import { useSystemConfig } from "@/contexts/system-config-context"
import { getErrorMessage } from "@/lib/error-utils"

// 解析 state 中携带的 next 信息
function parseNextFromState(stateParam: string | null): string | null {
  if (!stateParam) return null
  try {
    const decoded = decodeURIComponent(atob(stateParam))
    const data = JSON.parse(decoded) as { next?: string | null }
    if (!data || typeof data.next !== "string") return null
    const next = data.next
    if (
      !next ||
      !next.startsWith("/") ||
      next.startsWith("//") ||
      next.startsWith("/login")
    ) {
      return null
    }
    return next
  } catch {
    return null
  }
}

export default function GoogleAuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const setToken = useAuthStore((state) => state.setToken)
  const { refreshConfig } = useSystemConfig()

  useEffect(() => {
    // 从 URL hash 中解析 id_token（OAuth2 implicit flow）
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.substring(1)
      : window.location.hash

    const hashParams = new URLSearchParams(hash)
    const idToken = hashParams.get("id_token")
    const error = hashParams.get("error")
    const stateFromHash = hashParams.get("state")

    // Google 也会把 state 放在 query 参数里，兼容读取一次
    const stateFromQuery = searchParams.get("state")
    const next =
      parseNextFromState(stateFromHash) ||
      parseNextFromState(stateFromQuery) ||
      null

    const redirectBackToLogin = () => {
      const nextQuery = next ? `?next=${encodeURIComponent(next)}` : ""
      router.replace(`/login${nextQuery}`)
    }

    if (error) {
      toast.error("Google 登录失败", {
        description: `Google 返回错误：${error}`,
      })
      redirectBackToLogin()
      return
    }

    if (!idToken) {
      toast.error("Google 登录失败", {
        description: "回调中未找到 ID Token，请重试",
      })
      redirectBackToLogin()
      return
    }

    ;(async () => {
      try {
        const response = await authApi.verifyGoogleToken(idToken)
        if (!response.access_token) {
          throw new Error("未能获取 access_token")
        }

        const expiresIn =
          typeof response.expires_in === "number" ? response.expires_in : 0
        setToken(response.access_token, expiresIn)

        toast.success("登录成功", {
          description: "正在跳转到控制台...",
        })

        await refreshConfig()

        if (next) {
          router.replace(next)
        } else {
          router.replace("/dashboard")
        }
      } catch (err) {
        console.error("Google callback login error:", err)
        toast.error("Google 登录失败", {
          description: getErrorMessage(err, "请重试或联系管理员"),
        })
        redirectBackToLogin()
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">正在通过 Google 登录...</p>
      </div>
    </div>
  )
}

