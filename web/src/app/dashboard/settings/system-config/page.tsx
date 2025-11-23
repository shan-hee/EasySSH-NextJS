"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import {
  Settings,
  Globe,
  Zap,
  HardDrive,
  Command,
} from "lucide-react"
import { BasicTab } from "./_tabs/basic-tab"
import { I18nTab } from "./_tabs/i18n-tab"
import { PerformanceTab } from "./_tabs/performance-tab"
import { FileTransferTab } from "./_tabs/file-transfer-tab"
import { CompletionTab } from "./_tabs/completion-tab"
import { SkeletonCard } from "@/components/ui/loading"
import { SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function SystemConfigPage() {
  const [activeSection, setActiveSection] = useState("基本信息")
  const [isLoading] = useState(false)

  const navItems = [
    { name: "基本信息", icon: Settings },
    { name: "国际化", icon: Globe },
    { name: "性能设置", icon: Zap },
    { name: "文件传输", icon: HardDrive },
    { name: "补全设置", icon: Command },
  ]

  const handleSectionChange = (section: string) => {
    setActiveSection(section)
  }

  if (isLoading) {
    return (
      <>
        <PageHeader title="系统配置" />
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0 overflow-auto">
          <SkeletonCard showHeader lines={8} className="flex-1" />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="系统配置" />

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
                {activeSection === "基本信息" && <BasicTab />}
                {activeSection === "国际化" && <I18nTab />}
                {activeSection === "性能设置" && <PerformanceTab />}
                {activeSection === "文件传输" && <FileTransferTab />}
                {activeSection === "补全设置" && <CompletionTab />}
              </div>
            </div>
          </main>
        </SidebarProvider>
      </div>
    </>
  )
}
