"use client"

import * as React from "react"
import { PanelLeftIcon } from "lucide-react"
import Image from "next/image"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"

export function TeamSwitcher({
  teams,
}: {
  teams: {
    name: string
    logo: React.ElementType
    plan: string
  }[]
}) {
  const { state, toggleSidebar } = useSidebar()
  const activeTeam = teams[0]

  if (!activeTeam) {
    return null
  }

  // 在折叠状态下，显示可悬浮展开的logo
  if (state === "collapsed") {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            onClick={toggleSidebar}
            className="hover:bg-sidebar-accent group relative"
            tooltip="展开侧边栏"
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
              <Image
                src="/logo.svg"
                alt="EasySSH Logo"
                width={24}
                height={24}
                className="size-6"
              />
            </div>
            {/* 悬浮时显示展开按钮 */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-sidebar-accent rounded-md">
              <PanelLeftIcon className="size-4" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  // 在展开状态下，显示logo + 文字 + 折叠按钮
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex items-center justify-between w-full p-2">
          {/* Logo + EasySSH 文字 */}
          <div className="flex items-center gap-2">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
              <Image
                src="/logo.svg"
                alt="EasySSH Logo"
                width={24}
                height={24}
                className="size-6"
              />
            </div>
            <span className="font-medium text-sm">{activeTeam.name}</span>
          </div>

          {/* 折叠按钮 */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="size-7 hover:bg-sidebar-accent"
          >
            <PanelLeftIcon className="size-4" />
            <span className="sr-only">折叠侧边栏</span>
          </Button>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
