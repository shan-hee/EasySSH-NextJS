"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import SidebarProviderServer from "@/components/sidebar-provider-server"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, useSidebar } from "@/components/ui/sidebar"
import { ClientAuthProvider } from "@/components/client-auth-provider"
import { BreadcrumbProvider } from "@/contexts/breadcrumb-context"
import { CompletionConfigProvider } from "@/contexts/completion-config-context"
import { useSystemConfig } from "@/contexts/system-config-context"
import { DashboardI18nProvider } from "@/providers/dashboard-i18n-provider"
import { getAuthRedirectDecision, getCurrentBrowserPath } from "@/lib/auth-redirect"
import type { User } from "@/lib/api/auth"
import { cn } from "@/lib/utils"

function MobileSidebarRouteCloser() {
  const pathname = usePathname()
  const { isMobile, openMobile, setOpenMobile } = useSidebar()
  const previousPathRef = useRef(pathname)

  useEffect(() => {
    if (previousPathRef.current === pathname) {
      return
    }

    previousPathRef.current = pathname

    if (isMobile && openMobile) {
      setOpenMobile(false)
    }
  }, [isMobile, openMobile, pathname, setOpenMobile])

  return null
}

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
  const pathname = usePathname()
  const { authStatus, isLoading } = useSystemConfig()
  const disableOuterScroll = pathname?.startsWith("/dashboard/ai-assistant")

  useEffect(() => {
    if (isLoading) return

    const currentPath = getCurrentBrowserPath(pathname)
    const decision = getAuthRedirectDecision("dashboard", authStatus, { currentPath })
    if (decision.type === "redirect") {
      router.replace(decision.href)
    }
  }, [authStatus, isLoading, pathname, router])

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
              <MobileSidebarRouteCloser />
              <AppSidebar />
              <SidebarInset>
                {/* 添加淡入动画，使界面显示更平滑 */}
                <div
                  className={cn(
                    "animate-in fade-in duration-300 flex flex-1 flex-col min-h-0 scrollbar-custom",
                    disableOuterScroll ? "overflow-hidden" : "overflow-auto"
                  )}
                >
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
