 "use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "@/components/ui/sonner"
import { useTranslations } from "next-intl"
import { authApi } from "@/lib/api/auth"
import { useAuthStore } from "@/stores/auth-store"
import { useSystemConfig } from "@/contexts/system-config-context"
import { getErrorMessage } from "@/lib/error-utils"
import { isApiError } from "@/lib/api-client"
import { AuthI18nProvider } from "@/providers/auth-i18n-provider"

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

function GoogleAuthCallbackInner() {
  const t = useTranslations("auth")
  const router = useRouter()
  const searchParams = useSearchParams()
  const setToken = useAuthStore((state) => state.setToken)
  const { refreshConfig } = useSystemConfig()

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search)
    const code = queryParams.get("code")
    const error = queryParams.get("error")
    const state = queryParams.get("state") || searchParams.get("state")
    const next = parseNextFromState(state)

    const redirectBackToLogin = (params: Record<string, string> = {}) => {
      const query = new URLSearchParams()
      if (next) {
        query.set("next", next)
      }
      for (const [key, value] of Object.entries(params)) {
        if (value) {
          query.set(key, value)
        }
      }
      const queryString = query.toString()
      router.replace(queryString ? `/login?${queryString}` : "/login")
    }

    if (error) {
      toast.error(t("loginGoogleFailedTitle"), {
        description: t("loginGoogleFailedDesc"),
      })
      redirectBackToLogin()
      return
    }

    if (!code) {
      toast.error(t("loginGoogleFailedTitle"), {
        description: t("loginGoogleCredentialMissingDesc"),
      })
      redirectBackToLogin()
      return
    }

    ;(async () => {
      try {
        const storedState = window.sessionStorage.getItem("easyssh_google_oauth_state")
        const codeVerifier = window.sessionStorage.getItem("easyssh_google_pkce_verifier")
        window.sessionStorage.removeItem("easyssh_google_oauth_state")
        window.sessionStorage.removeItem("easyssh_google_pkce_verifier")

        if (!state || !storedState || state !== storedState || !codeVerifier) {
          throw new Error("Invalid Google OAuth state")
        }

        const redirectUri = `${window.location.origin}/auth/google/callback`
        const response = await authApi.verifyGoogleCode({
          code,
          code_verifier: codeVerifier,
          redirect_uri: redirectUri,
        })
        if (!response.access_token) {
          throw new Error("Missing access_token in Google callback response")
        }

        const expiresIn =
          typeof response.expires_in === "number" ? response.expires_in : 0
        setToken(response.access_token, expiresIn)

        toast.success(t("loginToastSuccessTitle"), {
          description: t("loginToastSuccessDesc"),
        })

        await refreshConfig({ refreshAuth: true })

        if (next) {
          router.replace(next)
        } else {
          router.replace("/dashboard")
        }
      } catch (err) {
        console.error("Google callback login error:", err)
        const message = getErrorMessage(err, t("loginGoogleRetryDesc"))
        toast.error(t("loginGoogleFailedTitle"), {
          description: message,
        })
        const detail = isApiError(err) && typeof err.detail === "object" && err.detail !== null
          ? (err.detail as { error?: string; message?: string })
          : null
        redirectBackToLogin({
          google_error: detail?.error ?? "google_login_failed",
          google_message: message,
        })
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">
          {t("loginGoogleCallbackLoading")}
        </p>
      </div>
    </div>
  )
}

function GoogleAuthCallbackFallback() {
  const t = useTranslations("auth")

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">
          {t("loginGoogleCallbackLoading")}
        </p>
      </div>
    </div>
  )
}

export default function GoogleAuthCallbackPage() {
  return (
    <AuthI18nProvider>
      <Suspense fallback={<GoogleAuthCallbackFallback />}>
        <GoogleAuthCallbackInner />
      </Suspense>
    </AuthI18nProvider>
  )
}
