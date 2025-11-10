"use client"

import { SettingsSection } from "@/components/settings/settings-section"
import { FormInput } from "@/components/settings/form-field"
import { Zap } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { SystemConfigFormData } from "@/schemas/settings/system-config.schema"

interface PerformanceTabProps {
  form: UseFormReturn<SystemConfigFormData>
}

export function PerformanceTab({ form }: PerformanceTabProps) {
  return (
    <div className="space-y-6">
      {/* 基本性能设置 */}
      <SettingsSection
        title="基本性能设置"
        description="配置系统的基本性能参数"
        icon={<Zap className="h-5 w-5" />}
      >
        <FormInput
          form={form}
          name="default_page_size"
          label="默认分页大小"
          description="列表页面每页显示的默认条数 (10-100)"
          type="number"
          min={10}
          max={100}
          step={5}
          required
        />

        <FormInput
          form={form}
          name="max_file_upload_size"
          label="最大文件上传大小 (MB)"
          description="允许上传的单个文件最大大小 (1-1024 MB)"
          type="number"
          min={1}
          max={1024}
          step={1}
          required
        />
      </SettingsSection>
    </div>
  )
}
