"use client"

import { useTranslations } from "next-intl"
import { SettingsSection } from "@/components/settings/settings-section"
import { FormSelect } from "@/components/settings/form-field"
import { Globe, Save, Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSettingsForm } from "@/hooks/settings/use-settings-form"
import { i18nSchema } from "@/schemas/settings/system-config.schema"
import { settingsApi } from "@/lib/api/settings"
import { SettingsLoading } from "@/components/settings/settings-loading"

export function I18nTab() {
  const t = useTranslations("settingsSystemI18n")
  const tBasic = useTranslations("settingsSystemBasic")
  const tCommon = useTranslations("common")

  const timezoneOptions = [
    { label: tBasic("timezoneAsiaShanghai"), value: "Asia/Shanghai" },
    { label: tBasic("timezoneAsiaTokyo"), value: "Asia/Tokyo" },
    { label: tBasic("timezoneAsiaHongKong"), value: "Asia/Hong_Kong" },
    { label: tBasic("timezoneAmericaNewYork"), value: "America/New_York" },
    { label: tBasic("timezoneAmericaLosAngeles"), value: "America/Los_Angeles" },
    { label: tBasic("timezoneEuropeLondon"), value: "Europe/London" },
    { label: tBasic("timezoneEuropeParis"), value: "Europe/Paris" },
    { label: tBasic("timezoneUTC"), value: "UTC" },
  ]

  const dateFormatOptions = [
    { label: "YYYY-MM-DD HH:mm:ss", value: "YYYY-MM-DD HH:mm:ss" },
    { label: "YYYY/MM/DD HH:mm:ss", value: "YYYY/MM/DD HH:mm:ss" },
    { label: "DD/MM/YYYY HH:mm:ss", value: "DD/MM/YYYY HH:mm:ss" },
    { label: "MM/DD/YYYY HH:mm:ss", value: "MM/DD/YYYY HH:mm:ss" },
    { label: "YYYY-MM-DD", value: "YYYY-MM-DD" },
    { label: "DD-MM-YYYY", value: "DD-MM-YYYY" },
  ]
  const { form, isLoading, isSaving, handleSave, reload } = useSettingsForm({
    schema: i18nSchema,
    loadFn: async () => {
      const data = await settingsApi.getSystemConfig()
      return {
        default_timezone: data.default_timezone,
        date_format: data.date_format,
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
    <div className="flex flex-1 min-h-0 flex-col">
      {/* 可滚动内容区 */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-custom p-4">
        <div className="space-y-4">
          <SettingsSection
            title={t("sectionTitle")}
        description={t("sectionDescription")}
        icon={<Globe className="h-5 w-5" />}
      >
        <FormSelect
          form={form}
          name="default_timezone"
          label={t("fieldDefaultTimezone")}
          description={t("fieldDefaultTimezoneDesc")}
          required
          options={timezoneOptions}
          placeholder={t("placeholderTimezone")}
        />

        <FormSelect
          form={form}
          name="date_format"
          label={t("fieldDateFormat")}
          description={t("fieldDateFormatDesc")}
          required
          options={dateFormatOptions}
          placeholder={t("placeholderDateFormat")}
        />

        {selectedFormat && (
          <div className="rounded-lg border p-4 bg-muted/50">
            <p className="text-sm font-medium mb-1">{t("previewTitle")}</p>
            <p className="text-lg font-mono">{formatPreview(selectedFormat)}</p>
          </div>
        )}
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
