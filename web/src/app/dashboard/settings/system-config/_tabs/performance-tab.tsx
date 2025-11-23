"use client"

import { SettingsSection } from "@/components/settings/settings-section"
import { FormInput } from "@/components/settings/form-field"
import { Zap, Save, Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSettingsForm } from "@/hooks/settings/use-settings-form"
import { performanceSchema } from "@/schemas/settings/system-config.schema"
import { settingsApi } from "@/lib/api/settings"
import { SettingsLoading } from "@/components/settings/settings-loading"

export function PerformanceTab() {
  const { form, isLoading, isSaving, handleSave, reload } = useSettingsForm({
    schema: performanceSchema,
    loadFn: async () => {
      const data = await settingsApi.getSystemConfig()
      return {
        default_page_size: data.default_page_size,
        max_file_upload_size: data.max_file_upload_size,
      }
    },
    saveFn: async (data) => {
      const fullConfig = await settingsApi.getSystemConfig()
      const updatedConfig = {
        ...fullConfig,
        ...data,
      }
      await settingsApi.saveSystemConfig(updatedConfig)
    },
  })

  if (isLoading) {
    return <SettingsLoading />
  }

  return (
    <div className="space-y-4">
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
