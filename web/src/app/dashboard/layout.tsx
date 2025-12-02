"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import SidebarProviderServer from "@/components/sidebar-provider-server"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { ClientAuthProvider } from "@/components/client-auth-provider"
import { BreadcrumbProvider } from "@/contexts/breadcrumb-context"
import { CompletionConfigProvider } from "@/contexts/completion-config-context"
import { useSystemConfig } from "@/contexts/system-config-context"
import { DashboardI18nProvider } from "@/providers/dashboard-i18n-provider"
import type { User } from "@/lib/api/auth"

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
  const { authStatus, isLoading } = useSystemConfig()

  useEffect(() => {
    if (isLoading) return

    // 如果加载失败（authStatus 为空），按未认证处理
    if (!authStatus) {
      router.replace("/login")
      return
    }

    // 需要初始化 → 跳转到 /setup
    if (authStatus.need_init) {
      router.replace("/setup")
      return
    }

    // 未认证 → 跳转到登录
    if (!authStatus.is_authenticated) {
      router.replace("/login")
      return
    }
  }, [authStatus, isLoading, router])

  const initialUser: User | null =
    authStatus && authStatus.is_authenticated && authStatus.user
      ? authStatus.user
      : null

  // 乐观渲染：立即显示界面，后台验证
  // 如果验证失败，会自动跳转到登录页
  return (
    <ClientAuthProvider initialUser={initialUser}>
      <DashboardI18nProvider>
        <CompletionConfigProvider>
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
        </CompletionConfigProvider>
      </DashboardI18nProvider>
    </ClientAuthProvider>
  )
}
