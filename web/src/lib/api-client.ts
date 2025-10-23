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
  // 修复: 正确处理包含路径的基础URL
  // 如果path是完整URL则直接使用,否则拼接到baseUrl
  const url = path.startsWith("http")
    ? new URL(path)
    : new URL(`${env.apiBaseUrl}${path}`)

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

  const res = await fetch(url.toString(), init)
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

