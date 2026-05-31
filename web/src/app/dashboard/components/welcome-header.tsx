"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { CalendarDays, CircleCheck } from "lucide-react"
import { useClientAuth } from "@/components/client-auth-provider"

/**
 * 仪表盘欢迎区
 * 左侧：标题 + 问候语（按时段 + 用户名）+ 副标题
 * 右侧：系统健康状态点 + 实时日期时间
 */
export function WelcomeHeader() {
  const t = useTranslations("dashboard")
  const { user } = useClientAuth()
  const [now, setNow] = React.useState<Date | null>(null)

  // 客户端挂载后再设置时间，避免 SSR/CSR 水合不一致
  React.useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 1000 * 30)
    return () => clearInterval(timer)
  }, [])

  const greeting = React.useMemo(() => {
    const h = (now ?? new Date()).getHours()
    if (h < 6) return t("greetingNight")
    if (h < 12) return t("greetingMorning")
    if (h < 18) return t("greetingAfternoon")
    return t("greetingEvening")
  }, [now, t])

  const dateText = React.useMemo(() => {
    if (!now) return ""
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, "0")
    const d = String(now.getDate()).padStart(2, "0")
    const hh = String(now.getHours()).padStart(2, "0")
    const mm = String(now.getMinutes()).padStart(2, "0")
    return `${y}-${m}-${d} ${hh}:${mm}`
  }, [now])

  const username = user?.username ?? ""

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-base font-medium">
          {greeting}
          {username ? `, ${username}` : ""} 👋
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex shrink-0 items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
          <CircleCheck className="h-4 w-4" />
          <span className="hidden sm:inline">{t("systemHealthy")}</span>
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground tabular-nums">
          <CalendarDays className="h-4 w-4" />
          {dateText}
        </span>
      </div>
    </div>
  )
}
