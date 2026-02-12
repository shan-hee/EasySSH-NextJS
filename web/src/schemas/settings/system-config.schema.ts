import { z } from "zod"

// 基本信息 Schema（包含国际化设置）
export const basicInfoSchema = z.object({
  system_name: z
    .string()
    .min(1, "settingsValidation.systemNameRequired")
    .max(100, "settingsValidation.systemNameMax"),
  system_logo: z.string().url("settingsValidation.urlInvalid").or(z.literal("")),
  system_favicon: z.string().url("settingsValidation.urlInvalid").or(z.literal("")),
  default_language: z.enum(["zh-CN", "en-US"], {
    message: "settingsValidation.defaultLanguageInvalid",
  }),
  default_timezone: z.string().min(1, "settingsValidation.defaultTimezoneRequired"),
  date_format: z.string().min(1, "settingsValidation.dateFormatRequired"),
  // 注册配置
  allow_registration: z.boolean().default(false),
  default_role: z.enum(["user", "viewer"]).default("user"),
  // OAuth 配置
  oauth_enabled: z.boolean().default(false),
  google_client_id: z.string().optional(),
  google_client_secret: z.string().optional(),
})

// 文件传输设置 Schema（包含上传大小限制）
export const fileTransferSchema = z.object({
  // 下载排除规则（每行一个）
  download_exclude_patterns: z.string().default(
    "node_modules\n.git\n.svn\n.hg\n__pycache__\n.pytest_cache\n.next\n.nuxt\ndist\nbuild\ntarget\nvendor\n.DS_Store\nthumbs.db"
  ),
  // 默认下载模式
  default_download_mode: z
    .enum(["fast", "compatible"], {
      message: "settingsValidation.downloadModeInvalid",
    })
    .default("fast"),
  // 上传时自动跳过排除的文件
  skip_excluded_on_upload: z.boolean().default(true),
  // 最大文件上传大小
  max_file_upload_size: z
    .number()
    .min(1, "settingsValidation.fileUploadSizeMin")
    .max(1024, "settingsValidation.fileUploadSizeMax"),
})

// 补全配置 Schema
export const completionSchema = z.object({
  // 全局开关
  completion_enabled: z.boolean().default(true),

  // 提供者启用状态
  completion_providers: z.object({
    local: z.boolean().default(true),
    remote_history: z.boolean().default(true),
    script: z.boolean().default(true),
    session: z.boolean().default(true),
  }).default({
    local: true,
    remote_history: true,
    script: true,
    session: true,
  }),

  // 配额分配配置
  completion_quotas: z.object({
    local_min: z.number().min(0).max(10).default(1),
    local_max: z.number().min(1).max(10).default(3),
    script_min: z.number().min(0).max(10).default(0),
    script_max: z.number().min(0).max(10).default(2),
    session_min: z.number().min(0).max(10).default(0),
    session_max: z.number().min(0).max(10).default(2),
    remote_history_unlimited: z.boolean().default(true),
    remote_history_soft_max: z.number().min(1).max(20).default(7),
  }).default({
    local_min: 1,
    local_max: 3,
    script_min: 0,
    script_max: 2,
    session_min: 0,
    session_max: 2,
    remote_history_unlimited: true,
    remote_history_soft_max: 7,
  }),

  // 缓存设置
  completion_cache: z.object({
    ttl_minutes: z.number().min(1).max(60).default(5),
    max_entries: z.number().min(10).max(1000).default(100),
  }).default({
    ttl_minutes: 5,
    max_entries: 100,
  }),
})

// 导出类型
export type BasicInfoFormData = z.infer<typeof basicInfoSchema>
export type FileTransferFormData = z.infer<typeof fileTransferSchema>
export type CompletionFormData = z.infer<typeof completionSchema>
