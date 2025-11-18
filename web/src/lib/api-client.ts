import { getApiUrl } from "@/lib/config"

// 全局刷新会话 Promise，避免并发重复刷新
let refreshPromise: Promise<void> | null = null

// 全局 401 处理标记，避免重复跳转
let hasRedirectedFor401 = false

function handleGlobalUnauthorized(error: unknown) {
  if (typeof window === 'undefined') return
  if (hasRedirectedFor401) return
  hasRedirectedFor401 = true

  // 打一条调试日志，方便排查
  console.error("[apiFetch] Unauthorized, redirecting to /login", error)

  const currentPath = window.location.pathname + window.location.search + window.location.hash
  // 避免在登录页上再次重定向自己
  if (!currentPath.startsWith("/login")) {
    try {
      const params = new URLSearchParams()
      if (currentPath && currentPath !== "/") {
        params.set("next", currentPath)
      }
      const query = params.toString()
      window.location.href = query ? `/login?${query}` : "/login"
    } catch {
      window.location.href = "/login"
    }
  } else {
    window.location.reload()
  }
}

async function refreshSession(): Promise<void> {
  if (typeof window === 'undefined') {
    // 仅在浏览器端执行刷新；服务端不做刷新以免无法设置浏览器 Cookie
    throw new Error('Refresh not supported on server')
  }
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    const apiUrl = getApiUrl()
    const url = `${apiUrl}/auth/refresh`

    // 根据是否跨域选择 credentials 策略，保持与 apiFetchInternal 一致
    let credentials: RequestCredentials = 'same-origin'
    try {
      if (typeof window !== 'undefined') {
        const reqUrl = new URL(url, window.location.href)
        if (reqUrl.origin !== window.location.origin) {
          credentials = 'include'
        }
      }
    } catch {
      // 忽略 URL 解析错误，回退到 same-origin
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}), // 刻意不传 refresh_token，后端将从 Cookie 读取
      credentials,
    })
    if (!res.ok) {
      throw new Error(`Refresh failed: ${res.status}`)
    }
    // 刷新成功，后端通过 Set-Cookie 更新会话，无需处理响应体
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
      // 401 处理：仅在浏览器端尝试用 Cookie 刷新并重放一次
      if (typeof window !== 'undefined' && isApiError(error) && error.status === 401) {
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

/**
 * 内部 fetch 实现,支持超时
 */
async function apiFetchInternal<T>(path: string, options: Omit<ApiFetchOptions, 'retry' | 'maxRetries'> = {}): Promise<T> {
  // 构建请求URL
  // 如果path是完整URL则直接使用
  // 否则使用统一的API URL配置
  let url: string
  if (path.startsWith("http")) {
    url = path
  } else {
    const apiUrl = getApiUrl()
    // getApiUrl() 在客户端返回相对路径 /api
    // 在服务端返回完整 URL http://backend:8521/api/v1
    url = `${apiUrl}${path}`
  }

  const headers: HeadersInit = {
    Accept: "application/json",
    ...options.headers,
  }

  // 创建超时控制器
  const controller = new AbortController()
  const timeoutId = options.timeout ? setTimeout(() => {
    controller.abort()
  }, options.timeout) : null

  // 合并用户提供的 signal 和超时 signal
  const signal = options.signal || controller.signal

  // 选择 credentials 策略：
  // - 默认 same-origin
  // - 若在浏览器端且请求为跨源绝对 URL，则自动使用 include 以携带 Cookie（跨域直连场景）
  let credentials: RequestCredentials = 'same-origin'
  try {
    if (typeof window !== 'undefined') {
      const reqUrl = new URL(url, window.location.href)
      if (reqUrl.origin !== window.location.origin) {
        credentials = 'include'
      }
    }
  } catch {
    // ignore URL parsing errors
  }

  const init: RequestInit = {
    method: options.method ?? "GET",
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
      throw Object.assign(new Error(`API ${res.status} ${res.statusText}`), {
        status: res.status,
        detail,
      })
    }

    const contentType = res.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      const json = await res.json()
      // 如果响应包含data字段,自动解包
      if (json && typeof json === "object" && "data" in json) {
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
