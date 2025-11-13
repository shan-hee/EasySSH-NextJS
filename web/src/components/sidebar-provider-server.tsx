"use client"

import { useEffect, useState } from "react"
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
  const [defaultOpen, setDefaultOpen] = useState(true)

  useEffect(() => {
    // 从 localStorage 读取侧边栏状态
    const persisted = localStorage.getItem("sidebar_state")
    if (persisted !== null) {
      setDefaultOpen(persisted === "true")
    }
  }, [])

  return (
    <SidebarProvider defaultOpen={defaultOpen} className={className}>
      {children}
    </SidebarProvider>
  )
}
