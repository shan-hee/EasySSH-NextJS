"use client"

import * as React from "react"
import {
  Frame,
  Map,
  Settings2,
  Server,
  Key,
  Monitor,
  Shield,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { NavExtra } from "@/components/nav-extra"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
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
      title: "服务器管理",
      url: "#",
      icon: Server,
      isActive: true,
      items: [
        {
          title: "所有服务器",
          url: "/dashboard/servers",
        },
        {
          title: "添加服务器",
          url: "/dashboard/servers/add",
        },
        {
          title: "连接历史",
          url: "/dashboard/history",
        },
        {
          title: "在线终端",
          url: "/dashboard/terminal",
        },
      ],
    },
    {
      title: "密钥管理",
      url: "#",
      icon: Key,
      items: [
        {
          title: "SSH 密钥",
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
      ],
    },
    {
      title: "监控",
      url: "#",
      icon: Monitor,
      items: [
        {
          title: "系统状态",
          url: "/dashboard/monitoring",
        },
        {
          title: "性能指标",
          url: "/dashboard/metrics",
        },
        {
          title: "日志查看",
          url: "/dashboard/logs",
        },
      ],
    },
    {
      title: "设置",
      url: "#",
      icon: Settings2,
      items: [
        {
          title: "常规设置",
          url: "/dashboard/settings/general",
        },
        {
          title: "安全设置",
          url: "/dashboard/settings/security",
        },
        {
          title: "用户管理",
          url: "/dashboard/settings/users",
        },
        {
          title: "备份恢复",
          url: "/dashboard/settings/backup",
        },
      ],
    },
  ],
  projects: [
    {
      name: "生产环境",
      url: "/dashboard/groups/production",
      icon: Shield,
    },
    {
      name: "测试环境",
      url: "/dashboard/groups/testing",
      icon: Frame,
    },
    {
      name: "开发环境",
      url: "/dashboard/groups/development",
      icon: Map,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <NavExtra />
        <SidebarSeparator />
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
