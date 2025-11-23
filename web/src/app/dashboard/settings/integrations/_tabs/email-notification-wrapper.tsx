"use client"

import { useSettingsForm } from "@/hooks/settings/use-settings-form"
import { smtpConfigSchema } from "@/schemas/settings/integrations.schema"
import { settingsApi } from "@/lib/api/settings"
import { EmailNotificationTab } from "./email-notification-tab"
import { Button } from "@/components/ui/button"
import { Save, Loader2, RotateCcw } from "lucide-react"
import { SettingsLoading } from "@/components/settings/settings-loading"

export function EmailNotificationWrapper() {
  const { form, isLoading, isSaving, handleSave, reload } = useSettingsForm({
    schema: smtpConfigSchema,
    loadFn: async () => {
      const config = await settingsApi.getSMTPConfig()
      return {
        enabled: config.enabled,
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        from_email: config.from_email,
        from_name: config.from_name,
        use_tls: config.use_tls,
      }
    },
    saveFn: async (data) => {
      await settingsApi.saveSMTPConfig({
        enabled: data.enabled,
        host: data.host,
        port: data.port,
        username: data.username,
        password: data.password,
        from_email: data.from_email,
        from_name: data.from_name,
        use_tls: data.use_tls,
      })
    },
  })

  if (isLoading) {
    return <SettingsLoading />
  }

  return (
    <div className="space-y-4">
      <EmailNotificationTab form={form} />

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
