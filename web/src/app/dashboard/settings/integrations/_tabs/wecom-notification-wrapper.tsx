"use client"

import { useSettingsForm } from "@/hooks/settings/use-settings-form"
import { weComConfigSchema } from "@/schemas/settings/integrations.schema"
import { settingsApi } from "@/lib/api/settings"
import { WeComNotificationTab } from "./wecom-notification-tab"
import { Button } from "@/components/ui/button"
import { Save, Loader2, RotateCcw } from "lucide-react"
import { SettingsLoading } from "@/components/settings/settings-loading"

export function WeComNotificationWrapper() {
  const { form, isLoading, isSaving, handleSave, reload } = useSettingsForm({
    schema: weComConfigSchema,
    loadFn: async () => {
      const config = await settingsApi.getWeComConfig()
      return {
        wecom_enabled: config.enabled,
        wecom_webhook_url: config.webhook_url,
      }
    },
    saveFn: async (data) => {
      await settingsApi.saveWeComConfig({
        enabled: data.wecom_enabled,
        webhook_url: data.wecom_webhook_url,
      })
    },
  })

  if (isLoading) {
    return <SettingsLoading />
  }

  return (
    <div className="space-y-4">
      <WeComNotificationTab form={form} />

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
