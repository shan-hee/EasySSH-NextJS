"use client"

import * as React from "react"
import {
  Activity,
  AlertTriangle,
  Download,
  KeyRound,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { useClientAuth } from "@/components/client-auth-provider"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { getErrorMessage } from "@/lib/error-utils"
import { logsApi, type AuditLog, type AuditLogStatisticsResponse } from "@/lib/api/logs"
import {
  DashboardDonutCard,
  DashboardMetricCard,
  DashboardSideList,
  DashboardStatusLine,
  DashboardTrendCard,
  InlineStatusBadge,
  type DashboardTone,
  type DonutItem,
} from "./log-dashboard-widgets"

interface LogsPageData {
  logs: AuditLog[]
  statistics: AuditLogStatisticsResponse | null
  totalPages: number
  totalCount: number
  currentPage: number
  pageSize: number
}

interface LogsClientProps {
  initialData?: LogsPageData
  defaultAction?: string
}

const PAGE_SIZE_OPTIONS = [10, 20, 50]
const TREND_BUCKETS = 12
const DAY_MS = 24 * 60 * 60 * 1000

function formatTime(value?: string) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
}

function formatDate(value?: string) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString()
}

function formatDateTime(value?: string) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function formatDuration(milliseconds?: number) {
  if (!milliseconds) return "-"
  if (milliseconds < 1000) return `${milliseconds}ms`
  const seconds = Math.round(milliseconds / 1000)
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

function actionLabel(t: (key: string) => string, action: string) {
  const labels: Record<string, string> = {
    login: t("actionLogin"),
    logout: t("actionLogout"),
    ssh_connect: t("actionConnect"),
    ssh_disconnect: t("actionDisconnect"),
    sftp_upload: t("actionUpload"),
    sftp_download: t("actionDownload"),
    sftp_delete: t("actionDelete"),
    sftp_rename: t("actionRename"),
    sftp_mkdir: t("actionMkdir"),
    monitoring_query: t("actionMonitoringQuery"),
    server_create: t("actionServerCreate"),
    server_update: t("actionServerUpdate"),
    server_delete: t("actionServerDelete"),
    server_test: t("actionServerTest"),
    user_create: t("actionUserCreate"),
    user_update: t("actionUserUpdate"),
    user_delete: t("actionUserDelete"),
    connect: t("actionConnect"),
    disconnect: t("actionDisconnect"),
    upload: t("actionUpload"),
    download: t("actionDownload"),
    delete: t("actionDelete"),
    create: t("actionCreate"),
    update: t("actionUpdate"),
  }
  return labels[action] || action
}

function actionTone(action: string): DashboardTone {
  if (action.includes("delete") || action.includes("failure")) return "rose"
  if (action.includes("upload") || action.includes("download") || action.includes("sftp")) return "blue"
  if (action.includes("server") || action.includes("ssh") || action.includes("connect")) return "emerald"
  if (action.includes("user")) return "violet"
  return "amber"
}

function statusTone(status: AuditLog["status"]): DashboardTone {
  if (status === "success") return "emerald"
  if (status === "warning") return "amber"
  return "rose"
}

function statusLabel(t: (key: string) => string, status: AuditLog["status"]) {
  if (status === "success") return t("filterStatusSuccessLabel")
  if (status === "warning") return t("filterStatusWarningLabel")
  return t("filterStatusFailureLabel")
}

function getTodayRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  end.setMilliseconds(end.getMilliseconds() - 1)

  return {
    start_date: start.toISOString(),
    end_date: end.toISOString(),
  }
}

function getLast24HoursRange() {
  const end = new Date()
  return {
    start_date: new Date(end.getTime() - DAY_MS).toISOString(),
    end_date: end.toISOString(),
  }
}

function getTrendBucketIndex(value?: string) {
  if (!value) return -1
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return -1

  const now = Date.now()
  const start = now - DAY_MS
  if (timestamp < start || timestamp > now) return -1

  return Math.min(TREND_BUCKETS - 1, Math.floor(((timestamp - start) / DAY_MS) * TREND_BUCKETS))
}

function buildTrend(logs: AuditLog[], predicate: (log: AuditLog) => boolean = () => true) {
  const buckets = Array.from({ length: TREND_BUCKETS }, () => 0)
  logs.forEach((log) => {
    if (!predicate(log)) return
    const bucket = getTrendBucketIndex(log.created_at)
    if (bucket < 0) return
    buckets[bucket] += 1
  })
  return buckets
}

function buildUniqueUserTrend(logs: AuditLog[]) {
  const buckets = Array.from({ length: TREND_BUCKETS }, () => new Set<string>())
  logs.forEach((log) => {
    const bucket = getTrendBucketIndex(log.created_at)
    if (bucket < 0) return
    const userKey = log.user_id || log.username
    if (userKey) {
      buckets[bucket].add(userKey)
    }
  })
  return buckets.map((bucket) => bucket.size)
}

function exportLogs(logs: AuditLog[]) {
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `activity-logs-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function LogsClient({ initialData, defaultAction }: LogsClientProps) {
  const { ready } = useAuthReady()
  const { user } = useClientAuth()
  const t = useTranslations("logsAudit")
  const [logs, setLogs] = React.useState<AuditLog[]>(initialData?.logs || [])
  const [statistics, setStatistics] = React.useState<AuditLogStatisticsResponse | null>(initialData?.statistics || null)
  const [initialLoading, setInitialLoading] = React.useState(!initialData)
  const [tableLoading, setTableLoading] = React.useState(false)
  const [trendLogs, setTrendLogs] = React.useState<AuditLog[]>(initialData?.logs || [])
  const [page, setPage] = React.useState(initialData?.currentPage || 1)
  const [pageSize, setPageSize] = React.useState(initialData?.pageSize || 20)
  const [totalPages, setTotalPages] = React.useState(initialData?.totalPages || 1)
  const [totalRows, setTotalRows] = React.useState(initialData?.totalCount || 0)
  const [cleanupOpen, setCleanupOpen] = React.useState(false)
  const [cleanupLoading, setCleanupLoading] = React.useState(false)
  const [retentionDays, setRetentionDays] = React.useState("90")
  const [query, setQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<"all" | AuditLog["status"]>("all")
  const [selectedLogId, setSelectedLogId] = React.useState<string | null>(null)

  const loadStatistics = React.useCallback(async () => {
    try {
      const [statsResponse, recentResponse] = await Promise.all([
        logsApi.getStatistics(getTodayRange()),
        logsApi.list({
          page: 1,
          page_size: 100,
          action: defaultAction,
          ...getLast24HoursRange(),
        }),
      ])
      setStatistics(statsResponse)
      setTrendLogs(recentResponse.logs || [])
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t("toastLoadFailed")))
    }
  }, [defaultAction, t])

  const loadLogs = React.useCallback(async (
    currentPage: number,
    currentPageSize: number,
    options: { showTableLoading?: boolean } = {},
  ) => {
    try {
      if (options.showTableLoading) setTableLoading(true)
      const logsResponse = await logsApi.list({
        page: currentPage,
        page_size: currentPageSize,
        action: defaultAction,
      })
      setLogs(logsResponse.logs || [])
      setTotalPages(logsResponse.total_pages || 1)
      setTotalRows(logsResponse.total || 0)
      setSelectedLogId((current) => (
        current && logsResponse.logs?.some((log) => log.id === current)
          ? current
          : logsResponse.logs?.[0]?.id || null
      ))
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t("toastLoadFailed")))
    } finally {
      if (options.showTableLoading) setTableLoading(false)
    }
  }, [defaultAction, t])

  React.useEffect(() => {
    if (initialData || !ready) return
    const loadInitialData = async () => {
      try {
        setInitialLoading(true)
        await Promise.all([loadLogs(page, pageSize), loadStatistics()])
      } finally {
        setInitialLoading(false)
      }
    }
    void loadInitialData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, initialData, defaultAction])

  const filteredLogs = React.useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return logs.filter((log) => {
      const matchesStatus = statusFilter === "all" || log.status === statusFilter
      const matchesKeyword = !keyword || [
        log.username,
        log.action,
        log.resource,
        log.ip,
        log.details,
        log.error_msg,
      ].some((value) => value?.toLowerCase().includes(keyword))
      return matchesStatus && matchesKeyword
    })
  }, [logs, query, statusFilter])

  const selectedLog = React.useMemo(
    () => filteredLogs.find((log) => log.id === selectedLogId) || filteredLogs[0] || null,
    [filteredLogs, selectedLogId]
  )

  const actionEntries = React.useMemo(() => {
    const stats = statistics?.action_stats || {}
    return Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [statistics])

  const donutItems = React.useMemo<DonutItem[]>(() => {
    if (actionEntries.length > 0) {
      return actionEntries.map(([action, count]) => ({
        label: actionLabel(t, action),
        value: count,
      }))
    }
    const fallback = new Map<string, number>()
    logs.forEach((log) => fallback.set(log.action, (fallback.get(log.action) || 0) + 1))
    return Array.from(fallback.entries()).slice(0, 5).map(([action, count]) => ({
      label: actionLabel(t, action),
      value: count,
    }))
  }, [actionEntries, logs, t])

  const trend = React.useMemo(() => buildTrend(trendLogs), [trendLogs])
  const failureTrend = React.useMemo(
    () => buildTrend(trendLogs, (log) => log.status === "failure"),
    [trendLogs]
  )
  const successTrend = React.useMemo(
    () => buildTrend(trendLogs, (log) => log.status === "success"),
    [trendLogs]
  )
  const riskTrend = React.useMemo(
    () => buildTrend(trendLogs, (log) => log.status !== "success"),
    [trendLogs]
  )
  const activeUserTrend = React.useMemo(() => buildUniqueUserTrend(trendLogs), [trendLogs])
  const hasTrendData = trend.some((value) => value > 0)
  const failureRate = statistics?.total_logs
    ? Math.round(((statistics.failure_count || 0) / statistics.total_logs) * 100)
    : 0
  const activeUserCount = React.useMemo(() => (
    new Set(trendLogs.map((log) => log.user_id || log.username).filter(Boolean)).size
  ), [trendLogs])

  const recentAlerts = React.useMemo(() => {
    const failures = statistics?.recent_failures?.length
      ? statistics.recent_failures
      : trendLogs.filter((log) => log.status !== "success")
    return failures.slice(0, 5).map((log) => ({
      id: log.id,
      icon: log.status === "warning" ? AlertTriangle : ShieldAlert,
      title: actionLabel(t, log.action),
      description: `${log.username || "-"} · ${log.ip || "-"}`,
      time: formatTime(log.created_at),
      tone: statusTone(log.status),
    }))
  }, [statistics, t, trendLogs])

  const canCleanup = user?.role === "admin"

  const handleRefresh = () => {
    void Promise.all([
      loadLogs(page, pageSize, { showTableLoading: true }),
      loadStatistics(),
    ])
  }

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage)
    void loadLogs(nextPage, pageSize, { showTableLoading: true })
  }

  const handlePageSizeChange = (nextSize: number) => {
    setPageSize(nextSize)
    setPage(1)
    void loadLogs(1, nextSize, { showTableLoading: true })
  }

  const handleCleanupLogs = async () => {
    const parsedRetentionDays = Number(retentionDays)
    if (!Number.isInteger(parsedRetentionDays) || parsedRetentionDays < 1 || parsedRetentionDays > 3650) {
      toast.error(t("cleanupInvalidRetention"))
      return
    }

    try {
      setCleanupLoading(true)
      const result = await logsApi.cleanup(parsedRetentionDays)
      toast.success(t("cleanupSuccess", { count: result.deleted_count }))
      setCleanupOpen(false)
      setPage(1)
      await Promise.all([
        loadLogs(1, pageSize, { showTableLoading: true }),
        loadStatistics(),
      ])
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t("cleanupFailed")))
    } finally {
      setCleanupLoading(false)
    }
  }

  const total = statistics?.total_logs || 0

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-3 pt-0 sm:gap-5 sm:p-4 sm:pt-0">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("activityDashboardTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("activityDashboardDescription")}</p>
        </div>
        <DashboardStatusLine label={t("collectionHealthy")} timestamp={formatDateTime(new Date().toISOString())} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <DashboardMetricCard title={t("metricTodayEvents")} value={total} icon={Activity} tone="emerald" spark={trend} loading={initialLoading} />
        <DashboardMetricCard title={t("metricFailedLogins")} value={statistics?.failure_count || 0} icon={AlertTriangle} tone="rose" spark={failureTrend} loading={initialLoading} />
        <DashboardMetricCard title={t("metricCommandRuns")} value={statistics?.success_count || 0} icon={ShieldCheck} tone="blue" spark={successTrend} loading={initialLoading} />
        <DashboardMetricCard title={t("metricSecurityAlerts")} value={`${failureRate}%`} icon={ShieldAlert} tone="amber" spark={riskTrend} loading={initialLoading} />
        <DashboardMetricCard title={t("metricActiveUsers")} value={activeUserCount} icon={User} tone="violet" spark={activeUserTrend} loading={initialLoading} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,0.85fr)]">
        <Card className="min-h-0 gap-0 p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-semibold">{t("activityTableTitle")}</h2>
                <p className="text-sm text-muted-foreground">{t("tableDescription", { count: totalRows })}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={tableLoading}>
                  {tableLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}
                  {t("refresh")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportLogs(filteredLogs)}>
                  <Download className="mr-2 h-4 w-4" />
                  {t("exportLogs")}
                </Button>
                {canCleanup && (
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setCleanupOpen(true)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("cleanupButton")}
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("activitySearchPlaceholder")} className="pl-9" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(["all", "success", "warning", "failure"] as const).map((status) => (
                  <Button
                    key={status}
                    variant={statusFilter === status ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(status)}
                    className="h-9"
                  >
                    {status === "all" ? t("filterAll") : statusLabel(t, status)}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border">
            <div className="overflow-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-muted/45 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">{t("columnTime")}</th>
                    <th className="px-4 py-3 text-left font-medium">{t("columnStatus")}</th>
                    <th className="px-4 py-3 text-left font-medium">{t("columnAction")}</th>
                    <th className="px-4 py-3 text-left font-medium">{t("columnUser")}</th>
                    <th className="px-4 py-3 text-left font-medium">{t("columnResource")}</th>
                    <th className="px-4 py-3 text-left font-medium">{t("columnIp")}</th>
                    <th className="px-4 py-3 text-left font-medium">{t("columnDetails")}</th>
                  </tr>
                </thead>
                <tbody>
                  {initialLoading || tableLoading ? (
                    <tr>
                      <td colSpan={7} className="h-40 text-center text-muted-foreground">
                        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                        {t("loading")}
                      </td>
                    </tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="h-40 text-center text-muted-foreground">{t("emptyMessage")}</td>
                    </tr>
                  ) : filteredLogs.map((log) => (
                    <tr
                      key={log.id}
                      className={cn(
                        "cursor-pointer border-t transition-colors hover:bg-accent/60",
                        selectedLog?.id === log.id && "bg-emerald-500/5"
                      )}
                      onClick={() => setSelectedLogId(log.id)}
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{formatTime(log.created_at)}</td>
                      <td className="px-4 py-3">
                        <InlineStatusBadge label={statusLabel(t, log.status)} tone={statusTone(log.status)} />
                      </td>
                      <td className="px-4 py-3">
                        <InlineStatusBadge label={actionLabel(t, log.action)} tone={actionTone(log.action)} />
                      </td>
                      <td className="px-4 py-3">{log.username || "-"}</td>
                      <td className="px-4 py-3">{log.resource || "-"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{log.ip || "-"}</td>
                      <td className="max-w-[260px] truncate px-4 py-3 text-muted-foreground" title={log.details || log.error_msg || undefined}>
                        {log.details || log.error_msg || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
              <span>{t("tableDescription", { count: totalRows })}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1 || tableLoading} onClick={() => handlePageChange(page - 1)}>
                  {t("previous")}
                </Button>
                <span className="px-2 tabular-nums">{t("pageInfo", { page, total: totalPages })}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages || tableLoading} onClick={() => handlePageChange(page + 1)}>
                  {t("next")}
                </Button>
                <select
                  className="h-8 rounded-md border bg-background px-2 text-xs"
                  value={pageSize}
                  onChange={(event) => handlePageSizeChange(Number(event.target.value))}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>{t("pageSize", { size })}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-4">
          <DashboardTrendCard title={t("activityTrendTitle")} label={t("last24Hours")} data={hasTrendData ? trend : []} tone="emerald" emptyLabel={t("activityEmpty")} loading={initialLoading} />
          <DashboardDonutCard title={t("riskDistributionTitle")} totalLabel={t("totalLabel")} totalValue={total} items={donutItems} loading={initialLoading} />
          <DashboardSideList title={t("recentAlertsTitle")} empty={t("activityEmpty")} items={recentAlerts} />
        </div>
      </div>

      <Card className="gap-0 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">{t("logDetailsTitle")}</h2>
          {selectedLog && <InlineStatusBadge label={actionLabel(t, selectedLog.action)} tone={actionTone(selectedLog.action)} />}
          {selectedLog && <span className="font-mono text-xs text-muted-foreground">ID: {selectedLog.id}</span>}
        </div>
        {selectedLog ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <div className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Detail label={t("columnTime")} value={`${formatDate(selectedLog.created_at)} ${formatTime(selectedLog.created_at)}`} />
              <Detail label={t("columnUser")} value={selectedLog.username || "-"} />
              <Detail label={t("columnResource")} value={selectedLog.resource || "-"} />
              <Detail label={t("columnIp")} value={selectedLog.ip || "-"} />
              <Detail label={t("columnStatus")} value={statusLabel(t, selectedLog.status)} />
              <Detail label={t("columnDuration")} value={formatDuration(selectedLog.duration)} />
              <Detail label={t("columnCategory")} value={selectedLog.category === "activity" ? t("categoryActivity") : t("categoryAudit")} />
              <Detail label={t("columnAction")} value={actionLabel(t, selectedLog.action)} />
              <Detail label={t("columnServer")} value={selectedLog.server_id || "-"} />
            </div>
            <div className="rounded-lg border bg-muted/25 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                {t("detailPayloadTitle")}
              </div>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
                {selectedLog.details || selectedLog.error_msg || selectedLog.user_agent || "-"}
              </pre>
            </div>
          </div>
        ) : (
          <div className="mt-4 text-sm text-muted-foreground">{t("emptyMessage")}</div>
        )}
      </Card>

      <AlertDialog open={cleanupOpen} onOpenChange={setCleanupOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cleanupDialogTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("cleanupDialogDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="audit-log-retention-days">{t("cleanupRetentionLabel")}</Label>
            <Input
              id="audit-log-retention-days"
              type="number"
              min={1}
              max={3650}
              value={retentionDays}
              disabled={cleanupLoading}
              onChange={(event) => setRetentionDays(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("cleanupRetentionHint")}</p>
            <p className="text-xs text-destructive">{t("cleanupWarning")}</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cleanupLoading}>{t("cleanupCancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={cleanupLoading}
              onClick={(event) => {
                event.preventDefault()
                void handleCleanupLogs()
              }}
            >
              {cleanupLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("cleanupRunning")}
                </>
              ) : t("cleanupConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-words font-medium">{value}</div>
    </div>
  )
}
