"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { PageHeader } from "@/components/page-header"
import {
  Shield,
  Clock,
  Globe,
} from "lucide-react"
import { AccessControlTab } from "./_tabs/access-control-tab"
import { SessionManagementTab } from "./_tabs/session-management-tab"
import { NetworkSecurityTab } from "./_tabs/network-security-tab"
import { SkeletonCard } from "@/components/ui/loading"
import { SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type SectionId = "access-control" | "session" | "network"

export default function SecurityCenterPage() {
  const t = useTranslations("settingsSecurity")
  const [activeSection, setActiveSection] = useState<SectionId>("access-control")
  const [isLoading] = useState(false)

  const navItems = [
    { id: "access-control" as SectionId, labelKey: "navAccessControl", icon: Shield },
    { id: "session" as SectionId, labelKey: "navSessionManagement", icon: Clock },
    { id: "network" as SectionId, labelKey: "navNetworkSecurity", icon: Globe },
  ]

  const handleSectionChange = (section: string) => {
    setActiveSection(section as SectionId)
  }

  if (isLoading) {
    return (
      <>
        <PageHeader title={t("pageTitle")} />
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0 overflow-auto">
          <SkeletonCard showHeader lines={8} className="flex-1" />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title={t("pageTitle")} />

      <div className="flex flex-1 overflow-hidden">
        <SidebarProvider>
          {/* 左侧导航栏 - 桌面端 */}
          <Sidebar collapsible="none" className="hidden md:flex md:w-44 lg:w-48 border-r shrink-0">
            <SidebarContent className="py-4">
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {navItems.map((item) => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          asChild
                          isActive={item.id === activeSection}
                          onClick={() => handleSectionChange(item.id)}
                        >
                          <button>
                            <item.icon />
                            <span>{t(item.labelKey)}</span>
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
                  {navItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <div className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{t(item.labelKey)}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 内容滚动区域 */}
            <div className="flex-1 overflow-y-auto scrollbar-custom">
              <div className="space-y-4 p-4">
                {activeSection === "access-control" && <AccessControlTab />}
                {activeSection === "session" && <SessionManagementTab />}
                {activeSection === "network" && <NetworkSecurityTab />}
              </div>
            </div>
          </main>
        </SidebarProvider>
      </div>
    </>
  )
}
