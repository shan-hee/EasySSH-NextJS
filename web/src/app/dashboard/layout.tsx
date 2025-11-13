"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import SidebarProviderServer from "@/components/sidebar-provider-server"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { ClientAuthProvider } from "@/components/client-auth-provider"
import { BreadcrumbProvider } from "@/contexts/breadcrumb-context"
import { authApi, type User } from "@/lib/api/auth"
import { getErrorMessage } from "@/lib/error-utils"

/**
 * Dashboard 布局 - Client Component
 * 纯 CSR 模式：在客户端验证认证状态
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await authApi.getCurrentUser()
        setUser(currentUser)
      } catch (error: unknown) {
        console.error("Authentication failed:", getErrorMessage(error))
        router.push("/login")
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [router])

  // 加载中：显示空白或骨架屏
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  // 未认证：不渲染（已重定向）
  if (!user) {
    return null
  }

  // 已认证：渲染 Dashboard
  return (
    <ClientAuthProvider initialUser={user}>
      <BreadcrumbProvider>
        <SidebarProviderServer>
          <AppSidebar />
          <SidebarInset>{children}</SidebarInset>
        </SidebarProviderServer>
      </BreadcrumbProvider>
    </ClientAuthProvider>
  )
}

