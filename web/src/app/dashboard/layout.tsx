import { redirect } from "next/navigation"
import SidebarProviderServer from "@/components/sidebar-provider-server"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { verifyAuth } from "@/lib/auth-server"
import { ClientAuthProvider } from "@/components/client-auth-provider"
import { BreadcrumbProvider } from "@/contexts/breadcrumb-context"

/**
 * Dashboard 布局 - Server Component
 * 在服务端验证认证状态,避免客户端加载闪烁
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 服务端验证认证状态
  const user = await verifyAuth()

  // 未认证:重定向到登录页
  if (!user) {
    redirect("/login")
  }

  // 已认证:渲染 Dashboard 并传递初始用户数据
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

