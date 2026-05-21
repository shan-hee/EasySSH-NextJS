"use client"

import { useCallback, useEffect, useMemo, useState, Suspense, type ComponentType } from "react"
import { useTranslations } from "next-intl"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { cn } from "@/lib/utils"
import { buildSettingsTabs } from "@/shell/settings"
import { isDesktopRuntime, useRuntimeInfo } from "@/shell/runtime"

// 导入所有配置子页签组件
import { BasicTab } from "./system-config/_tabs/basic-tab"
import { FileTransferTab } from "./system-config/_tabs/file-transfer-tab"
import { CompletionTab } from "./system-config/_tabs/completion-tab"

import { AccessControlTab } from "./security-center/_tabs/access-control-tab"
import { SessionManagementTab } from "./security-center/_tabs/session-management-tab"
import { NetworkSecurityTab } from "./security-center/_tabs/network-security-tab"

import { BackupRestoreTab } from "./management/_tabs/backup-restore-tab"

import { NotificationConfigWrapper } from "./integrations/_tabs/notification-config-wrapper"
import { AIConfigWrapper } from "./integrations/_tabs/ai-config-wrapper"

const settingsComponents: Record<string, ComponentType> = {
  basic: BasicTab,
  "file-transfer": FileTransferTab,
  completion: CompletionTab,
  "access-control": AccessControlTab,
  session: SessionManagementTab,
  network: NetworkSecurityTab,
  "ai-config": AIConfigWrapper,
  "notification-config": NotificationConfigWrapper,
  backup: BackupRestoreTab,
}

// 内部组件，使用 useSearchParams
function SettingsContent() {
  const t = useTranslations("settingsMain")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data: runtime } = useRuntimeInfo()
  const isDesktop = isDesktopRuntime(runtime)
  const tabs = useMemo(() => buildSettingsTabs({ runtime, t }), [runtime, t])

  const initialSection = searchParams.get("section") || tabs[0]?.id || "basic"
  const [activeSection, setActiveSection] = useState(initialSection)

  const activeTab = tabs.find((tab) => tab.id === activeSection) ?? tabs[0]
  const ActiveComponent = activeTab ? settingsComponents[activeTab.id] : undefined

  const handleSectionChange = useCallback((section: string) => {
    setActiveSection(section)
    if (!pathname) return
    const nextSearchParams = new URLSearchParams(searchParams.toString())
    nextSearchParams.set("section", section)
    router.replace(`${pathname}?${nextSearchParams.toString()}`, { scroll: false })
  }, [pathname, router, searchParams])

  useEffect(() => {
    if (tabs.length === 0) return
    const requestedSection = searchParams.get("section")
    if (requestedSection && tabs.some((tab) => tab.id === requestedSection) && requestedSection !== activeSection) {
      setActiveSection(requestedSection)
      return
    }
    if (!tabs.some((tab) => tab.id === activeSection) && tabs[0]) {
      handleSectionChange(tabs[0].id)
    }
  }, [activeSection, handleSectionChange, searchParams, tabs])

  return (
    <>
      <PageHeader title={isDesktop ? t("pageTitleDesktop") : t("pageTitle")} />
      <div className="flex flex-1 flex-col min-h-0 px-4 pt-2">
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
                {tab.name}
              </button>
            )
          })}
        </div>

        {/* 内容区域 */}
        <main className="flex-1 flex flex-col min-h-0 mt-3">
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
