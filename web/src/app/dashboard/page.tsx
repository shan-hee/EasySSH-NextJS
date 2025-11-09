import { Suspense } from "react"
import type { Metadata } from "next"
import { PageHeader } from "@/components/page-header"
import { getServerStats, getAuditStats } from "@/lib/api/dashboard-server"
import { DashboardStatsCards } from "./components/dashboard-stats"
import { QuickActions } from "./components/quick-actions"
import { DashboardSkeleton } from "./components/dashboard-skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, FileText, Server, ServerOff } from "lucide-react"
import { generatePageMetadata } from "@/lib/metadata"

export const metadata: Metadata = generatePageMetadata("dashboard")

/**
 * 服务器统计卡片（快速加载）
 * 独立的 Suspense 边界，优先显示服务器数据
 */
async function ServerStatsCards() {
  const stats = await getServerStats()

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">服务器总数</CardTitle>
          <Server className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalServers}</div>
          <p className="text-xs text-muted-foreground">已配置的服务器</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">在线服务器</CardTitle>
          <Server className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{stats.onlineServers}</div>
          <p className="text-xs text-muted-foreground">
            在线率 {stats.totalServers > 0 ? Math.round((stats.onlineServers / stats.totalServers) * 100) : 0}%
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">离线服务器</CardTitle>
          <ServerOff className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{stats.offlineServers}</div>
          <p className="text-xs text-muted-foreground">需要检查</p>
        </CardContent>
      </Card>
    </>
  )
}

/**
 * 审计日志统计卡片（可能较慢）
 * 独立的 Suspense 边界，延迟加载审计日志数据
 */
async function AuditStatsCards() {
  const stats = await getAuditStats()

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">今日连接</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.todayConnections}</div>
          <p className="text-xs text-muted-foreground">今日操作次数</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">最近日志</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.recentLogsCount}</div>
          <p className="text-xs text-muted-foreground">审计日志总数</p>
        </CardContent>
      </Card>
    </>
  )
}

/**
 * 统计卡片骨架屏
 */
function StatsCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        <div className="h-4 w-4 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-16 animate-pulse rounded bg-muted" />
        <div className="mt-1 h-3 w-24 animate-pulse rounded bg-muted" />
      </CardContent>
    </Card>
  )
}

/**
 * 仪表盘页面（Server Component）
 * 使用多个独立的 Suspense 边界实现 Streaming 优化
 * 快速数据（服务器统计）优先显示，慢速数据（审计日志）延迟加载
 */
export default function DashboardPage() {
  return (
    <>
      <PageHeader title="仪表盘" />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* 统计卡片 - 使用独立的 Suspense 边界实现渐进式渲染 */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {/* 服务器统计 - 快速加载 */}
          <Suspense
            fallback={
              <>
                <StatsCardSkeleton />
                <StatsCardSkeleton />
                <StatsCardSkeleton />
              </>
            }
          >
            <ServerStatsCards />
          </Suspense>

          {/* 审计日志统计 - 延迟加载，不阻塞服务器统计的显示 */}
          <Suspense
            fallback={
              <>
                <StatsCardSkeleton />
                <StatsCardSkeleton />
              </>
            }
          >
            <AuditStatsCards />
          </Suspense>
        </div>

        {/* 快速操作 - 客户端组件，立即显示 */}
        <QuickActions />
      </div>
    </>
  )
}
