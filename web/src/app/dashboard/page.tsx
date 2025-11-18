"use client"

import { useEffect, useState } from "react"
import { PageHeader } from "@/components/page-header"
import { dashboardApi, type DashboardStats } from "@/lib/api/dashboard"
import { QuickActions } from "./components/quick-actions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, FileText, Server, ServerOff } from "lucide-react"
import { getErrorMessage } from "@/lib/error-utils"
import { toast } from "@/components/ui/sonner"
import { useClientAuth } from "@/components/client-auth-provider"
import { isApiError } from "@/lib/api-client"

/**
 * 统计卡片骨架屏 - 精确匹配真实卡片的高度和布局
 * 策略：使用透明文本占位，而不是固定高度的 span，确保行高完全一致
 */
function StatsCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          <span className="inline-block w-20 animate-pulse rounded bg-muted text-transparent">占位</span>
        </CardTitle>
        <div className="h-4 w-4 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          <span className="inline-block w-16 animate-pulse rounded bg-muted text-transparent">0</span>
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="inline-block w-24 animate-pulse rounded bg-muted text-transparent">占位文字</span>
        </p>
      </CardContent>
    </Card>
  )
}

/**
 * 仪表盘页面（Client Component）
 * 乐观渲染模式：立即显示骨架屏，后台加载数据
 */
export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const { isAuthenticated } = useClientAuth()

  useEffect(() => {
    if (!isAuthenticated) {
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
  }, [isAuthenticated])

  return (
    <>
      <PageHeader title="仪表盘" />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* 统计卡片 - 乐观渲染：先显示骨架屏，数据加载后替换 */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {!stats ? (
            <>
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
            </>
          ) : (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">服务器总数</CardTitle>
                  <Server className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalServers || 0}</div>
                  <p className="text-xs text-muted-foreground">已配置的服务器</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">在线服务器</CardTitle>
                  <Server className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{stats?.onlineServers || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    在线率 {stats && stats.totalServers > 0 ? Math.round((stats.onlineServers / stats.totalServers) * 100) : 0}%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">离线服务器</CardTitle>
                  <ServerOff className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{stats?.offlineServers || 0}</div>
                  <p className="text-xs text-muted-foreground">需要检查</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">今日连接</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.todayConnections || 0}</div>
                  <p className="text-xs text-muted-foreground">今日操作次数</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">最近日志</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.recentLogsCount || 0}</div>
                  <p className="text-xs text-muted-foreground">审计日志总数</p>
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
