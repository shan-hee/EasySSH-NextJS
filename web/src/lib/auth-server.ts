/**
 * 服务端认证工具函数
 * 用于 Server Components 中验证用户认证状态
 */

import { cookies } from "next/headers"
import { type User } from "@/lib/api/auth"

const TOKEN_KEY = "easyssh_access_token"
const REFRESH_TOKEN_KEY = "easyssh_refresh_token"

/**
 * 从环境变量获取API基础URL
 * 服务端需要使用完整的后端URL，不能用相对路径
 */
function getApiBaseUrl(): string {
  return process.env.BACKEND_URL
    ? `${process.env.BACKEND_URL}/api/v1`
    : "http://localhost:8521/api/v1"
}

/**
 * 在服务端验证认证状态
 * @returns 用户信息或 null(未认证)
 */
export async function verifyAuth(): Promise<User | null> {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get(TOKEN_KEY)?.value
    const refreshToken = cookieStore.get(REFRESH_TOKEN_KEY)?.value

    if (!accessToken) {
      return null
    }

    // 尝试使用 access token 获取用户信息
    try {
      const user = await getCurrentUser(accessToken)
      return user
    } catch (_error) {
      // Access token 可能过期,尝试使用 refresh token
      if (refreshToken) {
        try {
          const newTokens = await refreshAccessToken(refreshToken)

          // 设置新的 cookies
          const cookieStore = await cookies()
          cookieStore.set(TOKEN_KEY, newTokens.access_token, {
            path: "/",
            maxAge: 3600, // 1小时
            sameSite: "lax",
            httpOnly: false, // 需要客户端访问
          })
          cookieStore.set(REFRESH_TOKEN_KEY, newTokens.refresh_token, {
            path: "/",
            maxAge: 604800, // 7天
            sameSite: "lax",
            httpOnly: false,
          })

          // 使用新 token 获取用户信息
          const user = await getCurrentUser(newTokens.access_token)
          return user
        } catch (_refreshError) {
          // Refresh token 也失败,不要在这里删除 cookies
          // 返回 null,让调用方处理重定向
          console.warn("[Auth Server] Refresh token failed, auth required")
          return null
        }
      }

      return null
    }
  } catch (error) {
    console.error("[Auth Server] Verification failed:", error)
    return null
  }
}

/**
 * 获取当前用户信息
 */
async function getCurrentUser(token: string): Promise<User> {
  const url = `${getApiBaseUrl()}/users/me`

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    cache: "no-store", // 不缓存认证请求
  })

  if (!response.ok) {
    throw new Error(`Failed to get current user: ${response.status}`)
  }

  const json = await response.json()

  // 自动解包 data 字段
  if (json && typeof json === "object" && "data" in json) {
    return json.data as User
  }

  return json as User
}

/**
 * 刷新访问令牌
 */
async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string
  refresh_token: string
}> {
  const url = `${getApiBaseUrl()}/auth/refresh`

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${response.status}`)
  }

  const json = await response.json()

  // 自动解包 data 字段
  if (json && typeof json === "object" && "data" in json) {
    return json.data
  }

  return json
}

/**
 * 获取服务端的访问令牌(用于传递给客户端组件)
 */
export async function getServerAccessToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(TOKEN_KEY)?.value || null
}
