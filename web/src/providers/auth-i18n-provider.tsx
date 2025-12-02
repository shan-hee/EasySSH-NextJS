"use client"

import type { ReactNode } from "react"
import { useMemo } from "react"
import { NextIntlClientProvider } from "next-intl"
import { useSystemConfig } from "@/contexts/system-config-context"
import { getEffectiveLocale } from "@/utils/datetime"
import zhCN from "@/i18n/messages/zh-CN"
import enUS from "@/i18n/messages/en-US"

const allMessages = {
  "zh-CN": zhCN,
  "en-US": enUS,
} as const

interface AuthI18nProviderProps {
  children: ReactNode
}

/**
 * 认证/初始化流程使用的 i18n Provider
 * 优先使用 localStorage 缓存的语言设置（避免闪烁）
 * 其次依赖系统配置中的默认语言
 * 不依赖登录用户信息（因为用户可能未登录）
 */
export function AuthI18nProvider({ children }: AuthI18nProviderProps) {
  const { config } = useSystemConfig()

  // 直接调用 getEffectiveLocale，它会自动从 localStorage 读取
  const locale = getEffectiveLocale(null, config)

  const messages = useMemo(() => {
    return allMessages[locale] ?? zhCN
  }, [locale])

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}

