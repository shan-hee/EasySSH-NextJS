import { z } from "zod"

// 基本信息 Schema
export const basicInfoSchema = z.object({
  system_name: z.string().min(1, "系统名称不能为空").max(100, "系统名称不能超过100字符"),
  system_logo: z.string().url("请输入有效的URL").or(z.literal("")),
  system_favicon: z.string().url("请输入有效的URL").or(z.literal("")),
  default_language: z.enum(["zh-CN", "en-US", "ja-JP"], {
    errorMap: () => ({ message: "请选择有效的语言" }),
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
  // 数据库连接池配置
  max_idle_conns: z
    .number()
    .min(1, "最大空闲连接数不能小于1")
    .max(1000, "最大空闲连接数不能超过1000"),
  max_open_conns: z
    .number()
    .min(1, "最大打开连接数不能小于1")
    .max(10000, "最大打开连接数不能超过10000"),
  conn_max_lifetime: z
    .number()
    .min(1, "连接最大生命周期不能小于1分钟")
    .max(1440, "连接最大生命周期不能超过1440分钟"),
  conn_max_idle_time: z
    .number()
    .min(1, "连接最大空闲时间不能小于1分钟")
    .max(60, "连接最大空闲时间不能超过60分钟"),
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
