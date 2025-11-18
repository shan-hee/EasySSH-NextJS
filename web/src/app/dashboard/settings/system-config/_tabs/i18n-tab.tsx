"use client"

import { SettingsSection } from "@/components/settings/settings-section"
import { FormSelect } from "@/components/settings/form-field"
import { Globe } from "lucide-react"
import { type UseFormReturn } from "react-hook-form"
import { type SystemConfigFormData } from "@/schemas/settings/system-config.schema"

interface I18nTabProps {
  form: UseFormReturn<SystemConfigFormData>
}

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

export function I18nTab({ form }: I18nTabProps) {
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
    <SettingsSection
      title="国际化设置"
      description="配置时区和日期时间格式"
      icon={<Globe className="h-5 w-5" />}
    >
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
  )
}
