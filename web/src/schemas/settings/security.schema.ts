import { z } from "zod"

// 会话管理 Schema
export const sessionManagementSchema = z.object({
  session_timeout: z
    .number()
    .min(5, "settingsValidation.sessionTimeoutMin")
    .max(1440, "settingsValidation.sessionTimeoutMax"),
  max_tabs: z
    .number()
    .min(1, "settingsValidation.maxTabsMin")
    .max(200, "settingsValidation.maxTabsMax"),
  inactive_minutes: z
    .number()
    .min(5, "settingsValidation.inactiveMinutesMin")
    .max(1440, "settingsValidation.inactiveMinutesMax"),
  remember_login: z.boolean(),
  hibernate: z.boolean(),
})

// CORS配置 Schema
export const corsConfigSchema = z.object({
  allowed_origins: z.array(z.string().min(1)).min(1, "settingsValidation.allowedOriginsMin"),
  allowed_methods: z.array(z.string()).min(1, "settingsValidation.allowedMethodsMin"),
  allowed_headers: z.array(z.string()).min(1, "settingsValidation.allowedHeadersMin"),
})

// 速率限制 Schema
export const rateLimitSchema = z.object({
  login_limit: z
    .number()
    .min(1, "settingsValidation.loginLimitMin")
    .max(100, "settingsValidation.loginLimitMax"),
  api_limit: z
    .number()
    .min(10, "settingsValidation.apiLimitMin")
    .max(10000, "settingsValidation.apiLimitMax"),
})

// 网络安全配置 Schema (包含 IP 白名单/黑名单)
export const networkSecuritySchema = z.object({
  allowlist_ips: z.string().optional(),
  blocklist_ips: z.string().optional(),
})

// 网络安全完整配置 Schema (CORS + 速率限制)
export const networkSecurityFullSchema = corsConfigSchema.merge(rateLimitSchema)

// 导出类型
export type SessionManagementFormData = z.infer<typeof sessionManagementSchema>
export type CORSConfigFormData = z.infer<typeof corsConfigSchema>
export type RateLimitFormData = z.infer<typeof rateLimitSchema>
export type NetworkSecurityFormData = z.infer<typeof networkSecuritySchema>
export type NetworkSecurityFullFormData = z.infer<typeof networkSecurityFullSchema>
