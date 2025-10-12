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

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
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
    { name: "账户设置", icon: User },
    { name: "终端设置", icon: Terminal },
    { name: "连接设置", icon: Server },
    { name: "SSH密钥", icon: Key },
    { name: "外观主题", icon: Paintbrush },
    { name: "AI助手", icon: Bot },
    { name: "安全设置", icon: Lock },
    { name: "高级设置", icon: Settings },
  ],
}

export function SettingsDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const [activeSection, setActiveSection] = React.useState("账户设置")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
                    {data.nav.map((item) => (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton
                          asChild
                          isActive={item.name === activeSection}
                          onClick={() => setActiveSection(item.name)}
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
          <main className="flex h-[480px] flex-1 flex-col overflow-hidden">
            <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
              <div className="flex items-center gap-2 px-4">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink href="#">设置</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{activeSection}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{activeSection}</h3>
                {activeSection === "账户设置" && (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">基本信息</h4>
                      <p className="text-sm text-muted-foreground mb-3">修改您的账户基本信息</p>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="username">用户名</Label>
                          <Input id="username" placeholder="输入新用户名" defaultValue="admin" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">邮箱地址</Label>
                          <Input id="email" type="email" placeholder="输入邮箱地址" defaultValue="admin@easyssh.com" />
                        </div>
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">密码设置</h4>
                      <p className="text-sm text-muted-foreground mb-3">修改登录密码</p>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="current-password">当前密码</Label>
                          <Input id="current-password" type="password" placeholder="输入当前密码" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new-password">新密码</Label>
                          <Input id="new-password" type="password" placeholder="输入新密码" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="confirm-password">确认新密码</Label>
                          <Input id="confirm-password" type="password" placeholder="再次输入新密码" />
                        </div>
                        <Button className="mt-4">保存密码</Button>
                      </div>
                    </div>
                  </div>
                )}
                {activeSection === "AI助手" && (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">AI功能</h4>
                      <p className="text-sm text-muted-foreground mb-3">启用AI助手来帮助您管理SSH连接</p>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label htmlFor="ai-enabled">启用AI助手</Label>
                            <p className="text-sm text-muted-foreground">使用AI来优化终端命令和故障诊断</p>
                          </div>
                          <Switch id="ai-enabled" defaultChecked={false} />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label htmlFor="ai-suggestions">智能建议</Label>
                            <p className="text-sm text-muted-foreground">在终端中显示命令建议</p>
                          </div>
                          <Switch id="ai-suggestions" defaultChecked={true} />
                        </div>
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">API配置</h4>
                      <p className="text-sm text-muted-foreground mb-3">配置AI服务的API设置</p>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="ai-provider">AI服务提供商</Label>
                          <div className="flex gap-2">
                            <Button variant="default" size="sm">OpenAI</Button>
                            <Button variant="outline" size="sm">Azure</Button>
                            <Button variant="outline" size="sm">自定义</Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="api-endpoint">API端点</Label>
                          <Input id="api-endpoint" placeholder="https://api.openai.com/v1" defaultValue="https://api.openai.com/v1" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="api-key">API密钥</Label>
                          <Input id="api-key" type="password" placeholder="输入您的API密钥" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ai-model">AI模型</Label>
                          <Input id="ai-model" placeholder="gpt-4" defaultValue="gpt-4" />
                        </div>
                        <Button className="mt-4">测试连接</Button>
                      </div>
                    </div>
                  </div>
                )}
                {activeSection === "终端设置" && (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">终端外观</h4>
                      <p className="text-sm text-muted-foreground mb-3">配置终端的字体、颜色和样式</p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">字体大小</span>
                          <Button variant="outline" size="sm">14px</Button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">字体家族</span>
                          <Button variant="outline" size="sm">Monaco</Button>
                        </div>
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">终端行为</h4>
                      <p className="text-sm text-muted-foreground mb-3">设置终端的行为选项</p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">滚动缓冲区大小</span>
                          <Button variant="outline" size="sm">1000行</Button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">光标闪烁</span>
                          <Button variant="default" size="sm">启用</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {activeSection === "连接设置" && (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">连接超时</h4>
                      <p className="text-sm text-muted-foreground mb-3">设置SSH连接的超时时间</p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">连接超时</span>
                          <Button variant="outline" size="sm">30秒</Button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">保活间隔</span>
                          <Button variant="outline" size="sm">60秒</Button>
                        </div>
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">重连策略</h4>
                      <p className="text-sm text-muted-foreground">连接断开时的处理方式</p>
                      <div className="mt-3">
                        <Button variant="default" size="sm">自动重连</Button>
                      </div>
                    </div>
                  </div>
                )}
                {activeSection === "SSH密钥" && (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">密钥管理</h4>
                      <p className="text-sm text-muted-foreground mb-3">管理您的SSH密钥对</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">生成新密钥</Button>
                        <Button variant="outline" size="sm">导入密钥</Button>
                        <Button variant="outline" size="sm">查看密钥</Button>
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">密钥代理</h4>
                      <p className="text-sm text-muted-foreground">SSH代理转发设置</p>
                      <div className="mt-3">
                        <Button variant="default" size="sm">启用代理转发</Button>
                      </div>
                    </div>
                  </div>
                )}
                {activeSection === "外观主题" && (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">界面主题</h4>
                      <p className="text-sm text-muted-foreground mb-3">选择您偏好的界面主题</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">浅色</Button>
                        <Button variant="outline" size="sm">深色</Button>
                        <Button variant="default" size="sm">跟随系统</Button>
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">终端主题</h4>
                      <p className="text-sm text-muted-foreground mb-3">选择终端的配色方案</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">默认</Button>
                        <Button variant="outline" size="sm">Monokai</Button>
                        <Button variant="default" size="sm">Solarized</Button>
                      </div>
                    </div>
                  </div>
                )}
                {activeSection === "安全设置" && (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">会话安全</h4>
                      <p className="text-sm text-muted-foreground mb-3">管理会话的安全性设置</p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">会话超时</span>
                          <Button variant="outline" size="sm">30分钟</Button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">双因子认证</span>
                          <Button variant="outline" size="sm">禁用</Button>
                        </div>
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">审计日志</h4>
                      <p className="text-sm text-muted-foreground">记录用户操作日志</p>
                      <div className="mt-3">
                        <Button variant="default" size="sm">启用日志记录</Button>
                      </div>
                    </div>
                  </div>
                )}
                {activeSection === "高级设置" && (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">性能优化</h4>
                      <p className="text-sm text-muted-foreground mb-3">优化WebSSH的性能表现</p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">缓冲区大小</span>
                          <Button variant="outline" size="sm">8KB</Button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">压缩传输</span>
                          <Button variant="default" size="sm">启用</Button>
                        </div>
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-medium mb-2">调试模式</h4>
                      <p className="text-sm text-muted-foreground">启用详细的调试信息</p>
                      <div className="mt-3">
                        <Button variant="outline" size="sm">启用调试</Button>
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
}