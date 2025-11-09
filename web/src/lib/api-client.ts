import { getApiUrl } from "@/lib/config"

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
  token?: string
  signal?: AbortSignal
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
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

  if (options.token) {
    ;(headers as Record<string, string>)["Authorization"] = `Bearer ${options.token}`
  }

  const init: RequestInit = {
    method: options.method ?? "GET",
    headers,
    signal: options.signal,
  }

  if (options.body !== undefined && options.body !== null) {
    if (typeof options.body === "string" || options.body instanceof FormData) {
      init.body = options.body as string | FormData
    } else {
      ;(headers as Record<string, string>)["Content-Type"] = "application/json"
      init.body = JSON.stringify(options.body)
    }
  }

  const res = await fetch(url, init)
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
}

