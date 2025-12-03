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
      const config = await settingsApi.getNotificationConfig()
      return {
        wecom_enabled: config.wecom.enabled,
        wecom_webhook_url: config.wecom.webhook_url,
      }
    },
    saveFn: async (data) => {
      // 只提交企业微信配置
      await settingsApi.saveWeComConfigOnly({
        enabled: data.wecom_enabled,
        webhook_url: data.wecom_webhook_url,
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
          <WeComNotificationTab form={form} />
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
