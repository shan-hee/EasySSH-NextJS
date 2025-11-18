"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import SidebarProviderServer from "@/components/sidebar-provider-server"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { ClientAuthProvider } from "@/components/client-auth-provider"
import { BreadcrumbProvider } from "@/contexts/breadcrumb-context"
import { authApi, type User } from "@/lib/api/auth"
import { isApiError } from "@/lib/api-client"
import { getErrorMessage } from "@/lib/error-utils"

/**
 * Dashboard 布局 - Client Component
 * 乐观渲染模式：先渲染界面，后台静默验证认证状态
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isVerifying, setIsVerifying] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // 获取当前用户信息
        // 注意：如果从首页跳转过来，首页的 checkStatus() 可能已经获取了用户信息
        // 未来可以考虑通过 state 传递来避免重复请求
        const currentUser = await authApi.getCurrentUser()
        setUser(currentUser)
      } catch (error: unknown) {
        console.error("Authentication failed:", getErrorMessage(error))
        // 401 会在 apiFetch 的全局处理里统一跳转到登录页
        // 这里只处理非 401 的异常情况,作为兜底
        if (!isApiError(error) || error.status !== 401) {
          router.push("/login")
        }
      } finally {
        setIsVerifying(false)
      }
    }

    checkAuth()
  }, [router])

  // 乐观渲染：立即显示界面，后台验证
  // 如果验证失败，会自动跳转到登录页
  return (
    <ClientAuthProvider initialUser={user}>
      <BreadcrumbProvider>
        <SidebarProviderServer>
          <AppSidebar />
          <SidebarInset>
            {/* 添加淡入动画，使界面显示更平滑 */}
            <div className="animate-in fade-in duration-300 flex flex-1 flex-col min-h-0">
              {children}
            </div>
          </SidebarInset>
        </SidebarProviderServer>
      </BreadcrumbProvider>
    </ClientAuthProvider>
  )
}
