import SidebarProviderServer from "@/components/sidebar-provider-server"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { AuthGuard } from "@/components/auth-guard"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <SidebarProviderServer>
        <AppSidebar />
        <SidebarInset>{children}</SidebarInset>
      </SidebarProviderServer>
    </AuthGuard>
  )
}

