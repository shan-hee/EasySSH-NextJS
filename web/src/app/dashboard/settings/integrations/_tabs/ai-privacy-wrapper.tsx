"use client"

import { useTranslations } from "next-intl"
import { useSettingsForm } from "@/hooks/settings/use-settings-form"
import { aiPrivacySchema } from "@/schemas/settings/integrations.schema"
import { settingsApi } from "@/lib/api/settings"
import { SettingsSection } from "@/components/settings/settings-section"
import { SettingsLoading } from "@/components/settings/settings-loading"
import { FormInput, FormSwitch } from "@/components/settings/form-field"
import { Button } from "@/components/ui/button"
import { Shield, Save, Loader2, RotateCcw } from "lucide-react"

export function AIPrivacyWrapper() {
  const tPrivacy = useTranslations("settingsIntegrationsPrivacy")
  const tCommon = useTranslations("common")
  const { form, isLoading, isSaving, handleSave, reload } = useSettingsForm({
    schema: aiPrivacySchema,
    loadFn: async () => {
      return await settingsApi.getAIPrivacySettings()
    },
    saveFn: async (data) => {
      await settingsApi.saveAIPrivacySettings(data)
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
          <SettingsSection
            title={tPrivacy("sectionTitle")}
            description={tPrivacy("sectionDescription")}
            icon={<Shield className="h-5 w-5" />}
          >
            <FormSwitch
              form={form}
              name="save_history"
              label={tPrivacy("fieldSaveHistoryLabel")}
              description={tPrivacy("fieldSaveHistoryDesc")}
            />
            <FormSwitch
              form={form}
              name="allow_training"
              label={tPrivacy("fieldAllowTrainingLabel")}
              description={tPrivacy("fieldAllowTrainingDesc")}
            />
            <FormInput
              form={form}
              name="auto_delete_days"
              label={tPrivacy("fieldAutoDeleteDaysLabel")}
              type="number"
              min={7}
              max={365}
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
