"use client"

import * as React from "react"
import {
  Bell,
  Terminal,
  Link,
  Lock,
  Paintbrush,
  Settings,
  Server,
  Key,
  User,
  Bot,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"

const data = {
  nav: [
    { name: "个人信息", icon: User },
    { name: "账户安全", icon: Lock },
    { name: "通知偏好", icon: Bell },
    { name: "SSH密钥", icon: Key },
    { name: "界面偏好", icon: Paintbrush },
  ],
}

export const SettingsDialog = React.memo(function SettingsDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const [activeSection, setActiveSection] = React.useState("个人信息")

  const handleOpenChange = React.useCallback((open: boolean) => {
    setOpen(open)
  }, [])

  const handleSectionChange = React.useCallback((section: string) => {
    setActiveSection(section)
  }, [])

  const navItems = React.useMemo(() => data.nav, [])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="overflow-hidden p-0 md:max-h-[500px] md:max-w-[700px] lg:max-w-[800px]">
        <DialogTitle className="sr-only">设置</DialogTitle>
        <DialogDescription className="sr-only">
          在这里自定义您的设置。
        </DialogDescription>
        <SidebarProvider className="items-start">
          <Sidebar collapsible="none" className="hidden md:flex">
            <SidebarContent>
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
          <main className="flex h-[500px] flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 scrollbar-custom">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{activeSection}</h3>
                {activeSection === "个人信息" && (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">头像</h4>
                      <p className="text-sm text-muted-foreground mb-3">上传或更换您的头像</p>
                      <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xl font-semibold">
                          管
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">上传头像</Button>
                          <Button variant="outline" size="sm">移除</Button>
                        </div>
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">基本信息</h4>
                      <p className="text-sm text-muted-foreground mb-3">修改您的个人基本信息</p>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="username">用户名</Label>
                          <Input id="username" placeholder="输入新用户名" defaultValue="admin" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">邮箱地址</Label>
                          <Input id="email" type="email" placeholder="输入邮箱地址" defaultValue="admin@easyssh.com" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="displayName">显示名称</Label>
                          <Input id="displayName" placeholder="输入显示名称" defaultValue="管理员" />
                        </div>
                        <Button className="mt-4">保存信息</Button>
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">个人偏好</h4>
                      <p className="text-sm text-muted-foreground mb-3">设置您的语言和时区偏好</p>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="language">语言</Label>
                          <Input id="language" placeholder="简体中文" defaultValue="简体中文" disabled />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="timezone">时区</Label>
                          <Input id="timezone" placeholder="Asia/Shanghai" defaultValue="Asia/Shanghai" disabled />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {activeSection === "账户安全" && (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">修改密码</h4>
                      <p className="text-sm text-muted-foreground mb-3">定期修改密码以保护账户安全</p>
                      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                        <div className="space-y-2">
                          <Label htmlFor="current-password">当前密码</Label>
                          <Input id="current-password" type="password" autoComplete="current-password" placeholder="输入当前密码" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new-password">新密码</Label>
                          <Input id="new-password" type="password" autoComplete="new-password" placeholder="输入新密码（至少8位）" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="confirm-password">确认新密码</Label>
                          <Input id="confirm-password" type="password" autoComplete="new-password" placeholder="再次输入新密码" />
                        </div>
                        <Button className="mt-4">保存密码</Button>
                      </form>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">双因子认证</h4>
                      <p className="text-sm text-muted-foreground mb-3">增强账户安全性</p>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label htmlFor="2fa">启用双因子认证</Label>
                            <p className="text-sm text-muted-foreground">使用authenticator应用验证登录</p>
                          </div>
                          <Switch id="2fa" defaultChecked={false} />
                        </div>
                        <Button variant="outline" size="sm">配置双因子认证</Button>
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">活动会话</h4>
                      <p className="text-sm text-muted-foreground mb-3">管理您的登录会话</p>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center p-2 bg-background rounded">
                          <div>
                            <p className="text-sm font-medium">当前会话</p>
                            <p className="text-xs text-muted-foreground">Chrome · 上海 · 刚刚</p>
                          </div>
                          <Button variant="ghost" size="sm" disabled>当前</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {activeSection === "通知偏好" && (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">邮件通知</h4>
                      <p className="text-sm text-muted-foreground mb-3">选择接收邮件通知的事件类型</p>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label htmlFor="email-login">登录通知</Label>
                            <p className="text-sm text-muted-foreground">账户登录时发送邮件</p>
                          </div>
                          <Switch id="email-login" defaultChecked={true} />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label htmlFor="email-alerts">告警通知</Label>
                            <p className="text-sm text-muted-foreground">服务器告警时发送邮件</p>
                          </div>
                          <Switch id="email-alerts" defaultChecked={true} />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label htmlFor="email-reports">报告通知</Label>
                            <p className="text-sm text-muted-foreground">接收定期系统报告</p>
                          </div>
                          <Switch id="email-reports" defaultChecked={false} />
                        </div>
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">浏览器通知</h4>
                      <p className="text-sm text-muted-foreground mb-3">管理浏览器推送通知</p>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label htmlFor="browser-notifications">启用浏览器通知</Label>
                            <p className="text-sm text-muted-foreground">接收实时浏览器推送</p>
                          </div>
                          <Switch id="browser-notifications" defaultChecked={true} />
                        </div>
                        <Button variant="outline" size="sm">测试通知</Button>
                      </div>
                    </div>
                  </div>
                )}
                {activeSection === "SSH密钥" && (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">我的SSH密钥</h4>
                      <p className="text-sm text-muted-foreground mb-3">管理您的个人SSH密钥对</p>
                      <div className="space-y-2 mb-4">
                        <div className="p-3 bg-background rounded border">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-medium">id_rsa</p>
                              <p className="text-xs text-muted-foreground">RSA 2048位 · 创建于 2024-01-01</p>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm">查看</Button>
                              <Button variant="ghost" size="sm">删除</Button>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">生成新密钥</Button>
                        <Button variant="outline" size="sm">导入密钥</Button>
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">密钥设置</h4>
                      <p className="text-sm text-muted-foreground mb-3">配置SSH密钥相关选项</p>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label htmlFor="key-agent">启用SSH代理</Label>
                            <p className="text-sm text-muted-foreground">自动管理密钥认证</p>
                          </div>
                          <Switch id="key-agent" defaultChecked={true} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {activeSection === "界面偏好" && (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">主题模式</h4>
                      <p className="text-sm text-muted-foreground mb-3">选择您偏好的界面主题</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">浅色</Button>
                        <Button variant="outline" size="sm">深色</Button>
                        <Button variant="default" size="sm">跟随系统</Button>
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">界面选项</h4>
                      <p className="text-sm text-muted-foreground mb-3">自定义界面显示选项</p>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label htmlFor="compact-mode">紧凑模式</Label>
                            <p className="text-sm text-muted-foreground">减少界面间距以显示更多内容</p>
                          </div>
                          <Switch id="compact-mode" defaultChecked={false} />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label htmlFor="sidebar-collapsed">默认收起侧边栏</Label>
                            <p className="text-sm text-muted-foreground">启动时侧边栏默认收起</p>
                          </div>
                          <Switch id="sidebar-collapsed" defaultChecked={false} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  )
})
