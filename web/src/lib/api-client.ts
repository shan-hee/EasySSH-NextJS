import { env } from "@/lib/env"

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

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
  // 如果apiBaseUrl是相对路径,直接拼接(用于反向代理)
  // 如果apiBaseUrl是完整URL,使用URL构造器拼接
  let url: string
  if (path.startsWith("http")) {
    url = path
  } else if (env.apiBaseUrl.startsWith("http")) {
    // 完整URL: http://localhost:8521/api/v1
    url = new URL(`${env.apiBaseUrl}${path}`).toString()
  } else {
    // 相对路径: /api/v1
    url = `${env.apiBaseUrl}${path}`
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

