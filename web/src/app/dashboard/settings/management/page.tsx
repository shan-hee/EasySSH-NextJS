"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Users, Database } from "lucide-react"
import { UserManagementContent } from "./_tabs/user-management-content"
import { BackupRestoreTab } from "./_tabs/backup-restore-tab"
import { SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslations } from "next-intl"

type SectionId = "users" | "backup"

export default function ManagementPage() {
  const t = useTranslations("settingsManagement")
  const [activeSection, setActiveSection] = useState<SectionId>("users")

  const navItems: { id: SectionId; icon: typeof Users; labelKey: "navUsers" | "navBackup" }[] = [
    { id: "users", icon: Users, labelKey: "navUsers" },
    { id: "backup", icon: Database, labelKey: "navBackup" },
  ]

  const handleSectionChange = (section: SectionId) => {
    setActiveSection(section)
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
              <Select value={activeSection} onValueChange={(value: SectionId) => handleSectionChange(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("selectPlaceholder")} />
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
                {activeSection === "users" && <UserManagementContent />}
                {activeSection === "backup" && <BackupRestoreTab />}
              </div>
            </div>
          </main>
        </SidebarProvider>
      </div>
    </>
  )
}
