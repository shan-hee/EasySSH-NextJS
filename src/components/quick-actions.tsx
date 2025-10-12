"use client"

import * as React from "react"
import {
  Download,
  HardDriveIcon,
  RotateCcw,
  Shield,
  Trash2,
  AlertTriangle
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function QuickActions() {
  const { state } = useSidebar()

  const quickActions = [
    {
      title: "导出配置",
      icon: Download,
      variant: "outline" as const,
      action: () => console.log("Export config"),
    },
    {
      title: "清理日志",
      icon: Trash2,
      variant: "outline" as const,
      action: () => console.log("Clean logs"),
    },
    {
      title: "重启服务",
      icon: RotateCcw,
      variant: "outline" as const,
      action: () => console.log("Restart service"),
    },
    {
      title: "紧急模式",
      icon: AlertTriangle,
      variant: "destructive" as const,
      action: () => console.log("Emergency mode"),
    },
  ]

  // 折叠状态下不显示快捷操作
  if (state === "collapsed") {
    return null
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-xs font-medium text-muted-foreground">
        快捷操作
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <div className="grid grid-cols-2 gap-1 px-1">
          {quickActions.map((action) => (
            <Button
              key={action.title}
              variant={action.variant}
              size="sm"
              onClick={action.action}
              className="h-8 text-xs"
            >
              <action.icon className="h-3 w-3 mr-1" />
              {action.title}
            </Button>
          ))}
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}