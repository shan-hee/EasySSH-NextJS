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
  Image as ImageIcon
} from "lucide-react"

export default function SettingsGeneralPage() {
  const [settings, setSettings] = useState({
    // 基本设置
    systemName: "EasySSH",
    systemDescription: "简单易用的SSH管理平台",
    systemLogo: "/logo.svg",
    favicon: "/favicon.ico",

    // 国际化设置
    defaultLanguage: "zh-CN",
    defaultTimezone: "Asia/Shanghai",
    dateFormat: "YYYY-MM-DD HH:mm:ss",

    // 功能设置
    enableUserRegistration: false,
    enableGuestAccess: false,
    enableFileManager: true,
    enableWebTerminal: true,
    enableMonitoring: true,

    // 安全设置
    sessionTimeout: 30,
    maxLoginAttempts: 5,
    passwordMinLength: 8,
    requireTwoFactor: false,

    // 邮件设置
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPassword: "",
    smtpFrom: "",
    enableEmailNotifications: false,

    // 其他设置
    defaultPageSize: 20,
    maxFileUploadSize: 100,
    enableSystemStats: true,
    enableMaintenanceMode: false,
  })

  const [isSaving, setIsSaving] = useState(false)
  const [tabSettings, setTabSettings] = useState({
    maxTabs: 50,
    inactiveMinutes: 60,
    hibernate: true,
  })

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
    setSettings(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    // 模拟保存
    setTimeout(() => {
      setIsSaving(false)
      console.log("设置已保存:", settings)
    }, 1000)
  }

  const handleLogoUpload = () => {
    console.log("上传Logo")
    // 这里应该打开文件选择对话框
  }

  const handleSaveTabs = async () => {
    try {
      localStorage.setItem("tab.maxTabs", String(tabSettings.maxTabs))
      localStorage.setItem("tab.inactiveMinutes", String(tabSettings.inactiveMinutes))
      localStorage.setItem("tab.hibernate", String(tabSettings.hibernate))
    } catch {}
  }

  return (
    <>
      <PageHeader
        title="通用设置"
        breadcrumbs={[
          { title: "系统与组织", href: "#" },
          { title: "通用设置" }
        ]}
      >
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "保存中..." : "保存设置"}
        </Button>
      </PageHeader>

      <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
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
                  value={settings.systemName}
                  onChange={(e) => handleSettingChange("systemName", e.target.value)}
                  placeholder="输入系统名称"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultLanguage">默认语言</Label>
                <Select
                  value={settings.defaultLanguage}
                  onValueChange={(value) => handleSettingChange("defaultLanguage", value)}
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
                value={settings.systemDescription}
                onChange={(e) => handleSettingChange("systemDescription", e.target.value)}
                placeholder="输入系统描述"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>系统Logo</Label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 border rounded-lg flex items-center justify-center bg-muted">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-2">
                    推荐尺寸: 64x64px，支持 PNG, JPG, SVG 格式
                  </p>
                  <Button variant="outline" size="sm" onClick={handleLogoUpload}>
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
                  value={settings.defaultTimezone}
                  onValueChange={(value) => handleSettingChange("defaultTimezone", value)}
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
                  value={settings.dateFormat}
                  onValueChange={(value) => handleSettingChange("dateFormat", value)}
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
                    checked={settings.enableUserRegistration}
                    onCheckedChange={(checked) => handleSettingChange("enableUserRegistration", checked)}
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
                    checked={settings.enableGuestAccess}
                    onCheckedChange={(checked) => handleSettingChange("enableGuestAccess", checked)}
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
                    checked={settings.enableFileManager}
                    onCheckedChange={(checked) => handleSettingChange("enableFileManager", checked)}
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
                    checked={settings.enableWebTerminal}
                    onCheckedChange={(checked) => handleSettingChange("enableWebTerminal", checked)}
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
                    checked={settings.enableMonitoring}
                    onCheckedChange={(checked) => handleSettingChange("enableMonitoring", checked)}
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
                    checked={settings.enableMaintenanceMode}
                    onCheckedChange={(checked) => handleSettingChange("enableMaintenanceMode", checked)}
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
                  value={settings.sessionTimeout}
                  onChange={(e) => handleSettingChange("sessionTimeout", parseInt(e.target.value))}
                  min="5"
                  max="1440"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxLoginAttempts">最大登录尝试次数</Label>
                <Input
                  id="maxLoginAttempts"
                  type="number"
                  value={settings.maxLoginAttempts}
                  onChange={(e) => handleSettingChange("maxLoginAttempts", parseInt(e.target.value))}
                  min="1"
                  max="10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passwordMinLength">密码最小长度</Label>
                <Input
                  id="passwordMinLength"
                  type="number"
                  value={settings.passwordMinLength}
                  onChange={(e) => handleSettingChange("passwordMinLength", parseInt(e.target.value))}
                  min="6"
                  max="32"
                />
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <Switch
                  id="requireTwoFactor"
                  checked={settings.requireTwoFactor}
                  onCheckedChange={(checked) => handleSettingChange("requireTwoFactor", checked)}
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
                  value={settings.defaultPageSize.toString()}
                  onValueChange={(value) => handleSettingChange("defaultPageSize", parseInt(value))}
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
                  value={settings.maxFileUploadSize}
                  onChange={(e) => handleSettingChange("maxFileUploadSize", parseInt(e.target.value))}
                  min="1"
                  max="1024"
                />
              </div>
            </div>

            <Separator className="my-4" />

            <div className="flex items-center space-x-2">
              <Switch
                id="enableSystemStats"
                checked={settings.enableSystemStats}
                onCheckedChange={(checked) => handleSettingChange("enableSystemStats", checked)}
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
      </div>
    </>
  )
}
