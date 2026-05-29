import { getApiUrl as getApiUrlFromConfig } from "@/lib/config"
import { getCurrentAccessToken } from "@/stores/auth-store"
import { performRefreshToken } from "@/lib/session-refresh"
import { clearCSRFToken, ensureCSRFToken, updateCSRFTokenFromHeaders } from "@/lib/csrf"
import {
  buildLockedLoginRedirectUrl,
  buildLoginRedirectUrl,
  getAuthLockInfo,
  getCurrentBrowserPath,
  isLoginPath,
} from "@/lib/auth-redirect"

// 重新导出 getApiUrl 以便其他模块使用
export function getApiUrl(path: string = ""): string {
  const baseUrl = getApiUrlFromConfig()
  return path ? `${baseUrl}${path}` : baseUrl
}

/**
 * 获取认证头
 */
export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  }
  const token = getCurrentAccessToken()
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  return headers
}

// 全局刷新会话 Promise，避免并发重复刷新
let refreshPromise: Promise<void> | null = null

// 全局 401 处理标记，避免重复跳转
let hasRedirectedFor401 = false

/**
 * 重置全局 401 重定向标记
 * - 典型场景: 进入登录页 / 登录成功后，开始新的认证周期
 */
export function resetUnauthorizedRedirectFlag() {
  hasRedirectedFor401 = false
}

function handleGlobalUnauthorized(error: unknown) {
  if (typeof window === 'undefined') return
  const currentPath = getCurrentBrowserPath() ?? ""
  // 已在登录页时收到 401，多数来自后台请求，忽略即可，避免重复刷新
  if (isLoginPath(currentPath)) {
    console.error("[apiFetch] Unauthorized while already on /login, ignoring redirect", error)
    return
  }

  if (hasRedirectedFor401) return
  hasRedirectedFor401 = true

  // 打一条调试日志，方便排查
  console.error("[apiFetch] Unauthorized, redirecting to /login", error)

  try {
    window.location.href = buildLoginRedirectUrl(currentPath)
  } catch {
    window.location.href = "/login"
  }
}

// 全局账户锁定处理标记，避免重复跳转
let hasRedirectedForLocked = false

/**
 * 重置全局账户锁定重定向标记
 */
export function resetAccountLockedRedirectFlag() {
  hasRedirectedForLocked = false
}

function handleAccountLocked(detail: unknown) {
  if (typeof window === 'undefined') return
  const currentPath = getCurrentBrowserPath() ?? ""
  // 已在登录页时收到锁定错误，忽略
  if (isLoginPath(currentPath)) {
    return
  }

  if (hasRedirectedForLocked) return
  hasRedirectedForLocked = true

  console.error("[apiFetch] Account locked, redirecting to /login", detail)

  try {
    window.location.href = buildLockedLoginRedirectUrl(getAuthLockInfo(detail), currentPath)
  } catch {
    window.location.href = "/login?locked=true"
  }
}

async function refreshSession(): Promise<void> {
  if (typeof window === 'undefined') {
    // 仅在浏览器端执行刷新；服务端不做刷新以免无法设置浏览器 Cookie
    throw new Error('Refresh not supported on server')
  }
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    await performRefreshToken()
  })()

  try {
    await refreshPromise
  } finally {
    // 单次刷新完成后释放锁
    refreshPromise = null
  }
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

/**
 * API 错误类型
 */
export interface ApiError extends Error {
  status: number
  detail: unknown
}

/**
 * 类型守卫:检查是否为 ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    error instanceof Error &&
    'status' in error &&
    typeof (error as ApiError).status === 'number'
  )
}

function shouldOmitAuthHeader(url: string): boolean {
  return (
    url.includes("/oauth/authorize") ||
    url.includes("/oauth/token") ||
    url.includes("/oauth/google/verify")
  )
}

function shouldIncludeCookies(url: string): boolean {
  return (
    url.includes("/oauth/token") ||
    url.includes("/oauth/logout") ||
    url.includes("/oauth/google/verify") ||
    url.includes("/users/me/oauth/google/link") ||
    url.includes("/auth/logout") ||
    url.includes("/auth/register") ||
    url.includes("/auth/initialize-admin")
  )
}

function shouldHandleUnauthorizedGlobally(url: string): boolean {
  return !(
    url.includes("/oauth/authorize") ||
    url.includes("/oauth/token") ||
    url.includes("/oauth/google/verify") ||
    url.includes("/users/me/oauth/google/link") ||
    url.includes("/auth/2fa/verify") ||
    url.includes("/auth/status")
  )
}

function shouldHandleAccountLockedGlobally(url: string): boolean {
  return !(
    url.includes("/oauth/google/verify") ||
    url.includes("/users/me/oauth/google/link")
  )
}

function isCSRFTokenInvalid(error: unknown): boolean {
  if (!isApiError(error) || error.status !== 403) {
    return false
  }

  const detail = error.detail
  return (
    typeof detail === "object" &&
    detail !== null &&
    "error" in detail &&
    (detail as { error?: string }).error === "csrf_token_invalid"
  )
}

type ApiFetchOptions = {
  method?: HttpMethod
  headers?: HeadersInit
  body?: unknown
  signal?: AbortSignal
  timeout?: number // 超时时间(毫秒),默认 30000ms
  retry?: boolean // 是否启用重试,默认 true
  maxRetries?: number // 最大重试次数,默认 3
}

/**
 * 延迟函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 判断错误是否可重试
 */
function isRetryableError(error: unknown): boolean {
  if (isApiError(error)) {
    // 5xx 服务器错误可重试
    return error.status >= 500 && error.status < 600
  }
  // 网络错误可重试
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true
  }
  return false
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const {
    timeout = 30000,
    retry = true,
    maxRetries = 3,
    ...fetchOptions
  } = options

  // 实现重试逻辑
  let lastError: unknown
  const retries = retry ? maxRetries : 1

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await apiFetchInternal<T>(path, { ...fetchOptions, timeout })
    } catch (error) {
      const method = fetchOptions.method ?? "GET"
      if (
        typeof window !== "undefined" &&
        method !== "GET" &&
        shouldIncludeCookies(path) &&
        isCSRFTokenInvalid(error)
      ) {
        clearCSRFToken()
        return await apiFetchInternal<T>(path, { ...fetchOptions, timeout })
      }

      // 401 处理：仅在浏览器端尝试用 Cookie 刷新并重放一次
      if (typeof window !== 'undefined' && isApiError(error) && error.status === 401) {
        const handleUnauthorizedGlobally = shouldHandleUnauthorizedGlobally(path)
        if (!handleUnauthorizedGlobally) {
          throw error
        }

        try {
          await refreshSession()
          // 刷新成功，重放原请求一次（不进入重试退避）。
          // 如果重放后仍然是 401，则认为会话已失效，统一跳转登录页。
          try {
            return await apiFetchInternal<T>(path, { ...fetchOptions, timeout })
          } catch (retryError) {
            if (isApiError(retryError) && retryError.status === 401) {
              handleGlobalUnauthorized(retryError)
            }
            throw retryError
          }
        } catch (refreshError) {
          // 刷新失败，统一跳转登录页
          handleGlobalUnauthorized(refreshError)
          throw error
        }
      }
      lastError = error

      // 最后一次尝试或不可重试的错误,直接抛出
      if (attempt === retries - 1 || !isRetryableError(error)) {
        throw error
      }

      // 指数退避: 2^attempt * 1000ms (1s, 2s, 4s...)
      const backoffMs = Math.pow(2, attempt) * 1000
      console.warn(`[apiFetch] Retry ${attempt + 1}/${maxRetries} after ${backoffMs}ms`, error)
      await sleep(backoffMs)
    }
  }

  throw lastError
}

async function apiFetchInternal<T>(path: string, options: Omit<ApiFetchOptions, 'retry' | 'maxRetries'> = {}): Promise<T> {
  // 构建请求URL
  // 如果path是完整URL则直接使用
  // 否则使用统一的API URL配置
  let url: string
  if (path.startsWith("http")) {
    url = path
  } else {
    const apiUrl = getApiUrl()
    url = `${apiUrl}${path}`
  }

  const headers: HeadersInit = {
    Accept: "application/json",
    ...options.headers,
  }
  const method = options.method ?? "GET"

  if (shouldIncludeCookies(url) && method !== "GET") {
    const apiBase = getApiUrl()
    ;(headers as Record<string, string>)["X-CSRF-Token"] = await ensureCSRFToken(apiBase)
  }

  // 如有可用的 access_token，则自动附加 Bearer 认证头
  // 注意：登录建链与刷新端点不附加 Authorization，避免干扰 PKCE / Token 交换
  if (!shouldOmitAuthHeader(url)) {
    const currentToken = getCurrentAccessToken()
    if (currentToken) {
      const headersRecord = headers as Record<string, string>
      const hasAuthHeader =
        Object.keys(headersRecord).some(
          (k) => k.toLowerCase() === "authorization",
        )
      if (!hasAuthHeader) {
        headersRecord["Authorization"] = `Bearer ${currentToken}`
      }
    }
  }

  // 创建超时控制器
  const controller = new AbortController()
  const timeoutId = options.timeout ? setTimeout(() => {
    controller.abort()
  }, options.timeout) : null

  // 合并用户提供的 signal 和超时 signal
  const signal = options.signal || controller.signal

  // 选择 credentials 策略：
  // - 默认 same-origin，业务 API 只走 Bearer，不自动携带 Cookie
  // - 仅对会建立/刷新/清理 refresh_token Cookie 的认证端点，在跨域时使用 include
  let credentials: RequestCredentials = 'same-origin'
  try {
    if (typeof window !== 'undefined') {
      const reqUrl = new URL(url, window.location.href)
      if (reqUrl.origin !== window.location.origin && shouldIncludeCookies(url)) {
        credentials = 'include'
      }
    }
  } catch {
    // ignore URL parsing errors
  }

  const init: RequestInit = {
    method,
    headers,
    credentials,
    signal,
  }

  if (options.body !== undefined && options.body !== null) {
    if (typeof options.body === "string" || options.body instanceof FormData) {
      init.body = options.body as string | FormData
    } else {
      ;(headers as Record<string, string>)["Content-Type"] = "application/json"
      init.body = JSON.stringify(options.body)
    }
  }

  try {
    const res = await fetch(url, init)
    updateCSRFTokenFromHeaders(res.headers, { trusted: credentials === "include" })

    // 清理超时定时器
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    if (!res.ok) {
      // 修复: 根据Content-Type只读取一次响应体
      const contentType = res.headers.get("content-type") || ""
      let detail: unknown
      try {
        if (contentType.includes("application/json")) {
          detail = await res.json()
        } else {
          detail = await res.text()
        }
      } catch {
        detail = "Failed to parse error response"
      }

      // 检查是否为账户锁定错误（403 + account_locked）
      // 如果用户已登录但被锁定，跳转到登录页面
      if (
        shouldHandleAccountLockedGlobally(url) &&
        res.status === 403 &&
        typeof detail === 'object' &&
        detail !== null
      ) {
        const errorDetail = detail as { error?: string }
        console.log("[apiFetch] 403 error detail:", errorDetail)
        if (errorDetail.error === 'account_locked') {
          handleAccountLocked(detail)
        }
      }

      throw Object.assign(new Error(`API ${res.status} ${res.statusText}`), {
        status: res.status,
        detail,
      })
    }

    const contentType = res.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      const json = await res.json()
      // 如果响应包含data字段,自动解包
      // 但如果响应包含分页元数据(total/page/total_pages),则不解包以保留完整的分页信息
      if (json && typeof json === "object" && "data" in json) {
        const hasPaginationMetadata = "total" in json || "page" in json || "total_pages" in json
        if (hasPaginationMetadata) {
          return json as T
        }
        return json.data as T
      }
      return json as T
    }
    return (await res.text()) as unknown as T
  } catch (error) {
    // 清理超时定时器
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    throw error
  }
}
