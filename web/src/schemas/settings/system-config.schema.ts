import { z } from "zod"

// 基本信息 Schema（包含国际化设置）
export const basicInfoSchema = z.object({
  system_name: z.string().min(1, "系统名称不能为空").max(100, "系统名称不能超过100字符"),
  system_logo: z.string().url("请输入有效的URL").or(z.literal("")),
  system_favicon: z.string().url("请输入有效的URL").or(z.literal("")),
  default_language: z.enum(["zh-CN", "en-US", "ja-JP"], {
    message: "请选择有效的语言",
  }),
  default_timezone: z.string().min(1, "时区不能为空"),
  date_format: z.string().min(1, "日期格式不能为空"),
})

// 国际化设置 Schema
export const i18nSchema = z.object({
  default_timezone: z.string().min(1, "时区不能为空"),
  date_format: z.string().min(1, "日期格式不能为空"),
})

// 文件传输设置 Schema（包含上传大小限制）
export const fileTransferSchema = z.object({
  // 下载排除规则（每行一个）
  download_exclude_patterns: z.string().default(
    "node_modules\n.git\n.svn\n.hg\n__pycache__\n.pytest_cache\n.next\n.nuxt\ndist\nbuild\ntarget\nvendor\n.DS_Store\nthumbs.db"
  ),
  // 默认下载模式
  default_download_mode: z.enum(["fast", "compatible"], {
    message: "请选择有效的下载模式",
  }).default("fast"),
  // 上传时自动跳过排除的文件
  skip_excluded_on_upload: z.boolean().default(true),
  // 最大文件上传大小
  max_file_upload_size: z
    .number()
    .min(1, "文件上传大小不能小于1MB")
    .max(1024, "文件上传大小不能超过1024MB"),
})

// 性能设置 Schema（已废弃，保留用于向后兼容）
export const performanceSchema = z.object({
  default_page_size: z
    .number()
    .min(10, "分页大小不能小于10")
    .max(100, "分页大小不能超过100")
    .optional(),
  max_file_upload_size: z
    .number()
    .min(1, "文件上传大小不能小于1MB")
    .max(1024, "文件上传大小不能超过1024MB")
    .optional(),
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

// 完整的系统配置 Schema (所有标签页合并)
export const systemConfigSchema = basicInfoSchema
  .merge(i18nSchema)
  .merge(performanceSchema)
  .merge(fileTransferSchema)
  .merge(completionSchema)

// 导出类型
export type BasicInfoFormData = z.infer<typeof basicInfoSchema>
export type I18nFormData = z.infer<typeof i18nSchema>
export type PerformanceFormData = z.infer<typeof performanceSchema>
export type FileTransferFormData = z.infer<typeof fileTransferSchema>
export type CompletionFormData = z.infer<typeof completionSchema>
export type SystemConfigFormData = z.infer<typeof systemConfigSchema>
