"use client"

import { useEffect, useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Save,
  Settings,
  Globe,
  Clock,
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
    system_logo: "/logo.svg",
    system_favicon: "/favicon.ico",

    // 国际化设置
    default_language: "zh-CN",
    default_timezone: "Asia/Shanghai",
    date_format: "YYYY-MM-DD HH:mm:ss",

    // 其他设置
    default_page_size: 20,
    max_file_upload_size: 100,
  })

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

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
      }
    } else if (typeof value === 'number') {
      switch (key) {
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


  const handleResetToDefaults = async () => {
    // 重置为默认值
    const defaultSettings: SystemConfig = {
      // 基本设置
      system_name: "EasySSH",
      system_logo: "/logo.svg",
      system_favicon: "/favicon.ico",

      // 国际化设置
      default_language: "zh-CN",
      default_timezone: "Asia/Shanghai",
      date_format: "YYYY-MM-DD HH:mm:ss",

      // 其他设置
      default_page_size: 20,
      max_file_upload_size: 100,
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

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 pt-0 overflow-auto">
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
                <div className="space-y-2">
                  <Label htmlFor="systemLogo">系统Logo URL</Label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 border rounded-lg flex items-center justify-center bg-muted overflow-hidden shrink-0">
                      {settings.system_logo ? (
                        <img
                          src={settings.system_logo}
                          alt="系统Logo"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <Input
                        id="systemLogo"
                        value={settings.system_logo}
                        onChange={(e) => handleSettingChange("system_logo", e.target.value)}
                        placeholder="输入Logo图片URL，如: /logo.svg 或 https://example.com/logo.png"
                        disabled={isLoading}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        支持相对路径(如 /logo.svg)或完整URL
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="systemFavicon">系统Favicon URL</Label>
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 border rounded flex items-center justify-center bg-muted overflow-hidden shrink-0">
                      {settings.system_favicon ? (
                        <img
                          src={settings.system_favicon}
                          alt="系统Favicon"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <Input
                        id="systemFavicon"
                        value={settings.system_favicon}
                        onChange={(e) => handleSettingChange("system_favicon", e.target.value)}
                        placeholder="输入Favicon图标URL，如: /logo.svg"
                        disabled={isLoading}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        推荐尺寸: 32x32px或16x16px，支持 .svg, .png, .ico 格式
                      </p>
                    </div>
                  </div>
                </div>

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


            {/* 性能设置 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  性能设置
                </CardTitle>
                <CardDescription>
                  配置系统性能和显示选项
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pageSize">默认分页大小</Label>
                    <Input
                      id="pageSize"
                      type="number"
                      min={10}
                      max={100}
                      value={settings.default_page_size}
                      onChange={(e) => handleSettingChange("default_page_size", parseInt(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      列表页面默认显示的记录数量
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxFileSize">最大文件上传大小 (MB)</Label>
                    <Input
                      id="maxFileSize"
                      type="number"
                      min={1}
                      max={1024}
                      value={settings.max_file_upload_size}
                      onChange={(e) => handleSettingChange("max_file_upload_size", parseInt(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      单个文件上传的最大大小限制
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

          </>
        )}
      </div>
    </>
  )
}
