/**
 * 服务端认证工具函数（Cookie-Only）
 * Server Components 中基于 HttpOnly Cookie 校验用户
 */

import { cookies } from "next/headers"
import { type User } from "@/lib/api/auth"
import { getApiUrl } from "./config"

/**
 * 在服务端验证认证状态（将当前请求 Cookie 转发给后端）
 * @returns 用户信息或 null(未认证)
 */
export async function verifyAuth(): Promise<User | null> {
  try {
    const cookieStore = await cookies()
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ")

    const url = `${getApiUrl()}/users/me`
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        // 将前端请求的 Cookie 透传给后端，便于后端基于 Cookie 认证
        Cookie: cookieHeader,
      },
      cache: "no-store",
    })

    if (!response.ok) return null

    const json = await response.json()
    return (json && typeof json === "object" && "data" in json ? json.data : json) as User
  } catch (error) {
    console.error("[Auth Server] verifyAuth failed:", error)
    return null
  }
}
