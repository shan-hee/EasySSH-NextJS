import { cookies } from "next/headers"
import { SidebarProvider } from "@/components/ui/sidebar"

export default async function SidebarProviderServer({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const cookieStore = await cookies()
  const persisted = cookieStore.get("sidebar_state")?.value === "true"
  return (
    <SidebarProvider defaultOpen={persisted} className={className}>
      {children}
    </SidebarProvider>
  )
}

