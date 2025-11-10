import { z } from "zod"

// 基本信息 Schema
export const basicInfoSchema = z.object({
  system_name: z.string().min(1, "系统名称不能为空").max(100, "系统名称不能超过100字符"),
  system_logo: z.string().url("请输入有效的URL").or(z.literal("")),
  system_favicon: z.string().url("请输入有效的URL").or(z.literal("")),
  default_language: z.enum(["zh-CN", "en-US", "ja-JP"], {
    message: "请选择有效的语言",
  }),
})

// 国际化设置 Schema
export const i18nSchema = z.object({
  default_timezone: z.string().min(1, "时区不能为空"),
  date_format: z.string().min(1, "日期格式不能为空"),
})

// 性能设置 Schema
export const performanceSchema = z.object({
  default_page_size: z
    .number()
    .min(10, "分页大小不能小于10")
    .max(100, "分页大小不能超过100"),
  max_file_upload_size: z
    .number()
    .min(1, "文件上传大小不能小于1MB")
    .max(1024, "文件上传大小不能超过1024MB"),
})

// 完整的系统配置 Schema (所有标签页合并)
export const systemConfigSchema = basicInfoSchema
  .merge(i18nSchema)
  .merge(performanceSchema)

// 导出类型
export type BasicInfoFormData = z.infer<typeof basicInfoSchema>
export type I18nFormData = z.infer<typeof i18nSchema>
export type PerformanceFormData = z.infer<typeof performanceSchema>
export type SystemConfigFormData = z.infer<typeof systemConfigSchema>
