import { z } from "zod"

// AI服务商配置 Schema
export const aiProviderSchema = z.object({
  // 系统配置（管理员）
  system_enabled: z.boolean().optional(),
  system_provider: z.enum(["openai", "anthropic", "azure", "custom"]).optional(),
  system_api_endpoint: z
    .string()
    .url("settingsValidation.systemApiEndpointInvalid")
    .or(z.literal(""))
    .optional(),
  system_default_model: z.string().optional(),
  system_rate_limit: z.number().min(1).max(1000).optional(),

  // 个人配置
  use_system_config: z.boolean(),
  provider: z.enum(["openai", "anthropic", "azure", "custom"]),
  api_key: z.string().min(1, "settingsValidation.apiKeyRequired"),
  api_endpoint: z.string().url("settingsValidation.apiEndpointInvalid").or(z.literal("")),
  preferred_model: z.string().min(1, "settingsValidation.preferredModelRequired"),
})

// AI模型参数 Schema
export const aiModelParamsSchema = z.object({
  temperature: z.number().min(0).max(2),
  max_tokens: z.number().min(256).max(8192),
  top_p: z.number().min(0).max(1),
  frequency_penalty: z.number().min(-2).max(2),
  presence_penalty: z.number().min(-2).max(2),
})

// AI隐私设置 Schema
export const aiPrivacySchema = z.object({
  save_history: z.boolean(),
  allow_training: z.boolean(),
  auto_delete_days: z.number().min(7).max(365),
})

// SMTP配置 Schema
export const smtpConfigSchema = z.object({
  enabled: z.boolean(),
  host: z.string().min(1, "settingsValidation.smtpHostRequired"),
  port: z
    .number()
    .min(1, "settingsValidation.smtpPortMin")
    .max(65535, "settingsValidation.smtpPortMax"),
  username: z.string().min(1, "settingsValidation.smtpUsernameRequired"),
  password: z.string().min(1, "settingsValidation.smtpPasswordRequired"),
  from_email: z.string().email("settingsValidation.smtpFromEmailInvalid"),
  from_name: z.string().min(1, "settingsValidation.smtpFromNameRequired"),
  use_tls: z.boolean(),
})

// 钉钉配置 Schema
export const dingTalkConfigSchema = z.object({
  dingtalk_enabled: z.boolean(),
  dingtalk_webhook_url: z
    .string()
    .url("settingsValidation.dingtalkWebhookUrlInvalid")
    .or(z.literal("")),
  dingtalk_secret: z.string().optional(),
})

// 企业微信配置 Schema
export const weComConfigSchema = z.object({
  wecom_enabled: z.boolean(),
  wecom_webhook_url: z
    .string()
    .url("settingsValidation.wecomWebhookUrlInvalid")
    .or(z.literal("")),
})

// Webhook配置 Schema
export const webhookConfigSchema = z.object({
  webhook_enabled: z.boolean(),
  webhook_url: z.string().url("settingsValidation.webhookUrlInvalid").or(z.literal("")),
  webhook_method: z.enum(["POST", "GET"]),
  webhook_secret: z.string().optional(),
})

// 完整的集成配置 Schema
export const integrationsConfigSchema = aiProviderSchema
  .merge(aiModelParamsSchema)
  .merge(aiPrivacySchema)
  .merge(smtpConfigSchema)
  .merge(dingTalkConfigSchema)
  .merge(weComConfigSchema)
  .merge(webhookConfigSchema)

// 导出类型
export type AIProviderFormData = z.infer<typeof aiProviderSchema>
export type AIModelParamsFormData = z.infer<typeof aiModelParamsSchema>
export type AIPrivacyFormData = z.infer<typeof aiPrivacySchema>
export type SMTPConfigFormData = z.infer<typeof smtpConfigSchema>
export type DingTalkConfigFormData = z.infer<typeof dingTalkConfigSchema>
export type WeComConfigFormData = z.infer<typeof weComConfigSchema>
export type WebhookConfigFormData = z.infer<typeof webhookConfigSchema>
export type IntegrationsConfigFormData = z.infer<typeof integrationsConfigSchema>
