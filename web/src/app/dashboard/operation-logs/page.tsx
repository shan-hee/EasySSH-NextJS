"use client"

import * as React from "react"
import {
  AlertTriangle,
  Download,
  FileText,
  History,
  Loader2,
  RefreshCw,
  Rocket,
  Search,
  TerminalSquare,
  Upload,
  XCircle,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { toast } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { getErrorMessage } from "@/lib/error-utils"
import {
  operationRecordsApi,
  type OperationRecord,
  type OperationRecordStatistics,
  type OperationRecordStatus,
  type OperationRecordType,
} from "@/lib/api/operation-records"
import { useAuthReady } from "@/hooks/use-auth-ready"
import {
  DashboardDonutCard,
  DashboardMetricCard,
  DashboardSideList,
  DashboardStatusLine,
  DashboardTrendCard,
  InlineStatusBadge,
  type DashboardTone,
  type DonutItem,
} from "../logs/components/log-dashboard-widgets"

const PAGE_SIZE = 20
const TREND_BUCKETS = 12
const DAY_MS = 24 * 60 * 60 * 1000

function isOperationRecordType(value: string | null): value is OperationRecordType {
  return value === "connection" || value === "transfer" || value === "execution"
}

function formatTime(value?: string) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
}

function formatDateTime(value?: string) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function formatDuration(milliseconds: number) {
  if (!milliseconds) return "-"
  if (milliseconds < 1000) return `${milliseconds}ms`
  const seconds = Math.round(milliseconds / 1000)
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

function formatBytes(bytes: number) {
  if (!bytes) return "-"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`
}

function statusTone(status: OperationRecordStatus): DashboardTone {
  if (status === "success") return "emerald"
  if (status === "running" || status === "pending") return "blue"
  if (status === "partial" || status === "timeout") return "amber"
  return "rose"
}

function typeTone(type: OperationRecordType): DashboardTone {
  if (type === "connection") return "emerald"
  if (type === "transfer") return "violet"
  return "amber"
}

function typeIcon(type: OperationRecordType) {
  if (type === "connection") return History
  if (type === "transfer") return Upload
  return Rocket
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

function buildTrend(records: OperationRecord[], predicate: (record: OperationRecord) => boolean = () => true) {
  const buckets = Array.from({ length: TREND_BUCKETS }, () => 0)
  records.forEach((record) => {
    if (!predicate(record)) return
    const bucket = getTrendBucketIndex(record.started_at || record.created_at)
    if (bucket < 0) return
    buckets[bucket] += Math.max(1, record.success_count + record.failure_count || 1)
  })
  return buckets
}

function exportRecords(records: OperationRecord[]) {
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `operation-records-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export default function OperationLogsPage() {
  const t = useTranslations("operationLogs")

  return (
    <>
      <PageHeader title={t("pageTitle")} />
      <React.Suspense fallback={<div className="flex min-h-0 flex-1" />}>
        <OperationLogsContent />
      </React.Suspense>
    </>
  )
}

function OperationLogsContent() {
  const t = useTranslations("operationLogs")
  const searchParams = useSearchParams()
  const { ready } = useAuthReady()
  const typeParam = searchParams.get("type")
  const initialType = isOperationRecordType(typeParam) ? typeParam : undefined
  const previousTypeParamRef = React.useRef<OperationRecordType | undefined>(initialType)
  const [type, setType] = React.useState<OperationRecordType | undefined>(initialType)
  const [records, setRecords] = React.useState<OperationRecord[]>([])
  const [trendRecords, setTrendRecords] = React.useState<OperationRecord[]>([])
  const [statistics, setStatistics] = React.useState<OperationRecordStatistics | null>(null)
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const [totalRows, setTotalRows] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<"all" | OperationRecordStatus>("all")
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  const typeLabels = React.useMemo<Record<OperationRecordType, string>>(() => ({
    connection: t("typeConnection"),
    transfer: t("typeTransfer"),
    execution: t("typeExecution"),
  }), [t])

  const statusLabels = React.useMemo<Record<string, string>>(() => ({
    pending: t("statusPending"),
    running: t("statusRunning"),
    success: t("statusSuccess"),
    failure: t("statusFailure"),
    partial: t("statusPartial"),
    canceled: t("statusCanceled"),
    timeout: t("statusTimeout"),
  }), [t])

  const loadData = React.useCallback(async (nextPage = page, showRefresh = false, nextType = type) => {
    try {
      if (showRefresh) setRefreshing(true)
      else setLoading(true)

      const [list, stats, recent] = await Promise.all([
        operationRecordsApi.list({ page: nextPage, page_size: PAGE_SIZE, type: nextType }),
        operationRecordsApi.getStatistics({ type: nextType, ...getTodayRange() }),
        operationRecordsApi.list({
          page: 1,
          page_size: 100,
          type: nextType,
          ...getLast24HoursRange(),
        }),
      ])
      setRecords(list.records || [])
      setTrendRecords(recent.records || [])
      setPage(list.page || nextPage)
      setTotalPages(list.total_pages || 1)
      setTotalRows(list.total || 0)
      setStatistics(stats)
      setSelectedId((current) => (
        current && list.records?.some((record) => record.id === current)
          ? current
          : list.records?.[0]?.id || null
      ))
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t("loadFailed")))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [page, t, type])

  React.useEffect(() => {
    if (!ready) return
    void loadData(1, false, type)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, type])

  React.useEffect(() => {
    if (previousTypeParamRef.current === initialType) return
    previousTypeParamRef.current = initialType
    setType(initialType)
    setPage(1)
    setSelectedId(null)
  }, [initialType])

  const filteredRecords = React.useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return records.filter((record) => {
      const matchesStatus = statusFilter === "all" || record.status === statusFilter
      const matchesKeyword = !keyword || [
        record.username,
        record.server_name,
        record.title,
        record.resource,
        record.source,
        record.action,
        record.error_message,
      ].some((value) => value?.toLowerCase().includes(keyword))
      return matchesStatus && matchesKeyword
    })
  }, [query, records, statusFilter])

  const selectedRecord = React.useMemo(
    () => filteredRecords.find((record) => record.id === selectedId) || filteredRecords[0] || null,
    [filteredRecords, selectedId]
  )

  const trend = React.useMemo(() => buildTrend(trendRecords), [trendRecords])
  const connectionTrend = React.useMemo(
    () => buildTrend(trendRecords, (record) => record.type === "connection"),
    [trendRecords]
  )
  const transferTrend = React.useMemo(
    () => buildTrend(trendRecords, (record) => record.type === "transfer"),
    [trendRecords]
  )
  const executionTrend = React.useMemo(
    () => buildTrend(trendRecords, (record) => record.type === "execution"),
    [trendRecords]
  )
  const failureTrend = React.useMemo(
    () => buildTrend(trendRecords, (record) => record.status === "failure"),
    [trendRecords]
  )
  const hasTrendData = trend.some((value) => value > 0)
  const total = statistics?.total || 0
  const byType = statistics?.by_type || {}
  const donutItems = React.useMemo<DonutItem[]>(() => {
    const source = Object.keys(byType).length > 0
      ? byType
      : records.reduce<Record<string, number>>((acc, record) => {
          acc[record.type] = (acc[record.type] || 0) + 1
          return acc
        }, {})
    return (["connection", "transfer", "execution"] as OperationRecordType[]).map((recordType, index) => ({
      label: typeLabels[recordType],
      value: source[recordType] || 0,
      color: ["var(--chart-1)", "var(--chart-4)", "var(--chart-3)"][index],
    }))
  }, [byType, records, typeLabels])

  const recentExceptions = React.useMemo(() => (
    trendRecords
      .filter((record) => (
        record.status === "failure" ||
        record.status === "partial" ||
        record.status === "canceled" ||
        record.status === "timeout"
      ))
      .slice(0, 5)
      .map((record) => ({
        id: record.id,
        icon: record.status === "partial" ? AlertTriangle : XCircle,
        title: record.title || record.resource || typeLabels[record.type],
        description: `${record.server_name || "-"} · ${record.username || "-"}`,
        time: formatTime(record.started_at || record.created_at),
        tone: statusTone(record.status),
      }))
  ), [trendRecords, typeLabels])

  const handleTypeChange = (nextType: OperationRecordType | undefined) => {
    setType(nextType)
    setPage(1)
    setSelectedId(null)
  }

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage)
    void loadData(nextPage, true, type)
  }

  return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 pt-0 sm:gap-4 sm:p-4 sm:pt-0 xl:overflow-hidden">
        <div className="flex flex-col gap-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>{t("dashboardDescription")}</p>
          <DashboardStatusLine label={t("systemHealthy")} timestamp={formatDateTime(new Date().toISOString())} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          <DashboardMetricCard title={t("metricTodayOps")} value={total} icon={FileText} tone="emerald" spark={trend} loading={loading} />
          <DashboardMetricCard title={t("metricConnections")} value={byType.connection || 0} icon={TerminalSquare} tone="blue" spark={connectionTrend} loading={loading} />
          <DashboardMetricCard title={t("metricTransfers")} value={byType.transfer || 0} icon={Upload} tone="violet" spark={transferTrend} loading={loading} />
          <DashboardMetricCard title={t("metricExecutions")} value={byType.execution || 0} icon={Rocket} tone="amber" spark={executionTrend} loading={loading} />
          <DashboardMetricCard title={t("metricFailures")} value={statistics?.failure_count || 0} icon={AlertTriangle} tone="rose" spark={failureTrend} loading={loading} />
        </div>

        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(320px,0.85fr)] xl:overflow-hidden">
          <Card className="min-h-[520px] gap-0 overflow-hidden p-0 xl:min-h-0">
            <div className="flex shrink-0 flex-col gap-3 p-4 sm:p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="mr-2 text-base font-semibold">{t("recordsTitle")}</h2>
                  {[
                    { label: t("filterAll"), value: undefined },
                    { label: t("typeConnection"), value: "connection" as const },
                    { label: t("typeTransfer"), value: "transfer" as const },
                    { label: t("typeExecution"), value: "execution" as const },
                  ].map((item) => (
                    <Button
                      key={item.label}
                      variant={type === item.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleTypeChange(item.value)}
                      className="h-9"
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => void loadData(page, true, type)} disabled={refreshing}>
                    {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    {t("refresh")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportRecords(filteredRecords)}>
                    <Download className="mr-2 h-4 w-4" />
                    {t("exportRecords")}
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchPlaceholder")} className="pl-9" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(["all", "running", "success", "failure"] as const).map((status) => (
                    <Button
                      key={status}
                      variant={statusFilter === status ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStatusFilter(status)}
                      className="h-9"
                    >
                      {status === "all" ? t("filterAll") : statusLabels[status]}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col border-t">
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="sticky top-0 z-10 bg-muted/95 text-xs text-muted-foreground backdrop-blur">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">{t("columnTime")}</th>
                      <th className="px-4 py-3 text-left font-medium">{t("columnType")}</th>
                      <th className="px-4 py-3 text-left font-medium">{t("columnStatus")}</th>
                      <th className="px-4 py-3 text-left font-medium">{t("columnAction")}</th>
                      <th className="px-4 py-3 text-left font-medium">{t("columnUser")}</th>
                      <th className="px-4 py-3 text-left font-medium">{t("columnServer")}</th>
                      <th className="px-4 py-3 text-left font-medium">{t("columnProgress")}</th>
                      <th className="px-4 py-3 text-left font-medium">{t("columnDuration")}</th>
                      <th className="px-4 py-3 text-left font-medium">{t("columnResult")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading || refreshing ? (
                      <tr>
                        <td colSpan={9} className="h-40 text-center text-muted-foreground">
                          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                          {t("loading")}
                        </td>
                      </tr>
                    ) : filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="h-40 text-center text-muted-foreground">{t("empty")}</td>
                      </tr>
                    ) : filteredRecords.map((record) => {
                      const TypeIcon = typeIcon(record.type)
                      return (
                        <tr
                          key={record.id}
                          className={cn(
                            "cursor-pointer border-t transition-colors hover:bg-accent/60",
                            selectedRecord?.id === record.id && "bg-emerald-500/5"
                          )}
                          onClick={() => setSelectedId(record.id)}
                        >
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{formatTime(record.started_at || record.created_at)}</td>
                          <td className="px-4 py-3">
                            <InlineStatusBadge label={typeLabels[record.type]} tone={typeTone(record.type)} />
                          </td>
                          <td className="px-4 py-3">
                            <InlineStatusBadge label={statusLabels[record.status] || record.status} tone={statusTone(record.status)} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex min-w-0 items-center gap-2">
                              <TypeIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <div className="min-w-0">
                                <div className="truncate font-medium">{record.title || record.resource || record.action}</div>
                                <div className="truncate text-xs text-muted-foreground">{record.resource || record.source || "-"}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">{record.username || "-"}</td>
                          <td className="px-4 py-3">{record.server_name || "-"}</td>
                          <td className="px-4 py-3">
                            {record.progress > 0 ? (
                              <div className="flex min-w-[110px] items-center gap-2">
                                <Progress value={record.progress} className="h-1.5" indicatorClassName={record.status === "failure" ? "bg-rose-500" : undefined} />
                                <span className="w-9 text-xs tabular-nums">{record.progress}%</span>
                              </div>
                            ) : "-"}
                          </td>
                          <td className="px-4 py-3">{formatDuration(record.duration_ms)}</td>
                          <td className="max-w-[260px] truncate px-4 py-3 text-muted-foreground" title={record.error_message || record.source || undefined}>
                            {record.error_message || record.source || "-"}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>{t("totalRows", { count: totalRows })}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1 || loading || refreshing} onClick={() => handlePageChange(page - 1)}>
                    {t("previous")}
                  </Button>
                  <span className="px-2 tabular-nums">{t("pageInfo", { page, total: totalPages })}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages || loading || refreshing} onClick={() => handlePageChange(page + 1)}>
                    {t("next")}
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid min-h-0 gap-3 overflow-visible xl:overflow-auto">
            <DashboardTrendCard title={t("trendTitle")} label={t("last24Hours")} data={hasTrendData ? trend : []} tone="emerald" emptyLabel={t("empty")} loading={loading} />
            <DashboardDonutCard title={t("typeDistributionTitle")} totalLabel={t("totalLabel")} totalValue={total} items={donutItems} loading={loading} />
            <DashboardSideList title={t("recentExceptionsTitle")} empty={t("empty")} items={recentExceptions} />
            <Card className="gap-0 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold">{t("detailTitle")}</h2>
                {selectedRecord && <InlineStatusBadge label={typeLabels[selectedRecord.type]} tone={typeTone(selectedRecord.type)} />}
                {selectedRecord && <span className="font-mono text-xs text-muted-foreground">ID: {selectedRecord.id}</span>}
              </div>
              {selectedRecord ? (
                <div className="mt-4 grid gap-4">
                  <div className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-1">
                    <Detail label={t("columnType")} value={typeLabels[selectedRecord.type]} />
                    <Detail label={t("columnStatus")} value={statusLabels[selectedRecord.status] || selectedRecord.status} />
                    <Detail label={t("columnUser")} value={selectedRecord.username || "-"} />
                    <Detail label={t("columnServer")} value={selectedRecord.server_name || "-"} />
                    <Detail label={t("columnSource")} value={selectedRecord.source || "-"} />
                    <Detail label={t("columnDuration")} value={formatDuration(selectedRecord.duration_ms)} />
                    <Detail label={t("detailStartedAt")} value={formatDateTime(selectedRecord.started_at || selectedRecord.created_at)} />
                    <Detail label={t("detailFinishedAt")} value={formatDateTime(selectedRecord.finished_at)} />
                    <Detail label={t("detailTraffic")} value={`${formatBytes(selectedRecord.bytes_processed)} / ${formatBytes(selectedRecord.bytes_total)}`} />
                  </div>
                  <div className="rounded-lg border bg-muted/25 p-4">
                    <div className="mb-2 flex items-center justify-between gap-2 text-sm font-medium">
                      <span>{t("detailPreviewTitle")}</span>
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => navigator.clipboard?.writeText(selectedRecord.detail_json || selectedRecord.error_message || "")}>
                        {t("copy")}
                      </Button>
                    </div>
                    <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-words rounded-md bg-background/70 p-3 font-mono text-xs text-muted-foreground">
                      {selectedRecord.detail_json || selectedRecord.error_message || selectedRecord.resource || "-"}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-muted-foreground">{t("empty")}</div>
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
