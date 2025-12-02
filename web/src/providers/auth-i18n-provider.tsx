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
 * 仅依赖系统配置中的默认语言，不依赖登录用户信息
 */
export function AuthI18nProvider({ children }: AuthI18nProviderProps) {
  const { config } = useSystemConfig()

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

