"use client"

import { useEffect, useState } from "react"
import { PageHeader } from "@/components/page-header"
import { dashboardApi, type DashboardStats } from "@/lib/api/dashboard"
import { QuickActions } from "./components/quick-actions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, FileText, Server, ServerOff } from "lucide-react"
import { SkeletonStatsCard } from "@/components/ui/loading"
import { getErrorMessage } from "@/lib/error-utils"
import { toast } from "@/components/ui/sonner"
import { isApiError } from "@/lib/api-client"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { useTranslations } from "next-intl"

/**
 * 仪表盘页面（Client Component）
 * 乐观渲染模式：立即显示骨架屏，后台加载数据
 */
export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const { ready } = useAuthReady()
  const tDashboard = useTranslations("dashboard")

  useEffect(() => {
    if (!ready) {
      return
    }

    const loadStats = async () => {
      try {
        const data = await dashboardApi.getStats()
        setStats(data)
      } catch (error: unknown) {
        // 401 交给全局认证处理逻辑（跳登录），这里不再重复弹错误
        if (isApiError(error) && error.status === 401) {
          return
        }
        toast.error(getErrorMessage(error, "无法加载仪表盘数据"))
      }
    }

    loadStats()
  }, [ready])

  return (
    <>
      <PageHeader title={tDashboard("title")} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* 统计卡片 - 乐观渲染：先显示骨架屏，数据加载后替换 */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {!stats ? (
            <>
              <SkeletonStatsCard />
              <SkeletonStatsCard />
              <SkeletonStatsCard />
              <SkeletonStatsCard />
              <SkeletonStatsCard />
            </>
          ) : (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {tDashboard("statsTotalServers")}
                  </CardTitle>
                  <Server className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalServers || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {tDashboard("statsTotalServersDesc")}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {tDashboard("statsOnlineServers")}
                  </CardTitle>
                  <Server className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {stats?.onlineServers || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tDashboard("statsOnlineRate")}{" "}
                    {stats && stats.totalServers > 0
                      ? Math.round((stats.onlineServers / stats.totalServers) * 100)
                      : 0}
                    %
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {tDashboard("statsOfflineServers")}
                  </CardTitle>
                  <ServerOff className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {stats?.offlineServers || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tDashboard("statsOfflineServersDesc")}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {tDashboard("statsTodayConnections")}
                  </CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.todayConnections || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {tDashboard("statsTodayConnectionsDesc")}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {tDashboard("statsRecentLogs")}
                  </CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.recentLogsCount || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {tDashboard("statsRecentLogsDesc")}
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* 快速操作 - 客户端组件，立即显示 */}
        <QuickActions />
      </div>
    </>
  )
}
