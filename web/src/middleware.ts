import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// API基础URL
const getApiBaseUrl = () => {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8521/api/v1"
}

// 公开路由(不需要认证)
const PUBLIC_ROUTES = ["/login", "/setup"]

// 受保护路由(需要认证)
const PROTECTED_ROUTES = ["/dashboard"]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. 根路径重定向到登录页
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // 2. 检查是否需要初始化管理员(对所有非公开路由)
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route))

  if (!isPublicRoute && !pathname.startsWith("/_next") && !pathname.startsWith("/api")) {
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
      }
    } catch (error) {
      console.error("Middleware: Failed to check admin status:", error)
      // API调用失败时不阻塞,允许继续
    }
  }

  // 3. 如果访问setup但已有管理员,重定向到登录页
  if (pathname === "/setup") {
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

        // 已有管理员,重定向到登录页
        if (!data.need_init) {
          return NextResponse.redirect(new URL("/login", request.url))
        }
      }
    } catch (error) {
      console.error("Middleware: Failed to check admin status on /setup:", error)
    }
  }

  // 4. 已登录用户访问登录页,重定向到dashboard
  if (pathname === "/login") {
    const accessToken = request.cookies.get("easyssh_access_token")?.value
    if (accessToken) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
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
