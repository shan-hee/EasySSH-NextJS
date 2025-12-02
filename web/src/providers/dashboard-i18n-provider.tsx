"use client"

import type { ReactNode } from "react"
import { useMemo, useEffect } from "react"
import { NextIntlClientProvider } from "next-intl"
import { useClientAuth } from "@/components/client-auth-provider"
import { useSystemConfig } from "@/contexts/system-config-context"
import { getEffectiveLocale, saveLocaleToStorage } from "@/utils/datetime"
import zhCN from "@/i18n/messages/zh-CN"
import enUS from "@/i18n/messages/en-US"

const allMessages = {
  "zh-CN": zhCN,
  "en-US": enUS,
} as const

interface DashboardI18nProviderProps {
  children: ReactNode
}

export function DashboardI18nProvider({ children }: DashboardI18nProviderProps) {
  const { user } = useClientAuth()
  const { config } = useSystemConfig()

  // 直接调用 getEffectiveLocale，它会自动从 localStorage 读取
  const locale = getEffectiveLocale(user, config)

  const messages = useMemo(() => {
    return allMessages[locale] ?? zhCN
  }, [locale])

  // 当用户数据加载完成后，同步语言设置到 localStorage
  useEffect(() => {
    if (user?.language && (user.language === "zh-CN" || user.language === "en-US")) {
      saveLocaleToStorage(user.language)
    }
  }, [user?.language])

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}

