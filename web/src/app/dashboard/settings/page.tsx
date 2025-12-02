"use client"

import { useState, Suspense } from "react"
import { useTranslations } from "next-intl"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
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
  nameKey: string
  icon: React.ElementType
  component: React.ComponentType
}

interface NavGroup {
  labelKey: string
  items: NavItem[]
}
const navGroups: NavGroup[] = [
  {
    labelKey: "groupSystemConfig",
    items: [
      { id: "basic", nameKey: "itemBasic", icon: Settings, component: BasicTab },
      { id: "file-transfer", nameKey: "itemFileTransfer", icon: HardDrive, component: FileTransferTab },
      { id: "completion", nameKey: "itemCompletion", icon: Command, component: CompletionTab },
    ],
  },
  {
    labelKey: "groupSecurityCenter",
    items: [
      { id: "access-control", nameKey: "itemAccessControl", icon: Shield, component: AccessControlTab },
      { id: "session", nameKey: "itemSessionManagement", icon: Clock, component: SessionManagementTab },
      { id: "network", nameKey: "itemNetworkSecurity", icon: Globe, component: NetworkSecurityTab },
    ],
  },
  {
    labelKey: "groupIntegrations",
    items: [
      { id: "ai-config", nameKey: "itemAIConfig", icon: Bot, component: AIConfigWrapper },
      { id: "notification-config", nameKey: "itemNotificationConfig", icon: Mail, component: NotificationConfigWrapper },
    ],
  },
  {
    labelKey: "groupManagementOps",
    items: [
      { id: "users", nameKey: "itemUsers", icon: Users, component: UserManagementContent },
      { id: "backup", nameKey: "itemBackup", icon: Archive, component: BackupRestoreTab },
    ],
  },
]

// 内部组件，使用 useSearchParams
function SettingsContent() {
  const t = useTranslations("settingsMain")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // 从 URL 查询参数恢复当前激活的分组, 默认 basic
  const initialSection = searchParams.get("section") || "basic"
  const [activeSection, setActiveSection] = useState(initialSection)

  // 查找当前激活的组件
  const ActiveComponent = navGroups
    .flatMap((group) => group.items)
    .find((item) => item.id === activeSection)?.component

  // 获取所有项用于移动端下拉选择
  const allItems = navGroups.flatMap((group) =>
    group.items.map((item) => ({ ...item, groupLabelKey: group.labelKey }))
  )

  const handleSectionChange = (section: string) => {
    setActiveSection(section)

    // 将当前分组写入 URL 查询参数, 这样刷新或复制链接时能保持当前选项
    if (!pathname) return
    const nextSearchParams = new URLSearchParams(searchParams.toString())
    nextSearchParams.set("section", section)
    const queryString = nextSearchParams.toString()
    const nextUrl = queryString ? `${pathname}?${queryString}` : pathname

    // 使用 replace 避免污染浏览器历史记录
    router.replace(nextUrl, { scroll: false })
  }

  return (
    <>
      <PageHeader title={t("pageTitle")} />
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
                            <span>{t(item.nameKey)}</span>
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
                  <SelectValue placeholder={t("mobileSelectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {allItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <div className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{t(item.nameKey)}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {t(item.groupLabelKey)}
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

// 外层组件，用 Suspense 包裹
export default function SettingsPage() {
  const tCommon = useTranslations("common")
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full">{tCommon("loading")}</div>}>
      <SettingsContent />
    </Suspense>
  )
}
