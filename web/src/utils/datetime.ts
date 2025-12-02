import type { SystemConfig } from "@/lib/api/settings"
import type { User } from "@/lib/api/auth"

/**
 * 统一获取用户生效的时区：
 * 1. 优先使用用户个人偏好 timezone
 * 2. 其次使用系统默认时区
 * 3. 最后回退到 UTC
 */
export function getEffectiveTimezone(user?: Pick<User, "timezone"> | null, config?: SystemConfig | null): string {
  return user?.timezone || config?.default_timezone || "UTC"
}

/**
 * 统一获取用户生效的语言：
 * 1. 默认仅支持 zh-CN / en-US
 * 2. 优先使用 localStorage 缓存（避免页面刷新闪烁）
 * 3. 其次使用用户个人语言偏好
 * 4. 再次使用系统默认语言
 * 5. 最后回退到 zh-CN
 *
 * 注意：此实现适用于纯 CSR（客户端渲染）环境
 * 开发环境可能会有 Hydration 警告，但生产环境（output: "export"）不会有问题
 */
export function getEffectiveLocale(
  user?: Pick<User, "language"> | null,
  config?: SystemConfig | null,
): "zh-CN" | "en-US" {
  // 优先从 localStorage 读取缓存的语言设置（仅在浏览器环境）
  if (typeof window !== "undefined") {
    try {
      const cachedLang = localStorage.getItem("user-language")
      if (cachedLang === "zh-CN" || cachedLang === "en-US") {
        return cachedLang
      }
    } catch (error) {
      // localStorage 不可用时静默失败，继续使用其他方式
      console.warn("Failed to read language from localStorage:", error)
    }
  }

  // 使用用户个人语言偏好
  const userLang = user?.language
  if (userLang === "zh-CN" || userLang === "en-US") {
    return userLang
  }

  // 使用系统默认语言
  const systemLang = config?.default_language
  if (systemLang === "zh-CN" || systemLang === "en-US") {
    return systemLang
  }

  // 最后回退到中文
  return "zh-CN"
}

/**
 * 保存语言设置到 localStorage
 * 用于在页面刷新时快速恢复语言设置，避免闪烁
 */
export function saveLocaleToStorage(locale: "zh-CN" | "en-US"): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("user-language", locale)
    } catch (error) {
      console.warn("Failed to save language to localStorage:", error)
    }
  }
}

/**
 * 按照“UTC 存储 + 指定时区展示”格式化时间
 * - value: 可以是 ISO 字符串 / 时间戳 / Date
 * - options: 透传给 Intl.DateTimeFormat
 */
export function formatInTimezone(
  value: string | number | Date | undefined,
  options: Intl.DateTimeFormatOptions & { timeZone?: string } = {},
  locale: "zh-CN" | "en-US" = "zh-CN",
  timeZone = "UTC",
): string {
  if (!value) return "-"
  try {
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return "-"
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone,
      ...options,
    }).format(date)
  } catch {
    return "-"
  }
}
