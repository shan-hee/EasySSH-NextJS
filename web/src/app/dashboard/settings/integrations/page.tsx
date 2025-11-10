"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import {
  Bot,
  Sliders,
  Shield,
  Mail,
  MessageSquare,
  MessageCircle,
  Webhook,
  Save,
  Loader2,
  RotateCcw,
} from "lucide-react"
import { useSettingsForm } from "@/hooks/settings/use-settings-form"
import { integrationsConfigSchema } from "@/schemas/settings/integrations.schema"
import { settingsApi } from "@/lib/api/settings"
import { AIProviderTab } from "./_tabs/ai-provider-tab"
import { AIModelParamsTab } from "./_tabs/ai-model-params-tab"
import { AIPrivacyTab } from "./_tabs/ai-privacy-tab"
import { EmailNotificationTab } from "./_tabs/email-notification-tab"
import { DingTalkNotificationTab } from "./_tabs/dingtalk-notification-tab"
import { WeComNotificationTab } from "./_tabs/wecom-notification-tab"
import { WebhookNotificationTab } from "./_tabs/webhook-notification-tab"
import { SkeletonCard } from "@/components/ui/loading"

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState("ai-provider")

  // 这里简化处理，实际应根据用户角色判断
  const isAdmin = true

  const { form, isLoading, isSaving, handleSave, reload } = useSettingsForm({
    schema: integrationsConfigSchema,
    loadFn: async () => {
      // 由于AI配置使用本地状态，这里只加载通知配置
      const [smtpConfig, dingTalkConfig, weComConfig, webhookConfig] =
        await Promise.all([
          settingsApi.getSMTPConfig(),
          settingsApi.getDingTalkConfig(),
          settingsApi.getWeComConfig(),
          settingsApi.getWebhookConfig(),
        ])

      // AI配置使用默认值（实际项目中应从localStorage或API加载）
      return {
        // AI服务商配置
        system_enabled: false,
        system_provider: "openai" as "openai" | "anthropic" | "azure" | "custom",
        system_api_endpoint: "",
        system_default_model: "",
        system_rate_limit: 60,
        use_system_config: false,
        provider: "openai" as "openai" | "anthropic" | "azure" | "custom",
        api_key: "",
        api_endpoint: "",
        preferred_model: "",

        // AI模型参数
        temperature: 0.7,
        max_tokens: 2048,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,

        // AI隐私设置
        save_history: true,
        allow_training: false,
        auto_delete_days: 30,

        // 通知配置
        ...smtpConfig,
        ...dingTalkConfig,
        ...weComConfig,
        ...webhookConfig,
        // 类型转换
        method: webhookConfig.method as "GET" | "POST",
      }
    },
    saveFn: async (data) => {
      // AI配置保存到localStorage（实际项目应保存到后端）
      const aiConfig = {
        system_enabled: data.system_enabled,
        system_provider: data.system_provider,
        system_api_endpoint: data.system_api_endpoint,
        system_default_model: data.system_default_model,
        system_rate_limit: data.system_rate_limit,
        use_system_config: data.use_system_config,
        provider: data.provider,
        api_key: data.api_key,
        api_endpoint: data.api_endpoint,
        preferred_model: data.preferred_model,
        temperature: data.temperature,
        max_tokens: data.max_tokens,
        top_p: data.top_p,
        frequency_penalty: data.frequency_penalty,
        presence_penalty: data.presence_penalty,
        save_history: data.save_history,
        allow_training: data.allow_training,
        auto_delete_days: data.auto_delete_days,
      }
      localStorage.setItem("ai_config", JSON.stringify(aiConfig))

      // 保存通知配置到后端
      await Promise.all([
        settingsApi.saveSMTPConfig({
          enabled: data.enabled,
          host: data.host,
          port: data.port,
          username: data.username,
          password: data.password,
          from_email: data.from_email,
          from_name: data.from_name,
          use_tls: data.use_tls,
        }),
        settingsApi.saveDingTalkConfig({
          enabled: data.enabled,
          webhook_url: data.webhook_url,
          secret: data.secret || "",
        }),
        settingsApi.saveWeComConfig({
          enabled: data.enabled,
          webhook_url: data.webhook_url,
        }),
        settingsApi.saveWebhookConfig({
          enabled: data.enabled,
          url: data.url,
          method: data.method,
          secret: data.secret || "",
        }),
      ])
    },
  })

  if (isLoading) {
    return (
      <>
        <PageHeader title="集成服务" />
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0 overflow-auto">
          {/* 统计卡片骨架屏 */}
          <div className="grid gap-4 md:grid-cols-4">
            <SkeletonCard showHeader={false} lines={2} />
            <SkeletonCard showHeader={false} lines={2} />
            <SkeletonCard showHeader={false} lines={2} />
            <SkeletonCard showHeader={false} lines={2} />
          </div>
          {/* 表单内容骨架屏 */}
          <SkeletonCard showHeader lines={8} className="flex-1" />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="集成服务">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={reload}
            disabled={isLoading || isSaving}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            重置
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isLoading || isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            保存设置
          </Button>
        </div>
      </PageHeader>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0 overflow-auto">
        {/* 统计卡片 */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-medium">AI服务</div>
            </div>
            <div className="mt-2 text-2xl font-bold">
              {form.watch("use_system_config") ? "系统配置" : "个人配置"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {form.watch("provider") === "openai"
                ? "OpenAI"
                : form.watch("provider") === "anthropic"
                ? "Anthropic"
                : "自定义"}
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-medium">邮件通知</div>
            </div>
            <div className="mt-2 text-2xl font-bold">
              {form.watch("enabled") ? "已启用" : "未启用"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">SMTP配置</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-medium">即时通讯</div>
            </div>
            <div className="mt-2 text-2xl font-bold">
              {(form.watch("enabled") ? 1 : 0) + (form.watch("enabled") ? 1 : 0)} 个
            </div>
            <p className="text-xs text-muted-foreground mt-1">钉钉 + 企微</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Webhook className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-medium">Webhook</div>
            </div>
            <div className="mt-2 text-2xl font-bold">
              {form.watch("enabled") ? "已配置" : "未配置"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">自定义通知</p>
          </Card>
        </div>

        {/* 标签页 */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="ai-provider">
              <Bot className="mr-2 h-4 w-4" />
              <span className="hidden lg:inline">AI服务</span>
            </TabsTrigger>
            <TabsTrigger value="ai-params">
              <Sliders className="mr-2 h-4 w-4" />
              <span className="hidden lg:inline">模型参数</span>
            </TabsTrigger>
            <TabsTrigger value="ai-privacy">
              <Shield className="mr-2 h-4 w-4" />
              <span className="hidden lg:inline">隐私</span>
            </TabsTrigger>
            <TabsTrigger value="email">
              <Mail className="mr-2 h-4 w-4" />
              <span className="hidden lg:inline">邮件</span>
            </TabsTrigger>
            <TabsTrigger value="dingtalk">
              <MessageSquare className="mr-2 h-4 w-4" />
              <span className="hidden lg:inline">钉钉</span>
            </TabsTrigger>
            <TabsTrigger value="wecom">
              <MessageCircle className="mr-2 h-4 w-4" />
              <span className="hidden lg:inline">企微</span>
            </TabsTrigger>
            <TabsTrigger value="webhook">
              <Webhook className="mr-2 h-4 w-4" />
              <span className="hidden lg:inline">Webhook</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai-provider">
            <AIProviderTab form={form} isAdmin={isAdmin} />
          </TabsContent>

          <TabsContent value="ai-params">
            <AIModelParamsTab form={form} />
          </TabsContent>

          <TabsContent value="ai-privacy">
            <AIPrivacyTab form={form} />
          </TabsContent>

          <TabsContent value="email">
            <EmailNotificationTab form={form} />
          </TabsContent>

          <TabsContent value="dingtalk">
            <DingTalkNotificationTab form={form} />
          </TabsContent>

          <TabsContent value="wecom">
            <WeComNotificationTab form={form} />
          </TabsContent>

          <TabsContent value="webhook">
            <WebhookNotificationTab form={form} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
