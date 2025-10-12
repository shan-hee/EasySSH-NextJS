"use client"

import * as React from "react"
import { Plus, Search, Zap, Smartphone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function QuickAccess() {
  const [searchQuery, setSearchQuery] = React.useState("")
  const { state } = useSidebar()

  const quickActions = [
    {
      title: "快速连接",
      icon: Zap,
      description: "连接最近使用的服务器",
      action: () => console.log("Quick connect"),
    },
    {
      title: "添加服务器",
      icon: Plus,
      description: "添加新的SSH服务器",
      action: () => console.log("Add server"),
    },
    {
      title: "移动终端",
      icon: Smartphone,
      description: "打开移动适配终端",
      action: () => console.log("Mobile terminal"),
    },
  ]

  // 折叠状态下不显示这个组件
  if (state === "collapsed") {
    return null
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-xs font-medium text-muted-foreground">
        快速访问
      </SidebarGroupLabel>
      <SidebarGroupContent>
        {/* 全局搜索 */}
        <div className="px-2 pb-2">
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
          {quickActions.map((action) => (
            <SidebarMenuItem key={action.title}>
              <SidebarMenuButton
                onClick={action.action}
                tooltip={action.description}
                size="sm"
                className="h-8"
              >
                <action.icon className="h-4 w-4" />
                <span className="text-sm">{action.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}