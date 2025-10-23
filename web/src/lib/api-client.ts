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
  const url = new URL(path, env.apiBaseUrl)

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
    let detail: unknown
    try {
      detail = await res.json()
    } catch {
      detail = await res.text()
    }
    throw Object.assign(new Error(`API ${res.status} ${res.statusText}`), {
      status: res.status,
      detail,
    })
  }

  const contentType = res.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    return (await res.json()) as T
  }
  return (await res.text()) as unknown as T
}

