"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import {
  Settings,
  Globe,
  HardDrive,
  Command,
  Shield,
  Clock,
  Users,
  Archive,
  Bot,
  Mail,
} from "lucide-react"
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// 导入所有配置子页签组件
import { BasicTab } from "./system-config/_tabs/basic-tab"
import { FileTransferTab } from "./system-config/_tabs/file-transfer-tab"
import { CompletionTab } from "./system-config/_tabs/completion-tab"

import { AccessControlTab } from "./security-center/_tabs/access-control-tab"
import { SessionManagementTab } from "./security-center/_tabs/session-management-tab"
import { NetworkSecurityTab } from "./security-center/_tabs/network-security-tab"

import { UserManagementContent } from "./management/_tabs/user-management-content"
import { BackupRestoreTab } from "./management/_tabs/backup-restore-tab"

import { AIConfigWrapper } from "./integrations/_tabs/ai-config-wrapper"
import { NotificationConfigWrapper } from "./integrations/_tabs/notification-config-wrapper"

// 定义导航项结构
interface NavItem {
  id: string
  name: string
  icon: React.ElementType
  component: React.ComponentType
}

interface NavGroup {
  label: string
  items: NavItem[]
}

// 所有配置项
const navGroups: NavGroup[] = [
  {
    label: "系统配置",
    items: [
      { id: "basic", name: "基本信息", icon: Settings, component: BasicTab },
      { id: "file-transfer", name: "文件传输", icon: HardDrive, component: FileTransferTab },
      { id: "completion", name: "补全设置", icon: Command, component: CompletionTab },
    ],
  },
  {
    label: "安全中心",
    items: [
      { id: "access-control", name: "访问控制", icon: Shield, component: AccessControlTab },
      { id: "session", name: "会话管理", icon: Clock, component: SessionManagementTab },
      { id: "network", name: "网络安全", icon: Globe, component: NetworkSecurityTab },
    ],
  },
  {
    label: "集成服务",
    items: [
      { id: "ai-config", name: "AI 配置", icon: Bot, component: AIConfigWrapper },
      { id: "notification-config", name: "通知配置", icon: Mail, component: NotificationConfigWrapper },
    ],
  },
  {
    label: "管理运维",
    items: [
      { id: "users", name: "用户管理", icon: Users, component: UserManagementContent },
      { id: "backup", name: "备份恢复", icon: Archive, component: BackupRestoreTab },
    ],
  },
]

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("basic")

  // 查找当前激活的组件
  const ActiveComponent = navGroups
    .flatMap((group) => group.items)
    .find((item) => item.id === activeSection)?.component

  // 获取所有项用于移动端下拉选择
  const allItems = navGroups.flatMap((group) =>
    group.items.map((item) => ({ ...item, groupLabel: group.label }))
  )

  const handleSectionChange = (section: string) => {
    setActiveSection(section)
  }

  return (
    <>
      <PageHeader title="系统设置" />
      <div className="flex flex-1 overflow-hidden">
        <SidebarProvider>
          {/* 左侧导航栏 - 桌面端 */}
          <Sidebar collapsible="none" className="hidden md:flex md:w-52 lg:w-56 shrink-0 bg-transparent border-none">
            <SidebarContent className="bg-transparent">
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {navGroups.flatMap((group) => group.items).map((item) => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          asChild
                          isActive={item.id === activeSection}
                          onClick={() => handleSectionChange(item.id)}
                        >
                          <button>
                            <item.icon className="h-4 w-4" />
                            <span>{item.name}</span>
                          </button>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>

          {/* 右侧内容区 */}
          <main className="flex min-h-[400px] flex-1 flex-col overflow-hidden">
            {/* 移动端下拉选择器 */}
            <div className="md:hidden border-b px-4 py-3">
              <Select value={activeSection} onValueChange={handleSectionChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择设置" />
                </SelectTrigger>
                <SelectContent>
                  {allItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <div className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {item.groupLabel}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 内容滚动区域 */}
            <div className="flex-1 overflow-y-auto scrollbar-custom">
              <div className="space-y-4 p-4">
                {ActiveComponent && <ActiveComponent />}
              </div>
            </div>
          </main>
        </SidebarProvider>
      </div>
    </>
  )
}
