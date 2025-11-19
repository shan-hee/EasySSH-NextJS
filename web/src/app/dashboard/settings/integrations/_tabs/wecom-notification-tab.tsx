"use client"

import { SettingsSection } from "@/components/settings/settings-section"
import { FormInput, FormSwitch } from "@/components/settings/form-field"
import { Button } from "@/components/ui/button"
import { MessageCircle, Send } from "lucide-react"
import { type UseFormReturn } from "react-hook-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
import { useSettingsAPI } from "@/hooks/settings/use-settings-api"
import { settingsApi } from "@/lib/api/settings"
import { toast } from "sonner"


import { type IntegrationsConfigFormData } from "@/schemas/settings/integrations.schema"

interface WeComNotificationTabProps {
  form: UseFormReturn<IntegrationsConfigFormData>
}

export function WeComNotificationTab({ form }: WeComNotificationTabProps) {
  const { execute: testConnection, isLoading: isTesting } = useSettingsAPI()
  const enabled = form.watch("enabled")

  const handleTestMessage = async () => {
    const data = form.getValues()
    const config = {
      enabled: data.enabled ?? false,
      webhook_url: data.webhook_url ?? "",
    }

    await testConnection(async () => {
      await settingsApi.testWeComConnection(config)
      toast.success("测试消息发送成功！请检查您的企业微信群组。")
    })
  }

  return (
    <SettingsSection
      title="企业微信通知配置"
      description="配置企业微信群机器人Webhook接收系统通知"
      icon={<MessageCircle className="h-5 w-5" />}
    >
      <FormSwitch
        form={form}
        name="enabled"
        label="启用企业微信通知"
        description="开启后系统将通过企业微信群机器人发送通知"
      />

      {enabled && (
        <>
          <FormInput
            form={form}
            name="webhook_url"
            label="Webhook URL"
            description="企业微信群机器人的Webhook地址"
            type="url"
            placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
            required
          />

          <Button
            type="button"
            variant="outline"
            onClick={handleTestMessage}
            disabled={isTesting}
          >
            {isTesting ? (
              <>
                <Send className="mr-2 h-4 w-4 animate-pulse" />
                发送中...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                发送测试消息
              </>
            )}
          </Button>

          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              测试消息将发送到配置的企业微信群组。请确保机器人已正确添加到目标群组中。
            </AlertDescription>
          </Alert>
        </>
      )}

      <div className="rounded-lg border p-4 bg-muted/50">
        <p className="text-sm font-medium mb-2">如何配置企业微信群机器人：</p>
        <div className="text-sm text-muted-foreground space-y-2">
          <div>
            <p className="font-medium text-foreground">步骤 1：创建群机器人</p>
            <ul className="list-disc list-inside ml-2">
              <li>打开企业微信群聊，点击右上角&ldquo;...&rdquo;→ 群机器人</li>
              <li>点击&ldquo;添加群机器人&rdquo;</li>
              <li>设置机器人名称和头像</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">步骤 2：获取Webhook</p>
            <ul className="list-disc list-inside ml-2">
              <li>创建完成后，系统会生成Webhook URL</li>
              <li>复制URL（格式：https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx）</li>
              <li>将URL填入上方配置</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">步骤 3：配置权限</p>
            <ul className="list-disc list-inside ml-2">
              <li>确保机器人有发送消息的权限</li>
              <li>建议设置机器人的使用范围和限制</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-2">
        <p className="text-sm font-medium">企业微信机器人特性：</p>
        <ul className="text-sm text-muted-foreground list-disc list-inside ml-2">
          <li>支持文本、markdown、图片、文件等多种消息类型</li>
          <li>每个机器人每分钟最多发送20条消息</li>
          <li>支持@特定成员或@所有人</li>
          <li>可配置消息发送频率限制</li>
        </ul>
      </div>

      <div className="rounded-lg border p-4 space-y-2">
        <p className="text-sm font-medium">支持的通知事件：</p>
        <ul className="text-sm text-muted-foreground list-disc list-inside ml-2">
          <li>服务器连接状态变更</li>
          <li>系统安全告警</li>
          <li>备份任务完成通知</li>
          <li>用户登录异常提醒</li>
          <li>系统更新和维护通知</li>
        </ul>
      </div>
    </SettingsSection>
  )
}
