import SidebarProviderServer from "@/components/sidebar-provider-server"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProviderServer>
      <AppSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProviderServer>
  )
}

