import { z } from "zod"

// IP白名单 Schema
export const ipWhitelistSchema = z.object({
  ip_address: z
    .string()
    .min(1, "IP地址不能为空")
    .refine(
      (ip) => {
        // 简单的IP或CIDR验证
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/
        return ipRegex.test(ip)
      },
      { message: "请输入有效的IP地址或CIDR格式" }
    ),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
})

// 会话管理 Schema
export const sessionManagementSchema = z.object({
  session_timeout: z
    .number()
    .min(5, "会话超时时间不能小于5分钟")
    .max(1440, "会话超时时间不能超过1440分钟"),
  max_tabs: z
    .number()
    .min(1, "最大标签页数不能小于1")
    .max(200, "最大标签页数不能超过200"),
  inactive_minutes: z
    .number()
    .min(5, "非活动断开时间不能小于5分钟")
    .max(1440, "非活动断开时间不能超过1440分钟"),
  remember_login: z.boolean(),
  hibernate: z.boolean(),
})

// CORS配置 Schema
export const corsConfigSchema = z.object({
  allowed_origins: z.array(z.string().min(1)).min(1, "至少需要一个允许的域名"),
  allowed_methods: z.array(z.string()).min(1, "至少需要一个允许的HTTP方法"),
  allowed_headers: z.array(z.string()).min(1, "至少需要一个允许的请求头"),
})

// 速率限制 Schema
export const rateLimitSchema = z.object({
  login_limit: z
    .number()
    .min(1, "登录速率限制不能小于1次/分钟")
    .max(100, "登录速率限制不能超过100次/分钟"),
  api_limit: z
    .number()
    .min(10, "API速率限制不能小于10次/分钟")
    .max(10000, "API速率限制不能超过10000次/分钟"),
})

// JWT 配置 Schema
export const jwtConfigSchema = z.object({
  jwt_secret: z.string().min(32, "JWT密钥长度不能小于32个字符"),
  access_token_expire_minutes: z
    .number()
    .min(1, "访问令牌过期时间不能小于1小时")
    .max(168, "访问令牌过期时间不能超过168小时"),
  refresh_token_expire_days: z
    .number()
    .min(24, "刷新令牌过期时间不能小于24小时")
    .max(720, "刷新令牌过期时间不能超过720小时"),
})

// 网络安全配置 Schema (包含 IP 白名单/黑名单)
export const networkSecuritySchema = z.object({
  allowlist_ips: z.string().optional(),
  blocklist_ips: z.string().optional(),
  allow_insecure_http: z.boolean().optional(),
})

// 完整的安全配置 Schema
export const securityConfigSchema = sessionManagementSchema
  .merge(corsConfigSchema)
  .merge(rateLimitSchema)
  .merge(jwtConfigSchema)
  .merge(networkSecuritySchema)

// 导出类型
export type IPWhitelistFormData = z.infer<typeof ipWhitelistSchema>
export type SessionManagementFormData = z.infer<typeof sessionManagementSchema>
export type CORSConfigFormData = z.infer<typeof corsConfigSchema>
export type RateLimitFormData = z.infer<typeof rateLimitSchema>
export type JWTConfigFormData = z.infer<typeof jwtConfigSchema>
export type NetworkSecurityFormData = z.infer<typeof networkSecuritySchema>
export type SecurityConfigFormData = z.infer<typeof securityConfigSchema>
