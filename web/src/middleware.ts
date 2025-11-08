import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { getApiUrl } from "@/lib/config"

// API基础URL - middleware运行在服务端，需要使用完整的后端URL
const getApiBaseUrl = () => {
  return getApiUrl()
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. 根路径重定向到登录页
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // 2. 检查是否需要初始化管理员(对所有路由,包括登录页)
  // 跳过静态资源和API路由
  if (!pathname.startsWith("/_next") && !pathname.startsWith("/api")) {
    try {
      const apiUrl = `${getApiBaseUrl()}/auth/admin-status`
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      })

      if (response.ok) {
        const result = await response.json()
        const data = result.data || result

        // 如果需要初始化且不在setup页面,重定向到setup
        if (data.need_init && pathname !== "/setup") {
          return NextResponse.redirect(new URL("/setup", request.url))
        }

        // 如果已有管理员且在setup页面,重定向到登录页
        if (!data.need_init && pathname === "/setup") {
          return NextResponse.redirect(new URL("/login", request.url))
        }
      }
    } catch (error) {
      console.error("Middleware: Failed to check admin status:", error)
      // API调用失败时不阻塞,允许继续
    }
  }

  // 4. 已登录用户访问登录页,重定向到dashboard
  // 注意: 仅检查 cookie 存在性,不验证有效性
  // 如果 token 无效,dashboard layout 会处理重定向
  if (pathname === "/login") {
    const accessToken = request.cookies.get("easyssh_access_token")?.value
    if (accessToken) {
      // 验证 token 是否有效
      try {
        const apiUrl = `${getApiBaseUrl()}/users/me`
        const response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            "Accept": "application/json",
            "Authorization": `Bearer ${accessToken}`,
          },
          cache: "no-store",
        })

        // Token 有效,重定向到 dashboard
        if (response.ok) {
          return NextResponse.redirect(new URL("/dashboard", request.url))
        }
        // Token 无效,清除 cookie,留在登录页
        else {
          const response = NextResponse.next()
          response.cookies.delete("easyssh_access_token")
          response.cookies.delete("easyssh_refresh_token")
          return response
        }
      } catch (error) {
        console.error("Middleware: Failed to verify token:", error)
        // 验证失败,清除 cookie
        const response = NextResponse.next()
        response.cookies.delete("easyssh_access_token")
        response.cookies.delete("easyssh_refresh_token")
        return response
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径除了:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|_next).*)",
  ],
}
