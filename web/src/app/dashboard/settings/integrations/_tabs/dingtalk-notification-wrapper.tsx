"use client"

import { useSettingsForm } from "@/hooks/settings/use-settings-form"
import { dingTalkConfigSchema } from "@/schemas/settings/integrations.schema"
import { settingsApi } from "@/lib/api/settings"
import { DingTalkNotificationTab } from "./dingtalk-notification-tab"
import { Button } from "@/components/ui/button"
import { Save, Loader2, RotateCcw } from "lucide-react"
import { SettingsLoading } from "@/components/settings/settings-loading"

export function DingTalkNotificationWrapper() {
  const { form, isLoading, isSaving, handleSave, reload } = useSettingsForm({
    schema: dingTalkConfigSchema,
    loadFn: async () => {
      const config = await settingsApi.getDingTalkConfig()
      return {
        dingtalk_enabled: config.enabled,
        dingtalk_webhook_url: config.webhook_url,
        dingtalk_secret: config.secret,
      }
    },
    saveFn: async (data) => {
      await settingsApi.saveDingTalkConfig({
        enabled: data.dingtalk_enabled,
        webhook_url: data.dingtalk_webhook_url,
        secret: data.dingtalk_secret || "",
      })
    },
  })

  if (isLoading) {
    return <SettingsLoading />
  }

  return (
    <div className="space-y-4">
      <DingTalkNotificationTab form={form} />

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
