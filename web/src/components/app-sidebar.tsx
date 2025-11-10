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
} from "lucide-react"

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
} from "@/components/ui/sidebar"
import { useClientAuth } from "@/components/client-auth-provider"
import { useSystemConfig } from "@/contexts/system-config-context"

// 导航数据 - 静态部分
const navMainData = [
  {
    title: "控制台",
    url: "/dashboard",
    icon: Monitor,
    isActive: true,
    // 无子级,点击即进入控制台概览
  },
  // 移除工作台中的"AI 助手"入口，仅保留快速访问中的 AI 助手
  {
    title: "连接管理",
    url: "#",
    icon: Server,
    items: [
      { title: "连接配置", url: "/dashboard/servers" },
      { title: "历史连接", url: "/dashboard/servers/history" },
    ],
  },
  {
    title: "自动化",
    url: "#",
    icon: Terminal,
    items: [
      { title: "脚本库", url: "/dashboard/scripts" },
      { title: "任务调度", url: "/dashboard/automation/schedules" },
      { title: "执行记录", url: "/dashboard/automation/history" },
      { title: "批量操作", url: "/dashboard/automation/batch" },
    ],
  },
  {
    title: "文件管理",
    url: "#",
    icon: FolderOpen,
    items: [
      { title: "文件管理器", url: "/dashboard/sftp" },
      { title: "传输记录", url: "/dashboard/transfers/history" },
      { title: "存储空间", url: "/dashboard/storage" },
    ],
  },
  {
    title: "监控告警",
    url: "#",
    icon: Activity,
    items: [
      { title: "资源监控", url: "/dashboard/monitoring/resources" },
      { title: "告警规则", url: "/dashboard/monitoring/alerts" },
      { title: "健康检查", url: "/dashboard/monitoring/health" },
    ],
  },
  {
    title: "日志审计",
    url: "#",
    icon: FileText,
    items: [
      { title: "操作日志", url: "/dashboard/logs" },
      { title: "登录日志", url: "/dashboard/logs/login" },
    ],
  },
  {
    title: "系统与组织",
    url: "#",
    icon: Settings2,
    items: [
      { title: "系统配置", url: "/dashboard/settings/system-config" },
      { title: "安全中心", url: "/dashboard/settings/security-center" },
      { title: "集成服务", url: "/dashboard/settings/integrations" },
      { title: "管理运维", url: "/dashboard/settings/management" },
    ],
  },
]

export const AppSidebar = React.memo(function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useClientAuth()
  const { config } = useSystemConfig()

  // 动态构建 teams 数据
  const teamsData = React.useMemo(() => [{
    name: config?.system_name || "EasySSH",
    logo: Server,
    plan: "专业版",
  }], [config?.system_name])

  const all = navMainData

  // 基于标题分组：工作台 / 核心功能 / 可观测与审计 / 平台设置
  const groupWorkbench = React.useMemo(() => all.filter((i) => ["控制台"].includes(i.title)), [all])
  const groupCore = React.useMemo(
    () => all.filter((i) => ["连接管理", "自动化", "文件管理"].includes(i.title)),
    [all]
  )
  const groupObserveAudit = React.useMemo(
    () => all.filter((i) => ["监控告警", "日志审计"].includes(i.title)),
    [all]
  )
  const groupSettings = React.useMemo(() => all.filter((i) => i.title === "系统与组织"), [all])

  // 构建真实用户数据
  const userData = React.useMemo(() => {
    if (!user) {
      return {
        name: "访客",
        email: "",
        avatar: undefined,
      }
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
        {groupWorkbench.length > 0 && <NavMain label="工作台" items={groupWorkbench} />}
        {groupCore.length > 0 && <NavMain label="服务器管理" items={groupCore} />}
        {groupObserveAudit.length > 0 && <NavMain label="监控与审计" items={groupObserveAudit} />}
        {groupSettings.length > 0 && <NavMain label="系统与组织" items={groupSettings} />}
      </SidebarContent>
      <SidebarFooter>
        <NavExtra />
        <NavUser user={userData} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
})
