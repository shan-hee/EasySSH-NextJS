import { cookies } from "next/headers"
import { SidebarProvider } from "@/components/ui/sidebar"

export default function SidebarProviderServer({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const persisted = cookies().get("sidebar_state")?.value === "true"
  return (
    <SidebarProvider defaultOpen={persisted} className={className}>
      {children}
    </SidebarProvider>
  )
}

