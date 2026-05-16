"use client"

import React, { useState, useCallback, useTransition, useOptimistic, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Upload as UploadIcon, Download as DownloadIcon, XCircle, ArrowUpDown, Plus, Loader2 } from "lucide-react"
import { SkeletonStatsCard } from "@/components/ui/loading"
import { fileTransfersApi, type FileTransfer, type FileTransferStatistics } from "@/lib/api/file-transfers"
import { serversApi, sftpApi, type Server } from "@/lib/api"
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

type TransferTaskMode = "legacy-upload" | "compatible-download" | "fast-download"

type TransferPlanOption = {
  value: TransferTaskMode
  title: string
  description: string
  note: string
}

const getFileNameFromPath = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) return "transfer"
  const normalized = trimmed.replace(/\/+$/, "")
  return normalized.split("/").pop() || "transfer"
}

const getRemoteUploadPath = (remoteDir: string, fileName: string): string => {
  const dir = remoteDir.trim() || "/"
  return `${dir.replace(/\/+$/, "")}/${fileName}`.replace(/\/+/g, "/")
}

/**
 * 传输任务客户端组件
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
  const [servers, setServers] = useState<Server[]>([])
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [taskMode, setTaskMode] = useState<TransferTaskMode>("legacy-upload")
  const [selectedServerId, setSelectedServerId] = useState("")
  const [remotePath, setRemotePath] = useState("/root")
  const [downloadPaths, setDownloadPaths] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [creatingTask, setCreatingTask] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const t = useTranslations("transfers")
  const transferPlanOptions = useMemo<TransferPlanOption[]>(() => [
    {
      value: "legacy-upload",
      title: t("planLegacyUploadTitle"),
      description: t("planLegacyUploadDescription"),
      note: t("planLegacyUploadNote"),
    },
    {
      value: "compatible-download",
      title: t("planCompatibleDownloadTitle"),
      description: t("planCompatibleDownloadDescription"),
      note: t("planCompatibleDownloadNote"),
    },
    {
      value: "fast-download",
      title: t("planFastDownloadTitle"),
      description: t("planFastDownloadDescription"),
      note: t("planFastDownloadNote"),
    },
  ], [t])

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

  const loadServers = useCallback(async () => {
    try {
      const response = await serversApi.list({ page: 1, limit: 1000 })
      setServers(Array.isArray(response) ? response : response.data || [])
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t("loadServersFailed")))
    }
  }, [t])

  // 初始加载数据（纯 CSR 模式，仅在已认证且全局状态就绪时触发）
  React.useEffect(() => {
    if (initialData) return
    if (!ready) return
    loadData(page, pageSize)
  }, [ready, initialData, loadData, page, pageSize])

  React.useEffect(() => {
    if (!ready) return
    loadServers()
  }, [ready, loadServers])

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

  // 删除传输任务（使用 API + 乐观更新）
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

  const resetTaskForm = useCallback(() => {
    setTaskMode("legacy-upload")
    setSelectedServerId("")
    setRemotePath("/root")
    setDownloadPaths("")
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  const handleTaskDialogChange = useCallback((open: boolean) => {
    setTaskDialogOpen(open)
    if (!open) {
      resetTaskForm()
    }
  }, [resetTaskForm])

  const handleCreateTask = useCallback(async () => {
    const serverId = selectedServerId.trim()
    if (!serverId) {
      toast.error(t("taskServerRequired"))
      return
    }

    setCreatingTask(true)

    try {
      if (taskMode === "legacy-upload") {
        if (!selectedFile) {
          toast.error(t("taskFileRequired"))
          return
        }

        const targetPath = getRemoteUploadPath(remotePath, selectedFile.name)
        const size = Math.max(selectedFile.size, 1)
        const record = await fileTransfersApi.create({
          server_id: serverId,
          transfer_type: "upload",
          source_path: selectedFile.name,
          dest_path: targetPath,
          file_name: selectedFile.name,
          file_size: size,
        })

        try {
          await sftpApi.uploadFileLegacy(
            serverId,
            remotePath,
            selectedFile,
            async (loaded, total) => {
              const progress = total > 0 ? Math.min(99, Math.round((loaded / total) * 100)) : 0
              await fileTransfersApi.update(record.id, {
                progress,
                bytes_transferred: Math.min(loaded, size),
              }).catch(() => undefined)
            },
          )
          await fileTransfersApi.update(record.id, {
            status: "completed",
            progress: 100,
            bytes_transferred: size,
          })
          toast.success(t("taskStarted"))
        } catch (error: unknown) {
          await fileTransfersApi.update(record.id, {
            status: "failed",
            error_message: getErrorMessage(error, t("taskFailed")),
          }).catch(() => undefined)
          throw error
        }
      } else {
        const paths = downloadPaths
          .split(/\r?\n/)
          .map((path) => path.trim())
          .filter(Boolean)

        if (paths.length === 0) {
          toast.error(t("taskPathsRequired"))
          return
        }

        const mode = taskMode === "fast-download" ? "fast" : "compatible"
        const fileName = paths.length === 1
          ? getFileNameFromPath(paths[0])
          : `batch-download-${paths.length}`
        const recordSize = 1
        const record = await fileTransfersApi.create({
          server_id: serverId,
          transfer_type: "download",
          source_path: paths.join("\n"),
          dest_path: "browser-download",
          file_name: fileName,
          file_size: recordSize,
        })

        try {
          await sftpApi.batchDownload(serverId, paths, mode)
          await fileTransfersApi.update(record.id, {
            status: "completed",
            progress: 100,
            bytes_transferred: recordSize,
          })
          toast.success(t("taskStarted"))
        } catch (error: unknown) {
          await fileTransfersApi.update(record.id, {
            status: "failed",
            error_message: getErrorMessage(error, t("taskFailed")),
          }).catch(() => undefined)
          throw error
        }
      }

      setTaskDialogOpen(false)
      resetTaskForm()
      await loadData(1, pageSize)
      setPage(1)
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t("taskFailed")))
    } finally {
      setCreatingTask(false)
    }
  }, [
    downloadPaths,
    loadData,
    pageSize,
    remotePath,
    resetTaskForm,
    selectedFile,
    selectedServerId,
    t,
    taskMode,
  ])

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
      <div className="flex items-center justify-end shrink-0">
        <Button
          type="button"
          size="sm"
          className="gap-2"
          onClick={() => setTaskDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
          {t("newTask")}
        </Button>
      </div>

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
        currentPage={page}
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

      <Dialog open={taskDialogOpen} onOpenChange={handleTaskDialogChange}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{t("newTask")}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>{t("transferPlan")}</Label>
              <RadioGroup
                value={taskMode}
                onValueChange={(value) => setTaskMode(value as TransferTaskMode)}
                className="grid gap-2"
              >
                {transferPlanOptions.map((option) => {
                  const inputId = `transfer-plan-${option.value}`
                  const selected = taskMode === option.value

                  return (
                    <Label
                      key={option.value}
                      htmlFor={inputId}
                      className={cn(
                        "cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50",
                      )}
                    >
                      <RadioGroupItem id={inputId} value={option.value} className="mt-0.5" />
                      <span className="grid gap-1">
                        <span className="text-sm font-medium">{option.title}</span>
                        <span className="text-xs leading-5 text-muted-foreground">
                          {option.description}
                        </span>
                        <span className="text-xs leading-5 text-muted-foreground">
                          {option.note}
                        </span>
                      </span>
                    </Label>
                  )
                })}
              </RadioGroup>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="transfer-task-server">{t("taskServer")}</Label>
              <Select value={selectedServerId} onValueChange={setSelectedServerId}>
                <SelectTrigger id="transfer-task-server" className="w-full">
                  <SelectValue placeholder={t("taskServerPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {servers.map((server) => (
                    <SelectItem key={server.id} value={server.id}>
                      {server.name || server.host}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {taskMode === "legacy-upload" ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="transfer-task-file">{t("taskLocalFile")}</Label>
                  <Input
                    id="transfer-task-file"
                    ref={fileInputRef}
                    type="file"
                    onChange={(event) => {
                      setSelectedFile(event.target.files?.[0] || null)
                    }}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="transfer-task-remote-dir">{t("taskRemoteDir")}</Label>
                  <Input
                    id="transfer-task-remote-dir"
                    value={remotePath}
                    onChange={(event) => setRemotePath(event.target.value)}
                    placeholder="/root"
                  />
                </div>
              </>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="transfer-task-paths">{t("taskRemotePaths")}</Label>
                <Textarea
                  id="transfer-task-paths"
                  value={downloadPaths}
                  onChange={(event) => setDownloadPaths(event.target.value)}
                  placeholder={"/root/file.log\n/root/archive"}
                  className="min-h-28"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleTaskDialogChange(false)}
              disabled={creatingTask}
            >
              {t("taskCancel")}
            </Button>
            <Button
              type="button"
              onClick={handleCreateTask}
              disabled={creatingTask}
              className="gap-2"
            >
              {creatingTask && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("taskCreate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
