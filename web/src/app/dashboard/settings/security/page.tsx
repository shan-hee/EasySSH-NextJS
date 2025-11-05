"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Shield, Lock, Key, Globe, Clock, AlertTriangle, CheckCircle, Save, Loader2 } from "lucide-react"
import { settingsApi, type TabSessionConfig } from "@/lib/api/settings"
import { getAccessToken } from "@/contexts/auth-context"
import { toast } from "sonner"

export default function SettingsSecurityPage() {
 const [twoFactorEnabled, setTwoFactorEnabled] = useState(true)
 const [ipWhitelistEnabled, setIpWhitelistEnabled] = useState(false)
 const [sessionTimeout, setSessionTimeout] = useState("30")

 // TabSession 配置状态
 const [tabSessionSettings, setTabSessionSettings] = useState<TabSessionConfig>({
   max_tabs: 50,
   inactive_minutes: 60,
   hibernate: true
 })
 const [isLoadingTabSession, setIsLoadingTabSession] = useState(true)
 const [isSavingTabSession, setIsSavingTabSession] = useState(false)

 // 加载 TabSession 配置
 useEffect(() => {
   const loadTabSessionConfig = async () => {
     try {
       const token = await getAccessToken()
       if (!token) {
         toast.error("未找到访问令牌")
         return
       }

       const config = await settingsApi.getTabSessionConfig(token)
       setTabSessionSettings(config)
     } catch (error) {
       console.error("Failed to load tab session config:", error)
       toast.error("加载标签会话配置失败")
     } finally {
       setIsLoadingTabSession(false)
     }
   }

   loadTabSessionConfig()
 }, [])

 // 保存 TabSession 配置
 const handleSaveTabSession = async () => {
   // 验证
   if (tabSessionSettings.max_tabs < 1 || tabSessionSettings.max_tabs > 200) {
     toast.error("最大标签页数必须在1-200之间")
     return
   }

   if (tabSessionSettings.inactive_minutes < 5 || tabSessionSettings.inactive_minutes > 1440) {
     toast.error("非活动断开提醒必须在5-1440分钟之间")
     return
   }

   setIsSavingTabSession(true)
   try {
     const token = await getAccessToken()
     if (!token) {
       toast.error("未找到访问令牌")
       return
     }

     await settingsApi.saveTabSessionConfig(token, tabSessionSettings)
     toast.success("标签会话配置保存成功")
   } catch (error) {
     console.error("Failed to save tab session config:", error)
     toast.error("保存标签会话配置失败")
   } finally {
     setIsSavingTabSession(false)
   }
 }

 return (
 <>
 <PageHeader title="安全策略">
 <Button>
 <Save className="mr-2 h-4 w-4" />
 保存设置
 </Button>
 </PageHeader>

 <div className="flex flex-1 flex-col gap-4 p-4 pt-0 overflow-auto">
 <div className="grid gap-4 md:grid-cols-4">
 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">双因素认证</CardTitle>
 <Shield className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-green-600">已启用</div>
 <p className="text-xs text-muted-foreground">保护账户安全</p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">IP白名单</CardTitle>
 <Globe className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-gray-600">未启用</div>
 <p className="text-xs text-muted-foreground">限制访问IP</p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">会话超时</CardTitle>
 <Clock className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">30分钟</div>
 <p className="text-xs text-muted-foreground">自动退出</p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">密码强度</CardTitle>
 <Key className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-green-600">强</div>
 <p className="text-xs text-muted-foreground">最低8位包含特殊字符</p>
 </CardContent>
 </Card>
 </div>

 <Tabs defaultValue="authentication" className="w-full">
 <TabsList className="grid w-full grid-cols-4">
 <TabsTrigger value="authentication">身份认证</TabsTrigger>
 <TabsTrigger value="access">访问控制</TabsTrigger>
 <TabsTrigger value="session">会话管理</TabsTrigger>
 <TabsTrigger value="password">密码策略</TabsTrigger>
 </TabsList>

 <TabsContent value="authentication" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>双因素认证 (2FA)</CardTitle>
 <CardDescription>增强账户安全性，要求用户提供第二重验证</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="flex items-center justify-between">
 <div className="space-y-0.5">
 <Label htmlFor="2fa">启用双因素认证</Label>
 <div className="text-sm text-muted-foreground">
 使用 TOTP 应用程序（如 Google Authenticator）进行验证
 </div>
 </div>
 <Switch id="2fa" checked={twoFactorEnabled} onCheckedChange={setTwoFactorEnabled} />
 </div>
 {twoFactorEnabled && (
 <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
 <div className="flex items-center gap-2">
 <CheckCircle className="h-4 w-4 text-green-600" />
 <span className="text-sm text-green-900 font-medium">双因素认证已启用</span>
 </div>
 <p className="text-sm text-green-800 mt-1">当前有 3 个用户启用了双因素认证</p>
 </div>
 )}
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>SSH 密钥管理</CardTitle>
 <CardDescription>管理用户的 SSH 公钥</CardDescription>
 </CardHeader>
 <CardContent className="space-y-2">
 <div className="flex items-center justify-between">
 <div>
 <div className="font-medium">强制使用 SSH 密钥</div>
 <div className="text-sm text-muted-foreground">禁止密码登录，仅允许密钥认证</div>
 </div>
 <Switch />
 </div>
 <div className="flex items-center justify-between">
 <div>
 <div className="font-medium">密钥过期时间</div>
 <div className="text-sm text-muted-foreground">定期轮换 SSH 密钥</div>
 </div>
 <Input className="w-32" type="number" defaultValue="365" />
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="access" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>IP 白名单</CardTitle>
 <CardDescription>限制只允许特定 IP 地址访问系统</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="flex items-center justify-between">
 <div className="space-y-0.5">
 <Label htmlFor="ip-whitelist">启用 IP 白名单</Label>
 <div className="text-sm text-muted-foreground">只有白名单内的 IP 可以访问</div>
 </div>
 <Switch id="ip-whitelist" checked={ipWhitelistEnabled} onCheckedChange={setIpWhitelistEnabled} />
 </div>
 {ipWhitelistEnabled && (
 <div className="space-y-2">
 <Label>白名单 IP 地址</Label>
 <Input placeholder="192.168.1.0/24" />
 <Button variant="outline" size="sm">添加 IP</Button>
 </div>
 )}
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>地理位置限制</CardTitle>
 <CardDescription>根据用户地理位置限制访问</CardDescription>
 </CardHeader>
 <CardContent className="space-y-2">
 <div className="flex items-center justify-between">
 <div>
 <div className="font-medium">启用地理位置限制</div>
 <div className="text-sm text-muted-foreground">阻止来自特定国家/地区的访问</div>
 </div>
 <Switch />
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="session" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>会话超时</CardTitle>
 <CardDescription>配置用户会话的超时时间</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-2">
 <Label htmlFor="session-timeout">超时时间（分钟）</Label>
 <Input
 id="session-timeout"
 type="number"
 value={sessionTimeout}
 onChange={(e) => setSessionTimeout(e.target.value)}
 className="w-32"
 />
 <p className="text-sm text-muted-foreground">
 用户无操作 {sessionTimeout} 分钟后将自动退出
 </p>
 </div>
 <div className="flex items-center justify-between">
 <div>
 <div className="font-medium">记住登录状态</div>
 <div className="text-sm text-muted-foreground">允许用户选择记住登录</div>
 </div>
 <Switch defaultChecked />
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>并发会话</CardTitle>
 <CardDescription>限制同一用户的并发登录数量</CardDescription>
 </CardHeader>
 <CardContent className="space-y-2">
 <div className="space-y-2">
 <Label>最大并发会话数</Label>
 <Input type="number" defaultValue="3" className="w-32" />
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>标签/会话设置</CardTitle>
 <CardDescription>控制浏览器标签页数量和非活动断开提醒</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 {isLoadingTabSession ? (
 <div className="flex items-center justify-center py-4">
 <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
 <span className="ml-2 text-muted-foreground">加载配置中...</span>
 </div>
 ) : (
 <>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="maxTabs">最大标签页数</Label>
 <Input
 id="maxTabs"
 type="number"
 min={1}
 max={200}
 value={tabSessionSettings.max_tabs}
 onChange={(e) => setTabSessionSettings(prev => ({
 ...prev,
 max_tabs: parseInt(e.target.value) || 1
 }))}
 disabled={isSavingTabSession}
 />
 <p className="text-xs text-muted-foreground">
 限制用户可同时打开的SSH会话标签页数量
 </p>
 </div>
 <div className="space-y-2">
 <Label htmlFor="inactiveMinutes">非活动断开提醒 (分钟)</Label>
 <Input
 id="inactiveMinutes"
 type="number"
 min={5}
 max={1440}
 value={tabSessionSettings.inactive_minutes}
 onChange={(e) => setTabSessionSettings(prev => ({
 ...prev,
 inactive_minutes: parseInt(e.target.value) || 5
 }))}
 disabled={isSavingTabSession}
 />
 <p className="text-xs text-muted-foreground">
 SSH会话非活动状态超过设定时间后将提醒用户
 </p>
 </div>
 </div>
 <div className="flex items-center justify-between">
 <div className="space-y-0.5">
 <Label>后台标签页休眠</Label>
 <p className="text-sm text-muted-foreground">
 非活动标签页停止渲染终端以释放系统资源
 </p>
 </div>
 <Switch
 checked={tabSessionSettings.hibernate}
 onCheckedChange={(checked) => setTabSessionSettings(prev => ({
 ...prev,
 hibernate: checked
 }))}
 disabled={isSavingTabSession}
 />
 </div>
 <div className="flex justify-end pt-2">
 <Button
 onClick={handleSaveTabSession}
 disabled={isSavingTabSession}
 size="sm"
 >
 {isSavingTabSession ? (
 <>
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 保存中...
 </>
 ) : (
 <>
 <Save className="mr-2 h-4 w-4" />
 保存配置
 </>
 )}
 </Button>
 </div>
 </>
 )}
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="password" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>密码复杂度</CardTitle>
 <CardDescription>设置密码的最低安全要求</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-2">
 <Label>最小长度</Label>
 <Input type="number" defaultValue="8" className="w-32" />
 </div>
 <div className="space-y-2">
 <div className="flex items-center gap-2">
 <Switch defaultChecked />
 <Label>必须包含大写字母</Label>
 </div>
 <div className="flex items-center gap-2">
 <Switch defaultChecked />
 <Label>必须包含小写字母</Label>
 </div>
 <div className="flex items-center gap-2">
 <Switch defaultChecked />
 <Label>必须包含数字</Label>
 </div>
 <div className="flex items-center gap-2">
 <Switch defaultChecked />
 <Label>必须包含特殊字符</Label>
 </div>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>密码过期</CardTitle>
 <CardDescription>定期强制用户更换密码</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <div className="font-medium">启用密码过期</div>
 <div className="text-sm text-muted-foreground">要求用户定期更换密码</div>
 </div>
 <Switch />
 </div>
 <div className="space-y-2">
 <Label>过期时间（天）</Label>
 <Input type="number" defaultValue="90" className="w-32" />
 </div>
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>

 <Card className="border-yellow-200 bg-yellow-50">
 <CardContent className="pt-6">
 <div className="flex items-start gap-3">
 <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
 <div>
 <h4 className="font-medium text-yellow-900">安全提示</h4>
 <p className="text-sm text-yellow-800 mt-1">
 修改安全策略可能会影响所有用户的登录体验。建议在非高峰时段进行调整，并提前通知用户。
 </p>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>
 </>
 )
}
