"use client"

import { useTranslations } from "next-intl"
import { useSettingsForm } from "@/hooks/settings/use-settings-form"
import { aiModelParamsSchema } from "@/schemas/settings/integrations.schema"
import { settingsApi } from "@/lib/api/settings"
import { SettingsSection } from "@/components/settings/settings-section"
import { SettingsLoading } from "@/components/settings/settings-loading"
import { FormInput } from "@/components/settings/form-field"
import { Button } from "@/components/ui/button"
import { Sliders, Save, Loader2, RotateCcw } from "lucide-react"

export function AIModelParamsWrapper() {
  const tAI = useTranslations("settingsIntegrationsAI")
  const tCommon = useTranslations("common")
  const { form, isLoading, isSaving, handleSave, reload } = useSettingsForm({
    schema: aiModelParamsSchema,
    loadFn: async () => {
      return await settingsApi.getAIModelParams()
    },
    saveFn: async (data) => {
      await settingsApi.saveAIModelParams(data)
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
            title={tAI("paramsSectionTitle")}
            description={tAI("paramsSectionDescription")}
            icon={<Sliders className="h-5 w-5" />}
          >
            <FormInput form={form} name="temperature" label="Temperature" type="number" step={0.1} min={0} max={2} />
            <FormInput form={form} name="max_tokens" label="Max Tokens" type="number" min={256} max={8192} />
            <FormInput form={form} name="top_p" label="Top P" type="number" step={0.1} min={0} max={1} />
            <FormInput form={form} name="frequency_penalty" label="Frequency Penalty" type="number" step={0.1} min={-2} max={2} />
            <FormInput form={form} name="presence_penalty" label="Presence Penalty" type="number" step={0.1} min={-2} max={2} />
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
