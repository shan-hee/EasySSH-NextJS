"use client"

import * as React from "react"
import { Plus, Search, Zap, Bot } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { Input } from "@/components/ui/input"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function QuickAccess() {
  const [searchQuery, setSearchQuery] = React.useState("")
  const pathname = usePathname()

  const quickActions: Array<{
    title: string
    icon: React.ComponentType<{ className?: string }>
    description: string
    href?: string
    action?: () => void
  }> = [
    {
      title: "快速连接",
      icon: Zap,
      description: "打开终端并快速连接",
      href: "/dashboard/terminal",
    },
    {
      title: "添加服务器",
      icon: Plus,
      description: "添加新的SSH服务器",
      href: "/dashboard/servers",
    },
    {
      title: "AI助手",
      icon: Bot,
      description: "把需求交给AI，生成计划并执行",
      href: "/dashboard/ai-assistant",
    },
  ]

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-xs font-medium text-muted-foreground">
        快速访问
      </SidebarGroupLabel>
      <SidebarGroupContent>
        {/* 全局搜索 */}
        <div className="px-2 pb-2 group-data-[collapsible=icon]:hidden">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索服务器、命令..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        {/* 快速操作按钮 */}
        <SidebarMenu>
          {quickActions.map((qa) => {
            const baseHref = qa.href?.split("?")[0]
            // 精确匹配当前路径,避免前缀匹配导致误判
            const isActive = !!baseHref && pathname === baseHref
            return (
              <SidebarMenuItem key={qa.title}>
                {qa.href ? (
                  <SidebarMenuButton asChild tooltip={qa.description} size="sm" className="h-8" isActive={isActive}>
                    <Link href={qa.href} aria-current={isActive ? "page" : undefined}>
                      <qa.icon className="h-4 w-4" />
                      <span className="text-sm">{qa.title}</span>
                    </Link>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton onClick={qa.action} tooltip={qa.description} size="sm" className="h-8">
                    <qa.icon className="h-4 w-4" />
                    <span className="text-sm">{qa.title}</span>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
