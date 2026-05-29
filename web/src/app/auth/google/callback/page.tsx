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
import {
  buildLockedLoginRedirectUrl,
  buildLoginRedirectUrl,
  getAuthLockInfo,
  getSafeAuthNextPath,
  getSafeInternalPath,
} from "@/lib/auth-redirect"
import { AuthI18nProvider } from "@/providers/auth-i18n-provider"

type GoogleOAuthState = {
  mode?: "login" | "link"
  next?: string | null
  returnTo?: string | null
}

// 解析 state 中携带的 next / mode 信息
function parseState(stateParam: string | null): GoogleOAuthState {
  if (!stateParam) return {}
  try {
    const decoded = decodeURIComponent(atob(stateParam))
    const data = JSON.parse(decoded) as GoogleOAuthState
    return data && typeof data === "object" ? data : {}
  } catch {
    return {}
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
    const parsedState = parseState(state)
    const mode = parsedState.mode === "link" ? "link" : "login"
    const next = getSafeAuthNextPath(parsedState.next)
    const returnTo = getSafeInternalPath(parsedState.returnTo) ?? "/dashboard"

    const redirectBackToLogin = (params: Record<string, string> = {}) => {
      const loginUrl = buildLoginRedirectUrl(next)
      const [path, existingQuery = ""] = loginUrl.split("?")
      const query = new URLSearchParams(existingQuery)
      for (const [key, value] of Object.entries(params)) {
        if (value) {
          query.set(key, value)
        }
      }
      const queryString = query.toString()
      router.replace(queryString ? `${path}?${queryString}` : path)
    }

    const redirectBackToSettings = (params: Record<string, string> = {}) => {
      const url = new URL(returnTo, window.location.origin)
      url.searchParams.set("account_settings", "security")
      for (const [key, value] of Object.entries(params)) {
        if (value) {
          url.searchParams.set(key, value)
        }
      }
      router.replace(`${url.pathname}${url.search}${url.hash}`)
    }

    if (error) {
      if (mode === "link") {
        redirectBackToSettings({
          google_link: "failed",
          google_message: t("loginGoogleFailedDesc"),
        })
      } else {
        toast.error(t("loginGoogleFailedTitle"), {
          description: t("loginGoogleFailedDesc"),
        })
        redirectBackToLogin()
      }
      return
    }

    if (!code) {
      if (mode === "link") {
        redirectBackToSettings({
          google_link: "failed",
          google_message: t("loginGoogleCredentialMissingDesc"),
        })
      } else {
        toast.error(t("loginGoogleFailedTitle"), {
          description: t("loginGoogleCredentialMissingDesc"),
        })
        redirectBackToLogin()
      }
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

        if (mode === "link") {
          await authApi.linkGoogleCode({
            code,
            code_verifier: codeVerifier,
            redirect_uri: redirectUri,
          })

          await refreshConfig({ refreshAuth: true })
          redirectBackToSettings({ google_link: "success" })
          return
        }

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
        const apiError = isApiError(err) ? err : null
        const detail = apiError && typeof apiError.detail === "object" && apiError.detail !== null
          ? (apiError.detail as { error?: string; message?: string })
          : null
        if (detail?.error === "account_locked") {
          router.replace(
            buildLockedLoginRedirectUrl(
              getAuthLockInfo(apiError?.detail),
              mode === "link" ? returnTo : next,
            ),
          )
          return
        }

        if (mode === "link") {
          redirectBackToSettings({
            google_link: detail?.error ?? "failed",
            google_message: message,
          })
        } else {
          toast.error(t("loginGoogleFailedTitle"), {
            description: message,
          })
          redirectBackToLogin({
            google_error: detail?.error ?? "google_login_failed",
            google_message: message,
          })
        }
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
