"use client"

import React, { useState, useCallback, useTransition, useOptimistic, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload as UploadIcon, Download as DownloadIcon, XCircle, ArrowUpDown } from "lucide-react"
import { SkeletonStatsCard } from "@/components/ui/loading"
import { fileTransfersApi, type FileTransfer, type FileTransferStatistics } from "@/lib/api/file-transfers"
import { toast } from "@/components/ui/sonner"
import { getErrorMessage } from "@/lib/error-utils"
import { DataTable } from "@/components/ui/data-table"
import { DataTableToolbar } from "@/components/ui/data-table-toolbar"
import { createTransferColumns } from "./transfer-columns"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { useTranslations } from "next-intl"

// 定义页面数据类型
interface FileTransfersPageData {
  transfers: FileTransfer[]
  statistics: FileTransferStatistics
  currentPage: number
  pageSize: number
  totalPages: number
  totalCount: number
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

interface TransfersClientProps {
  initialData?: FileTransfersPageData
}

/**
 * 传输记录客户端组件
 * 纯 CSR 模式：在客户端加载数据
 */
export function TransfersClient({ initialData }: TransfersClientProps) {
  const { ready } = useAuthReady()
  const [isPending, startTransition] = useTransition()
  const [transfers, setTransfers] = useState<FileTransfer[]>(initialData?.transfers || [])
  const [statistics, setStatistics] = useState<FileTransferStatistics>(initialData?.statistics || {
    total_transfers: 0,
    completed_transfers: 0,
    failed_transfers: 0,
    total_bytes_uploaded: 0,
    total_bytes_downloaded: 0,
    by_type: {},
    by_status: {},
  })
  const [refreshing, setRefreshing] = useState(!initialData)
  const [page, setPage] = useState(initialData?.currentPage || 1)
  const [pageSize, setPageSize] = useState(initialData?.pageSize || 20)
  const [totalPages, setTotalPages] = useState(initialData?.totalPages || 0)
  const [totalCount, setTotalCount] = useState(initialData?.totalCount || 0)
  const t = useTranslations("transfers")

  // 乐观更新：立即从 UI 中移除删除的项目
  const [optimisticTransfers, setOptimisticTransfers] = useOptimistic(
    transfers,
    (state, deletedId: string) => state.filter((transfer) => transfer.id !== deletedId)
  )


  // 加载数据
  const loadData = useCallback(
    async (currentPage: number, currentPageSize: number) => {
      try {
        setRefreshing(true)
        // 并行加载传输列表和统计信息
        const [transfersResponse, statsResponse] = await Promise.all([
          fileTransfersApi.list({
            page: currentPage,
            limit: currentPageSize,
          }),
          fileTransfersApi.getStatistics(),
        ])

        setTransfers(transfersResponse.data || [])
        setTotalPages(transfersResponse.total_pages || 1)
        setTotalCount(transfersResponse.total || 0)
        setStatistics(statsResponse)
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, t("loadFailed")))
      } finally {
        setRefreshing(false)
      }
    },
    [t]
  )

  // 初始加载数据（纯 CSR 模式，仅在已认证且全局状态就绪时触发）
  React.useEffect(() => {
    if (initialData) return
    if (!ready) return
    loadData(page, pageSize)
  }, [ready, initialData, loadData, page, pageSize])

  // 刷新数据
  const handleRefresh = async () => {
    await loadData(page, pageSize)
  }

  // 页码变化
  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage)
      loadData(newPage, pageSize)
    },
    [pageSize, loadData]
  )

  // 每页数量变化
  const handlePageSizeChange = useCallback(
    (newPageSize: number) => {
      setPageSize(newPageSize)
      setPage(1) // 重置到第一页
      loadData(1, newPageSize)
    },
    [loadData]
  )

  // 删除传输记录（使用 API + 乐观更新）
  const handleDelete = useCallback(async (id: string) => {
    if (!confirm(t("confirmDelete"))) {
      return
    }

    // 立即从 UI 中移除（乐观更新）
    setOptimisticTransfers(id)

    startTransition(async () => {
      try {
        await fileTransfersApi.delete(id)
        toast.success(t("deleteSuccess"))
        // 刷新数据
        await loadData(page, pageSize)
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, t("deleteFailed")))
        // 恢复数据
        await loadData(page, pageSize)
      }
    })
  }, [loadData, page, pageSize, setOptimisticTransfers, startTransition, t])

  // 创建列定义（依赖 t 和删除回调）
  const columns = useMemo(
    () =>
      createTransferColumns(t, {
        onDelete: handleDelete,
      }),
    [t, handleDelete],
  )

  // 筛选选项
  const filters = [
    {
      column: "transfer_type",
      title: t("type"),
      options: [
        { label: t("typeUpload"), value: "upload", icon: UploadIcon },
        { label: t("typeDownload"), value: "download", icon: DownloadIcon },
      ],
    },
    {
      column: "status",
      title: t("status"),
      options: [
        { label: t("statusCompleted"), value: "completed" },
        { label: t("statusTransferring"), value: "transferring" },
        { label: t("statusFailed"), value: "failed" },
        { label: t("statusPending"), value: "pending" },
      ],
    },
  ]

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0 h-full overflow-hidden">
      {/* 统计卡片 - 加载时显示骨架屏 */}
      {refreshing && !initialData ? (
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
              <CardTitle className="text-sm font-medium">{t("statsTotal")}</CardTitle>
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics?.total_transfers || 0}</div>
              <p className="text-xs text-muted-foreground">
                {t("statsTotalDesc", {
                  completed: statistics?.completed_transfers || 0,
                })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("statsUpload")}</CardTitle>
              <UploadIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {statistics?.by_type?.upload || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(statistics?.total_bytes_uploaded || 0)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("statsDownload")}</CardTitle>
              <DownloadIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {statistics?.by_type?.download || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(statistics?.total_bytes_downloaded || 0)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("statsFailed")}</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {statistics?.failed_transfers || 0}
              </div>
              <p className="text-xs text-muted-foreground">{t("statsFailedDesc")}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* DataTable - 使用乐观更新的数据 */}
      <DataTable
        data={optimisticTransfers}
        columns={columns}
        loading={refreshing || isPending}
        pageCount={totalPages}
        pageSize={pageSize}
        totalRows={totalCount}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        emptyMessage={t("empty")}
        toolbar={(table) => (
          <DataTableToolbar
            table={table}
            searchKey="file_name"
            searchPlaceholder={t("searchPlaceholder")}
            filters={filters}
            onRefresh={handleRefresh}
            showRefresh={true}
          />
        )}
      />
    </div>
  )
}
