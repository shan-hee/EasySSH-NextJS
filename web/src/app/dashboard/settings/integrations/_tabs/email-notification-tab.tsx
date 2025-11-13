"use client"

import { useState } from "react"
import { SettingsSection } from "@/components/settings/settings-section"
import { FormInput, FormSwitch } from "@/components/settings/form-field"
import { Button } from "@/components/ui/button"
import { Mail, Send } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
import { useSettingsAPI } from "@/hooks/settings/use-settings-api"
import { settingsApi } from "@/lib/api/settings"
import { toast } from "sonner"

interface EmailNotificationTabProps {
  form: UseFormReturn<any>
}

export function EmailNotificationTab({ form }: EmailNotificationTabProps) {
  const { execute: testConnection, isLoading: isTesting } = useSettingsAPI()
  const enabled = form.watch("enabled")

  const handleTestEmail = async () => {
    const data = form.getValues()
    const config = {
      enabled: data.enabled,
      host: data.host,
      port: data.port,
      username: data.username,
      password: data.password,
      from_email: data.from_email,
      from_name: data.from_name,
      use_tls: data.use_tls,
    }

    await testConnection(async () => {
      await settingsApi.testSMTPConnection(config)
      toast.success("测试邮件发送成功！请检查您的邮箱。")
    })
  }

  return (
    <SettingsSection
      title="邮件通知配置"
      description="配置SMTP服务器以发送邮件通知"
      icon={<Mail className="h-5 w-5" />}
    >
      <FormSwitch
        form={form}
        name="enabled"
        label="启用邮件通知"
        description="开启后系统将通过邮件发送重要通知"
      />

      {enabled && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput
              form={form}
              name="host"
              label="SMTP服务器地址"
              placeholder="smtp.gmail.com"
              required
            />

            <FormInput
              form={form}
              name="port"
              label="端口号"
              type="number"
              placeholder="587"
              min={1}
              max={65535}
              required
            />
          </div>

          <FormSwitch
            form={form}
            name="use_tls"
            label="使用TLS/SSL加密"
            description="推荐开启以确保邮件传输安全"
          />

          <div className="grid gap-4 md:grid-cols-2">
            <FormInput
              form={form}
              name="username"
              label="用户名"
              placeholder="your-email@example.com"
              required
            />

            <FormInput
              form={form}
              name="password"
              label="密码/应用专用密码"
              type="password"
              placeholder="••••••••"
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormInput
              form={form}
              name="from_email"
              label="发件人邮箱"
              type="email"
              placeholder="noreply@example.com"
              required
            />

            <FormInput
              form={form}
              name="from_name"
              label="发件人名称"
              placeholder="EasySSH System"
              required
            />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleTestEmail}
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
                发送测试邮件
              </>
            )}
          </Button>

          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              测试邮件将发送到配置的发件人邮箱。如果使用Gmail，请确保已启用&ldquo;两步验证&rdquo;并生成&ldquo;应用专用密码&rdquo;。
            </AlertDescription>
          </Alert>
        </>
      )}

      <div className="rounded-lg border p-4 bg-muted/50">
        <p className="text-sm font-medium mb-2">常用SMTP服务器配置：</p>
        <div className="text-sm text-muted-foreground space-y-2">
          <div>
            <p className="font-medium text-foreground">Gmail:</p>
            <p>• 服务器：smtp.gmail.com，端口：587（TLS）或 465（SSL）</p>
            <p>• 需要启用两步验证并生成应用专用密码</p>
          </div>
          <div>
            <p className="font-medium text-foreground">腾讯企业邮箱:</p>
            <p>• 服务器：smtp.exmail.qq.com，端口：587 或 465</p>
          </div>
          <div>
            <p className="font-medium text-foreground">阿里云邮件推送:</p>
            <p>• 服务器：smtpdm.aliyun.com，端口：25 或 465</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Microsoft 365:</p>
            <p>• 服务器：smtp.office365.com，端口：587</p>
          </div>
        </div>
      </div>
    </SettingsSection>
  )
}
