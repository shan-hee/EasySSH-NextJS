"use client"

import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { PageHeader } from "@/components/page-header"
import {
  dashboardApi,
  type DashboardOverview,
} from "@/lib/api/dashboard"
import { monitoringApi, type ServerResourceSummary } from "@/lib/api"
import {
  Server,
  Activity,
  Cpu,
  MemoryStick,
  TerminalSquare,
  RefreshCw,
} from "lucide-react"
import { isApiError } from "@/lib/api-client"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

import { WelcomeHeader } from "./components/welcome-header"
import { StatCard } from "./components/stat-card"
import { ConnectionTrendChart } from "./components/connection-trend-chart"
import { QuickActionsPanel } from "./components/quick-actions-panel"
import { ServerDistribution } from "./components/server-distribution"
import {
  ServerOverviewTable,
  type ServerOverviewRow,
} from "./components/server-overview-table"
import { RecentActivity } from "./components/recent-activity"
import {
  ResourceDistributionChart,
  type ResourceShare,
} from "./components/resource-distribution-chart"

// ---- 数据转换工具 ----

function formatBytes(bytes: number): number {
  return Number((bytes / (1024 * 1024 * 1024)).toFixed(1))
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  if (days > 0) return `${days}d ${hours}h`
  return `${hours}h`
}

// 把 SSE 流的服务器资源转为表格行
function transformServer(s: ServerResourceSummary): ServerOverviewRow {
  let status: ServerOverviewRow["status"] = s.status as ServerOverviewRow["status"]
  const cpuUsage = Math.round(s.cpu?.usage_percent ?? 0)
  const memUsage = Math.round(s.memory?.used_percent ?? 0)
  const diskUsage = Math.round(s.disk?.used_percent ?? 0)
  if (s.status === "online" && (cpuUsage >= 90 || memUsage >= 90 || diskUsage >= 90)) {
    status = "warning"
  }

  let location: string | undefined
  if (s.location) {
    const { city, region, country } = s.location
    if (city && region) location = `${city}, ${region}`
    else location = city || region || country || undefined
  }

  return {
    id: s.server_id,
    name: s.name || `${s.host}:${s.port}`,
    location,
    status,
    cpu: cpuUsage,
    memory: {
      used: formatBytes(s.memory?.used ?? 0),
      total: formatBytes(s.memory?.total ?? 0),
      usage: memUsage,
    },
    disk: {
      used: formatBytes(s.disk?.used ?? 0),
      total: formatBytes(s.disk?.total ?? 0),
      usage: diskUsage,
    },
    uptime: s.uptime > 0 ? formatUptime(s.uptime) : "—",
  }
}

const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000

export default function DashboardPage() {
  const { ready } = useAuthReady()
  const t = useTranslations("dashboard")

  // 聚合概览（后端 /dashboard/overview）
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [loadingOverview, setLoadingOverview] = useState(true)

  // SSE 流式服务器资源
  const [servers, setServers] = useState<ServerOverviewRow[]>([])
  const [loadingServers, setLoadingServers] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const cancelStreamRef = useRef<(() => void) | null>(null)
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null)

  // 加载聚合概览
  const loadOverview = useCallback(async () => {
    try {
      const data = await dashboardApi.getOverview()
      setOverview(data)
    } catch (error: unknown) {
      if (isApiError(error) && error.status === 401) return
      console.error("Failed to load dashboard overview:", error)
    } finally {
      setLoadingOverview(false)
    }
  }, [])

  // SSE 流式加载服务器资源
  const loadServersStream = useCallback(() => {
    if (cancelStreamRef.current) cancelStreamRef.current()
    setServers([])
    setLoadingServers(true)

    const cancel = monitoringApi.streamServersResources(
      (serverData) => {
        const row = transformServer(serverData)
        setServers((prev) => {
          const idx = prev.findIndex((s) => s.id === row.id)
          if (idx >= 0) {
            const next = [...prev]
            next[idx] = row
            return next
          }
          return [...prev, row]
        })
        setLoadingServers(false)
      },
      () => {
        setLoadingServers(false)
        cancelStreamRef.current = null
      },
      (error) => {
        console.error("Failed to load server resources:", error)
        setLoadingServers(false)
        cancelStreamRef.current = null
      }
    )
    cancelStreamRef.current = cancel
  }, [])

  const performRefresh = useCallback(() => {
    setIsRefreshing(true)
    loadOverview()
    loadServersStream()
    setTimeout(() => setIsRefreshing(false), 600)
  }, [loadOverview, loadServersStream])

  useEffect(() => {
    if (!ready) return
    loadOverview()
    loadServersStream()

    autoRefreshRef.current = setInterval(() => {
      loadOverview()
      loadServersStream()
    }, AUTO_REFRESH_INTERVAL)

    return () => {
      if (cancelStreamRef.current) cancelStreamRef.current()
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current)
    }
  }, [ready, loadOverview, loadServersStream])

  // 在线服务器实时均值（CPU/内存）来自 SSE 流
  const resourceSummary = useMemo(() => {
    const online = servers.filter((s) => s.status === "online" || s.status === "warning")
    const count = online.length
    if (count === 0) return { avgCpu: 0, avgMemory: 0 }
    return {
      avgCpu: Math.round(online.reduce((acc, s) => acc + s.cpu, 0) / count),
      avgMemory: Math.round(online.reduce((acc, s) => acc + s.memory.usage, 0) / count),
    }
  }, [servers])

  // 排序：在线 > 警告 > 离线 > 错误
  const sortedServers = useMemo(() => {
    const order: Record<string, number> = { online: 0, warning: 1, offline: 2, error: 3 }
    return [...servers].sort((a, b) => order[a.status] - order[b.status])
  }, [servers])

  // 资源分布环形图数据（分片按已用内存，中心显示总内存）
  const resourceShares = useMemo<ResourceShare[]>(
    () =>
      servers
        .filter((s) => s.status === "online" || s.status === "warning")
        .map((s) => ({ name: s.name, used: s.memory.used, total: s.memory.total })),
    [servers]
  )

  // 在线服务器数（实时，来自 SSE）
  const onlineCount = useMemo(
    () => servers.filter((s) => s.status === "online" || s.status === "warning").length,
    [servers]
  )

  const stats = overview?.stats
  const trend = overview?.connection_trend

  return (
    <>
      <PageHeader
        title={t("title")}
        titleActions={
          <button
            onClick={performRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            aria-label={t("refresh")}
            title={t("refresh")}
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </button>
        }
      />

      <div className="flex flex-1 flex-col gap-4 p-3 pt-0 sm:gap-5 sm:p-4 sm:pt-0">
        {/* 欢迎区 */}
        <WelcomeHeader />

        {/* 5 个统计卡 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          <StatCard
            title={t("statsOnlineServers")}
            value={`${onlineCount} / ${stats?.total_servers ?? 0}`}
            icon={Server}
            tone="emerald"
            spark={stats?.online_servers.spark}
            loading={loadingOverview && !stats}
          />
          <StatCard
            title={t("statActiveConns")}
            value={stats?.active_conns.value ?? 0}
            icon={TerminalSquare}
            tone="blue"
            spark={stats?.active_conns.spark}
            loading={loadingOverview && !stats}
          />
          <StatCard
            title={t("statAvgCpu")}
            value={`${resourceSummary.avgCpu}%`}
            icon={Cpu}
            tone="violet"
            loading={loadingServers && servers.length === 0}
          />
          <StatCard
            title={t("statAvgMemory")}
            value={`${resourceSummary.avgMemory}%`}
            icon={MemoryStick}
            tone="cyan"
            loading={loadingServers && servers.length === 0}
          />
          <StatCard
            title={t("statsTodayConnections")}
            value={stats?.today_commands.value ?? 0}
            icon={Activity}
            tone="amber"
            changePct={stats?.today_commands.change_pct}
            changeLabel={t("comparedToYesterday")}
            spark={stats?.today_commands.spark}
            loading={loadingOverview && !stats}
          />
        </div>

        {/* 趋势图 + 快捷操作 + 分布 */}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)_minmax(360px,1fr)]">
          <div>
            <ConnectionTrendChart
              dates={trend?.dates ?? []}
              series={trend?.series ?? {}}
              loading={loadingOverview && !trend}
            />
          </div>
          <QuickActionsPanel />
          <ServerDistribution
            distribution={overview?.distribution ?? []}
            loading={loadingOverview && !overview}
          />
        </div>

        {/* 服务器概览表 + 最近活动 + 资源分布 */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)_minmax(320px,1fr)]">
          <div className="md:col-span-2 xl:col-span-1">
            <ServerOverviewTable servers={sortedServers} loading={loadingServers} />
          </div>
          <RecentActivity
            items={overview?.recent_activity ?? []}
            loading={loadingOverview && !overview}
          />
          <ResourceDistributionChart items={resourceShares} loading={loadingServers && servers.length === 0} />
        </div>
      </div>
    </>
  )
}
