"use client"

import { SettingsSection } from "@/components/settings/settings-section"
import { FormInput, FormSelect } from "@/components/settings/form-field"
import { Settings, Save, Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSettingsForm } from "@/hooks/settings/use-settings-form"
import { basicInfoSchema } from "@/schemas/settings/system-config.schema"
import { settingsApi } from "@/lib/api/settings"
import { SettingsLoading } from "@/components/settings/settings-loading"

const languageOptions = [
  { label: "简体中文", value: "zh-CN" },
  { label: "English", value: "en-US" },
  { label: "日本語", value: "ja-JP" },
]

const timezoneOptions = [
  { label: "Asia/Shanghai (东八区)", value: "Asia/Shanghai" },
  { label: "Asia/Tokyo (东九区)", value: "Asia/Tokyo" },
  { label: "Asia/Hong_Kong (东八区)", value: "Asia/Hong_Kong" },
  { label: "America/New_York (西五区)", value: "America/New_York" },
  { label: "America/Los_Angeles (西八区)", value: "America/Los_Angeles" },
  { label: "Europe/London (零时区)", value: "Europe/London" },
  { label: "Europe/Paris (东一区)", value: "Europe/Paris" },
  { label: "UTC (协调世界时)", value: "UTC" },
]

const dateFormatOptions = [
  { label: "YYYY-MM-DD HH:mm:ss", value: "YYYY-MM-DD HH:mm:ss" },
  { label: "YYYY/MM/DD HH:mm:ss", value: "YYYY/MM/DD HH:mm:ss" },
  { label: "DD/MM/YYYY HH:mm:ss", value: "DD/MM/YYYY HH:mm:ss" },
  { label: "MM/DD/YYYY HH:mm:ss", value: "MM/DD/YYYY HH:mm:ss" },
  { label: "YYYY-MM-DD", value: "YYYY-MM-DD" },
  { label: "DD-MM-YYYY", value: "DD-MM-YYYY" },
]

export function BasicTab() {
  const { form, isLoading, isSaving, handleSave, reload } = useSettingsForm({
    schema: basicInfoSchema,
    loadFn: async () => {
      const data = await settingsApi.getSystemConfig()
      return {
        system_name: data.system_name,
        system_logo: data.system_logo,
        system_favicon: data.system_favicon,
        default_language: data.default_language,
        default_timezone: data.default_timezone,
        date_format: data.date_format,
      }
    },
    saveFn: async (data) => {
      // 加载完整配置
      const fullConfig = await settingsApi.getSystemConfig()
      // 合并当前页签的修改
      const updatedConfig = {
        ...fullConfig,
        ...data,
      }
      // 全量保存
      await settingsApi.saveSystemConfig(updatedConfig)
    },
  })

  if (isLoading) {
    return <SettingsLoading />
  }

  const logoUrl = form.watch("system_logo")
  const faviconUrl = form.watch("system_favicon")
  const selectedFormat = form.watch("date_format")
  const currentDate = new Date()

  // 简单的日期格式化示例
  const formatPreview = (format: string) => {
    const year = currentDate.getFullYear()
    const month = String(currentDate.getMonth() + 1).padStart(2, "0")
    const day = String(currentDate.getDate()).padStart(2, "0")
    const hours = String(currentDate.getHours()).padStart(2, "0")
    const minutes = String(currentDate.getMinutes()).padStart(2, "0")
    const seconds = String(currentDate.getSeconds()).padStart(2, "0")

    return format
      .replace("YYYY", String(year))
      .replace("MM", month)
      .replace("DD", day)
      .replace("HH", hours)
      .replace("mm", minutes)
      .replace("ss", seconds)
  }

  return (
    <div className="space-y-4">
      <SettingsSection
        title="基本信息"
        description="配置系统的基本信息和外观"
        icon={<Settings className="h-5 w-5" />}
      >
        <FormInput
          form={form}
          name="system_name"
          label="系统名称"
          description="显示在浏览器标题和页面中的系统名称"
          required
          placeholder="EasySSH"
        />

        <FormInput
          form={form}
          name="system_logo"
          label="系统Logo URL"
          description="系统主Logo的URL地址"
          type="url"
          placeholder="https://example.com/logo.svg"
        />

        {logoUrl && (
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium mb-2">Logo预览：</p>
            <img
              src={logoUrl}
              alt="Logo预览"
              className="h-16 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none"
              }}
            />
          </div>
        )}

        <FormInput
          form={form}
          name="system_favicon"
          label="系统Favicon URL"
          description="浏览器标签页显示的图标URL"
          type="url"
          placeholder="https://example.com/favicon.ico"
        />

        {faviconUrl && (
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium mb-2">Favicon预览：</p>
            <img
              src={faviconUrl}
              alt="Favicon预览"
              className="h-8 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none"
              }}
            />
          </div>
        )}

        <FormSelect
          form={form}
          name="default_language"
          label="默认语言"
          description="系统界面的默认显示语言"
          required
          options={languageOptions}
          placeholder="选择语言"
        />

        <FormSelect
          form={form}
          name="default_timezone"
          label="默认时区"
          description="系统使用的默认时区"
          required
          options={timezoneOptions}
          placeholder="选择时区"
        />

        <FormSelect
          form={form}
          name="date_format"
          label="日期格式"
          description="系统中日期时间的显示格式"
          required
          options={dateFormatOptions}
          placeholder="选择日期格式"
        />

        {selectedFormat && (
          <div className="rounded-lg border p-4 bg-muted/50">
            <p className="text-sm font-medium mb-1">格式预览：</p>
            <p className="text-lg font-mono">{formatPreview(selectedFormat)}</p>
          </div>
        )}
      </SettingsSection>

      {/* 保存按钮区域 */}
      <div className="flex justify-end gap-2 pt-6 pb-16 mt-6">
        <Button variant="outline" onClick={reload} disabled={isSaving}>
          <RotateCcw className="mr-2 h-4 w-4" />
          重置
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              保存
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
