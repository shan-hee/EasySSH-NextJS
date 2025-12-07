"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useTranslations } from "next-intl"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { getErrorMessage } from "@/lib/error-utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DataTable } from "@/components/ui/data-table"
import { DataTableToolbar } from "@/components/ui/data-table-toolbar"
import {
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Terminal,
  Calendar,
  Server,
  AlertTriangle,
} from "lucide-react"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { useClientAuth } from "@/components/client-auth-provider"
import { useSystemConfig } from "@/hooks/use-system-config"
import { formatInTimezone, getEffectiveLocale, getEffectiveTimezone } from "@/utils/datetime"
import { SkeletonStatsCard } from "@/components/ui/loading"
import { createExecutionHistoryColumns } from "./components/execution-history-columns"
import {
  taskExecutionsApi,
  type TaskExecution,
  type ExecutionStatistics,
} from "@/lib/api"

const triggerTypeColors: Record<string, string> = {
  schedule: "bg-blue-50 text-blue-700 border-blue-200",
  manual: "bg-green-50 text-green-700 border-green-200",
}

export default function AutomationHistoryPage() {
  const t = useTranslations("automationHistory")
  const tCommon = useTranslations("common")
  const { ready } = useAuthReady()
  const { user } = useClientAuth()
  const { data: systemConfig } = useSystemConfig()
  const effectiveLocale = getEffectiveLocale(user, systemConfig || null)
  const effectiveTimezone = getEffectiveTimezone(user, systemConfig || null)

  const [executions, setExecutions] = useState<TaskExecution[]>([])
  const [statistics, setStatistics] = useState<ExecutionStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [selectedExecution, setSelectedExecution] = useState<TaskExecution | null>(null)

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      const [listResponse, statsResponse] = await Promise.all([
        taskExecutionsApi.list({ limit: 100 }),
        taskExecutionsApi.getStatistics(1), // 最近1天
      ])
      setExecutions(listResponse.data || [])
      setStatistics(statsResponse)
    } catch (error) {
      toast.error(t("toastLoadFailed"), {
        description: getErrorMessage(error),
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  // 初始加载
  useEffect(() => {
    if (!ready) return
    loadData()
  }, [ready, loadData])

  if (!ready) {
    return null
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "success":
        return t("statusSuccess")
      case "failed":
        return t("statusFailed")
      case "running":
        return t("statusRunning")
      case "partial":
        return t("statusPartial")
      default:
        return status
    }
  }

  const getStatusExportLabel = (status: string) => {
    switch (status) {
      case "success":
        return t("exportCsvStatusSuccess")
      case "failed":
        return t("exportCsvStatusFailed")
      case "running":
        return t("exportCsvStatusRunning")
      default:
        return status
    }
  }

  const getTriggerTypeLabel = (type: string) => {
    switch (type) {
      case "schedule":
        return t("sourceTypeScheduleShort")
      case "manual":
        return t("sourceTypeManualShort")
      default:
        return type
    }
  }

  const getTriggerTypeFullLabel = (type: string) => {
    switch (type) {
      case "schedule":
        return t("typeFilterSchedule")
      case "manual":
        return t("typeFilterManual")
      default:
        return type
    }
  }

  const getTriggerTypeExportLabel = (type: string) => {
    switch (type) {
      case "schedule":
        return t("exportCsvSourceTypeSchedule")
      case "manual":
        return t("exportCsvSourceTypeManual")
      default:
        return type
    }
  }

  // 格式化日期
  const formatDate = (dateString: string) => {
    if (!dateString) return "-"
    return formatInTimezone(
      dateString,
      { second: undefined },
      effectiveLocale,
      effectiveTimezone,
    )
  }

  // 格式化耗时（毫秒转可读格式）
  const formatDuration = (ms: number) => {
    if (!ms || ms <= 0) return "-"
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) {
      return t("durationSeconds", { seconds })
    }
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    if (minutes < 60) {
      return t("durationMinutesSeconds", { minutes, seconds: remainingSeconds })
    }
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return t("durationHoursMinutes", { hours, minutes: remainingMinutes })
  }

  const handleViewDetails = async (execution: TaskExecution) => {
    try {
      // 获取详情（包含服务器结果）
      const detail = await taskExecutionsApi.getById(execution.id)
      setSelectedExecution(detail)
      setIsDetailsDialogOpen(true)
    } catch (error) {
      toast.error(t("toastLoadFailed"), {
        description: getErrorMessage(error),
      })
    }
  }

  const handleRetry = (execution: TaskExecution) => {
    // TODO: 实现重新执行功能
    toast.info(`即将重新执行任务: ${execution.task_name}`)
  }

  const handleDownloadOutput = async (execution: TaskExecution) => {
    try {
      // 获取详情
      const detail = await taskExecutionsApi.getById(execution.id)

      // 构建输出内容
      const lines = [
        `${t("fieldTaskName")}: ${detail.task_name}`,
        `${t("fieldSourceType")}: ${getTriggerTypeFullLabel(detail.trigger_type)}`,
        `${t("fieldCommand")}: ${detail.command}`,
        `${t("fieldStatus")}: ${getStatusText(detail.status)}`,
        `${t("fieldStartTime")}: ${formatDate(detail.start_time)}`,
        `${t("fieldEndTime")}: ${detail.end_time ? formatDate(detail.end_time) : t("exportCsvEndTimeNotFinished")}`,
        `${t("fieldDuration")}: ${formatDuration(detail.duration)}`,
        `${t("fieldUser")}: ${detail.username || "-"}`,
        "",
        `========== ${t("fieldOutput")} ==========`,
      ]

      // 添加每个服务器的输出
      if (detail.server_results && detail.server_results.length > 0) {
        for (const result of detail.server_results) {
          lines.push("")
          lines.push(`--- ${result.server_name} (${result.server_host}) ---`)
          lines.push(`Status: ${result.status}`)
          lines.push(`Exit Code: ${result.exit_code ?? "N/A"}`)
          lines.push(`Output:`)
          lines.push(result.output || "(no output)")
          if (result.error_message) {
            lines.push(`Error: ${result.error_message}`)
          }
        }
      }

      const content = lines.join("\n")
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `execution_${detail.id}_${detail.start_time.replace(/[: ]/g, "_")}.txt`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(t("toastLoadFailed"), {
        description: getErrorMessage(error),
      })
    }
  }

  const handleExportRecords = () => {
    const headers = [
      t("exportCsvHeaderId"),
      t("exportCsvHeaderTaskName"),
      t("exportCsvHeaderSourceType"),
      t("exportCsvHeaderCommand"),
      t("exportCsvHeaderServer"),
      t("exportCsvHeaderStatus"),
      t("exportCsvHeaderStartTime"),
      t("exportCsvHeaderEndTime"),
      t("exportCsvHeaderDuration"),
      t("exportCsvHeaderUser"),
    ]

    const rows = executions.map(execution => [
      execution.id,
      execution.task_name,
      getTriggerTypeExportLabel(execution.trigger_type),
      execution.command,
      `${execution.success_count}/${execution.total_servers}`,
      getStatusExportLabel(execution.status),
      formatDate(execution.start_time),
      execution.end_time ? formatDate(execution.end_time) : t("exportCsvEndTimeNotFinished"),
      formatDuration(execution.duration),
      execution.username || "-",
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
    ].join("\n")

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `execution_history_${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleRefresh = () => {
    setRefreshing(true)
    loadData()
  }

  // 统计数据
  const successCount = statistics?.success_count ?? 0
  const failedCount = statistics?.failed_count ?? 0
  const runningCount = statistics?.running_count ?? 0
  const totalCount = statistics?.total_executions ?? 0
  const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0

  // 创建表格列配置
  const columns = useMemo(
    () =>
      createExecutionHistoryColumns(t, {
        onViewDetails: handleViewDetails,
        onRetry: handleRetry,
        onDownloadOutput: handleDownloadOutput,
        getTriggerTypeLabel,
        formatDate,
        formatDuration,
      }),
    [t, effectiveLocale, effectiveTimezone]
  )

  // 筛选选项
  const filterOptions = useMemo(() => ({
    status: [
      { label: t("statusFilterSuccess"), value: "success", icon: CheckCircle },
      { label: t("statusFilterFailed"), value: "failed", icon: XCircle },
      { label: t("statusFilterRunning"), value: "running", icon: Clock },
    ],
    trigger_type: [
      { label: t("typeFilterSchedule"), value: "schedule" },
      { label: t("typeFilterManual"), value: "manual" },
    ],
  }), [t])

  return (
    <>
      <PageHeader title={t("pageTitle")} />

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* 统计卡片 */}
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
                <CardTitle className="text-sm font-medium">
                  {t("statsTotalRunsTitle")}
                </CardTitle>
                <Terminal className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalCount}</div>
                <p className="text-xs text-muted-foreground">
                  {t("statsTotalRunsDesc")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("statsSuccessTitle")}
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {successCount}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("statsSuccessDesc", { percent: successRate })}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("statsFailedTitle")}
                </CardTitle>
                <XCircle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {failedCount}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("statsFailedDesc")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("statsRunningTitle")}
                </CardTitle>
                <Clock className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {runningCount}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("statsRunningDesc")}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 执行记录列表 */}
        <Card className="flex-1 min-h-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">{t("tableTitle")}</CardTitle>
              <CardDescription>
                {t("tableDescription", {
                  current: executions.length,
                  total: totalCount,
                })}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                {tCommon("tableRefresh")}
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportRecords}>
                <Download className="mr-2 h-4 w-4" />
                {t("exportButton")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 p-4 pt-0">
            <DataTable
              data={executions}
              columns={columns}
              loading={loading || refreshing}
              emptyMessage={t("tableEmpty")}
              toolbar={(table) => (
                <DataTableToolbar
                  table={table}
                  searchKey="task_name"
                  searchPlaceholder={t("searchPlaceholder")}
                  filters={[
                    {
                      column: "status",
                      title: t("statusFilterPlaceholder"),
                      options: filterOptions.status,
                    },
                    {
                      column: "trigger_type",
                      title: t("typeFilterPlaceholder"),
                      options: filterOptions.trigger_type,
                    },
                  ]}
                />
              )}
            />
          </CardContent>
        </Card>
      </div>

      {/* 执行详情对话框 */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-5xl w-[90vw] max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>{t("detailsDialogTitle")}</DialogTitle>
            <DialogDescription>{t("detailsDialogDescription")}</DialogDescription>
          </DialogHeader>

          {selectedExecution && (
            <div className="space-y-6 py-4 flex-1 min-h-0 overflow-y-auto scrollbar-custom">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t("fieldTaskName")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{selectedExecution.task_name}</span>
                    <Badge
                      variant="outline"
                      className={triggerTypeColors[selectedExecution.trigger_type] || ""}
                    >
                      {getTriggerTypeFullLabel(selectedExecution.trigger_type)}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t("fieldStatus")}
                  </Label>
                  <div className="flex items-center gap-2">
                    {selectedExecution.status === "success" && <CheckCircle className="h-4 w-4 text-green-600" />}
                    {selectedExecution.status === "failed" && <XCircle className="h-4 w-4 text-red-600" />}
                    {selectedExecution.status === "running" && <Clock className="h-4 w-4 text-blue-600 animate-spin" />}
                    {selectedExecution.status === "partial" && <AlertTriangle className="h-4 w-4 text-yellow-600" />}
                    <Badge className={
                      selectedExecution.status === "success" ? "bg-green-100 text-green-800" :
                      selectedExecution.status === "failed" ? "bg-red-100 text-red-800" :
                      selectedExecution.status === "partial" ? "bg-yellow-100 text-yellow-800" :
                      "bg-blue-100 text-blue-800"
                    }>
                      {getStatusText(selectedExecution.status)}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t("fieldUser")}
                  </Label>
                  <div className="font-medium">{selectedExecution.username || "-"}</div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t("fieldServer")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {selectedExecution.success_count}/{selectedExecution.total_servers} 台成功
                    </span>
                  </div>
                </div>
              </div>

              {/* 执行时间信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t("fieldStartTime")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-mono">{formatDate(selectedExecution.start_time)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t("fieldEndTime")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-mono">
                      {selectedExecution.end_time ? formatDate(selectedExecution.end_time) : t("endTimeRunning")}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t("fieldDuration")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{formatDuration(selectedExecution.duration)}</span>
                  </div>
                </div>
              </div>

              {/* 执行命令 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  {t("fieldCommand")}
                </Label>
                <div className="rounded-md bg-muted p-3">
                  <code className="text-sm font-mono">{selectedExecution.command}</code>
                </div>
              </div>

              {/* 服务器执行结果 */}
              {selectedExecution.server_results && selectedExecution.server_results.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t("fieldOutput")}
                  </Label>
                  <div className="space-y-3">
                    {selectedExecution.server_results.map((result) => (
                      <div key={result.id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Server className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{result.server_name}</span>
                            <span className="text-sm text-muted-foreground">({result.server_host})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {result.status === "success" ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                            <Badge className={
                              result.status === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                            }>
                              {result.exit_code !== null && result.exit_code !== undefined ? `Exit: ${result.exit_code}` : result.status}
                            </Badge>
                          </div>
                        </div>
                        <Textarea
                          value={result.output || result.error_message || "(no output)"}
                          readOnly
                          className="min-h-[120px] max-h-[300px] scrollbar-custom text-sm font-mono resize-y"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 shrink-0">
            {selectedExecution && selectedExecution.status === "failed" && (
              <Button
                variant="outline"
                onClick={() => {
                  setIsDetailsDialogOpen(false)
                  handleRetry(selectedExecution)
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {t("detailsRetryButton")}
              </Button>
            )}
            {selectedExecution && (
              <Button
                variant="outline"
                onClick={() => {
                  handleDownloadOutput(selectedExecution)
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                {t("detailsDownloadOutputButton")}
              </Button>
            )}
            <Button onClick={() => setIsDetailsDialogOpen(false)}>
              {t("detailsCloseButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
