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
    defaultValues: {
      enabled: false,
      host: "",
      port: 587,
      username: "",
      password: "",
      from_email: "",
      from_name: "",
      use_tls: true,
    },
    loadFn: async () => {
      const config = await settingsApi.getNotificationConfig()
      return {
        enabled: config.smtp.enabled ?? false,
        host: config.smtp.host ?? "",
        port: config.smtp.port ?? 587,
        username: config.smtp.username ?? "",
        password: config.smtp.password ?? "",
        from_email: config.smtp.from_email ?? "",
        from_name: config.smtp.from_name ?? "",
        use_tls: config.smtp.use_tls ?? true,
      }
    },
    saveFn: async (data) => {
      // 只提交 SMTP 配置
      await settingsApi.saveSMTPConfigOnly({
        enabled: data.enabled ?? false,
        host: data.host ?? "",
        port: data.port ?? 587,
        username: data.username ?? "",
        password: data.password ?? "",
        from_email: data.from_email ?? "",
        from_name: data.from_name ?? "",
        use_tls: data.use_tls ?? true,
      })
    },
  })

  if (isLoading) {
    return <SettingsLoading />
  }

  return (
    <div className="relative h-full">
      {/* 可滚动内容区 - 底部留出按钮区域的空间 */}
      <div className="h-full overflow-y-auto scrollbar-custom p-4 pb-20">
        <div className="space-y-4">
          <EmailNotificationTab form={form} />
        </div>
      </div>

      {/* 固定底部按钮区 - 使用绝对定位固定在底部 */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-end gap-2 p-4 bg-background">
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
