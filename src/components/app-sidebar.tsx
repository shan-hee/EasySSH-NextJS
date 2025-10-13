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

// This is sample data.
const data = {
  user: {
    name: "管理员",
    email: "admin@easyssh.com",
    avatar: "/avatars/admin.jpg",
  },
  teams: [
    {
      name: "EasySSH",
      logo: Server,
      plan: "专业版",
    },
  ],
  navMain: [
    {
      title: "控制台",
      url: "/dashboard",
      icon: Monitor,
      isActive: true,
      // 无子级，点击即进入控制台概览
    },
    {
      title: "连接管理",
      url: "#",
      icon: Server,
      items: [
        { title: "连接配置", url: "/dashboard/servers" },
        { title: "历史连接", url: "/dashboard/servers/history" },
        { title: "连接模板", url: "/dashboard/servers/templates" },
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
        { title: "性能分析", url: "/dashboard/monitoring/perf" },
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
        { title: "命令审计", url: "/dashboard/logs/commands" },
        { title: "文件审计", url: "/dashboard/logs/files" },
      ],
    },
    {
      title: "系统配置",
      url: "#",
      icon: Settings2,
      items: [
        { title: "通用设置", url: "/dashboard/settings/general" },
        { title: "安全策略", url: "/dashboard/settings/security" },
        { title: "通知设置", url: "/dashboard/settings/notifications" },
        { title: "用户管理", url: "/dashboard/users" },
        { title: "备份恢复", url: "/dashboard/settings/backup" },
      ],
    },
  ],
}

export const AppSidebar = React.memo(function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const memoizedData = React.useMemo(() => data, [])
  const all = memoizedData.navMain

  // 基于标题分组：工作台 / 核心功能 / 可观测与审计 / 平台设置
  const groupWorkbench = React.useMemo(() => all.filter((i) => i.title === "控制台"), [all])
  const groupCore = React.useMemo(
    () => all.filter((i) => ["连接管理", "自动化", "文件管理"].includes(i.title)),
    [all]
  )
  const groupObserveAudit = React.useMemo(
    () => all.filter((i) => ["监控告警", "日志审计"].includes(i.title)),
    [all]
  )
  const groupSettings = React.useMemo(() => all.filter((i) => i.title === "系统配置"), [all])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={memoizedData.teams} />
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
        <NavUser user={memoizedData.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
})
