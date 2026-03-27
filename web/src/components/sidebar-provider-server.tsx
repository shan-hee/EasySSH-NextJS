"use client"

import { useState } from "react"
import { SidebarProvider } from "@/components/ui/sidebar"

/**
 * 客户端侧边栏提供者
 * 纯 CSR 模式：从 localStorage 读取侧边栏状态
 */
export default function SidebarProviderServer({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const [defaultOpen] = useState(() => {
    if (typeof window === "undefined") {
      return true
    }

    const persisted = localStorage.getItem("sidebar_state")
    return persisted !== null ? persisted === "true" : true
  })

  return (
    <SidebarProvider defaultOpen={defaultOpen} className={className}>
      {children}
    </SidebarProvider>
  )
}
