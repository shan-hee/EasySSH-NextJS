"use client"

import { useTranslations } from "next-intl"
import { SettingsSection } from "@/components/settings/settings-section"
import { FormInput } from "@/components/settings/form-field"
import { Zap, Save, Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSettingsForm } from "@/hooks/settings/use-settings-form"
import { performanceSchema } from "@/schemas/settings/system-config.schema"
import { settingsApi } from "@/lib/api/settings"
import { SettingsLoading } from "@/components/settings/settings-loading"

export function PerformanceTab() {
  const t = useTranslations("settingsSystemPerformance")
  const tCommon = useTranslations("common")
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
    <div className="flex flex-1 min-h-0 flex-col">
      {/* 可滚动内容区 */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-custom p-4">
        <div className="space-y-4">
          {/* 基本性能设置 */}
          <SettingsSection
        title={t("sectionTitle")}
        description={t("sectionDescription")}
        icon={<Zap className="h-5 w-5" />}
      >
        <FormInput
          form={form}
          name="default_page_size"
          label={t("fieldDefaultPageSize")}
          description={t("fieldDefaultPageSizeDesc")}
          type="number"
          min={10}
          max={100}
          step={5}
          required
        />

        <FormInput
          form={form}
          name="max_file_upload_size"
          label={t("fieldMaxUploadSize")}
          description={t("fieldMaxUploadSizeDesc")}
          type="number"
          min={1}
          max={1024}
          step={1}
          required
        />
          </SettingsSection>
        </div>
      </div>

      {/* 固定底部按钮区 */}
      <div className="shrink-0 flex justify-end gap-2 p-4 bg-background">
        <Button variant="outline" onClick={reload} disabled={isSaving}>
          <RotateCcw className="mr-2 h-4 w-4" />
          {tCommon("reset")}
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {tCommon("saving")}
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {tCommon("save")}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
