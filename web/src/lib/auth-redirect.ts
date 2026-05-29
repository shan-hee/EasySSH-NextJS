import type { AuthStatusResponse } from "@/lib/api/auth"

export type AuthGatePage = "home" | "login" | "dashboard" | "setup"

export type AuthRedirectDecision =
  | { type: "stay" }
  | { type: "redirect"; href: string }

export type AuthLockInfo = Pick<AuthStatusResponse, "locked_until" | "lock_reason">

interface AuthRedirectOptions {
  currentPath?: string | null
}

const AUTHENTICATED_FALLBACK = "/dashboard"
const INITIAL_SETUP_PATH = "/setup"

export function getAuthRedirectDecision(
  page: AuthGatePage,
  authStatus: AuthStatusResponse | null,
  options: AuthRedirectOptions = {},
): AuthRedirectDecision {
  if (!authStatus) {
    return page === "login" || page === "setup"
      ? stay()
      : redirect(buildLoginRedirectUrl(options.currentPath))
  }

  if (authStatus.need_init) {
    return page === "setup" ? stay() : redirect(INITIAL_SETUP_PATH)
  }

  if (authStatus.account_locked) {
    if (page === "login" && hasLockedLoginParam(options.currentPath)) {
      return stay()
    }

    const nextPath = page === "login"
      ? getLoginNextPath(options.currentPath)
      : page === "setup"
        ? null
        : options.currentPath

    return redirect(buildLockedLoginRedirectUrl(authStatus, nextPath))
  }

  if (authStatus.is_authenticated) {
    if (page === "dashboard") {
      return stay()
    }

    const nextPath = page === "login" ? getLoginNextPath(options.currentPath) : null
    return redirect(nextPath ?? AUTHENTICATED_FALLBACK)
  }

  return page === "login"
    ? stay()
    : redirect(buildLoginRedirectUrl(page === "setup" ? null : options.currentPath))
}

export function buildLoginRedirectUrl(nextPath?: string | null): string {
  const params = new URLSearchParams()
  const safeNext = getSafeAuthNextPath(nextPath)

  if (safeNext) {
    params.set("next", safeNext)
  }

  const query = params.toString()
  return query ? `/login?${query}` : "/login"
}

export function buildLockedLoginRedirectUrl(
  lockInfo?: AuthLockInfo | null,
  nextPath?: string | null,
): string {
  const params = new URLSearchParams()
  const safeNext = getSafeAuthNextPath(nextPath)

  params.set("locked", "true")

  if (safeNext) {
    params.set("next", safeNext)
  }

  if (lockInfo?.locked_until) {
    params.set("locked_until", lockInfo.locked_until)
  }

  if (lockInfo?.lock_reason) {
    params.set("lock_reason", lockInfo.lock_reason)
  }

  return `/login?${params.toString()}`
}

export function getAuthLockInfo(detail: unknown): AuthLockInfo | null {
  if (typeof detail !== "object" || detail === null) {
    return null
  }

  const lockDetail = detail as {
    locked_until?: unknown
    lock_reason?: unknown
    unlock_at?: unknown
    message?: unknown
  }

  return {
    locked_until: typeof lockDetail.locked_until === "string"
      ? lockDetail.locked_until
      : typeof lockDetail.unlock_at === "string"
        ? lockDetail.unlock_at
        : undefined,
    lock_reason: typeof lockDetail.lock_reason === "string"
      ? lockDetail.lock_reason
      : typeof lockDetail.message === "string"
        ? lockDetail.message
        : undefined,
  }
}

export function getLoginNextPath(loginPath?: string | null): string | null {
  if (!loginPath) {
    return null
  }

  try {
    const url = new URL(loginPath, "http://easyssh.local")
    return getSafeAuthNextPath(url.searchParams.get("next"))
  } catch {
    return null
  }
}

export function getCurrentBrowserPath(fallbackPath?: string | null): string | null {
  if (typeof window === "undefined") {
    return fallbackPath ?? null
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

export function getSafeAuthNextPath(path?: string | null): string | null {
  const safePath = getSafeInternalPath(path)

  if (!safePath || safePath === "/" || isLoginPath(safePath)) {
    return null
  }

  return safePath
}

export function getSafeInternalPath(path?: string | null): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return null
  }

  return path
}

function hasLockedLoginParam(path?: string | null): boolean {
  if (!path) {
    return false
  }

  try {
    const url = new URL(path, "http://easyssh.local")
    return url.pathname === "/login" && url.searchParams.get("locked") === "true"
  } catch {
    return false
  }
}

export function isLoginPath(path?: string | null): boolean {
  if (!path) {
    return false
  }

  try {
    const url = new URL(path, "http://easyssh.local")
    return url.pathname === "/login"
  } catch {
    return path === "/login"
  }
}

function stay(): AuthRedirectDecision {
  return { type: "stay" }
}

function redirect(href: string): AuthRedirectDecision {
  return { type: "redirect", href }
}
