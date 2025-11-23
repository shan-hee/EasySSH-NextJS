"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Users, Database } from "lucide-react"
import { UserManagementContent } from "./_tabs/user-management-content"
import { BackupRestoreTab } from "./_tabs/backup-restore-tab"
import { SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function ManagementPage() {
  const [activeSection, setActiveSection] = useState("用户管理")

  const navItems = [
    { name: "用户管理", icon: Users },
    { name: "备份恢复", icon: Database },
  ]

  const handleSectionChange = (section: string) => {
    setActiveSection(section)
  }

  return (
    <>
      <PageHeader title="管理运维" />

      <div className="flex flex-1 overflow-hidden">
        <SidebarProvider>
          {/* 左侧导航栏 - 桌面端 */}
          <Sidebar collapsible="none" className="hidden md:flex md:w-44 lg:w-48 border-r shrink-0">
            <SidebarContent className="py-4">
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {navItems.map((item) => (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton
                          asChild
                          isActive={item.name === activeSection}
                          onClick={() => handleSectionChange(item.name)}
                        >
                          <button>
                            <item.icon />
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
                  {navItems.map((item) => (
                    <SelectItem key={item.name} value={item.name}>
                      <div className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 内容滚动区域 */}
            <div className="flex-1 overflow-y-auto scrollbar-custom">
              <div className="space-y-4 p-4">
                {activeSection === "用户管理" && <UserManagementContent />}
                {activeSection === "备份恢复" && <BackupRestoreTab />}
              </div>
            </div>
          </main>
        </SidebarProvider>
      </div>
    </>
  )
}
