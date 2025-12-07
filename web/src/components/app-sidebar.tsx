"use client"

import * as React from "react"
import {
  Settings2,
  Server,
  Monitor,
  Terminal,
  FileText,
  FolderOpen,
  Activity,
  Users,
} from "lucide-react"
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

export const AppSidebar = React.memo(function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useClientAuth()
  const { config } = useSystemConfig()
  const tNav = useTranslations("nav")

  // 导航数据 - 根据当前语言动态构建
  const navMainData = React.useMemo(
    () => [
      {
        title: tNav("console"),
        url: "/dashboard",
        icon: Monitor,
        isActive: true,
      },
      {
        title: tNav("connections"),
        url: "#",
        icon: Server,
        items: [
          { title: tNav("connectionConfigs"), url: "/dashboard/servers" },
          { title: tNav("connectionHistory"), url: "/dashboard/servers/history" },
        ],
      },
      {
        title: tNav("automation"),
        url: "#",
        icon: Terminal,
        items: [
          { title: tNav("scripts"), url: "/dashboard/scripts" },
          { title: tNav("schedules"), url: "/dashboard/automation/schedules" },
          { title: tNav("executions"), url: "/dashboard/automation/history" },
        ],
      },
      {
        title: tNav("file"),
        url: "#",
        icon: FolderOpen,
        items: [
          { title: tNav("fileManager"), url: "/dashboard/sftp" },
          { title: tNav("transferHistory"), url: "/dashboard/transfers/history" },
          { title: tNav("storage"), url: "/dashboard/storage" },
        ],
      },
      {
        title: tNav("logs"),
        url: "#",
        icon: FileText,
        items: [
          { title: tNav("logsOperations"), url: "/dashboard/logs" },
          { title: tNav("logsLogin"), url: "/dashboard/logs/login" },
        ],
      },
      {
        title: tNav("userManagement"),
        url: "/dashboard/users",
        icon: Users,
      },
      {
        title: tNav("systemSettings"),
        url: "/dashboard/settings",
        icon: Settings2,
      },
    ],
    [tNav],
  )

  // 动态构建 teams 数据
  const teamsData = React.useMemo(() => [{
    name: config?.system_name || "EasySSH",
    logo: Server,
    plan: tNav("planPro"),
  }], [config?.system_name, tNav])

  const all = navMainData

  // 基于标题分组：工作台 / 核心功能 / 可观测与审计 / 平台设置
  const groupWorkbench = React.useMemo(
    () => all.filter((i) => i.url === "/dashboard"),
    [all],
  )
  const groupCore = React.useMemo(
    () => all.filter((i) => [tNav("connections"), tNav("automation"), tNav("file")].includes(i.title)),
    [all]
  )
  const groupObserveAudit = React.useMemo(
    () => all.filter((i) => [tNav("logs")].includes(i.title)),
    [all, tNav]
  )
  const groupSettings = React.useMemo(
    () => all.filter((i) => [tNav("userManagement"), tNav("systemSettings")].includes(i.title)),
    [all, tNav],
  )

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
        {groupWorkbench.length > 0 && <NavMain label={tNav("workbench")} items={groupWorkbench} />}
        {groupCore.length > 0 && <NavMain label={tNav("coreServers")} items={groupCore} />}
        {groupObserveAudit.length > 0 && <NavMain label={tNav("observeAudit")} items={groupObserveAudit} />}
        {groupSettings.length > 0 && <NavMain label={tNav("settings")} items={groupSettings} />}
      </SidebarContent>
      <SidebarFooter>
        <NavExtra />
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
