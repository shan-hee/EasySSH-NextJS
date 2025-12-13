"use client"

import React, { useState, useCallback, useMemo, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import { DataTable } from "@/components/ui/data-table"
import { DataTableToolbar } from "@/components/ui/data-table-toolbar"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { SkeletonStatsCard } from "@/components/ui/loading"
import {
  Trash2,
  RotateCcw,
  File,
  Folder,
  Server,
  HardDrive,
  FileStack,
  FolderOpen,
  MoreHorizontal,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Settings,
  Loader2,
  Timer,
  Files,
  Database,
  Sparkles,
  Info,
  RotateCw,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { useTranslations } from "next-intl"
import { toast } from "@/components/ui/sonner"
import { getErrorMessage } from "@/lib/error-utils"
import { serversApi, type Server as ServerType } from "@/lib/api/servers"
import { sftpApi, type GlobalTrashItem, type TrashItemStatus, type TrashSettingsResponse } from "@/lib/api/sftp"
import { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

// 格式化相对时间
function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return "-"
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "刚刚"
  if (diffMins < 60) return `${diffMins} 分钟前`
  if (diffHours < 24) return `${diffHours} 小时前`
  if (diffDays < 30) return `${diffDays} 天前`
  return date.toLocaleDateString()
}

// 格式化完整日期时间
function formatFullDateTime(dateStr: string): string {
  if (!dateStr) return "-"
  const date = new Date(dateStr)
  return date.toLocaleString()
}

// 状态颜色和图标映射
const statusConfig: Record<TrashItemStatus, { color: string; icon: React.ReactNode; label: string }> = {
  active: {
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    icon: <Clock className="h-3.5 w-3.5" />,
    label: "待清理",
  },
  restored: {
    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    label: "已恢复",
  },
  purged: {
    color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
    icon: <XCircle className="h-3.5 w-3.5" />,
    label: "已删除",
  },
  missing: {
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    label: "文件丢失",
  },
  purging: {
    color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    label: "清理中",
  },
  restoring: {
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    label: "恢复中",
  },
}

export default function TrashPage() {
  const { ready } = useAuthReady()
  const t = useTranslations("trash")

  // 状态
  const [servers, setServers] = useState<ServerType[]>([])
  const [serversMap, setServersMap] = useState<Map<string, ServerType>>(new Map())
  const [trashItems, setTrashItems] = useState<GlobalTrashItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingServers, setLoadingServers] = useState(true)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  // 筛选状态
  const [filterServerId, setFilterServerId] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<TrashItemStatus | "all">("active")

  // 分页状态
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)

  // 确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description: string
    onConfirm: () => void
    variant: "default" | "destructive"
  }>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
    variant: "default",
  })

  // 设置面板状态
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settings, setSettings] = useState<TrashSettingsResponse | null>(null)
  const [settingsForm, setSettingsForm] = useState({
    retention_hours: 24,
    max_entries_per_dir: 5000,
    max_bytes_per_dir_mb: 2048,
    auto_clean_enabled: true,
  })

  // 加载设置
  const loadSettings = useCallback(async () => {
    try {
      setSettingsLoading(true)
      const data = await sftpApi.getTrashSettings()
      setSettings(data)
      setSettingsForm({
        retention_hours: data.retention_hours,
        max_entries_per_dir: data.max_entries_per_dir,
        max_bytes_per_dir_mb: data.max_bytes_per_dir_mb,
        auto_clean_enabled: data.auto_clean_enabled,
      })
    } catch (error) {
      toast.error(t("settingsLoadFailed", { message: getErrorMessage(error) }))
    } finally {
      setSettingsLoading(false)
    }
  }, [t])

  // 保存设置
  const handleSaveSettings = useCallback(async () => {
    try {
      setSettingsSaving(true)
      await sftpApi.updateTrashSettings(settingsForm)
      toast.success(t("settingsSaveSuccess"))
      await loadSettings()
    } catch (error) {
      toast.error(t("settingsSaveFailed", { message: getErrorMessage(error) }))
    } finally {
      setSettingsSaving(false)
    }
  }, [settingsForm, loadSettings, t])

  // 重置设置
  const handleResetSettings = useCallback(async () => {
    setConfirmDialog({
      open: true,
      title: t("settingsReset"),
      description: t("settingsResetConfirm"),
      variant: "destructive",
      onConfirm: async () => {
        try {
          setSettingsSaving(true)
          const data = await sftpApi.resetTrashSettings()
          setSettings(data)
          setSettingsForm({
            retention_hours: data.retention_hours,
            max_entries_per_dir: data.max_entries_per_dir,
            max_bytes_per_dir_mb: data.max_bytes_per_dir_mb,
            auto_clean_enabled: data.auto_clean_enabled,
          })
          toast.success(t("settingsResetSuccess"))
        } catch (error) {
          toast.error(t("settingsResetFailed", { message: getErrorMessage(error) }))
        } finally {
          setSettingsSaving(false)
        }
      },
    })
  }, [t])

  // 加载服务器列表
  useEffect(() => {
    if (!ready) return

    const loadServers = async () => {
      try {
        setLoadingServers(true)
        const response = await serversApi.list({ limit: 100 })
        const serverList = response.data || []
        setServers(serverList)
        // 构建服务器映射表
        const map = new Map<string, ServerType>()
        serverList.forEach((server) => map.set(server.id, server))
        setServersMap(map)
      } catch (error) {
        toast.error(getErrorMessage(error, "加载服务器列表失败"))
      } finally {
        setLoadingServers(false)
      }
    }

    loadServers()
  }, [ready])

  // 加载回收站内容
  const loadTrash = useCallback(async () => {
    try {
      setLoading(true)
      const response = await sftpApi.listGlobalTrash({
        server_id: filterServerId === "all" ? undefined : filterServerId,
        status: filterStatus === "all" ? undefined : filterStatus,
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
      })
      setTrashItems(response.items || [])
      setTotal(response.total || 0)
      setSelectedItems(new Set())
    } catch (error) {
      toast.error(t("loadFailed", { message: getErrorMessage(error) }))
      setTrashItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [filterServerId, filterStatus, pageSize, currentPage, t])

  // 当筛选条件变化时重新加载
  useEffect(() => {
    if (ready && !loadingServers) {
      loadTrash()
    }
  }, [ready, loadingServers, loadTrash])

  // 恢复文件
  const handleRestore = useCallback(
    async (item: GlobalTrashItem) => {
      try {
        await sftpApi.restoreGlobalTrashItem(item.id, true)
        toast.success(t("restoreSuccess"))
        loadTrash()
      } catch (error) {
        toast.error(t("restoreFailed", { message: getErrorMessage(error) }))
      }
    },
    [loadTrash, t]
  )

  // 永久删除
  const handlePurge = useCallback(
    async (item: GlobalTrashItem) => {
      setConfirmDialog({
        open: true,
        title: t("actionDelete"),
        description: t("deleteConfirm"),
        variant: "destructive",
        onConfirm: async () => {
          try {
            await sftpApi.purgeGlobalTrashItem(item.id)
            toast.success(t("deleteSuccess"))
            loadTrash()
          } catch (error) {
            toast.error(t("deleteFailed", { message: getErrorMessage(error) }))
          }
        },
      })
    },
    [loadTrash, t]
  )

  // 清空回收站
  const handleEmptyTrash = useCallback(() => {
    setConfirmDialog({
      open: true,
      title: t("emptyTrash"),
      description: t("emptyTrashConfirm"),
      variant: "destructive",
      onConfirm: async () => {
        try {
          const result = await sftpApi.emptyGlobalTrash({
            server_id: filterServerId === "all" ? undefined : filterServerId,
          })
          toast.success(t("emptyTrashSuccess") + ` (${result.deleted_count} 项)`)
          loadTrash()
        } catch (error) {
          toast.error(t("emptyTrashFailed", { message: getErrorMessage(error) }))
        }
      },
    })
  }, [filterServerId, loadTrash, t])

  // 批量恢复
  const handleBatchRestore = useCallback(async () => {
    if (selectedItems.size === 0) return

    setConfirmDialog({
      open: true,
      title: t("batchRestore"),
      description: t("batchRestoreConfirm", { count: selectedItems.size }),
      variant: "default",
      onConfirm: async () => {
        try {
          const items = trashItems.filter((item) => selectedItems.has(item.id))
          let successCount = 0
          for (const item of items) {
            try {
              await sftpApi.restoreGlobalTrashItem(item.id, true)
              successCount++
            } catch {
              // 继续处理其他项
            }
          }
          toast.success(t("batchRestoreSuccess", { count: successCount }))
          loadTrash()
        } catch (error) {
          toast.error(t("restoreFailed", { message: getErrorMessage(error) }))
        }
      },
    })
  }, [selectedItems, trashItems, loadTrash, t])

  // 批量删除
  const handleBatchDelete = useCallback(async () => {
    if (selectedItems.size === 0) return

    setConfirmDialog({
      open: true,
      title: t("batchDelete"),
      description: t("batchDeleteConfirm", { count: selectedItems.size }),
      variant: "destructive",
      onConfirm: async () => {
        try {
          const items = trashItems.filter((item) => selectedItems.has(item.id))
          let successCount = 0
          for (const item of items) {
            try {
              await sftpApi.purgeGlobalTrashItem(item.id)
              successCount++
            } catch {
              // 继续处理其他项
            }
          }
          toast.success(t("batchDeleteSuccess", { count: successCount }))
          loadTrash()
        } catch (error) {
          toast.error(t("deleteFailed", { message: getErrorMessage(error) }))
        }
      },
    })
  }, [selectedItems, trashItems, loadTrash, t])

  // 统计数据
  const statistics = useMemo(() => {
    const totalSize = trashItems.reduce((acc, item) => acc + item.size, 0)
    const fileCount = trashItems.filter((item) => !item.is_dir).length
    const folderCount = trashItems.filter((item) => item.is_dir).length

    return {
      total,
      totalSize,
      fileCount,
      folderCount,
    }
  }, [trashItems, total])

  // 获取服务器信息
  const getServerInfo = useCallback(
    (serverId: string) => {
      const server = serversMap.get(serverId)
      return server
        ? { name: server.name || server.host, host: server.host }
        : { name: "未知服务器", host: "-" }
    },
    [serversMap]
  )

  // 表格列定义
  const columns: ColumnDef<GlobalTrashItem>[] = useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => {
              table.toggleAllPageRowsSelected(!!value)
              if (value) {
                const allIds = new Set(trashItems.map((item) => item.id))
                setSelectedItems(allIds)
              } else {
                setSelectedItems(new Set())
              }
            }}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedItems.has(row.original.id)}
            onCheckedChange={(value) => {
              const newSelected = new Set(selectedItems)
              if (value) {
                newSelected.add(row.original.id)
              } else {
                newSelected.delete(row.original.id)
              }
              setSelectedItems(newSelected)
              row.toggleSelected(!!value)
            }}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "original_name",
        header: t("columnName"),
        cell: ({ row }) => {
          const item = row.original
          const Icon = item.is_dir ? Folder : File
          const iconColor = item.is_dir ? "text-amber-500" : "text-gray-500"

          return (
            <div className="flex items-center gap-2">
              <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="font-medium truncate max-w-[180px]">
                      {item.original_name}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-md">
                    <p className="font-medium">{item.original_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.original_path}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )
        },
      },
      {
        accessorKey: "server_id",
        header: t("columnServer"),
        cell: ({ row }) => {
          const serverInfo = getServerInfo(row.original.server_id)
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5">
                    <Server className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm truncate max-w-[100px]">{serverInfo.name}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>{serverInfo.host}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        },
      },
      {
        accessorKey: "size",
        header: t("columnSize"),
        cell: ({ row }) => {
          const item = row.original
          return item.is_dir ? (
            <span className="text-muted-foreground">-</span>
          ) : (
            <span className="tabular-nums">{formatFileSize(item.size)}</span>
          )
        },
      },
      {
        accessorKey: "status",
        header: t("columnStatus"),
        cell: ({ row }) => {
          const status = row.original.status
          const config = statusConfig[status]
          return (
            <Badge className={`${config.color} gap-1`}>
              {config.icon}
              <span>{config.label}</span>
            </Badge>
          )
        },
      },
      {
        accessorKey: "deleted_at",
        header: t("columnDeletedAt"),
        cell: ({ row }) => (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-sm text-muted-foreground">
                  {formatRelativeTime(row.original.deleted_at)}
                </span>
              </TooltipTrigger>
              <TooltipContent>{formatFullDateTime(row.original.deleted_at)}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ),
      },
      {
        accessorKey: "parent_dir",
        header: t("columnOriginalPath"),
        cell: ({ row }) => (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-muted-foreground truncate max-w-[150px] block text-sm">
                  {row.original.parent_dir}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-md break-all">
                {row.original.original_path}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ),
      },
      {
        id: "actions",
        header: t("columnActions"),
        cell: ({ row }) => {
          const item = row.original
          const canOperate = item.status === "active"

          if (!canOperate) {
            const statusText = {
              restored: "已恢复",
              purged: "已清理",
              missing: "文件丢失",
              purging: "清理中...",
              restoring: "恢复中...",
            }[item.status] || "不可用"

            return (
              <span className="text-xs text-muted-foreground">
                {statusText}
              </span>
            )
          }

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleRestore(item)}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {t("actionRestore")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handlePurge(item)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("actionDelete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [t, handleRestore, handlePurge, selectedItems, trashItems, getServerInfo]
  )

  // 计算总页数
  const pageCount = useMemo(() => Math.ceil(total / pageSize), [total, pageSize])

  // 判断是否处于初始加载状态（认证检查中或服务器列表加载中）
  const isInitialLoading = !ready || loadingServers

  return (
    <>
      <PageHeader title={t("pageTitle")} />

      {/* Sheet 放在顶层，通过状态控制 */}
      <Sheet open={settingsOpen} onOpenChange={(open) => {
        setSettingsOpen(open)
        if (open && !settings) {
          loadSettings()
        }
      }}>
        <SheetContent className="w-[400px] sm:w-[480px] flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {t("settingsTitle")}
            </SheetTitle>
            <SheetDescription>{t("settingsDesc")}</SheetDescription>
          </SheetHeader>

          {settingsLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
                <div className="flex-1 overflow-y-auto space-y-4 p-4 pt-0">
                  {/* 当前状态 */}
                  <div className={`flex items-center gap-3 rounded-xl p-3 ${
                    settings?.is_default
                      ? "bg-muted/50"
                      : "bg-primary/5"
                  }`}>
                    {settings?.is_default ? (
                      <Info className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-primary shrink-0" />
                    )}
                    <span className={`text-sm ${
                      settings?.is_default ? "text-muted-foreground" : "text-primary"
                    }`}>
                      {settings?.is_default ? t("settingsUsingDefault") : t("settingsUsingCustom")}
                    </span>
                  </div>

                  {/* 清理规则 */}
                  <div className="bg-muted/50 rounded-xl p-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <RotateCw className="h-4 w-4 text-muted-foreground" />
                      {t("settingsCleanupRules")}
                    </h4>
                    <div className="space-y-4">
                      {/* 保留时间 */}
                      <div className="space-y-2">
                        <Label htmlFor="retention_hours" className="text-sm flex items-center gap-2">
                          <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                          {t("settingsRetentionHours")}
                        </Label>
                        <div className="relative">
                          <Input
                            id="retention_hours"
                            type="number"
                            min={0}
                            max={8760}
                            className="pr-16"
                            value={settingsForm.retention_hours}
                            onChange={(e) => setSettingsForm(prev => ({ ...prev, retention_hours: parseInt(e.target.value) || 0 }))}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            {t("settingsHoursUnit")}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t("settingsRetentionHoursDesc")}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 容量限制 */}
                  <div className="bg-muted/50 rounded-xl p-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      {t("settingsCapacityLimits")}
                    </h4>
                    <div className="space-y-4">
                      {/* 最大条目数 */}
                      <div className="space-y-2">
                        <Label htmlFor="max_entries_per_dir" className="text-sm flex items-center gap-2">
                          <Files className="h-3.5 w-3.5 text-muted-foreground" />
                          {t("settingsMaxEntries")}
                        </Label>
                        <div className="relative">
                          <Input
                            id="max_entries_per_dir"
                            type="number"
                            min={0}
                            max={100000}
                            className="pr-12"
                            value={settingsForm.max_entries_per_dir}
                            onChange={(e) => setSettingsForm(prev => ({ ...prev, max_entries_per_dir: parseInt(e.target.value) || 0 }))}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            {t("settingsItemsUnit")}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t("settingsMaxEntriesDesc")}
                        </p>
                      </div>

                      {/* 最大空间 */}
                      <div className="space-y-2">
                        <Label htmlFor="max_bytes_per_dir_mb" className="text-sm flex items-center gap-2">
                          <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                          {t("settingsMaxBytes")}
                        </Label>
                        <div className="relative">
                          <Input
                            id="max_bytes_per_dir_mb"
                            type="number"
                            min={0}
                            max={102400}
                            className="pr-12"
                            value={settingsForm.max_bytes_per_dir_mb}
                            onChange={(e) => setSettingsForm(prev => ({ ...prev, max_bytes_per_dir_mb: parseInt(e.target.value) || 0 }))}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            MB
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t("settingsMaxBytesDesc")}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 自动清理 */}
                  <div className="bg-muted/50 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        <Sparkles className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div className="space-y-1">
                          <Label htmlFor="auto_clean_enabled" className="font-medium">
                            {t("settingsAutoClean")}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {t("settingsAutoCleanDesc")}
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="auto_clean_enabled"
                        checked={settingsForm.auto_clean_enabled}
                        onCheckedChange={(checked) => setSettingsForm(prev => ({ ...prev, auto_clean_enabled: checked }))}
                      />
                    </div>
                  </div>

                  {/* 提示 */}
                  <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-xl p-3">
                    <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>{t("settingsDefaultHint")}</span>
                  </div>
                </div>
              )}

              <SheetFooter className="pt-4 border-t mt-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetSettings}
                  disabled={settingsSaving || settingsLoading || settings?.is_default}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {t("settingsReset")}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveSettings}
                  disabled={settingsSaving || settingsLoading}
                >
                  {settingsSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("settingsSave")}
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0 h-full overflow-hidden">
        {/* 统计卡片 */}
        {isInitialLoading || (loading && trashItems.length === 0) ? (
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
                <CardTitle className="text-sm font-medium">{t("statsTotalItems")}</CardTitle>
                <FileStack className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.total}</div>
                <p className="text-xs text-muted-foreground">{t("statsTotalItemsDesc")}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("statsTotalSize")}</CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {formatFileSize(statistics.totalSize)}
                </div>
                <p className="text-xs text-muted-foreground">{t("statsTotalSizeDesc")}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("statsFiles")}</CardTitle>
                <File className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{statistics.fileCount}</div>
                <p className="text-xs text-muted-foreground">{t("statsFilesDesc")}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("statsFolders")}</CardTitle>
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">{statistics.folderCount}</div>
                <p className="text-xs text-muted-foreground">{t("statsFoldersDesc")}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 回收站列表 */}
        <DataTable
          data={trashItems}
          columns={columns}
          loading={isInitialLoading || loading}
          pageCount={pageCount}
          pageSize={pageSize}
          totalRows={total}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setCurrentPage(1)
          }}
          emptyMessage={t("empty")}
          enableRowSelection={filterStatus === "active"}
          toolbar={(table) => (
            <DataTableToolbar
              table={table}
              searchKey="original_name"
              searchPlaceholder={t("searchPlaceholder")}
              showRefresh={false}
              filterSlot={
                <>
                  {/* 服务器筛选 */}
                  <Select
                    value={filterServerId}
                    onValueChange={(value) => {
                      setFilterServerId(value)
                      setCurrentPage(1)
                    }}
                    disabled={isInitialLoading}
                  >
                    <SelectTrigger className="h-8 w-[160px] border-dashed">
                      <Server className="mr-2 h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder={t("filterServer")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("filterAllServers")}</SelectItem>
                      {servers.map((server) => (
                        <SelectItem key={server.id} value={server.id}>
                          {server.name || server.host}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* 状态筛选 */}
                  <Select
                    value={filterStatus}
                    onValueChange={(value) => {
                      setFilterStatus(value as TrashItemStatus | "all")
                      setCurrentPage(1)
                    }}
                  >
                    <SelectTrigger className="h-8 w-[140px] border-dashed">
                      <SelectValue placeholder={t("filterStatus")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("statusAll")}</SelectItem>
                      <SelectItem value="active">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-orange-500" />
                          <span>{t("statusActive")}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="restored">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span>{t("statusRestored")}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="purged">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-gray-500" />
                          <span>{t("statusPurged")}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="missing">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-red-500" />
                          <span>{t("statusMissing")}</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </>
              }
            >
              {filterStatus === "active" && statistics.total > 0 && (
                <Button variant="destructive" size="sm" className="h-8" onClick={handleEmptyTrash}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("emptyTrash")}
                </Button>
              )}
              <Button variant="outline" size="sm" className="h-8" onClick={loadTrash} disabled={isInitialLoading || loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                {t("refresh")}
              </Button>
              <Button variant="outline" size="sm" className="h-8" onClick={() => setSettingsOpen(true)}>
                <Settings className="mr-2 h-4 w-4" />
                {t("settings")}
              </Button>
            </DataTableToolbar>
          )}
          batchActions={() =>
            selectedItems.size > 0 && filterStatus === "active" ? (
              <>
                <span className="text-sm text-muted-foreground mr-2">
                  {t("selectedItems", { count: selectedItems.size })}
                </span>
                <Button variant="outline" size="sm" onClick={handleBatchRestore}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {t("batchRestore")}
                </Button>
                <Button variant="destructive" size="sm" onClick={handleBatchDelete}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("batchDelete")}
                </Button>
              </>
            ) : null
          }
        />
      </div>

      {/* 确认对话框 */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
      />
    </>
  )
}
