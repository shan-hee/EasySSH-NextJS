"use client"

import * as React from "react"
import {
  ChevronsUpDown,
  LogOut,
  Settings,
} from "lucide-react"

import { SmartAvatar } from "@/components/ui/smart-avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { SettingsDialog } from "@/components/settings-dialog"
import { useClientAuth } from "@/components/client-auth-provider"

export const NavUser = React.memo(function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar?: string
  }
}) {
  const { isMobile } = useSidebar()
  const { logout } = useClientAuth()

  const handleSettingsSelect = React.useCallback((e: Event) => {
    e.preventDefault()
  }, [])

  const handleLogout = React.useCallback(async () => {
    try {
      await logout()
    } catch (error) {
      console.error("Logout failed:", error)
    }
  }, [logout])

  
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <SmartAvatar
                className="h-8 w-8 rounded-lg"
                src={user.avatar || undefined}
                displayName={user.name}
                username={user.name}
                email={user.email}
              />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <SmartAvatar
                  className="h-8 w-8 rounded-lg"
                  src={user.avatar || undefined}
                  displayName={user.name}
                  username={user.name}
                  email={user.email}
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <SettingsDialog>
              <DropdownMenuItem onSelect={handleSettingsSelect}>
                <Settings />
                设置
              </DropdownMenuItem>
            </SettingsDialog>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
})
