"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Bell, Mail, MessageSquare, Webhook, Send, Save, CheckCircle, XCircle } from "lucide-react"

export default function SettingsNotificationsPage() {
 const [emailEnabled, setEmailEnabled] = useState(true)
 const [dingdingEnabled, setDingdingEnabled] = useState(true)
 const [webhookEnabled, setWebhookEnabled] = useState(false)

 return (
 <>
 <PageHeader title="通知设置">
 <Button>
 <Save className="mr-2 h-4 w-4" />
 保存设置
 </Button>
 </PageHeader>

 <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
 <div className="grid gap-4 md:grid-cols-4">
 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">邮件通知</CardTitle>
 <Mail className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-green-600">已启用</div>
 <p className="text-xs text-muted-foreground">SMTP已配置</p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">钉钉通知</CardTitle>
 <Bell className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-green-600">已启用</div>
 <p className="text-xs text-muted-foreground">2个机器人</p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">企业微信</CardTitle>
 <MessageSquare className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-gray-600">未启用</div>
 <p className="text-xs text-muted-foreground">需要配置</p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">Webhook</CardTitle>
 <Webhook className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-gray-600">未启用</div>
 <p className="text-xs text-muted-foreground">自定义通知</p>
 </CardContent>
 </Card>
 </div>

 <Tabs defaultValue="email" className="w-full">
 <TabsList className="grid w-full grid-cols-4">
 <TabsTrigger value="email">邮件通知</TabsTrigger>
 <TabsTrigger value="dingding">钉钉</TabsTrigger>
 <TabsTrigger value="wechat">企业微信</TabsTrigger>
 <TabsTrigger value="webhook">Webhook</TabsTrigger>
 </TabsList>

 <TabsContent value="email" className="space-y-4">
 <Card>
 <CardHeader>
 <div className="flex items-center justify-between">
 <div>
 <CardTitle>邮件服务器配置</CardTitle>
 <CardDescription>配置 SMTP 服务器用于发送邮件通知</CardDescription>
 </div>
 <Badge className={emailEnabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
 {emailEnabled ? "已启用" : "未启用"}
 </Badge>
 </div>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="flex items-center justify-between">
 <Label htmlFor="email-enabled">启用邮件通知</Label>
 <Switch id="email-enabled" checked={emailEnabled} onCheckedChange={setEmailEnabled} />
 </div>
 {emailEnabled && (
 <>
 <div className="grid gap-4">
 <div className="space-y-2">
 <Label>SMTP 服务器</Label>
 <Input defaultValue="smtp.example.com" />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>端口</Label>
 <Input type="number" defaultValue="587" />
 </div>
 <div className="space-y-2">
 <Label>加密方式</Label>
 <Input defaultValue="TLS" />
 </div>
 </div>
 <div className="space-y-2">
 <Label>用户名</Label>
 <Input defaultValue="noreply@example.com" />
 </div>
 <div className="space-y-2">
 <Label>密码</Label>
 <Input type="password" defaultValue="••••••••" />
 </div>
 <div className="space-y-2">
 <Label>发件人名称</Label>
 <Input defaultValue="EasySSH 系统" />
 </div>
 </div>
 <div className="flex gap-2">
 <Button variant="outline">
 <Send className="mr-2 h-4 w-4" />
 发送测试邮件
 </Button>
 </div>
 </>
 )}
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>通知事件</CardTitle>
 <CardDescription>选择需要发送邮件的事件类型</CardDescription>
 </CardHeader>
 <CardContent className="space-y-2">
 <div className="flex items-center justify-between">
 <Label>服务器离线告警</Label>
 <Switch defaultChecked />
 </div>
 <div className="flex items-center justify-between">
 <Label>高风险操作告警</Label>
 <Switch defaultChecked />
 </div>
 <div className="flex items-center justify-between">
 <Label>登录失败告警</Label>
 <Switch defaultChecked />
 </div>
 <div className="flex items-center justify-between">
 <Label>定时任务失败</Label>
 <Switch />
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="dingding" className="space-y-4">
 <Card>
 <CardHeader>
 <div className="flex items-center justify-between">
 <div>
 <CardTitle>钉钉机器人配置</CardTitle>
 <CardDescription>配置钉钉群机器人 Webhook 地址</CardDescription>
 </div>
 <Badge className={dingdingEnabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
 {dingdingEnabled ? "已启用" : "未启用"}
 </Badge>
 </div>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="flex items-center justify-between">
 <Label htmlFor="dingding-enabled">启用钉钉通知</Label>
 <Switch id="dingding-enabled" checked={dingdingEnabled} onCheckedChange={setDingdingEnabled} />
 </div>
 {dingdingEnabled && (
 <>
 <div className="space-y-2">
 <Label>Webhook 地址</Label>
 <Input placeholder="https://oapi.dingtalk.com/robot/send?access_token=..." />
 </div>
 <div className="space-y-2">
 <Label>签名密钥（可选）</Label>
 <Input placeholder="SEC..." />
 </div>
 <Button variant="outline">
 <Send className="mr-2 h-4 w-4" />
 发送测试消息
 </Button>
 </>
 )}
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="wechat" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>企业微信配置</CardTitle>
 <CardDescription>配置企业微信应用进行消息推送</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-2">
 <Label>企业 ID</Label>
 <Input placeholder="ww..." />
 </div>
 <div className="space-y-2">
 <Label>应用 AgentId</Label>
 <Input placeholder="1000002" />
 </div>
 <div className="space-y-2">
 <Label>应用 Secret</Label>
 <Input type="password" placeholder="••••••••" />
 </div>
 <Button variant="outline">
 <Send className="mr-2 h-4 w-4" />
 发送测试消息
 </Button>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="webhook" className="space-y-4">
 <Card>
 <CardHeader>
 <div className="flex items-center justify-between">
 <div>
 <CardTitle>自定义 Webhook</CardTitle>
 <CardDescription>配置自定义 Webhook 接收通知</CardDescription>
 </div>
 <Badge className={webhookEnabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
 {webhookEnabled ? "已启用" : "未启用"}
 </Badge>
 </div>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="flex items-center justify-between">
 <Label htmlFor="webhook-enabled">启用 Webhook</Label>
 <Switch id="webhook-enabled" checked={webhookEnabled} onCheckedChange={setWebhookEnabled} />
 </div>
 {webhookEnabled && (
 <>
 <div className="space-y-2">
 <Label>Webhook URL</Label>
 <Input placeholder="https://your-api.com/webhook" />
 </div>
 <div className="space-y-2">
 <Label>请求方法</Label>
 <Input defaultValue="POST" />
 </div>
 <div className="space-y-2">
 <Label>认证 Token（可选）</Label>
 <Input placeholder="Bearer token..." />
 </div>
 <Button variant="outline">
 <Send className="mr-2 h-4 w-4" />
 发送测试请求
 </Button>
 </>
 )}
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>
 </div>
 </>
 )
}
