"use client"

import * as React from "react"
import { PanelLeft } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export const TeamSwitcher = React.memo(function TeamSwitcher({
  teams,
}: {
  teams: {
    name: string
    logo: React.ElementType
    plan: string
  }[]
}) {
  const { toggleSidebar, state } = useSidebar()
  const router = useRouter()
  const activeTeam = teams[0]

  const handleToggleSidebar = React.useCallback(() => {
    toggleSidebar()
  }, [toggleSidebar])

  // 侧边栏展开时点击logo和文字返回主页
  const handleLogoClick = React.useCallback(() => {
    if (state === "expanded") {
      router.push("/dashboard")
    } else {
      toggleSidebar()
    }
  }, [state, router, toggleSidebar])

  if (!activeTeam) {
    return null
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex items-center w-full">
          {/* Logo和文字区域 */}
          <SidebarMenuButton
            size="lg"
            className="flex-1 group-data-[collapsible=icon]:hover:bg-sidebar-accent group relative group-data-[collapsible=icon]:cursor-ew-resize group-data-[state=expanded]:cursor-pointer group-data-[state=expanded]:hover:bg-sidebar-accent"
            aria-label={state === "expanded" ? "返回主页" : "展开侧边栏"}
            onClick={handleLogoClick}
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg relative">
              {/* 默认显示的logo */}
              <Image
                src="/logo.svg"
                alt="EasySSH Logo"
                width={24}
                height={24}
                className="size-6 group-data-[collapsible=icon]:group-hover:opacity-0 transition-opacity"
              />
              {/* 悬浮时显示的展开按钮 - 仅在折叠状态下 */}
              <PanelLeft className="size-4 absolute inset-0 m-auto opacity-0 group-data-[collapsible=icon]:group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{activeTeam.name}</span>
            </div>
          </SidebarMenuButton>

          {/* 独立的折叠按钮 - 在折叠状态下隐藏 */}
          <button
            onClick={handleToggleSidebar}
            className="flex items-center justify-center size-8 rounded hover:bg-sidebar-accent ml-1 group-data-[collapsible=icon]:hidden cursor-ew-resize"
            aria-label="折叠侧边栏"
          >
            <PanelLeft className="size-4" />
          </button>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  )
})
