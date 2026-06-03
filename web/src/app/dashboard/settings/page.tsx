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
  Archive,
  Bot,
  Mail,
  ScrollText,
} from "lucide-react"
import { cn } from "@/lib/utils"

// 导入所有配置子页签组件
import { BasicTab } from "./system-config/_tabs/basic-tab"
import { FileTransferTab } from "./system-config/_tabs/file-transfer-tab"
import { CompletionTab } from "./system-config/_tabs/completion-tab"

import { AccessControlTab } from "./security-center/_tabs/access-control-tab"
import { SessionManagementTab } from "./security-center/_tabs/session-management-tab"
import { NetworkSecurityTab } from "./security-center/_tabs/network-security-tab"

import { BackupRestoreTab } from "./management/_tabs/backup-restore-tab"
import { LogManagementTab } from "./management/_tabs/log-management-tab"

import { NotificationConfigWrapper } from "./integrations/_tabs/notification-config-wrapper"
import { AIConfigWrapper } from "./integrations/_tabs/ai-config-wrapper"

// 所有页签平铺为一级
interface TabItem {
  id: string
  nameKey: string
  icon: React.ElementType
  component: React.ComponentType
}

const tabs: TabItem[] = [
  { id: "basic", nameKey: "itemBasic", icon: Settings, component: BasicTab },
  { id: "file-transfer", nameKey: "itemFileTransfer", icon: HardDrive, component: FileTransferTab },
  { id: "completion", nameKey: "itemCompletion", icon: Command, component: CompletionTab },
  { id: "access-control", nameKey: "itemAccessControl", icon: Shield, component: AccessControlTab },
  { id: "session", nameKey: "itemSessionManagement", icon: Clock, component: SessionManagementTab },
  { id: "network", nameKey: "itemNetworkSecurity", icon: Globe, component: NetworkSecurityTab },
  { id: "ai-config", nameKey: "itemAIConfig", icon: Bot, component: AIConfigWrapper },
  { id: "notification-config", nameKey: "itemNotificationConfig", icon: Mail, component: NotificationConfigWrapper },
  { id: "logs", nameKey: "itemLogs", icon: ScrollText, component: LogManagementTab },
  { id: "backup", nameKey: "itemBackup", icon: Archive, component: BackupRestoreTab },
]

// 内部组件，使用 useSearchParams
function SettingsContent() {
  const t = useTranslations("settingsMain")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const initialSection = searchParams.get("section") || "basic"
  const [activeSection, setActiveSection] = useState(initialSection)

  const activeTab = tabs.find((tab) => tab.id === activeSection)
  const ActiveComponent = activeTab?.component

  const handleSectionChange = (section: string) => {
    setActiveSection(section)
    if (!pathname) return
    const nextSearchParams = new URLSearchParams(searchParams.toString())
    nextSearchParams.set("section", section)
    router.replace(`${pathname}?${nextSearchParams.toString()}`, { scroll: false })
  }

  return (
    <>
      <PageHeader title={t("pageTitle")} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pt-2">
        {/* 页签栏 */}
        <div className="flex items-center gap-1 border-b pb-0 mb-0 overflow-x-auto overflow-y-hidden scrollbar-none shrink-0">
          {tabs.map((tab) => {
            const isActive = tab.id === activeSection
            return (
              <button
                key={tab.id}
                onClick={() => handleSectionChange(tab.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                )}
              >
                <tab.icon className="h-4 w-4" />
                {t(tab.nameKey)}
              </button>
            )
          })}
        </div>

        {/* 内容区域 */}
        <main className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">
          {ActiveComponent && <ActiveComponent />}
        </main>
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
