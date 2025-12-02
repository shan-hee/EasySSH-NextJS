"use client"

import { Server, Activity, History } from "lucide-react"
import type { DashboardStats } from "@/lib/api/dashboard"
import { useTranslations } from "next-intl"

interface DashboardStatsCardsProps {
  stats: DashboardStats
}

/**
 * 仪表盘统计卡片组件（客户端组件）
 * 接收服务端传递的初始数据
 */
export function DashboardStatsCards({ stats }: DashboardStatsCardsProps) {
  const t = useTranslations("dashboard")

  return (
    <div className="grid auto-rows-min gap-4 md:grid-cols-3">
      {/* 服务器总数卡片 */}
      <div className="bg-card border rounded-xl p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">{t("statsTotalServers")}</h3>
          <Server className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-3xl font-bold text-primary">{stats.totalServers}</p>
        <p className="text-sm text-muted-foreground">
          {t("statsOnlineServers")}: {stats.onlineServers} | {t("statsOfflineServers")}: {stats.offlineServers}
        </p>
      </div>

      {/* 操作总数卡片 */}
      <div className="bg-card border rounded-xl p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">{t("statsTodayConnections")}</h3>
          <Activity className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-3xl font-bold text-green-600">{stats.todayConnections}</p>
        <p className="text-sm text-muted-foreground">{t("statsTodayConnectionsDesc")}</p>
      </div>

      {/* 历史记录卡片 */}
      <div className="bg-card border rounded-xl p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">{t("statsRecentLogs")}</h3>
          <History className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-3xl font-bold text-blue-600">{stats.recentLogsCount}</p>
        <p className="text-sm text-muted-foreground">{t("statsRecentLogsDesc")}</p>
      </div>
    </div>
  )
}
