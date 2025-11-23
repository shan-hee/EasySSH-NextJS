"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import {
  Bot,
  Sliders,
  Shield,
  Mail,
  MessageSquare,
  MessageCircle,
  Webhook,
} from "lucide-react"
import { AIProviderWrapper } from "./_tabs/ai-provider-wrapper"
import { AIModelParamsWrapper } from "./_tabs/ai-model-params-wrapper"
import { AIPrivacyWrapper } from "./_tabs/ai-privacy-wrapper"
import { EmailNotificationWrapper } from "./_tabs/email-notification-wrapper"
import { DingTalkNotificationWrapper } from "./_tabs/dingtalk-notification-wrapper"
import { WeComNotificationWrapper } from "./_tabs/wecom-notification-wrapper"
import { WebhookNotificationWrapper } from "./_tabs/webhook-notification-wrapper"
import { SkeletonCard } from "@/components/ui/loading"
import { SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function IntegrationsPage() {
  const [activeSection, setActiveSection] = useState("AI服务")
  const [isLoading] = useState(false)

  // 这里简化处理，实际应根据用户角色判断
  const isAdmin = true

  const navItems = [
    { name: "AI服务", icon: Bot },
    { name: "模型参数", icon: Sliders },
    { name: "隐私设置", icon: Shield },
    { name: "邮件通知", icon: Mail },
    { name: "钉钉通知", icon: MessageSquare },
    { name: "企微通知", icon: MessageCircle },
    { name: "Webhook", icon: Webhook },
  ]

  const handleSectionChange = (section: string) => {
    setActiveSection(section)
  }

  if (isLoading) {
    return (
      <>
        <PageHeader title="集成服务" />
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0 overflow-auto">
          <SkeletonCard showHeader lines={8} className="flex-1" />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="集成服务" />

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
                {activeSection === "AI服务" && <AIProviderWrapper isAdmin={isAdmin} />}
                {activeSection === "模型参数" && <AIModelParamsWrapper />}
                {activeSection === "隐私设置" && <AIPrivacyWrapper />}
                {activeSection === "邮件通知" && <EmailNotificationWrapper />}
                {activeSection === "钉钉通知" && <DingTalkNotificationWrapper />}
                {activeSection === "企微通知" && <WeComNotificationWrapper />}
                {activeSection === "Webhook" && <WebhookNotificationWrapper />}
              </div>
            </div>
          </main>
        </SidebarProvider>
      </div>
    </>
  )
}
