"use client"

import { EmailNotificationTab } from "./email-notification-tab"
import { WebhookNotificationTab } from "./webhook-notification-tab"
import { DingTalkNotificationTab } from "./dingtalk-notification-tab"
import { WeComNotificationTab } from "./wecom-notification-tab"
import { useSettingsForm } from "@/hooks/settings/use-settings-form"
import { notificationConfigSchema } from "@/schemas/settings/integrations.schema"
import { settingsApi } from "@/lib/api/settings"
import { SettingsLoading } from "@/components/settings/settings-loading"
import { Button } from "@/components/ui/button"
import { Save, Loader2, RotateCcw } from "lucide-react"

export function NotificationConfigWrapper() {
  const { form, isLoading, isSaving, handleSave, reload } = useSettingsForm({
    schema: notificationConfigSchema,
    loadFn: async () => {
      // 使用统一的通知配置 API
      const config = await settingsApi.getNotificationConfig()

      // 将嵌套结构转换为扁平结构（匹配表单字段名）
      return {
        // SMTP 配置
        enabled: config.smtp.enabled,
        host: config.smtp.host,
        port: config.smtp.port,
        username: config.smtp.username,
        password: config.smtp.password,
        from_email: config.smtp.from_email,
        from_name: config.smtp.from_name,
        use_tls: config.smtp.use_tls,

        // Webhook 配置
        webhook_enabled: config.webhook.enabled,
        webhook_url: config.webhook.url,
        webhook_method: config.webhook.method,
        webhook_secret: config.webhook.secret,

        // 钉钉配置
        dingtalk_enabled: config.dingtalk.enabled,
        dingtalk_webhook_url: config.dingtalk.webhook_url,
        dingtalk_secret: config.dingtalk.secret,

        // 企业微信配置
        wecom_enabled: config.wecom.enabled,
        wecom_webhook_url: config.wecom.webhook_url,
      }
    },
    saveFn: async (data) => {
      // 将扁平结构转换为嵌套结构（匹配 API 格式）
      const config = {
        smtp: {
          enabled: data.enabled ?? false,
          host: data.host ?? "",
          port: data.port ?? 587,
          username: data.username ?? "",
          password: data.password ?? "",
          from_email: data.from_email ?? "",
          from_name: data.from_name ?? "",
          use_tls: data.use_tls ?? true,
        },
        webhook: {
          enabled: data.webhook_enabled ?? false,
          url: data.webhook_url ?? "",
          method: data.webhook_method ?? "POST",
          secret: data.webhook_secret ?? "",
        },
        dingtalk: {
          enabled: data.dingtalk_enabled ?? false,
          webhook_url: data.dingtalk_webhook_url ?? "",
          secret: data.dingtalk_secret ?? "",
        },
        wecom: {
          enabled: data.wecom_enabled ?? false,
          webhook_url: data.wecom_webhook_url ?? "",
        },
      }

      // 使用统一的通知配置 API 保存
      await settingsApi.saveNotificationConfig(config)
    },
  })

  if (isLoading) {
    return <SettingsLoading />
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* 可滚动内容区 - flex-1 + min-h-0 确保正确收缩 */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-custom p-4">
        <div className="space-y-6">
          {/* 邮件通知 */}
          <EmailNotificationTab form={form} />

          {/* Webhook 通知 */}
          <WebhookNotificationTab form={form} />

          {/* 钉钉通知 */}
          <DingTalkNotificationTab form={form} />

          {/* 企业微信通知 */}
          <WeComNotificationTab form={form} />
        </div>
      </div>

      {/* 固定底部按钮区 - shrink-0 防止被压缩 */}
      <div className="shrink-0 flex justify-end gap-2 p-4 bg-background">
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
