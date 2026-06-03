"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import {
  Activity,
  AlertTriangle,
  Download,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  User,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { toast } from "@/components/ui/sonner"
import { getErrorMessage } from "@/lib/error-utils"
import { logsApi, type AuditLog, type AuditLogStatisticsResponse } from "@/lib/api/logs"
import { DataTable } from "@/components/ui/data-table"
import { DataTableToolbar } from "@/components/ui/data-table-toolbar"
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
  a.download = `logs-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function LogsClient({ initialData, defaultAction }: LogsClientProps) {
  const { ready } = useAuthReady()
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

  const selectedLog = React.useMemo(
    () => logs.find((log) => log.id === selectedLogId) || logs[0] || null,
    [logs, selectedLogId]
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

  const logColumns = React.useMemo<ColumnDef<AuditLog>[]>(() => [
    {
      id: "created_at",
      accessorKey: "created_at",
      header: t("columnTime"),
      cell: ({ row }) => (
        <span className="whitespace-nowrap font-mono text-xs">
          {formatTime(row.original.created_at)}
        </span>
      ),
    },
    {
      id: "status",
      accessorKey: "status",
      header: t("columnStatus"),
      cell: ({ row }) => (
        <InlineStatusBadge
          label={statusLabel(t, row.original.status)}
          tone={statusTone(row.original.status)}
        />
      ),
      filterFn: (row, id, value) => {
        const selected = (value as string[]) || []
        if (selected.length === 0) return true
        return selected.includes(row.getValue(id) as string)
      },
    },
    {
      id: "action",
      accessorKey: "action",
      header: t("columnAction"),
      cell: ({ row }) => (
        <InlineStatusBadge
          label={actionLabel(t, row.original.action)}
          tone={actionTone(row.original.action)}
        />
      ),
    },
    {
      id: "username",
      accessorKey: "username",
      header: t("columnUser"),
      cell: ({ row }) => row.original.username || "-",
    },
    {
      id: "resource",
      accessorKey: "resource",
      header: t("columnResource"),
      cell: ({ row }) => (
        <span className="block max-w-[180px] truncate" title={row.original.resource || undefined}>
          {row.original.resource || "-"}
        </span>
      ),
    },
    {
      id: "ip",
      accessorKey: "ip",
      header: t("columnIp"),
      cell: ({ row }) => (
        <span className="whitespace-nowrap font-mono text-xs">
          {row.original.ip || "-"}
        </span>
      ),
    },
    {
      id: "details",
      accessorKey: "details",
      header: t("columnDetails"),
      cell: ({ row }) => {
        const details = row.original.details || row.original.error_msg || "-"
        return (
          <span className="block max-w-[260px] truncate text-muted-foreground" title={details === "-" ? undefined : details}>
            {details}
          </span>
        )
      },
      filterFn: (row, _id, value) => {
        const keyword = String(value || "").trim().toLowerCase()
        if (!keyword) return true
        const log = row.original
        return [
          log.username,
          log.action,
          log.resource,
          log.ip,
          log.details,
          log.error_msg,
        ].some((item) => item?.toLowerCase().includes(keyword))
      },
    },
  ], [t])

  const total = statistics?.total_logs || 0

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 pt-0 sm:gap-4 sm:p-4 sm:pt-0 xl:overflow-hidden">
      <div className="flex flex-col gap-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p>{t("activityDashboardDescription")}</p>
        <DashboardStatusLine label={t("collectionHealthy")} timestamp={formatDateTime(new Date().toISOString())} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <DashboardMetricCard title={t("metricTodayEvents")} value={total} icon={Activity} tone="emerald" spark={trend} loading={initialLoading} />
        <DashboardMetricCard title={t("metricFailedLogins")} value={statistics?.failure_count || 0} icon={AlertTriangle} tone="rose" spark={failureTrend} loading={initialLoading} />
        <DashboardMetricCard title={t("metricCommandRuns")} value={statistics?.success_count || 0} icon={ShieldCheck} tone="blue" spark={successTrend} loading={initialLoading} />
        <DashboardMetricCard title={t("metricSecurityAlerts")} value={`${failureRate}%`} icon={ShieldAlert} tone="amber" spark={riskTrend} loading={initialLoading} />
        <DashboardMetricCard title={t("metricActiveUsers")} value={activeUserCount} icon={User} tone="violet" spark={activeUserTrend} loading={initialLoading} />
      </div>

      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(320px,0.85fr)] xl:overflow-hidden">
        <DataTable
          data={logs}
          columns={logColumns}
          loading={initialLoading || tableLoading}
          currentPage={page}
          pageCount={totalPages}
          pageSize={pageSize}
          totalRows={totalRows}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          emptyMessage={t("emptyMessage")}
          className="min-h-[520px] overflow-hidden xl:min-h-0"
          tableClassName="min-w-[920px]"
          density="compact"
          onRowClick={(log) => setSelectedLogId(log.id)}
          getRowClassName={(log) => (
            selectedLog?.id === log.id ? "bg-emerald-500/5 hover:bg-emerald-500/10" : undefined
          )}
          toolbar={(table) => (
            <DataTableToolbar
              table={table}
              searchKey="details"
              searchPlaceholder={t("activitySearchPlaceholder")}
              filters={[
                {
                  column: "status",
                  title: t("filterStatusTitle"),
                  options: [
                    { value: "success", label: statusLabel(t, "success") },
                    { value: "warning", label: statusLabel(t, "warning") },
                    { value: "failure", label: statusLabel(t, "failure") },
                  ],
                },
              ]}
              showRefresh
              onRefresh={handleRefresh}
              isRefreshing={tableLoading}
            >
              <Button variant="outline" size="sm" onClick={() => exportLogs(table.getFilteredRowModel().rows.map((row) => row.original))} className="h-8">
                <Download className="mr-2 h-4 w-4" />
                {t("exportLogs")}
              </Button>
            </DataTableToolbar>
          )}
        />

        <div className="grid min-h-0 gap-3 overflow-visible xl:overflow-auto">
          <DashboardTrendCard title={t("activityTrendTitle")} label={t("last24Hours")} data={hasTrendData ? trend : []} tone="emerald" emptyLabel={t("activityEmpty")} loading={initialLoading} />
          <DashboardDonutCard title={t("riskDistributionTitle")} totalLabel={t("totalLabel")} totalValue={total} items={donutItems} loading={initialLoading} />
          <DashboardSideList title={t("recentAlertsTitle")} empty={t("activityEmpty")} items={recentAlerts} />
          <Card className="gap-0 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">{t("logDetailsTitle")}</h2>
              {selectedLog && <InlineStatusBadge label={actionLabel(t, selectedLog.action)} tone={actionTone(selectedLog.action)} />}
              {selectedLog && <span className="font-mono text-xs text-muted-foreground">ID: {selectedLog.id}</span>}
            </div>
            {selectedLog ? (
              <div className="mt-4 grid gap-4">
                <div className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-1">
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
                  <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
                    {selectedLog.details || selectedLog.error_msg || selectedLog.user_agent || "-"}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="mt-4 text-sm text-muted-foreground">{t("emptyMessage")}</div>
            )}
          </Card>
        </div>
      </div>
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
