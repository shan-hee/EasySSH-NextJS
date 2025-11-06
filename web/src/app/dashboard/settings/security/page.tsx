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
import { Globe, Clock, Save, Loader2 } from "lucide-react"
import { settingsApi, type TabSessionConfig, type IPWhitelist } from "@/lib/api/settings"
import { getAccessToken } from "@/contexts/auth-context"
import { toast } from "sonner"

export default function SettingsSecurityPage() {
 // TabSession 配置状态
 const [tabSessionSettings, setTabSessionSettings] = useState<TabSessionConfig>({
   max_tabs: 50,
   inactive_minutes: 60,
   hibernate: true,
   session_timeout: 30,
   remember_login: true
 })
 const [isLoadingTabSession, setIsLoadingTabSession] = useState(true)
 const [isSavingTabSession, setIsSavingTabSession] = useState(false)

 // IP 白名单状态
 const [ipWhitelists, setIpWhitelists] = useState<IPWhitelist[]>([])
 const [isLoadingIPWhitelist, setIsLoadingIPWhitelist] = useState(true)
 const [newIPAddress, setNewIPAddress] = useState("")
 const [newIPDescription, setNewIPDescription] = useState("")
 const [isAddingIP, setIsAddingIP] = useState(false)

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

 // 加载 IP 白名单配置
 useEffect(() => {
   const loadIPWhitelistConfig = async () => {
     try {
       const token = await getAccessToken()
       if (!token) {
         toast.error("未找到访问令牌")
         return
       }

       const whitelists = await settingsApi.getIPWhitelistList(token)
       setIpWhitelists(whitelists)
     } catch (error) {
       console.error("Failed to load IP whitelist config:", error)
       toast.error("加载 IP 白名单配置失败")
     } finally {
       setIsLoadingIPWhitelist(false)
     }
   }

   loadIPWhitelistConfig()
 }, [])

 // IP 白名单处理函数
 const handleAddIP = async () => {
   if (!newIPAddress.trim()) {
     toast.error("请输入 IP 地址")
     return
   }

   setIsAddingIP(true)
   try {
     const token = await getAccessToken()
     if (!token) {
       toast.error("未找到访问令牌")
       return
     }

     const newIP = await settingsApi.createIPWhitelist(token, {
       ip_address: newIPAddress.trim(),
       description: newIPDescription.trim()
     })

     setIpWhitelists(prev => [newIP, ...prev])
     setNewIPAddress("")
     setNewIPDescription("")
     toast.success("IP 地址添加成功")
   } catch (error) {
     console.error("Failed to add IP:", error)
     toast.error("添加 IP 地址失败")
   } finally {
     setIsAddingIP(false)
   }
 }

 const handleToggleIP = async (id: number) => {
   try {
     const token = await getAccessToken()
     if (!token) {
       toast.error("未找到访问令牌")
       return
     }

     await settingsApi.toggleIPWhitelist(token, id)

     setIpWhitelists(prev =>
       prev.map(ip =>
         ip.id === id ? { ...ip, enabled: !ip.enabled } : ip
       )
     )
     toast.success("IP 状态切换成功")
   } catch (error) {
     console.error("Failed to toggle IP:", error)
     toast.error("切换 IP 状态失败")
   }
 }

 const handleDeleteIP = async (id: number) => {
   if (!confirm("确定要删除这个 IP 地址吗？")) {
     return
   }

   try {
     const token = await getAccessToken()
     if (!token) {
       toast.error("未找到访问令牌")
       return
     }

     await settingsApi.deleteIPWhitelist(token, id)

     setIpWhitelists(prev => prev.filter(ip => ip.id !== id))
     toast.success("IP 地址删除成功")
   } catch (error) {
     console.error("Failed to delete IP:", error)
     toast.error("删除 IP 地址失败")
   }
 }

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

   if (tabSessionSettings.session_timeout < 5 || tabSessionSettings.session_timeout > 1440) {
     toast.error("会话超时时间必须在5-1440分钟之间")
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
     toast.success("会话管理配置保存成功")
   } catch (error) {
     console.error("Failed to save tab session config:", error)
     toast.error("保存会话管理配置失败")
   } finally {
     setIsSavingTabSession(false)
   }
 }

 return (
 <>
 <PageHeader title="安全策略" />

 <div className="flex flex-1 flex-col gap-4 p-4 pt-0 overflow-auto">
 <div className="grid gap-4 md:grid-cols-2">
 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">IP白名单</CardTitle>
 <Globe className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{ipWhitelists.filter(ip => ip.enabled).length} 个</div>
 <p className="text-xs text-muted-foreground">已启用IP地址</p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">会话超时</CardTitle>
 <Clock className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{tabSessionSettings.session_timeout}分钟</div>
 <p className="text-xs text-muted-foreground">自动退出</p>
 </CardContent>
 </Card>
 </div>

 <Tabs defaultValue="access" className="w-full">
 <TabsList className="grid w-full grid-cols-2">
 <TabsTrigger value="access">访问控制</TabsTrigger>
 <TabsTrigger value="session">会话管理</TabsTrigger>
 </TabsList>

 <TabsContent value="access" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>IP 白名单</CardTitle>
 <CardDescription>限制只允许特定 IP 地址访问系统</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 {/* 添加新的 IP 地址 */}
 <div className="space-y-2">
 <Label>添加 IP 地址</Label>
 <div className="flex gap-2">
 <Input
   placeholder="192.168.1.0/24 或单个 IP"
   value={newIPAddress}
   onChange={(e) => setNewIPAddress(e.target.value)}
   className="flex-1"
 />
 <Input
   placeholder="描述（可选）"
   value={newIPDescription}
   onChange={(e) => setNewIPDescription(e.target.value)}
   className="w-48"
 />
 <Button
   onClick={handleAddIP}
   disabled={isAddingIP || !newIPAddress.trim()}
   size="sm"
 >
   {isAddingIP ? (
     <>
     <Loader2 className="mr-2 h-4 w-4 animate-spin" />
     添加中...
     </>
   ) : (
     "添加"
   )}
 </Button>
 </div>
 <p className="text-xs text-muted-foreground">
   支持单个 IP 地址（如 192.168.1.1）或 CIDR 格式（如 192.168.1.0/24）
 </p>
 </div>

 {/* IP 白名单列表 */}
 {ipWhitelists.length > 0 && (
   <div className="space-y-2">
   <Label>已配置的 IP 地址</Label>
   <div className="border rounded-lg divide-y">
   {ipWhitelists.map((ip) => (
     <div key={ip.id} className="p-3 flex items-center justify-between">
       <div className="flex items-center gap-3">
         <Switch
           checked={ip.enabled}
           onCheckedChange={() => handleToggleIP(ip.id)}
         />
         <div>
           <div className="font-medium">{ip.ip_address}</div>
           {ip.description && (
             <div className="text-sm text-muted-foreground">{ip.description}</div>
           )}
         </div>
       </div>
       <div className="flex items-center gap-2">
         <Badge variant={ip.enabled ? "default" : "secondary"}>
           {ip.enabled ? "已启用" : "已禁用"}
         </Badge>
         <Button
           variant="ghost"
           size="sm"
           onClick={() => handleDeleteIP(ip.id)}
           className="text-red-600 hover:text-red-700 hover:bg-red-50"
         >
           删除
         </Button>
       </div>
     </div>
   ))}
   </div>
   </div>
 )}

 {ipWhitelists.length === 0 && (
   <div className="text-center py-8 text-muted-foreground">
   暂无 IP 白名单配置，请添加 IP 地址以启用访问控制
   </div>
 )}
 </CardContent>
 </Card>

  </TabsContent>

 <TabsContent value="session" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>会话管理设置</CardTitle>
 <CardDescription>配置用户会话超时、标签页数量和非活动断开提醒</CardDescription>
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
 <Label htmlFor="session-timeout">会话超时时间（分钟）</Label>
 <Input
 id="session-timeout"
 type="number"
 min={5}
 max={1440}
 value={tabSessionSettings.session_timeout}
 onChange={(e) => setTabSessionSettings(prev => ({
 ...prev,
 session_timeout: parseInt(e.target.value) || 5
 }))}
 disabled={isSavingTabSession}
 />
 <p className="text-xs text-muted-foreground">
 用户无操作超过设定时间后将自动退出
 </p>
 </div>
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
 <Label>记住登录状态</Label>
 <p className="text-sm text-muted-foreground">
 允许用户选择记住登录状态
 </p>
 </div>
 <Switch
 checked={tabSessionSettings.remember_login}
 onCheckedChange={(checked) => setTabSessionSettings(prev => ({
 ...prev,
 remember_login: checked
 }))}
 disabled={isSavingTabSession}
 />
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
 保存会话管理
 </>
 )}
 </Button>
 </div>
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
