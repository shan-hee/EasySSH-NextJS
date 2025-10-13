"use client"

import * as React from "react"
import {
  Settings2,
  Server,
  Key,
  Monitor,
  Terminal,
  FileText,
  UserCog,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { NavExtra } from "@/components/nav-extra"
import { QuickAccess } from "@/components/quick-access"
import { QuickActions } from "@/components/quick-actions"
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
      title: "连接管理",
      url: "#",
      icon: Server,
      isActive: true,
      items: [
        {
          title: "服务器列表",
          url: "/dashboard/servers",
        },
        {
          title: "添加服务器",
          url: "/dashboard/servers/add",
        },
        {
          title: "批量操作",
          url: "/dashboard/servers/batch",
        },
      ],
    },
    {
      title: "终端会话",
      url: "#",
      icon: Terminal,
      items: [
        {
          title: "Web终端",
          url: "/dashboard/terminal",
        },
        {
          title: "活动会话",
          url: "/dashboard/sessions",
        },
        {
          title: "会话历史",
          url: "/dashboard/history",
        },
        {
          title: "SFTP文件传输",
          url: "/dashboard/sftp",
        },
      ],
    },
    {
      title: "密钥管理",
      url: "#",
      icon: Key,
      items: [
        {
          title: "SSH密钥",
          url: "/dashboard/keys",
        },
        {
          title: "生成密钥",
          url: "/dashboard/keys/generate",
        },
        {
          title: "导入密钥",
          url: "/dashboard/keys/import",
        },
        {
          title: "密钥分发",
          url: "/dashboard/keys/deploy",
        },
      ],
    },
    {
      title: "系统监控",
      url: "#",
      icon: Monitor,
      items: [
        {
          title: "服务器状态",
          url: "/dashboard/monitoring",
        },
        {
          title: "性能监控",
          url: "/dashboard/metrics",
        },
        {
          title: "连接统计",
          url: "/dashboard/statistics",
        },
        {
          title: "告警管理",
          url: "/dashboard/alerts",
        },
      ],
    },
    {
      title: "日志审计",
      url: "#",
      icon: FileText,
      items: [
        {
          title: "操作日志",
          url: "/dashboard/logs",
        },
        {
          title: "登录日志",
          url: "/dashboard/logs/login",
        },
        {
          title: "命令记录",
          url: "/dashboard/logs/commands",
        },
        {
          title: "安全审计",
          url: "/dashboard/logs/security",
        },
      ],
    },
    {
      title: "用户管理",
      url: "#",
      icon: UserCog,
      items: [
        {
          title: "用户列表",
          url: "/dashboard/users",
        },
        {
          title: "角色权限",
          url: "/dashboard/roles",
        },
        {
          title: "访问控制",
          url: "/dashboard/access-control",
        },
        {
          title: "组织架构",
          url: "/dashboard/organization",
        },
      ],
    },
    {
      title: "系统设置",
      url: "#",
      icon: Settings2,
      items: [
        {
          title: "基础配置",
          url: "/dashboard/settings/general",
        },
        {
          title: "安全设置",
          url: "/dashboard/settings/security",
        },
        {
          title: "邮件配置",
          url: "/dashboard/settings/email",
        },
        {
          title: "备份恢复",
          url: "/dashboard/settings/backup",
        },
      ],
    },
  ],
}

export const AppSidebar = React.memo(function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const memoizedData = React.useMemo(() => data, [])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={memoizedData.teams} />
      </SidebarHeader>
      <SidebarContent>
        <QuickAccess />
        <NavMain items={memoizedData.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <QuickActions />
        <NavExtra />
        <NavUser user={memoizedData.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
})
