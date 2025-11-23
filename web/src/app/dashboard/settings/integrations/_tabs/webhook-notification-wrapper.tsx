"use client"

import { useSettingsForm } from "@/hooks/settings/use-settings-form"
import { webhookConfigSchema } from "@/schemas/settings/integrations.schema"
import { settingsApi } from "@/lib/api/settings"
import { WebhookNotificationTab } from "./webhook-notification-tab"
import { Button } from "@/components/ui/button"
import { Save, Loader2, RotateCcw } from "lucide-react"
import { SettingsLoading } from "@/components/settings/settings-loading"

export function WebhookNotificationWrapper() {
  const { form, isLoading, isSaving, handleSave, reload } = useSettingsForm({
    schema: webhookConfigSchema,
    loadFn: async () => {
      const config = await settingsApi.getWebhookConfig()
      return {
        webhook_enabled: config.enabled,
        webhook_url: config.url,
        webhook_method: config.method as "POST" | "GET",
        webhook_secret: config.secret,
      }
    },
    saveFn: async (data) => {
      await settingsApi.saveWebhookConfig({
        enabled: data.webhook_enabled,
        url: data.webhook_url,
        method: data.webhook_method,
        secret: data.webhook_secret || "",
      })
    },
  })

  if (isLoading) {
    return <SettingsLoading />
  }

  return (
    <div className="space-y-4">
      <WebhookNotificationTab form={form} />

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
