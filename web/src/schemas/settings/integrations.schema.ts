import { z } from "zod"

// AI服务商配置 Schema
export const aiProviderSchema = z.object({
  // 系统配置（管理员）
  system_enabled: z.boolean().optional(),
  system_provider: z.enum(["openai", "anthropic", "azure", "custom"]).optional(),
  system_api_endpoint: z.string().url("请输入有效的API端点").or(z.literal("")).optional(),
  system_default_model: z.string().optional(),
  system_rate_limit: z.number().min(1).max(1000).optional(),

  // 个人配置
  use_system_config: z.boolean(),
  provider: z.enum(["openai", "anthropic", "azure", "custom"]),
  api_key: z.string().min(1, "API密钥不能为空"),
  api_endpoint: z.string().url("请输入有效的API端点").or(z.literal("")),
  preferred_model: z.string().min(1, "偏好模型不能为空"),
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
  host: z.string().min(1, "SMTP服务器地址不能为空"),
  port: z.number().min(1, "端口号必须大于0").max(65535, "端口号不能超过65535"),
  username: z.string().min(1, "用户名不能为空"),
  password: z.string().min(1, "密码不能为空"),
  from_email: z.string().email("请输入有效的邮箱地址"),
  from_name: z.string().min(1, "发件人名称不能为空"),
  use_tls: z.boolean(),
})

// 钉钉配置 Schema
export const dingTalkConfigSchema = z.object({
  enabled: z.boolean(),
  webhook_url: z.string().url("请输入有效的Webhook URL").or(z.literal("")),
  secret: z.string().optional(),
})

// 企业微信配置 Schema
export const weComConfigSchema = z.object({
  enabled: z.boolean(),
  webhook_url: z.string().url("请输入有效的Webhook URL").or(z.literal("")),
})

// Webhook配置 Schema
export const webhookConfigSchema = z.object({
  enabled: z.boolean(),
  url: z.string().url("请输入有效的URL").or(z.literal("")),
  method: z.enum(["POST", "GET"]),
  secret: z.string().optional(),
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
