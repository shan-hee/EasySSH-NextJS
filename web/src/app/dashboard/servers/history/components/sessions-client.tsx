"use client"

import React, { useState, useCallback, useMemo, useTransition, useOptimistic } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, Activity, ArrowUpDown, ArrowDownUp, Trash2, Loader2 } from "lucide-react"
import { SkeletonStatsCard } from "@/components/ui/loading"
import { sshSessionsApi, type SSHSessionDetail, type SSHSessionStatistics } from "@/lib/api/ssh-sessions"
import { getErrorMessage } from "@/lib/error-utils"
import { toast } from "@/components/ui/sonner"
import { DataTable } from "@/components/ui/data-table"
import { DataTableToolbar } from "@/components/ui/data-table-toolbar"
import { Button } from "@/components/ui/button"
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
import { createSessionColumns } from "./session-columns"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog"

// 格式化数据传输量
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

interface SSHSessionsPageData {
  sessions: SSHSessionDetail[]
  statistics: SSHSessionStatistics
  totalPages: number
  totalCount: number
  currentPage: number
  pageSize: number
}

interface SessionsClientProps {
  initialData?: SSHSessionsPageData
}

/**
 * 服务器历史连接客户端组件
 * 接收服务端传递的初始数据，处理客户端交互
 */
export function SessionsClient({ initialData }: SessionsClientProps) {
  const t = useTranslations("connectionHistory")
  const { ready } = useAuthReady()
  const { confirm: requestConfirm, confirmDialog } = useConfirmDialog()
  const [isPending, startTransition] = useTransition()
  const [sessions, setSessions] = useState<SSHSessionDetail[]>(initialData?.sessions || [])
  const [statistics, setStatistics] = useState<SSHSessionStatistics>(initialData?.statistics || {
    total_sessions: 0,
    active_sessions: 0,
    closed_sessions: 0,
    total_duration: 0,
    total_bytes_sent: 0,
    total_bytes_received: 0,
    by_server: {},
  })
  const [initialLoading, setInitialLoading] = useState(!initialData)
  const [tableLoading, setTableLoading] = useState(false)
  const [page, setPage] = useState(initialData?.currentPage || 1)
  const [pageSize, setPageSize] = useState(initialData?.pageSize || 20)
  const [totalPages, setTotalPages] = useState(initialData?.totalPages || 0)
  const [totalCount, setTotalCount] = useState(initialData?.totalCount || 0)
  const [cleanupOpen, setCleanupOpen] = useState(false)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [retentionDays, setRetentionDays] = useState("90")

  // 乐观更新：立即从 UI 中移除删除的项目
  const [optimisticSessions, setOptimisticSessions] = useOptimistic(
    sessions,
    (state, deletedId: string) => state.filter((session) => session.id !== deletedId)
  )

  // 加载会话列表
  const loadSessions = useCallback(
    async (
      currentPage: number,
      currentPageSize: number,
      options: { showTableLoading?: boolean } = {},
    ) => {
      try {
        if (options.showTableLoading) {
          setTableLoading(true)
        }

        const sessionsResponse = await sshSessionsApi.list({
          page: currentPage,
          limit: currentPageSize,
        })

        // 确保 data 是数组
        const sessionData = Array.isArray(sessionsResponse.data)
          ? sessionsResponse.data
          : []
        setSessions(sessionData)
        setTotalPages(sessionsResponse.total_pages || 1)
        setTotalCount(sessionsResponse.total || 0)
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, t("toastLoadFailed")))
      } finally {
        if (options.showTableLoading) {
          setTableLoading(false)
        }
      }
    },
    [t]
  )

  // 加载统计信息
  const loadStatistics = useCallback(async () => {
    try {
      const statsResponse = await sshSessionsApi.getStatistics()
      setStatistics(statsResponse)
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t("toastLoadFailed")))
    }
  }, [t])

  // 初始加载数据（纯 CSR 模式，仅在已认证且全局状态就绪时触发）
  React.useEffect(() => {
    if (initialData) return
    if (!ready) return
    const loadInitialData = async () => {
      try {
        setInitialLoading(true)
        await Promise.all([
          loadSessions(page, pageSize),
          loadStatistics(),
        ])
      } finally {
        setInitialLoading(false)
      }
    }

    loadInitialData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, initialData])

  // 刷新数据
  const handleRefresh = useCallback(async () => {
    await Promise.all([
      loadSessions(page, pageSize, { showTableLoading: true }),
      loadStatistics(),
    ])
  }, [loadSessions, loadStatistics, page, pageSize])

  // 页码变化
  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage)
      loadSessions(newPage, pageSize, { showTableLoading: true })
    },
    [pageSize, loadSessions]
  )

  // 每页数量变化
  const handlePageSizeChange = useCallback(
    (newPageSize: number) => {
      setPageSize(newPageSize)
      setPage(1) // 重置到第一页
      loadSessions(1, newPageSize, { showTableLoading: true })
    },
    [loadSessions]
  )

  // 删除会话记录（使用 API + 乐观更新）
  const handleDelete = useCallback(async (id: string) => {
    const confirmed = await requestConfirm({
      description: t("toastDeleteConfirm"),
      variant: "destructive",
    })
    if (!confirmed) {
      return
    }

    // 立即从 UI 中移除（乐观更新）
    setOptimisticSessions(id)

    startTransition(async () => {
      try {
        await sshSessionsApi.delete(id)
        toast.success(t("toastDeleteSuccess"))
        // 刷新数据
        await Promise.all([
          loadSessions(page, pageSize, { showTableLoading: true }),
          loadStatistics(),
        ])
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, t("toastDeleteFailed")))
        // 恢复数据
        await loadSessions(page, pageSize, { showTableLoading: true })
      }
    })
  }, [
    loadSessions,
    loadStatistics,
    page,
    pageSize,
    requestConfirm,
    setOptimisticSessions,
    startTransition,
    t,
  ])

  // 导出会话数据
  const handleExportSession = useCallback((session: SSHSessionDetail) => {
    const data = {
      sessionId: session.session_id,
      clientIp: session.client_ip,
      clientPort: session.client_port,
      terminalType: session.terminal_type,
      status: session.status,
      connectedAt: session.connected_at,
      disconnectedAt: session.disconnected_at,
      duration: session.duration,
      bytesSent: session.bytes_sent,
      bytesReceived: session.bytes_received,
      errorMessage: session.error_message,
      exportTime: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `session-${session.session_id.substring(0, 8)}-export.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(t("toastExportSuccess"))
  }, [t])

  const handleCleanupSessions = useCallback(async () => {
    const parsedRetentionDays = Number(retentionDays)
    if (
      !Number.isInteger(parsedRetentionDays) ||
      parsedRetentionDays < 1 ||
      parsedRetentionDays > 3650
    ) {
      toast.error(t("cleanupInvalidRetention"))
      return
    }

    try {
      setCleanupLoading(true)
      const result = await sshSessionsApi.cleanup(parsedRetentionDays)
      toast.success(t("cleanupSuccess", { count: result.deleted_count }))
      setCleanupOpen(false)
      setPage(1)
      await Promise.all([
        loadSessions(1, pageSize, { showTableLoading: true }),
        loadStatistics(),
      ])
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t("cleanupFailed")))
    } finally {
      setCleanupLoading(false)
    }
  }, [loadSessions, loadStatistics, pageSize, retentionDays, t])

  // 创建列定义
  const columns = useMemo(
    () =>
      createSessionColumns(
        {
          onExport: handleExportSession,
          onDelete: handleDelete,
        },
        (key, values) => t(key as Parameters<typeof t>[0], values)
      ),
    [handleDelete, handleExportSession, t]
  )

  // 状态筛选选项
  const statusFilters = useMemo(
    () => [
      {
        column: "status",
        title: t("filterStatusTitle"),
        options: [
          { label: t("filterStatusActive"), value: "active" },
          { label: t("filterStatusClosed"), value: "closed" },
          { label: t("filterStatusTimeout"), value: "timeout" },
        ],
      },
    ],
    [t]
  )

  return (
    <div className="flex flex-1 h-full min-h-0 flex-col gap-4 p-4 pt-0 overflow-hidden">
      {confirmDialog}
      {/* 统计卡片 - 加载时显示骨架屏 */}
      {initialLoading ? (
        <div className="grid gap-4 md:grid-cols-4 shrink-0">
          <SkeletonStatsCard />
          <SkeletonStatsCard />
          <SkeletonStatsCard />
          <SkeletonStatsCard />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4 shrink-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("statsTotalTitle")}
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics?.total_sessions || 0}</div>
              <p className="text-xs text-muted-foreground">
                {t("statsTotalDesc", {
                  active: statistics?.active_sessions || 0,
                })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("statsClosedTitle")}
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">
                {statistics?.closed_sessions || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("statsClosedDesc")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("statsUploadTitle")}
              </CardTitle>
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {formatBytes(statistics?.total_bytes_sent || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("statsUploadDesc")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("statsDownloadTitle")}
              </CardTitle>
              <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatBytes(statistics?.total_bytes_received || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("statsDownloadDesc")}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* DataTable - 使用乐观更新的数据 */}
      <DataTable
        data={optimisticSessions}
        columns={columns}
        loading={initialLoading || tableLoading || isPending}
        currentPage={page}
        pageCount={totalPages}
        pageSize={pageSize}
        totalRows={totalCount}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        emptyMessage={t("tableEmpty")}
        toolbar={(table) => (
          <DataTableToolbar
            table={table}
            searchKey="server_name"
            searchPlaceholder={t("tableSearchPlaceholder")}
            filters={statusFilters}
            onRefresh={handleRefresh}
            showRefresh={true}
          >
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-destructive hover:text-destructive"
              onClick={() => setCleanupOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("cleanupButton")}
            </Button>
          </DataTableToolbar>
        )}
      />

      <AlertDialog open={cleanupOpen} onOpenChange={setCleanupOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cleanupDialogTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("cleanupDialogDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label htmlFor="ssh-session-retention-days">{t("cleanupRetentionLabel")}</Label>
            <Input
              id="ssh-session-retention-days"
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
                void handleCleanupSessions()
              }}
            >
              {cleanupLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("cleanupRunning")}
                </>
              ) : (
                t("cleanupConfirm")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
