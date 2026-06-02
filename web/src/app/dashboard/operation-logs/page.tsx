"use client"

import * as React from "react"
import { Activity, CheckCircle, Clock, Loader2, RefreshCw, XCircle } from "lucide-react"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SkeletonStatsCard } from "@/components/ui/loading"
import { toast } from "@/components/ui/sonner"
import { getErrorMessage } from "@/lib/error-utils"
import {
  operationRecordsApi,
  type OperationRecord,
  type OperationRecordStatistics,
  type OperationRecordType,
} from "@/lib/api/operation-records"
import { useAuthReady } from "@/hooks/use-auth-ready"

const PAGE_SIZE = 20

function isOperationRecordType(value: string | null): value is OperationRecordType {
  return value === "connection" || value === "transfer" || value === "execution"
}

function formatTime(value?: string) {
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

function statusVariant(status: string) {
  if (status === "success") return "border-green-200 bg-green-50 text-green-700"
  if (status === "running" || status === "pending") return "border-blue-200 bg-blue-50 text-blue-700"
  if (status === "partial" || status === "timeout") return "border-amber-200 bg-amber-50 text-amber-700"
  return "border-red-200 bg-red-50 text-red-700"
}

export default function OperationLogsPage() {
  const t = useTranslations("operationLogs")
  const searchParams = useSearchParams()
  const { ready } = useAuthReady()
  const typeParam = searchParams.get("type")
  const type = isOperationRecordType(typeParam) ? typeParam : undefined
  const [records, setRecords] = React.useState<OperationRecord[]>([])
  const [statistics, setStatistics] = React.useState<OperationRecordStatistics | null>(null)
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const [totalRows, setTotalRows] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
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

  const loadData = React.useCallback(async (nextPage = page, showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true)
      else setLoading(true)

      const [list, stats] = await Promise.all([
        operationRecordsApi.list({ page: nextPage, page_size: PAGE_SIZE, type }),
        operationRecordsApi.getStatistics({ type }),
      ])
      setRecords(list.records || [])
      setPage(list.page || nextPage)
      setTotalPages(list.total_pages || 1)
      setTotalRows(list.total || 0)
      setStatistics(stats)
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t("loadFailed")))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [page, t, type])

  React.useEffect(() => {
    if (!ready) return
    void loadData(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, type])

  return (
    <>
      <PageHeader title={t("pageTitle")}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadData(page, true)}
          disabled={refreshing}
        >
          {refreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {t("refresh")}
        </Button>
      </PageHeader>
      <div className="flex flex-1 h-full min-h-0 flex-col gap-4 p-4 pt-0 overflow-hidden">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-4">
            <SkeletonStatsCard />
            <SkeletonStatsCard />
            <SkeletonStatsCard />
            <SkeletonStatsCard />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("total")}</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics?.total || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("success")}</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{statistics?.success_count || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("running")}</CardTitle>
                <Clock className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{statistics?.running_count || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("failure")}</CardTitle>
                <XCircle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{statistics?.failure_count || 0}</div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="min-h-0 flex-1 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("tableTitle")}</CardTitle>
            <div className="text-sm text-muted-foreground">{t("totalRows", { count: totalRows })}</div>
          </CardHeader>
          <CardContent className="min-h-0 overflow-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columnTime")}</TableHead>
                  <TableHead>{t("columnType")}</TableHead>
                  <TableHead>{t("columnTitle")}</TableHead>
                  <TableHead>{t("columnStatus")}</TableHead>
                  <TableHead>{t("columnProgress")}</TableHead>
                  <TableHead>{t("columnDuration")}</TableHead>
                  <TableHead>{t("columnSource")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      {t("loading")}
                    </TableCell>
                  </TableRow>
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      {t("empty")}
                    </TableCell>
                  </TableRow>
                ) : records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {formatTime(record.started_at || record.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{typeLabels[record.type] || record.type}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[360px]">
                      <div className="truncate font-medium" title={record.title || record.resource}>
                        {record.title || record.resource || "-"}
                      </div>
                      <div className="truncate text-xs text-muted-foreground" title={record.resource}>
                        {record.resource || record.action}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusVariant(record.status)}>
                        {statusLabels[record.status] || record.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{record.progress ? `${record.progress}%` : "-"}</TableCell>
                    <TableCell>{formatDuration(record.duration_ms)}</TableCell>
                    <TableCell>{record.source || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <div className="flex items-center justify-between border-t px-4 py-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => void loadData(page - 1)}
            >
              {t("previous")}
            </Button>
            <div className="text-sm text-muted-foreground">
              {t("pageInfo", { page, total: totalPages })}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => void loadData(page + 1)}
            >
              {t("next")}
            </Button>
          </div>
        </Card>
      </div>
    </>
  )
}
