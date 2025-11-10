import { cookies } from "next/headers"
import { apiFetch } from "./api-client"
import type { HttpMethod } from "./api-client"

/**
 * Next.js 缓存选项
 */
export interface CacheOptions {
  /**
   * 重新验证时间（秒）
   * - false: 永不重新验证
   * - 0: 每次请求都重新验证
   * - number: 指定秒数后重新验证
   */
  revalidate?: number | false
  /**
   * 缓存标签，用于按需重新验证
   */
  tags?: string[]
}

/**
 * 服务端 API 调用包装器
 * 自动从 cookies 获取 token 并调用 API
 * 支持 Next.js 缓存和重新验证
 *
 * @param path - API 路径
 * @param options - 请求选项
 * @returns API 响应数据
 * @throws 如果没有 token 或 API 调用失败
 */
export async function serverApiFetch<T>(
  path: string,
  options: {
    method?: HttpMethod
    headers?: HeadersInit
    body?: unknown
    signal?: AbortSignal
    cache?: CacheOptions
  } = {}
): Promise<T> {
  // Cookie-only：无需读取/校验 token，apiFetch 会在服务端将 Cookie 透传给后端
  return apiFetch<T>(path, { ...options })
}

/**
 * 检查是否有服务端 token
 * 用于条件渲染或逻辑判断
 */
export async function hasServerToken(): Promise<boolean> {
  const cookieStore = cookies()
  return !!cookieStore.get("easyssh_access_token")?.value
}
