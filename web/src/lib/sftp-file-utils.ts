import { formatBytesString } from "@/lib/format-utils"
import { formatInTimezone } from "@/utils/datetime"

type SupportedLocale = Parameters<typeof formatInTimezone>[2]

export interface SftpBackendFileInfo {
  name: string
  size: number
  mode: number
  is_dir: boolean
  mod_time: string
  permission?: string
}

export interface SftpFileItem {
  name: string
  type: "file" | "directory"
  size: string
  sizeBytes: number
  modified: string
  permissions: string
}

interface ConvertOptions {
  locale?: SupportedLocale
  timezone?: string
  showDirSizeDash?: boolean
}

const permissionCache = new Map<string, string>()

export function formatSftpPermissions(mode: number, isDir: boolean, override?: string): string {
  if (override) return override
  const cacheKey = `${mode}-${isDir}`
  const cached = permissionCache.get(cacheKey)
  if (cached) return cached

  if (!mode && mode !== 0) {
    return "---------"
  }

  const perms =
    (mode & 0o400 ? "r" : "-") +
    (mode & 0o200 ? "w" : "-") +
    (mode & 0o100 ? "x" : "-") +
    (mode & 0o040 ? "r" : "-") +
    (mode & 0o020 ? "w" : "-") +
    (mode & 0o010 ? "x" : "-") +
    (mode & 0o004 ? "r" : "-") +
    (mode & 0o002 ? "w" : "-") +
    (mode & 0o001 ? "x" : "-")

  const result = (isDir ? "d" : "-") + perms
  permissionCache.set(cacheKey, result)
  return result
}

export function formatSftpModTime(modTime: string, options?: Pick<ConvertOptions, "locale" | "timezone">): string {
  if (!modTime) return "-"
  const date = new Date(modTime)
  if (Number.isNaN(date.getTime())) return "-"

  if (options?.locale && options?.timezone) {
    return formatInTimezone(
      date,
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      },
      options.locale,
      options.timezone,
    ).replace(/\//g, "-")
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const seconds = String(date.getSeconds()).padStart(2, "0")
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

export function convertSftpFileInfo(info: SftpBackendFileInfo, options?: ConvertOptions): SftpFileItem {
  const isDir = info.is_dir
  const sizeBytes = info.size ?? 0
  const showDirSizeDash = options?.showDirSizeDash !== false

  return {
    name: info.name,
    type: isDir ? "directory" : "file",
    size: isDir && showDirSizeDash ? "-" : formatBytesString(sizeBytes),
    sizeBytes,
    modified: formatSftpModTime(info.mod_time, options),
    permissions: formatSftpPermissions(info.mode, isDir, info.permission),
  }
}
