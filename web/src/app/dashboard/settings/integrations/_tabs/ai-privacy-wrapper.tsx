"use client"

import { useSettingsForm } from "@/hooks/settings/use-settings-form"
import { aiPrivacySchema } from "@/schemas/settings/integrations.schema"
import { settingsApi } from "@/lib/api/settings"
import { SettingsSection } from "@/components/settings/settings-section"
import { SettingsLoading } from "@/components/settings/settings-loading"
import { FormInput, FormSwitch } from "@/components/settings/form-field"
import { Button } from "@/components/ui/button"
import { Shield, Save, Loader2, RotateCcw } from "lucide-react"

export function AIPrivacyWrapper() {
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
    <div className="space-y-4">
      <SettingsSection
        title="隐私设置"
        description="管理AI对话的隐私和数据保留"
        icon={<Shield className="h-5 w-5" />}
      >
        <FormSwitch form={form} name="save_history" label="保存历史记录" description="保存AI对话历史" />
        <FormSwitch form={form} name="allow_training" label="允许用于训练" description="允许AI提供商使用对话数据进行模型训练" />
        <FormInput form={form} name="auto_delete_days" label="自动删除天数" type="number" min={7} max={365} />
      </SettingsSection>

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
