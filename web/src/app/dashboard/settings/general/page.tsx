"use client"

import { useEffect, useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
 Save,
 Upload,
 Settings,
 Globe,
 Clock,
 Shield,
 Mail,
 Server,
 Image as ImageIcon,
 Loader2,
 RotateCcw
} from "lucide-react"
import { settingsApi, type SystemConfig } from "@/lib/api/settings"
import { getAccessToken } from "@/contexts/auth-context"
import { toast } from "sonner"

export default function SettingsGeneralPage() {
 const [settings, setSettings] = useState<SystemConfig>({
  // 基本设置
  system_name: "EasySSH",
  system_description: "简单易用的SSH管理平台",
  system_logo: "/logo.svg",
  system_favicon: "/favicon.ico",

  // 国际化设置
  default_language: "zh-CN",
  default_timezone: "Asia/Shanghai",
  date_format: "YYYY-MM-DD HH:mm:ss",

  // 功能设置
  enable_user_registration: false,
  enable_guest_access: false,
  enable_file_manager: true,
  enable_web_terminal: true,
  enable_monitoring: true,

  // 安全设置
  session_timeout: 30,
  max_login_attempts: 5,
  password_min_length: 8,
  require_two_factor: false,

  // 其他设置
  default_page_size: 20,
  max_file_upload_size: 100,
  enable_system_stats: true,
  enable_maintenance_mode: false,
 })

 const [isLoading, setIsLoading] = useState(true)
 const [isSaving, setIsSaving] = useState(false)
 const [tabSettings, setTabSettings] = useState({
 maxTabs: 50,
 inactiveMinutes: 60,
 hibernate: true,
 })

 // 载入系统配置
 useEffect(() => {
 const loadSettings = async () => {
   try {
     const token = await getAccessToken()
     if (!token) {
       toast.error("未找到访问令牌")
       return
     }

     const config = await settingsApi.getSystemConfig(token)
     setSettings(config)
   } catch (error) {
     console.error("Failed to load system settings:", error)
     toast.error("加载系统配置失败")
   } finally {
     setIsLoading(false)
   }
 }

 loadSettings()
 }, [])

 // 载入页签设置
 useEffect(() => {
 try {
 const maxTabs = Number(localStorage.getItem("tab.maxTabs") || "50")
 const inactiveMinutes = Number(localStorage.getItem("tab.inactiveMinutes") || "60")
 const hibernate = (localStorage.getItem("tab.hibernate") || "true") === "true"
 setTabSettings({
 maxTabs: isNaN(maxTabs) ? 50 : maxTabs,
 inactiveMinutes: isNaN(inactiveMinutes) ? 60 : inactiveMinutes,
 hibernate,
 })
 } catch {}
 }, [])

 const handleSettingChange = (key: string, value: string | boolean | number) => {
 // 基本验证
 if (typeof value === 'string') {
  switch (key) {
   case 'system_name':
    if (value.length > 100) {
     toast.error('系统名称不能超过100个字符')
     return
    }
    break
   case 'system_description':
    if (value.length > 500) {
     toast.error('系统描述不能超过500个字符')
     return
    }
    break
  }
 } else if (typeof value === 'number') {
  switch (key) {
   case 'session_timeout':
    if (value < 5 || value > 1440) {
     toast.error('会话超时时间必须在5-1440分钟之间')
     return
    }
    break
   case 'max_login_attempts':
    if (value < 1 || value > 10) {
     toast.error('最大登录尝试次数必须在1-10之间')
     return
    }
    break
   case 'password_min_length':
    if (value < 6 || value > 32) {
     toast.error('密码最小长度必须在6-32之间')
     return
    }
    break
   case 'default_page_size':
    if (value < 10 || value > 100) {
     toast.error('默认分页大小必须在10-100之间')
     return
    }
    break
   case 'max_file_upload_size':
    if (value < 1 || value > 1024) {
     toast.error('文件上传大小限制必须在1-1024MB之间')
     return
    }
    break
  }
 }

 setSettings(prev => ({
  ...prev,
  [key]: value
 }))
 }

 const handleSave = async () => {
 // 保存前验证
 if (!settings.system_name.trim()) {
  toast.error("系统名称不能为空")
  return
 }

 if (settings.system_name.length > 100) {
  toast.error("系统名称不能超过100个字符")
  return
 }

 if (settings.system_description.length > 500) {
  toast.error("系统描述不能超过500个字符")
  return
 }

 if (settings.session_timeout < 5 || settings.session_timeout > 1440) {
  toast.error("会话超时时间必须在5-1440分钟之间")
  return
 }

 if (settings.max_login_attempts < 1 || settings.max_login_attempts > 10) {
  toast.error("最大登录尝试次数必须在1-10之间")
  return
 }

 if (settings.password_min_length < 6 || settings.password_min_length > 32) {
  toast.error("密码最小长度必须在6-32之间")
  return
 }

 if (settings.default_page_size < 10 || settings.default_page_size > 100) {
  toast.error("默认分页大小必须在10-100之间")
  return
 }

 if (settings.max_file_upload_size < 1 || settings.max_file_upload_size > 1024) {
  toast.error("文件上传大小限制必须在1-1024MB之间")
  return
 }

 setIsSaving(true)
 try {
   const token = await getAccessToken()
   if (!token) {
     toast.error("未找到访问令牌")
     return
   }

   await settingsApi.saveSystemConfig(token, settings)
   toast.success("系统配置保存成功")
 } catch (error) {
   console.error("Failed to save system settings:", error)
   toast.error("保存系统配置失败")
 } finally {
   setIsSaving(false)
 }
 }

 const handleLogoUpload = async () => {
 // 创建文件输入元素
 const input = document.createElement("input")
 input.type = "file"
 input.accept = "image/*"

 input.onchange = async (e) => {
   const file = (e.target as HTMLInputElement).files?.[0]
   if (!file) return

   // 验证文件类型
   if (!file.type.startsWith("image/")) {
     toast.error("请选择图片文件")
     return
   }

   // 验证文件大小 (10MB)
   if (file.size > 10 * 1024 * 1024) {
     toast.error("文件大小不能超过10MB")
     return
   }

   try {
     const token = await getAccessToken()
     if (!token) {
       toast.error("未找到访问令牌")
       return
     }

     // 上传文件
     const result = await settingsApi.uploadLogo(token, file)

     // 更新设置中的Logo URL
     setSettings(prev => ({
       ...prev,
       system_logo: result.file_url
     }))

     toast.success("Logo上传成功")
   } catch (error) {
     console.error("Failed to upload logo:", error)
     toast.error("Logo上传失败")
   }
 }

 input.click()
 }

 const handleSaveTabs = async () => {
 try {
 localStorage.setItem("tab.maxTabs", String(tabSettings.maxTabs))
 localStorage.setItem("tab.inactiveMinutes", String(tabSettings.inactiveMinutes))
 localStorage.setItem("tab.hibernate", String(tabSettings.hibernate))
 toast.success("页签设置保存成功")
 } catch {
 toast.error("页签设置保存失败")
 }
 }

 const handleResetToDefaults = async () => {
 // 重置为默认值
 const defaultSettings: SystemConfig = {
  // 基本设置
  system_name: "EasySSH",
  system_description: "简单易用的SSH管理平台",
  system_logo: "/logo.svg",
  system_favicon: "/favicon.ico",

  // 国际化设置
  default_language: "zh-CN",
  default_timezone: "Asia/Shanghai",
  date_format: "YYYY-MM-DD HH:mm:ss",

  // 功能设置
  enable_user_registration: false,
  enable_guest_access: false,
  enable_file_manager: true,
  enable_web_terminal: true,
  enable_monitoring: true,

  // 安全设置
  session_timeout: 30,
  max_login_attempts: 5,
  password_min_length: 8,
  require_two_factor: false,

  // 其他设置
  default_page_size: 20,
  max_file_upload_size: 100,
  enable_system_stats: true,
  enable_maintenance_mode: false,
 }

 setSettings(defaultSettings)
 toast.info("已重置为默认配置，请点击保存按钮生效")
 }

 return (
 <>
 <PageHeader title="通用设置">
 <div className="flex gap-2">
 <Button
 variant="outline"
 onClick={handleResetToDefaults}
 disabled={isSaving || isLoading}
 >
 <RotateCcw className="mr-2 h-4 w-4" />
 重置默认
 </Button>
 <Button onClick={handleSave} disabled={isSaving || isLoading}>
 {isSaving ? (
 <>
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 保存中...
 </>
 ) : (
 <>
 <Save className="mr-2 h-4 w-4" />
 保存设置
 </>
 )}
 </Button>
 </div>
 </PageHeader>

 <div className="flex flex-col gap-4 p-4 pt-0 h-full overflow-auto">
 {isLoading && (
  <div className="flex items-center justify-center py-8">
   <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
   <span className="ml-2 text-muted-foreground">加载系统配置中...</span>
  </div>
 )}

 {!isLoading && (
  <>
 {/* 基本设置 */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Settings className="h-5 w-5" />
 基本设置
 </CardTitle>
 <CardDescription>
 配置系统名称、描述和品牌标识
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="systemName">系统名称</Label>
 <Input
 id="systemName"
 value={settings.system_name}
 onChange={(e) => handleSettingChange("system_name", e.target.value)}
 placeholder="输入系统名称"
 disabled={isLoading}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="defaultLanguage">默认语言</Label>
 <Select
 value={settings.default_language}
 onValueChange={(value) => handleSettingChange("default_language", value)}
 disabled={isLoading}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="zh-CN">简体中文</SelectItem>
 <SelectItem value="en-US">English</SelectItem>
 <SelectItem value="ja-JP">日本語</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>

 <div className="space-y-2">
 <Label htmlFor="systemDescription">系统描述</Label>
 <Textarea
 id="systemDescription"
 value={settings.system_description}
 onChange={(e) => handleSettingChange("system_description", e.target.value)}
 placeholder="输入系统描述"
 rows={3}
 disabled={isLoading}
 />
 </div>

 <div className="space-y-2">
 <Label>系统Logo</Label>
 <div className="flex items-center gap-4">
 <div className="w-16 h-16 border rounded-lg flex items-center justify-center bg-muted overflow-hidden">
 {settings.system_logo && settings.system_logo !== "/logo.svg" ? (
 <img
 src={settings.system_logo}
 alt="系统Logo"
 className="w-full h-full object-cover"
 onError={(e) => {
 // 图片加载失败时显示默认图标
 e.currentTarget.style.display = 'none'
 e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image h-8 w-8 text-muted-foreground"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg></div>'
 }}
 />
 ) : (
 <ImageIcon className="h-8 w-8 text-muted-foreground" />
 )}
 </div>
 <div className="flex-1">
 <p className="text-sm text-muted-foreground mb-2">
 推荐尺寸: 64x64px，支持 PNG, JPG, SVG, WebP 格式，最大10MB
 </p>
 <Button variant="outline" size="sm" onClick={handleLogoUpload} disabled={isLoading}>
 <Upload className="mr-2 h-4 w-4" />
 上传Logo
 </Button>
 </div>
 </div>
 </div>
 </CardContent>
 </Card>

 {/* 国际化和时区设置 */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Globe className="h-5 w-5" />
 国际化设置
 </CardTitle>
 <CardDescription>
 配置时区、日期格式和本地化选项
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="defaultTimezone">默认时区</Label>
 <Select
 value={settings.default_timezone || "Asia/Shanghai"}
 onValueChange={(value) => handleSettingChange("default_timezone", value)}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="Asia/Shanghai">Asia/Shanghai (GMT+8)</SelectItem>
 <SelectItem value="America/New_York">America/New_York (GMT-5)</SelectItem>
 <SelectItem value="Europe/London">Europe/London (GMT+0)</SelectItem>
 <SelectItem value="Asia/Tokyo">Asia/Tokyo (GMT+9)</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label htmlFor="dateFormat">日期格式</Label>
 <Select
 value={settings.date_format || "YYYY-MM-DD HH:mm:ss"}
 onValueChange={(value) => handleSettingChange("date_format", value)}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="YYYY-MM-DD HH:mm:ss">2024-01-15 14:30:00</SelectItem>
 <SelectItem value="MM/DD/YYYY HH:mm">01/15/2024 14:30</SelectItem>
 <SelectItem value="DD/MM/YYYY HH:mm">15/01/2024 14:30</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>
 </CardContent>
 </Card>

 {/* 功能设置 */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Server className="h-5 w-5" />
 功能设置
 </CardTitle>
 <CardDescription>
 控制系统功能的启用和禁用
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div className="space-y-0.5">
 <Label>用户注册</Label>
 <p className="text-sm text-muted-foreground">
 允许新用户自主注册账号
 </p>
 </div>
 <Switch
 checked={settings.enable_user_registration}
 onCheckedChange={(checked) => handleSettingChange("enable_user_registration", checked)}
 />
 </div>

 <div className="flex items-center justify-between">
 <div className="space-y-0.5">
 <Label>访客访问</Label>
 <p className="text-sm text-muted-foreground">
 允许访客用户查看部分信息
 </p>
 </div>
 <Switch
 checked={settings.enable_guest_access}
 onCheckedChange={(checked) => handleSettingChange("enable_guest_access", checked)}
 />
 </div>

 <div className="flex items-center justify-between">
 <div className="space-y-0.5">
 <Label>文件管理器</Label>
 <p className="text-sm text-muted-foreground">
 启用Web文件管理功能
 </p>
 </div>
 <Switch
 checked={settings.enable_file_manager}
 onCheckedChange={(checked) => handleSettingChange("enable_file_manager", checked)}
 />
 </div>
 </div>

 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div className="space-y-0.5">
 <Label>Web终端</Label>
 <p className="text-sm text-muted-foreground">
 启用浏览器终端功能
 </p>
 </div>
 <Switch
 checked={settings.enable_web_terminal}
 onCheckedChange={(checked) => handleSettingChange("enable_web_terminal", checked)}
 />
 </div>

 <div className="flex items-center justify-between">
 <div className="space-y-0.5">
 <Label>系统监控</Label>
 <p className="text-sm text-muted-foreground">
 启用系统资源监控功能
 </p>
 </div>
 <Switch
 checked={settings.enable_monitoring}
 onCheckedChange={(checked) => handleSettingChange("enable_monitoring", checked)}
 />
 </div>

 <div className="flex items-center justify-between">
 <div className="space-y-0.5">
 <Label>维护模式</Label>
 <p className="text-sm text-muted-foreground">
 启用后将显示维护页面
 </p>
 </div>
 <Switch
 checked={settings.enable_maintenance_mode}
 onCheckedChange={(checked) => handleSettingChange("enable_maintenance_mode", checked)}
 />
 </div>
 </div>
 </div>
 </CardContent>
 </Card>

 {/* 安全设置 */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Shield className="h-5 w-5" />
 安全设置
 </CardTitle>
 <CardDescription>
 配置系统安全策略和访问控制
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="sessionTimeout">会话超时时间 (分钟)</Label>
 <Input
 id="sessionTimeout"
 type="number"
 value={settings.session_timeout || 30}
 onChange={(e) => handleSettingChange("session_timeout", parseInt(e.target.value))}
 min="5"
 max="1440"
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="maxLoginAttempts">最大登录尝试次数</Label>
 <Input
 id="maxLoginAttempts"
 type="number"
 value={settings.max_login_attempts || 5}
 onChange={(e) => handleSettingChange("max_login_attempts", parseInt(e.target.value))}
 min="1"
 max="10"
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="passwordMinLength">密码最小长度</Label>
 <Input
 id="passwordMinLength"
 type="number"
 value={settings.password_min_length || 8}
 onChange={(e) => handleSettingChange("password_min_length", parseInt(e.target.value))}
 min="6"
 max="32"
 />
 </div>
 <div className="flex items-center space-x-2 pt-6">
 <Switch
 id="requireTwoFactor"
 checked={settings.require_two_factor}
 onCheckedChange={(checked) => handleSettingChange("require_two_factor", checked)}
 />
 <Label htmlFor="requireTwoFactor">强制双因子认证</Label>
 </div>
 </div>
 </CardContent>
 </Card>

 {/* 邮件设置 */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Mail className="h-5 w-5" />
 邮件设置
 </CardTitle>
 <CardDescription>
 配置SMTP服务器用于发送系统通知邮件
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="flex items-center space-x-2 mb-4">
 <Switch
 id="enableEmailNotifications"
 checked={settings.enableEmailNotifications}
 onCheckedChange={(checked) => handleSettingChange("enableEmailNotifications", checked)}
 />
 <Label htmlFor="enableEmailNotifications">启用邮件通知</Label>
 </div>

 {settings.enableEmailNotifications && (
 <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={(e) => e.preventDefault()}>
 <div className="space-y-2">
 <Label htmlFor="smtpHost">SMTP 服务器</Label>
 <Input
 id="smtpHost"
 value={settings.smtpHost}
 onChange={(e) => handleSettingChange("smtpHost", e.target.value)}
 placeholder="smtp.example.com"
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="smtpPort">端口</Label>
 <Input
 id="smtpPort"
 type="number"
 value={settings.smtpPort}
 onChange={(e) => handleSettingChange("smtpPort", parseInt(e.target.value))}
 placeholder="587"
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="smtpUser">用户名</Label>
 <Input
 id="smtpUser"
 value={settings.smtpUser}
 onChange={(e) => handleSettingChange("smtpUser", e.target.value)}
 placeholder="your-email@example.com"
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="smtpPassword">密码</Label>
 <Input
 id="smtpPassword"
 type="password"
 autoComplete="new-password"
 value={settings.smtpPassword}
 onChange={(e) => handleSettingChange("smtpPassword", e.target.value)}
 placeholder="••••••••"
 />
 </div>
 <div className="space-y-2 md:col-span-2">
 <Label htmlFor="smtpFrom">发件人地址</Label>
 <Input
 id="smtpFrom"
 value={settings.smtpFrom}
 onChange={(e) => handleSettingChange("smtpFrom", e.target.value)}
 placeholder="noreply@example.com"
 />
 </div>
 </form>
 )}
 </CardContent>
 </Card>

 {/* 系统设置 */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Clock className="h-5 w-5" />
 系统设置
 </CardTitle>
 <CardDescription>
 配置系统性能和显示选项
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="defaultPageSize">默认分页大小</Label>
 <Select
 value={settings.default_page_size?.toString() || "20"}
 onValueChange={(value) => handleSettingChange("default_page_size", parseInt(value))}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="10">10 条/页</SelectItem>
 <SelectItem value="20">20 条/页</SelectItem>
 <SelectItem value="50">50 条/页</SelectItem>
 <SelectItem value="100">100 条/页</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label htmlFor="maxFileUploadSize">文件上传大小限制 (MB)</Label>
 <Input
 id="maxFileUploadSize"
 type="number"
 value={settings.max_file_upload_size || 100}
 onChange={(e) => handleSettingChange("max_file_upload_size", parseInt(e.target.value))}
 min="1"
 max="1024"
 />
 </div>
 </div>

 <Separator className="my-4" />

 <div className="flex items-center space-x-2">
 <Switch
 id="enableSystemStats"
 checked={settings.enable_system_stats}
 onCheckedChange={(checked) => handleSettingChange("enable_system_stats", checked)}
 />
 <Label htmlFor="enableSystemStats">启用系统统计信息收集</Label>
 </div>
 </CardContent>
 </Card>

 {/* 标签/会话设置 */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 标签/会话设置
 </CardTitle>
 <CardDescription>
 控制页签数量、未活动断开提醒和后台休眠
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="maxTabs">最大页签数</Label>
 <Input
 id="maxTabs"
 type="number"
 min={1}
 max={200}
 value={tabSettings.maxTabs}
 onChange={(e) => setTabSettings(s => ({ ...s, maxTabs: Math.max(1, Math.min(200, parseInt(e.target.value || '0'))) }))}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="inactiveMinutes">未活动断开提醒 (分钟)</Label>
 <Input
 id="inactiveMinutes"
 type="number"
 min={5}
 max={1440}
 value={tabSettings.inactiveMinutes}
 onChange={(e) => setTabSettings(s => ({ ...s, inactiveMinutes: Math.max(5, Math.min(1440, parseInt(e.target.value || '0'))) }))}
 />
 </div>
 </div>
 <div className="flex items-center justify-between">
 <div className="space-y-0.5">
 <Label>后台页签休眠</Label>
 <p className="text-sm text-muted-foreground">未激活的页签不渲染终端以释放资源</p>
 </div>
 <Switch
 checked={tabSettings.hibernate}
 onCheckedChange={(checked) => setTabSettings(s => ({ ...s, hibernate: checked }))}
 />
 </div>

 <div className="flex justify-end">
 <Button onClick={handleSaveTabs}>保存页签设置</Button>
 </div>
 </CardContent>
 </Card>
 </>
 )}
 </div>
 </>
 )
}
