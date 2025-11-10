import { z } from "zod"

// 备份配置 Schema
export const backupConfigSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum(["hourly", "daily", "weekly", "monthly"]),
  retention_days: z.number().min(1, "保留天数不能小于1").max(365, "保留天数不能超过365"),
  backup_items: z.object({
    database: z.boolean(),
    config: z.boolean(),
    user_data: z.boolean(),
    logs: z.boolean(),
    recordings: z.boolean(),
  }),
  storage_location: z.string().min(1, "存储位置不能为空"),
})

// 远程备份配置 Schema
export const remoteBackupSchema = z.object({
  type: z.enum(["s3", "oss", "cos", "sftp", "none"]),
  endpoint: z.string().optional(),
  access_key: z.string().optional(),
  secret_key: z.string().optional(),
  bucket: z.string().optional(),
  region: z.string().optional(),
})

// 手动备份 Schema
export const manualBackupSchema = z.object({
  description: z.string().max(200, "描述不能超过200字符").optional(),
  backup_items: z.object({
    database: z.boolean(),
    config: z.boolean(),
    user_data: z.boolean(),
    logs: z.boolean(),
    recordings: z.boolean(),
  }),
})

// 数据恢复 Schema
export const dataRestoreSchema = z.object({
  backup_file: z.string().min(1, "请选择备份文件"),
  restore_options: z.object({
    overwrite: z.boolean(),
    validate: z.boolean(),
  }),
})

// 完整的管理配置 Schema
export const managementConfigSchema = backupConfigSchema
  .merge(remoteBackupSchema)

// 导出类型
export type BackupConfigFormData = z.infer<typeof backupConfigSchema>
export type RemoteBackupFormData = z.infer<typeof remoteBackupSchema>
export type ManualBackupFormData = z.infer<typeof manualBackupSchema>
export type DataRestoreFormData = z.infer<typeof dataRestoreSchema>
export type ManagementConfigFormData = z.infer<typeof managementConfigSchema>
