"use client"

import React, { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, XCircle, Activity, User } from "lucide-react"
import { auditLogsApi, type AuditLog, type AuditLogStatisticsResponse } from "@/lib/api/audit-logs"
import { getErrorMessage } from "@/lib/error-utils"
import { toast } from "@/components/ui/sonner"
import { DataTable } from "@/components/ui/data-table"
import { DataTableToolbar } from "@/components/ui/data-table-toolbar"
import { ColumnVisibility } from "@/components/ui/column-visibility"
import { exportLogsToCSV, exportLogsToJSON, downloadFile } from "@/components/ui/batch-actions"
import { auditLogColumns } from "./audit-log-columns"
import type { AuditLogsPageData } from "@/lib/api/audit-logs-server"

interface AuditLogsClientProps {
  initialData?: AuditLogsPageData
}

/**
 * 操作日志客户端组件
 * 纯 CSR 模式：在客户端加载数据
 */
export function AuditLogsClient({ initialData }: AuditLogsClientProps) {
  const [logs, setLogs] = useState<AuditLog[]>(initialData?.logs || [])
  const [statistics, setStatistics] = useState<AuditLogStatisticsResponse | null>(
    initialData?.statistics || null
  )
  const [loading, setLoading] = useState(!initialData)
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

  // 加载数据
  const loadData = async (currentPage: number, currentPageSize: number) => {
    try {
      setLoading(true)
      // 并行加载日志列表和统计信息
      const [logsResponse, statsResponse] = await Promise.all([
        auditLogsApi.list({
          page: currentPage,
          page_size: currentPageSize,
        }),
        auditLogsApi.getStatistics(),
      ])

      setLogs(logsResponse.logs || [])
      setTotalPages(logsResponse.total_pages || 1)
      setTotalRows(logsResponse.total || 0)
      setStatistics(statsResponse)
    } catch (error: unknown) {
      console.error("操作日志加载失败:", error)
      toast.error(getErrorMessage(error, "无法加载操作日志"))
    } finally {
      setLoading(false)
    }
  }

  // 初始加载数据（纯 CSR 模式）
  React.useEffect(() => {
    if (!initialData) {
      loadData(page, pageSize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 页码变化
  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    loadData(newPage, pageSize)
  }

  // 每页数量变化
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize)
    setPage(1)
    loadData(1, newPageSize)
  }

  // 刷新数据
  const handleRefresh = () => {
    loadData(page, pageSize)
  }

  // 导出操作函数
  const handleExportAll = (format: "csv" | "json") => {
    try {
      let content: string
      let filename: string
      let type: string

      if (format === "csv") {
        content = exportLogsToCSV(logs)
        filename = `操作日志_${new Date().toISOString().split("T")[0]}.csv`
        type = "text/csv;charset=utf-8"
      } else {
        content = exportLogsToJSON(logs)
        filename = `操作日志_${new Date().toISOString().split("T")[0]}.json`
        type = "application/json;charset=utf-8"
      }

      downloadFile(content, filename, type)
      toast.success(`成功导出 ${logs.length} 条日志`)
    } catch (error) {
      console.error("导出失败:", error)
      toast.error("导出失败")
    }
  }

  // 筛选选项配置
  const filterOptions = useMemo(() => {
    const uniqueUsers = Array.from(new Set(logs.map((log) => log.username)))
    const uniqueActions = Array.from(new Set(logs.map((log) => log.action)))

    return {
      status: [
        { label: "成功", value: "success", icon: CheckCircle },
        { label: "失败", value: "failure", icon: XCircle },
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
  }, [logs])

  // 可见列配置
  const visibleColumns = useMemo(
    () =>
      auditLogColumns.filter(
        (column) => columnVisibility[column.id as keyof typeof columnVisibility] ?? true
      ),
    [columnVisibility]
  )

  return (
    <div className="flex flex-1 h-full min-h-0 flex-col gap-4 p-4 pt-0 overflow-hidden">
      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总操作数</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics?.total_logs || 0}</div>
            <p className="text-xs text-muted-foreground">所有审计日志</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">成功操作</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {statistics?.success_count || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              成功率{" "}
              {statistics?.total_logs
                ? Math.round((statistics.success_count / statistics.total_logs) * 100)
                : 0}
              %
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">失败操作</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {statistics?.failure_count || 0}
            </div>
            <p className="text-xs text-muted-foreground">需要关注</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">活跃用户</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {statistics?.top_users?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">操作用户数</p>
          </CardContent>
        </Card>
      </div>

      {/* 操作日志表格 */}
      <Card className="flex-1 min-h-0">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">操作日志</CardTitle>
            <CardDescription>显示 {logs.length} 条记录</CardDescription>
          </div>
          <div className="flex gap-2">
            <ColumnVisibility
              columns={[
                { id: "created_at", label: "时间" },
                { id: "username", label: "用户" },
                { id: "action", label: "操作" },
                { id: "resource", label: "资源" },
                { id: "status", label: "状态" },
                { id: "ip", label: "IP地址" },
                { id: "details", label: "详情" },
                { id: "duration", label: "耗时" },
                { id: "server_id", label: "服务器" },
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
          </div>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 p-4 pt-0">
          <DataTable
            data={logs}
            columns={visibleColumns}
            loading={loading}
            pageCount={totalPages}
            pageSize={pageSize}
            totalRows={totalRows}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            emptyMessage="暂无操作日志"
            toolbar={(table) => (
              <DataTableToolbar
                table={table}
                searchKey="username"
                searchPlaceholder="搜索用户名或操作..."
                filters={[
                  {
                    column: "status",
                    title: "状态",
                    options: filterOptions.status,
                  },
                  {
                    column: "action",
                    title: "操作",
                    options: filterOptions.actions.slice(0, 10), // 限制显示前10个
                  },
                ]}
                onRefresh={handleRefresh}
                showRefresh={true}
              />
            )}
          />
        </CardContent>
      </Card>
    </div>
  )
}
