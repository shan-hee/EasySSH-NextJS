"use client"

import React, { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, XCircle, Activity, User } from "lucide-react"
import { SkeletonStatsCard } from "@/components/ui/loading"
import { auditLogsApi, type AuditLog, type AuditLogStatisticsResponse } from "@/lib/api/audit-logs"
import { getErrorMessage } from "@/lib/error-utils"
import { toast } from "@/components/ui/sonner"
import { DataTable } from "@/components/ui/data-table"
import { DataTableToolbar } from "@/components/ui/data-table-toolbar"
import { ColumnVisibility } from "@/components/ui/column-visibility"
import { createAuditLogColumns } from "./audit-log-columns"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { useTranslations } from "next-intl"

interface AuditLogsPageData {
  logs: AuditLog[]
  statistics: AuditLogStatisticsResponse | null
  totalPages: number
  totalCount: number
  currentPage: number
  pageSize: number
}

interface AuditLogsClientProps {
  initialData?: AuditLogsPageData
}

/**
 * 操作日志客户端组件
 * 纯 CSR 模式：在客户端加载数据
 */
export function AuditLogsClient({ initialData }: AuditLogsClientProps) {
  const { ready } = useAuthReady()
  const t = useTranslations("logsAudit")
  const [logs, setLogs] = useState<AuditLog[]>(initialData?.logs || [])
  const [statistics, setStatistics] = useState<AuditLogStatisticsResponse | null>(
    initialData?.statistics || null
  )
  const [initialLoading, setInitialLoading] = useState(!initialData)
  const [tableLoading, setTableLoading] = useState(false)
  const [page, setPage] = useState(initialData?.currentPage || 1)
  const [pageSize, setPageSize] = useState(initialData?.pageSize || 20)
  const [totalPages, setTotalPages] = useState(initialData?.totalPages || 0)
  const [totalRows, setTotalRows] = useState(initialData?.totalCount || 0)
  const [columnVisibility, setColumnVisibility] = useState({
    created_at: true,
    username: true,
    action: true,
    resource: true,
    status: true,
    ip: true,
    details: true,
    duration: true,
    server_id: false, // 默认隐藏服务器列
  })

  const columns = useMemo(
    () => createAuditLogColumns(t),
    [t],
  )

  // 加载统计数据
  const loadStatistics = async () => {
    try {
      const statsResponse = await auditLogsApi.getStatistics()
      setStatistics(statsResponse)
    } catch (error: unknown) {
      console.error("操作日志统计加载失败:", error)
      toast.error(getErrorMessage(error, t("toastLoadFailed")))
    }
  }

  // 加载日志列表
  const loadLogs = async (
    currentPage: number,
    currentPageSize: number,
    options: { showTableLoading?: boolean } = {},
  ) => {
    try {
      if (options.showTableLoading) {
        setTableLoading(true)
      }

      const logsResponse = await auditLogsApi.list({
        page: currentPage,
        page_size: currentPageSize,
      })

      setLogs(logsResponse.logs || [])
      setTotalPages(logsResponse.total_pages || 1)
      setTotalRows(logsResponse.total || 0)
    } catch (error: unknown) {
      console.error("操作日志加载失败:", error)
      toast.error(getErrorMessage(error, t("toastLoadFailed")))
    } finally {
      if (options.showTableLoading) {
        setTableLoading(false)
      }
    }
  }

  // 初始加载数据（纯 CSR 模式，仅在已认证且全局状态就绪时触发）
  React.useEffect(() => {
    if (initialData) return
    if (!ready) return

    const loadInitialData = async () => {
      try {
        setInitialLoading(true)
        await Promise.all([
          loadLogs(page, pageSize),
          loadStatistics(),
        ])
      } finally {
        setInitialLoading(false)
      }
    }

    loadInitialData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, initialData])

  // 页码变化
  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    loadLogs(newPage, pageSize, { showTableLoading: true })
  }

  // 每页数量变化
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize)
    setPage(1)
    loadLogs(1, newPageSize, { showTableLoading: true })
  }

  // 刷新数据
  const handleRefresh = () => {
    loadLogs(page, pageSize, { showTableLoading: true })
  }

  // 筛选选项配置
  const filterOptions = useMemo(() => {
    const uniqueUsers = Array.from(new Set(logs.map((log) => log.username)))
    const uniqueActions = Array.from(new Set(logs.map((log) => log.action)))

    return {
      status: [
        { label: t("filterStatusSuccessLabel"), value: "success", icon: CheckCircle },
        { label: t("filterStatusFailureLabel"), value: "failure", icon: XCircle },
      ],
      users: uniqueUsers.map((user) => ({
        label: user,
        value: user,
        icon: User,
      })),
      actions: uniqueActions.map((action) => ({
        label: action,
        value: action,
        icon: Activity,
      })),
    }
  }, [logs, t])

  // 可见列配置
  const visibleColumns = useMemo(
    () =>
      columns.filter(
        (column) => columnVisibility[column.id as keyof typeof columnVisibility] ?? true
      ),
    [columnVisibility, columns]
  )

  return (
    <div className="flex flex-1 h-full min-h-0 flex-col gap-4 p-4 pt-0 overflow-hidden">
      {/* 统计卡片 - 加载时显示骨架屏 */}
      {initialLoading ? (
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
              <CardTitle className="text-sm font-medium">{t("statsTotalTitle")}</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics?.total_logs || 0}</div>
              <p className="text-xs text-muted-foreground">{t("statsTotalDesc")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("statsSuccessTitle")}</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {statistics?.success_count || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("statsSuccessDescPrefix")}{" "}
                {statistics?.total_logs
                  ? Math.round((statistics.success_count / statistics.total_logs) * 100)
                  : 0}
                %
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("statsFailureTitle")}</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {statistics?.failure_count || 0}
              </div>
              <p className="text-xs text-muted-foreground">{t("statsFailureDesc")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("statsActiveUsersTitle")}</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {statistics?.top_users?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">{t("statsActiveUsersDesc")}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 操作日志表格 */}
      <DataTable
        data={logs}
        columns={visibleColumns}
        loading={initialLoading || tableLoading}
        currentPage={page}
        pageCount={totalPages}
        pageSize={pageSize}
        totalRows={totalRows}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        emptyMessage={t("emptyMessage")}
        toolbar={(table) => (
          <DataTableToolbar
            table={table}
            searchKey="username"
            searchPlaceholder={t("searchPlaceholder")}
            filters={[
              {
                column: "status",
                title: t("filterStatusTitle"),
                options: filterOptions.status,
              },
              {
                column: "action",
                title: t("filterActionTitle"),
                options: filterOptions.actions.slice(0, 10), // 限制显示前10个
              },
            ]}
            onRefresh={handleRefresh}
            showRefresh={true}
          >
            <ColumnVisibility
              columns={[
                { id: "created_at", label: t("columnTime") },
                { id: "username", label: t("columnUser") },
                { id: "action", label: t("columnAction") },
                { id: "resource", label: t("columnResource") },
                { id: "status", label: t("columnStatus") },
                { id: "ip", label: t("columnIp") },
                { id: "details", label: t("columnDetails") },
                { id: "duration", label: t("columnDuration") },
                { id: "server_id", label: t("columnServer") },
              ].map((column) => ({
                id: column.id,
                label: column.label,
                visible: columnVisibility[column.id as keyof typeof columnVisibility] ?? true,
                onToggle: () =>
                  setColumnVisibility((prev) => ({
                    ...prev,
                    [column.id as keyof typeof columnVisibility]:
                      !prev[column.id as keyof typeof columnVisibility],
                  })),
              }))}
            />
          </DataTableToolbar>
        )}
      />
    </div>
  )
}
