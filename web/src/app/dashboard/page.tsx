"use client"

import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { PageHeader } from "@/components/page-header"
import { dashboardApi, type DashboardStats } from "@/lib/api/dashboard"
import { monitoringApi, type ServerResourceSummary } from "@/lib/api"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Activity,
  Server,
  ServerOff,
  Cpu,
  MemoryStick,
  HardDrive,
  Clock,
  RefreshCw,
  Terminal,
  FolderOpen,
  Settings,
  Plus,
  ArrowDown,
  ArrowUp,
  MapPin,
} from "lucide-react"
import { SkeletonStatsCard } from "@/components/ui/loading"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/sonner"
import { isApiError } from "@/lib/api-client"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import Link from "next/link"

// 服务器资源数据接口
interface ServerResource {
  id: string
  name: string
  host: string
  location?: string
  status: "online" | "warning" | "offline" | "error"
  cpu: { usage: number; cores: number }
  memory: { used: number; total: number; usage: number }
  disk: { used: number; total: number; usage: number }
  network: { rx: string; tx: string }
  uptime: string
}

function formatBytes(bytes: number): number {
  return Number((bytes / (1024 * 1024 * 1024)).toFixed(1))
}

// 格式化网络流量
function formatNetworkBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  if (days > 0) return `${days}d ${hours}h`
  return `${hours}h`
}

// 使用率颜色
function getUsageColor(usage: number): string {
  if (usage >= 90) return "bg-red-500"
  if (usage >= 70) return "bg-yellow-500"
  return "bg-green-500"
}

// 使用率文字颜色
function getUsageTextColor(usage: number): string {
  if (usage >= 90) return "text-red-600"
  if (usage >= 70) return "text-yellow-600"
  return "text-green-600"
}

// 状态配置
const statusConfig = {
  online: {
    label: "在线",
    badgeClass: "bg-green-500/10 text-green-600 border-green-500/20",
    dotClass: "bg-green-500",
  },
  warning: {
    label: "警告",
    badgeClass: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    dotClass: "bg-yellow-500",
  },
  offline: {
    label: "离线",
    badgeClass: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
    dotClass: "bg-zinc-400",
  },
  error: {
    label: "错误",
    badgeClass: "bg-red-500/10 text-red-600 border-red-500/20",
    dotClass: "bg-red-500",
  },
}

// 统计卡片组件
function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconClassName,
  valueClassName,
}: {
  title: string
  value: string | number
  description: string
  icon: React.ElementType
  iconClassName?: string
  valueClassName?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn("h-4 w-4 text-muted-foreground", iconClassName)} />
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold tabular-nums", valueClassName)}>{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

// 快速操作按钮
function QuickActionButton({
  href,
  icon: Icon,
  label,
  variant = "secondary",
}: {
  href: string
  icon: React.ElementType
  label: string
  variant?: "primary" | "secondary"
}) {
  return (
    <Link href={href}>
      <Button
        variant={variant === "primary" ? "default" : "outline"}
        className={cn(
          "h-auto w-full flex-col gap-2 py-4",
          variant === "primary" && "bg-primary hover:bg-primary/90"
        )}
      >
        <Icon className="h-5 w-5" />
        <span className="text-sm">{label}</span>
      </Button>
    </Link>
  )
}

// 资源指标行
function ResourceMetricRow({
  icon: Icon,
  label,
  value,
  usage,
}: {
  icon: React.ElementType
  label: string
  value: string
  usage: number
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          <span>{label}</span>
        </div>
        <span className={cn("font-medium tabular-nums", getUsageTextColor(usage))}>
          {value}
        </span>
      </div>
      <Progress value={usage} className="h-1" indicatorClassName={getUsageColor(usage)} />
    </div>
  )
}

// 服务器资源卡片
function ServerResourceCard({ server }: { server: ServerResource }) {
  const config = statusConfig[server.status] || statusConfig.offline

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-sm font-medium">{server.name}</CardTitle>
            <CardDescription className="truncate text-xs">
              {server.location ? (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {server.location}
                </span>
              ) : (
                server.host
              )}
            </CardDescription>
          </div>
          <Badge variant="outline" className={cn("shrink-0 gap-1 text-xs", config.badgeClass)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", config.dotClass)} />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {server.status === "online" || server.status === "warning" ? (
          <>
            <ResourceMetricRow
              icon={Cpu}
              label="CPU"
              value={`${server.cpu.usage}%`}
              usage={server.cpu.usage}
            />
            <ResourceMetricRow
              icon={MemoryStick}
              label="内存"
              value={`${server.memory.used}GB/${server.memory.usage}%`}
              usage={server.memory.usage}
            />
            <ResourceMetricRow
              icon={HardDrive}
              label="磁盘"
              value={`${server.disk.used}GB/${server.disk.usage}%`}
              usage={server.disk.usage}
            />
            {/* 网络流量 */}
            <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-0.5">
                  <ArrowDown className="h-3 w-3 text-green-500" />
                  {server.network.rx}
                </span>
                <span className="flex items-center gap-0.5">
                  <ArrowUp className="h-3 w-3 text-blue-500" />
                  {server.network.tx}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{server.uptime}</span>
              </div>
              <span>{server.cpu.cores} 核心</span>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
            <ServerOff className="mr-2 h-4 w-4" />
            服务器离线
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 服务器卡片骨架屏
function SkeletonServerCard() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-12" />
              <Skeleton className="h-3.5 w-8" />
            </div>
            <Skeleton className="h-1 w-full" />
          </div>
        ))}
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
      </CardContent>
    </Card>
  )
}

// 空状态
function EmptyServers() {
  return (
    <Card className="col-span-full">
      <CardContent className="flex flex-col items-center justify-center py-8">
        <Server className="h-10 w-10 text-muted-foreground/40" />
        <p className="mt-3 text-sm text-muted-foreground">暂无服务器</p>
        <Link href="/dashboard/servers">
          <Button variant="outline" size="sm" className="mt-3">
            <Plus className="mr-1.5 h-4 w-4" />
            添加服务器
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}

// 转换服务器数据
function transformServerData(server: ServerResourceSummary): ServerResource {
  let status: "online" | "warning" | "offline" | "error" = server.status as
    | "online"
    | "offline"
    | "error"
  if (server.status === "online") {
    const cpuUsage = server.cpu?.usage_percent ?? 0
    const memUsage = server.memory?.used_percent ?? 0
    const diskUsage = server.disk?.used_percent ?? 0
    if (cpuUsage >= 90 || memUsage >= 90 || diskUsage >= 90) {
      status = "warning"
    }
  }

  // 格式化地理位置
  let location: string | undefined
  if (server.location) {
    const { city, region, country } = server.location
    if (city && region) {
      location = `${city}, ${region}`
    } else if (city) {
      location = city
    } else if (region) {
      location = region
    } else if (country) {
      location = country
    }
  }

  return {
    id: server.server_id,
    name: server.name || `${server.host}:${server.port}`,
    host: server.host,
    location,
    status,
    cpu: {
      usage: Math.round(server.cpu?.usage_percent ?? 0),
      cores: server.cpu?.cores ?? 0,
    },
    memory: {
      used: formatBytes(server.memory?.used ?? 0),
      total: formatBytes(server.memory?.total ?? 0),
      usage: Math.round(server.memory?.used_percent ?? 0),
    },
    disk: {
      used: formatBytes(server.disk?.used ?? 0),
      total: formatBytes(server.disk?.total ?? 0),
      usage: Math.round(server.disk?.used_percent ?? 0),
    },
    network: {
      rx: formatNetworkBytes(server.network?.rx_bytes ?? 0),
      tx: formatNetworkBytes(server.network?.tx_bytes ?? 0),
    },
    uptime: server.uptime > 0 ? formatUptime(server.uptime) : "-",
  }
}

// 自动刷新间隔（5分钟）
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [servers, setServers] = useState<ServerResource[]>([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingServers, setLoadingServers] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState(AUTO_REFRESH_INTERVAL / 1000)
  const { ready } = useAuthReady()
  const t = useTranslations("dashboard")
  const cancelStreamRef = useRef<(() => void) | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null)

  // 加载统计数据
  const loadStats = async () => {
    try {
      const data = await dashboardApi.getStats()
      setStats(data)
    } catch (error: unknown) {
      if (isApiError(error) && error.status === 401) return
      console.error("Failed to load stats:", error)
    } finally {
      setLoadingStats(false)
    }
  }

  // 使用流式 API 加载服务器资源
  const loadServersStream = useCallback(() => {
    // 取消之前的流
    if (cancelStreamRef.current) {
      cancelStreamRef.current()
    }

    setServers([])
    setLoadingServers(true)

    const cancel = monitoringApi.streamServersResources(
      // 每收到一台服务器数据
      (serverData) => {
        const transformed = transformServerData(serverData)
        setServers((prev) => {
          // 检查是否已存在，如果存在则更新
          const existingIndex = prev.findIndex((s) => s.id === transformed.id)
          if (existingIndex >= 0) {
            const newServers = [...prev]
            newServers[existingIndex] = transformed
            return newServers
          }
          return [...prev, transformed]
        })
        // 收到第一条数据后取消加载状态
        setLoadingServers(false)
      },
      // 全部完成
      () => {
        setLoadingServers(false)
        cancelStreamRef.current = null
      },
      // 错误处理
      (error) => {
        console.error("Failed to load server resources:", error)
        setLoadingServers(false)
        cancelStreamRef.current = null
      }
    )

    cancelStreamRef.current = cancel
  }, [])

  // 启动倒计时
  const startCountdown = useCallback(() => {
    // 清除之前的定时器
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
    }

    setCountdown(AUTO_REFRESH_INTERVAL / 1000)

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return AUTO_REFRESH_INTERVAL / 1000
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  // 执行刷新并更新时间
  const performRefresh = useCallback(() => {
    setIsRefreshing(true)
    loadStats()
    loadServersStream()
    setLastUpdated(new Date())
    startCountdown()

    setTimeout(() => {
      setIsRefreshing(false)
    }, 500)
  }, [loadServersStream, startCountdown])

  useEffect(() => {
    if (!ready) return

    // 首次加载
    loadStats()
    loadServersStream()
    setLastUpdated(new Date())
    startCountdown()

    // 设置自动刷新
    autoRefreshRef.current = setInterval(() => {
      loadStats()
      loadServersStream()
      setLastUpdated(new Date())
    }, AUTO_REFRESH_INTERVAL)

    return () => {
      if (cancelStreamRef.current) {
        cancelStreamRef.current()
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
      }
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current)
      }
    }
  }, [ready, loadServersStream, startCountdown])

  // 手动刷新数据
  const handleRefresh = () => {
    performRefresh()
    toast.success("数据已刷新")
  }

  // 格式化倒计时显示
  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  // 格式化更新时间
  const formatLastUpdated = (date: Date): string => {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, "0")
    const day = date.getDate().toString().padStart(2, "0")
    const hours = date.getHours().toString().padStart(2, "0")
    const minutes = date.getMinutes().toString().padStart(2, "0")
    const seconds = date.getSeconds().toString().padStart(2, "0")
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`
  }

  // 计算资源汇总
  const resourceSummary = useMemo(() => {
    const onlineServers = servers.filter((s) => s.status === "online" || s.status === "warning")
    const count = onlineServers.length
    if (count === 0) return { avgCpu: 0, avgMemory: 0, avgDisk: 0 }

    return {
      avgCpu: Math.round(onlineServers.reduce((acc, s) => acc + s.cpu.usage, 0) / count),
      avgMemory: Math.round(onlineServers.reduce((acc, s) => acc + s.memory.usage, 0) / count),
      avgDisk: Math.round(onlineServers.reduce((acc, s) => acc + s.disk.usage, 0) / count),
    }
  }, [servers])

  // 排序服务器列表：在线 > 警告 > 离线 > 错误
  const sortedServers = useMemo(() => {
    const statusOrder: Record<string, number> = {
      online: 0,
      warning: 1,
      offline: 2,
      error: 3,
    }
    return [...servers].sort((a, b) => statusOrder[a.status] - statusOrder[b.status])
  }, [servers])

  return (
    <>
      <PageHeader title={t("title")} />

      <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
        {/* 统计概览 */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loadingStats ? (
            <>
              <SkeletonStatsCard />
              <SkeletonStatsCard />
              <SkeletonStatsCard />
              <SkeletonStatsCard />
            </>
          ) : (
            <>
              <StatCard
                title={t("statsTotalServers")}
                value={stats?.totalServers ?? 0}
                description={`${stats?.onlineServers ?? 0} 在线 / ${stats?.offlineServers ?? 0} 离线`}
                icon={Server}
              />
              <StatCard
                title="平均 CPU"
                value={`${resourceSummary.avgCpu}%`}
                description="所有在线服务器"
                icon={Cpu}
                valueClassName={resourceSummary.avgCpu >= 70 ? "text-yellow-600" : undefined}
              />
              <StatCard
                title="平均内存"
                value={`${resourceSummary.avgMemory}%`}
                description="所有在线服务器"
                icon={MemoryStick}
                valueClassName={resourceSummary.avgMemory >= 70 ? "text-yellow-600" : undefined}
              />
              <StatCard
                title={t("statsTodayConnections")}
                value={stats?.todayConnections ?? 0}
                description={t("statsTodayConnectionsDesc")}
                icon={Activity}
              />
            </>
          )}
        </div>

        {/* 快速操作 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("quickActions")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <QuickActionButton
                href="/dashboard/terminal"
                icon={Terminal}
                label={t("quickWebTerminal")}
                variant="primary"
              />
              <QuickActionButton
                href="/dashboard/servers"
                icon={Plus}
                label={t("quickAddServer")}
              />
              <QuickActionButton
                href="/dashboard/sftp"
                icon={FolderOpen}
                label="文件管理"
              />
              <QuickActionButton
                href="/dashboard/settings"
                icon={Settings}
                label={t("quickSystemSettings")}
              />
            </div>
          </CardContent>
        </Card>

        {/* 服务器资源监控 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">服务器状态</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {lastUpdated && (
                <span className="hidden sm:inline">
                  更新于 {formatLastUpdated(lastUpdated)}
                </span>
              )}
              <span className="text-muted-foreground/60">|</span>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 hover:text-foreground transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                <span className="tabular-nums">{formatCountdown(countdown)}</span>
              </button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {loadingServers && sortedServers.length === 0 ? (
              <>
                <SkeletonServerCard />
                <SkeletonServerCard />
                <SkeletonServerCard />
                <SkeletonServerCard />
              </>
            ) : sortedServers.length === 0 ? (
              <EmptyServers />
            ) : (
              sortedServers.map((server) => (
                <ServerResourceCard key={server.id} server={server} />
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}
