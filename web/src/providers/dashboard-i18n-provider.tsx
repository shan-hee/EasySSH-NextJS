"use client"

import type { ReactNode } from "react"
import { useMemo } from "react"
import { NextIntlClientProvider } from "next-intl"
import { useClientAuth } from "@/components/client-auth-provider"
import { useSystemConfig } from "@/contexts/system-config-context"
import { getEffectiveLocale } from "@/utils/datetime"
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

  const locale = getEffectiveLocale(user, config)

  const messages = useMemo(() => {
    return allMessages[locale] ?? zhCN
  }, [locale])

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}

