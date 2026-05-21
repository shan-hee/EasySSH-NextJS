"use client"

import * as React from "react"
import { Server } from "lucide-react"
import { useTranslations } from "next-intl"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { NavExtra } from "@/components/nav-extra"
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
import { buildNavigationItems } from "@/shell/navigation"
import { isDesktopRuntime, useRuntimeInfo } from "@/shell/runtime"

export const AppSidebar = React.memo(function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useClientAuth()
  const { config } = useSystemConfig()
  const { data: runtime } = useRuntimeInfo()
  const tNav = useTranslations("nav")
  const isDesktop = isDesktopRuntime(runtime)

  // 检查用户是否为管理员
  const isAdmin = user?.role === "admin"

  // 导航数据 - 根据当前语言、用户角色和运行形态动态构建
  const navMainData = React.useMemo(
    () => buildNavigationItems({ runtime, isAdmin, t: tNav }),
    [runtime, tNav, isAdmin],
  )

  // 动态构建 teams 数据
  const teamsData = React.useMemo(() => [{
    name: config?.system_name || "EasySSH",
    logo: Server,
    plan: isDesktop ? tNav("planDesktop") : tNav("planPro"),
  }], [config?.system_name, isDesktop, tNav])

  const all = navMainData

  // 基于注册表 group 分组：工作台 / 核心功能 / 可观测与审计 / 设置
  const groupWorkbench = React.useMemo(
    () => all.filter((i) => i.group === "workbench"),
    [all],
  )
  const groupCore = React.useMemo(
    () => all.filter((i) => i.group === "core"),
    [all]
  )
  const groupObserveAudit = React.useMemo(
    () => all.filter((i) => i.group === "observeAudit"),
    [all]
  )
  const groupSettings = React.useMemo(
    () => all.filter((i) => i.group === "settings"),
    [all],
  )

  // 构建真实用户数据
  const userData = React.useMemo(() => {
    if (!user) {
      return null
    }
    return {
      name: isDesktop ? tNav("localWorkspace") : user.username,
      email: isDesktop ? (runtime?.data_dir || tNav("planDesktop")) : user.email,
      avatar: user.avatar,
    }
  }, [isDesktop, runtime?.data_dir, tNav, user])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teamsData} />
      </SidebarHeader>
      <SidebarContent>
        <QuickAccess runtime={runtime} />
        {groupWorkbench.length > 0 && <NavMain label={isDesktop ? tNav("localWorkspace") : tNav("workbench")} items={groupWorkbench} />}
        {groupCore.length > 0 && <NavMain label={tNav("coreServers")} items={groupCore} />}
        {groupObserveAudit.length > 0 && <NavMain label={tNav("observeAudit")} items={groupObserveAudit} />}
        {groupSettings.length > 0 && <NavMain label={isDesktop ? tNav("settingsPlain") : tNav("settings")} items={groupSettings} />}
      </SidebarContent>
      <SidebarFooter>
        <NavExtra />
        {/* 用户信息区域：加载时显示占位，加载完成后显示真实内容 */}
        {userData ? (
          <NavUser user={userData} runtime={runtime} />
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
