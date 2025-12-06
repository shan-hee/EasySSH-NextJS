"use client"

import React, { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, XCircle, Shield, AlertTriangle, User } from "lucide-react"
import { SkeletonStatsCard } from "@/components/ui/loading"
import { auditLogsApi, type AuditLog } from "@/lib/api/audit-logs"
import { getErrorMessage } from "@/lib/error-utils"
import { toast } from "@/components/ui/sonner"
import { DataTable } from "@/components/ui/data-table"
import { DataTableToolbar } from "@/components/ui/data-table-toolbar"
import { ColumnVisibility } from "@/components/ui/column-visibility"
import { createLoginLogColumns } from "../../components/login-log-columns"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { useTranslations } from "next-intl"

interface LoginStats {
  total: number
  success: number
  failure: number
  abnormalIP: number
}

interface LoginLogsPageData {
  logs: AuditLog[]
  loginStats: LoginStats
  totalPages: number
  totalCount: number
  currentPage: number
  pageSize: number
}

interface LoginLogsClientProps {
  initialData?: LoginLogsPageData
}

/**
 * 登录日志客户端组件
 * 纯 CSR 模式：在客户端加载数据
 */
export function LoginLogsClient({ initialData }: LoginLogsClientProps) {
  const { ready } = useAuthReady()
  const t = useTranslations("logsLogin")
  const [logs, setLogs] = useState<AuditLog[]>(initialData?.logs || [])
  const [loginStats, setLoginStats] = useState(initialData?.loginStats || {
    total: 0,
    success: 0,
    failure: 0,
    abnormalIP: 0,
  })
  const [loading, setLoading] = useState(!initialData)
  const [page, setPage] = useState(initialData?.currentPage || 1)
  const [pageSize, setPageSize] = useState(initialData?.pageSize || 20)
  const [totalPages, setTotalPages] = useState(initialData?.totalPages || 0)
  const [totalRows, setTotalRows] = useState(initialData?.totalCount || 0)
  const [columnVisibility, setColumnVisibility] = useState({
    created_at: true,
    username: true,
    status: true,
    ip: true,
    location: true,
    user_agent: true,
    details: true,
  })

  const columns = useMemo(
    () => createLoginLogColumns(t),
    [t],
  )


  // 检测异常IP（简单的内网IP检测）
  function isAbnormalIP(ip: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^localhost/,
    ]
    const isPrivate = privateRanges.some((range) => range.test(ip))
    return !isPrivate && ip !== "::1" && !ip.startsWith("fe80::")
  }

  // 加载数据
  const loadData = async (currentPage: number, currentPageSize: number) => {
    try {
      setLoading(true)
      // 加载日志列表
      const logsResponse = await auditLogsApi.list({
        page: currentPage,
        page_size: currentPageSize,
        action: "login",
      })

      const filteredLogs = logsResponse.logs.filter((log) => log.action === "login")
      setLogs(filteredLogs || [])
      setTotalPages(logsResponse.total_pages || 1)
      setTotalRows(logsResponse.total || 0)

      // 重新计算统计数据
      setLoginStats({
        total: filteredLogs.length,
        success: filteredLogs.filter((log) => log.status === "success").length,
        failure: filteredLogs.filter((log) => log.status === "failure").length,
        abnormalIP: filteredLogs.filter((log) => isAbnormalIP(log.ip)).length,
      })
    } catch (error: unknown) {
      console.error("登录日志加载失败:", error)
      toast.error(getErrorMessage(error, t("toastLoadFailed")))
    } finally {
      setLoading(false)
    }
  }

  // 初始加载数据（纯 CSR 模式，仅在已认证且全局状态就绪时触发）
  React.useEffect(() => {
    if (initialData) return
    if (!ready) return
    loadData(page, pageSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, initialData])

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

  // 筛选选项配置
  const filterOptions = useMemo(() => {
    const uniqueUsers = Array.from(new Set(logs.map((log) => log.username)))

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
    }
  }, [logs])

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
      {loading && !initialData ? (
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
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loginStats.total}</div>
              <p className="text-xs text-muted-foreground">{t("statsTotalDesc")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("statsSuccessTitle")}</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{loginStats.success}</div>
              <p className="text-xs text-muted-foreground">
                {t("statsSuccessDescPrefix")}{" "}
                {loginStats.total ? Math.round((loginStats.success / loginStats.total) * 100) : 0}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("statsFailureTitle")}</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{loginStats.failure}</div>
              <p className="text-xs text-muted-foreground">{t("statsFailureDesc")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("statsAbnormalIpTitle")}</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{loginStats.abnormalIP}</div>
              <p className="text-xs text-muted-foreground">{t("statsAbnormalIpDesc")}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 登录日志表格 */}
      <Card className="flex-1 min-h-0">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">{t("tableTitle")}</CardTitle>
            <CardDescription>
              {t("tableDescription", { count: logs.length })}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <ColumnVisibility
              columns={[
                { id: "created_at", label: t("columnTime") },
                { id: "username", label: t("columnUser") },
                { id: "status", label: t("columnStatus") },
                { id: "ip", label: t("columnIp") },
                { id: "location", label: t("columnLocation") },
                { id: "user_agent", label: t("columnBrowser") },
                { id: "details", label: t("columnDetails") },
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
