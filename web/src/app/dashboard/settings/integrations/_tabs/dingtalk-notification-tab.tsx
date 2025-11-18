"use client"

import { SettingsSection } from "@/components/settings/settings-section"
import { FormInput, FormSwitch } from "@/components/settings/form-field"
import { Button } from "@/components/ui/button"
import { MessageSquare, Send } from "lucide-react"
import { type UseFormReturn } from "react-hook-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
import { useSettingsAPI } from "@/hooks/settings/use-settings-api"
import { settingsApi } from "@/lib/api/settings"
import { toast } from "sonner"

type DingTalkFormValues = {
  enabled?: boolean
  webhook_url?: string
  secret?: string
  mention_all?: boolean
}

interface DingTalkNotificationTabProps {
  form: UseFormReturn<DingTalkFormValues>
}

export function DingTalkNotificationTab({ form }: DingTalkNotificationTabProps) {
  const { execute: testConnection, isLoading: isTesting } = useSettingsAPI()
  const enabled = form.watch("enabled")

  const handleTestMessage = async () => {
    const data = form.getValues()
    const config = {
      enabled: data.enabled,
      webhook_url: data.webhook_url,
      secret: data.secret || "",
    }

    await testConnection(async () => {
      await settingsApi.testDingTalkConnection(config)
      toast.success("测试消息发送成功！请检查您的钉钉群组。")
    })
  }

  return (
    <SettingsSection
      title="钉钉通知配置"
      description="配置钉钉机器人Webhook接收系统通知"
      icon={<MessageSquare className="h-5 w-5" />}
    >
      <FormSwitch
        form={form}
        name="enabled"
        label="启用钉钉通知"
        description="开启后系统将通过钉钉机器人发送通知"
      />

      {enabled && (
        <>
          <FormInput
            form={form}
            name="webhook_url"
            label="Webhook URL"
            description="钉钉自定义机器人的Webhook地址"
            type="url"
            placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
            required
          />

          <FormInput
            form={form}
            name="secret"
            label="签名密钥（可选）"
            description="钉钉机器人的加签密钥，用于验证消息来源"
            type="password"
            placeholder="SECxxxxxxxxxxxxxxxxxxxxxxxx"
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
              测试消息将发送到配置的钉钉群组。请确保机器人已正确添加到目标群组中。
            </AlertDescription>
          </Alert>
        </>
      )}

      <div className="rounded-lg border p-4 bg-muted/50">
        <p className="text-sm font-medium mb-2">如何配置钉钉机器人：</p>
        <div className="text-sm text-muted-foreground space-y-2">
          <div>
            <p className="font-medium text-foreground">步骤 1：创建群机器人</p>
            <ul className="list-disc list-inside ml-2">
              <li>打开钉钉群组，点击群设置 → 智能群助手 → 添加机器人</li>
              <li>选择&ldquo;自定义&rdquo;类型的机器人</li>
              <li>设置机器人名称和头像</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">步骤 2：安全设置</p>
            <ul className="list-disc list-inside ml-2">
              <li>推荐选择&ldquo;加签&rdquo;方式，并保存生成的密钥</li>
              <li>也可以选择&ldquo;自定义关键词&rdquo;或&ldquo;IP地址&rdquo;验证</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">步骤 3：获取Webhook</p>
            <ul className="list-disc list-inside ml-2">
              <li>创建完成后复制Webhook URL</li>
              <li>将URL和密钥（如有）填入上方配置</li>
            </ul>
          </div>
        </div>
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
