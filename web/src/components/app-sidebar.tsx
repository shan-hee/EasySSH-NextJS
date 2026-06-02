"use client"

import * as React from "react"
import { Server } from "lucide-react"
import { useTranslations } from "next-intl"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { QuickAccess } from "@/components/quick-access"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import { useClientAuth } from "@/components/client-auth-provider"
import { useSystemConfig } from "@/contexts/system-config-context"
import { useRuntime } from "@/shell/runtime/runtime-provider"
import { buildNavigationGroups } from "@/shell/navigation/navigation-registry"

export const AppSidebar = React.memo(function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useClientAuth()
  const { config } = useSystemConfig()
  const { runtime } = useRuntime()
  const tNav = useTranslations("nav")

  // 检查用户是否为管理员
  const isAdmin = user?.role === "admin" || runtime?.principal.role === "owner"

  const navigationGroups = React.useMemo(() => buildNavigationGroups({
    runtime,
    isAdmin,
    t: tNav,
  }), [isAdmin, runtime, tNav])

  // 动态构建 teams 数据
  const teamsData = React.useMemo(() => [{
    name: config?.system_name || "EasySSH",
    logo: Server,
    plan: tNav("planPro"),
  }], [config?.system_name, tNav])

  // 构建真实用户数据
  const userData = React.useMemo(() => {
    if (!user) {
      return null
    }
    return {
      name: user.username,
      email: user.email,
      avatar: user.avatar,
    }
  }, [user])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teamsData} />
      </SidebarHeader>
      <SidebarContent>
        <QuickAccess />
        {navigationGroups.workbench.length > 0 && <NavMain label={tNav("workbench")} items={navigationGroups.workbench} />}
        {navigationGroups.core.length > 0 && <NavMain label={tNav("coreServers")} items={navigationGroups.core} />}
        {navigationGroups.observeAudit.length > 0 && <NavMain label={tNav("observeAudit")} items={navigationGroups.observeAudit} />}
        {navigationGroups.settings.length > 0 && <NavMain label={tNav("systemOrg")} items={navigationGroups.settings} />}
      </SidebarContent>
      <SidebarFooter>
        {/* 用户信息区域：加载时显示占位，加载完成后显示真实内容 */}
        {userData ? (
          <NavUser user={userData} />
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" className="pointer-events-none">
                <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
                <div className="grid flex-1 text-left text-sm leading-tight gap-0.5">
                  <div className="h-3.5 w-20 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                </div>
                <div className="ml-auto h-4 w-4 bg-muted rounded animate-pulse" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
})
