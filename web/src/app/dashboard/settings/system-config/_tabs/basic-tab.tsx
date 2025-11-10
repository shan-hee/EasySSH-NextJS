"use client"

import { SettingsSection } from "@/components/settings/settings-section"
import { FormInput, FormSelect } from "@/components/settings/form-field"
import { Settings } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { SystemConfigFormData } from "@/schemas/settings/system-config.schema"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"

interface BasicTabProps {
  form: UseFormReturn<SystemConfigFormData>
}

const languageOptions = [
  { label: "简体中文", value: "zh-CN" },
  { label: "English", value: "en-US" },
  { label: "日本語", value: "ja-JP" },
]

export function BasicTab({ form }: BasicTabProps) {
  const logoUrl = form.watch("system_logo")
  const faviconUrl = form.watch("system_favicon")

  return (
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

      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          修改基本信息后,部分更改可能需要刷新页面才能生效。
        </AlertDescription>
      </Alert>
    </SettingsSection>
  )
}
