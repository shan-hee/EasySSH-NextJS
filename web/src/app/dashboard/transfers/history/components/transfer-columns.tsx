"use client"

import { ColumnDef } from "@tanstack/react-table"
import { FileTransfer } from "@/lib/api/file-transfers"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Clock, XCircle, Upload, Download, ArrowUpDown } from "lucide-react"

// 类型颜色映射
const typeColors = {
  upload: "bg-blue-100 text-blue-800 border-blue-200",
  download: "bg-green-100 text-green-800 border-green-200",
}

// 状态颜色映射
const statusColors = {
  completed: "bg-green-100 text-green-800 border-green-200",
  transferring: "bg-blue-100 text-blue-800 border-blue-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
}

// 状态标签映射
const statusLabels = {
  completed: "已完成",
  transferring: "进行中",
  failed: "失败",
  pending: "等待中",
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

// 格式化速度
function formatSpeed(bytesPerSecond: number | undefined): string {
  if (!bytesPerSecond || bytesPerSecond === 0) return '-'
  return `${formatFileSize(bytesPerSecond)}/s`
}

// 格式化时长
function formatDuration(seconds: number | undefined): string {
  if (!seconds) return '-'
  if (seconds < 60) return `${seconds}秒`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}分${remainingSeconds}秒`
}

// 格式化时间
function formatTimestamp(timestamp: string): { date: string; time: string } {
  const date = new Date(timestamp)
  return {
    date: date.toLocaleDateString('zh-CN'),
    time: date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
}

interface TransferColumnsOptions {
  onDelete?: (transferId: string) => void
}

export function createTransferColumns(options?: TransferColumnsOptions): ColumnDef<FileTransfer>[] {
  return [
    // 时间列
    {
      accessorKey: "created_at",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            时间
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const timestamp = formatTimestamp(row.getValue("created_at"))
        return (
          <div className="font-mono text-sm flex items-center gap-2">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <div>
              <div>{timestamp.time}</div>
              <div className="text-xs text-muted-foreground">{timestamp.date}</div>
            </div>
          </div>
        )
      },
    },

    // 类型列
    {
      accessorKey: "transfer_type",
      header: "类型",
      cell: ({ row }) => {
        const type = row.getValue("transfer_type") as "upload" | "download"
        return (
          <Badge className={typeColors[type]}>
            {type === "upload" ? (
              <>
                <Upload className="mr-1 h-3 w-3" />
                上传
              </>
            ) : (
              <>
                <Download className="mr-1 h-3 w-3" />
                下载
              </>
            )}
          </Badge>
        )
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },

    // 文件名列
    {
      accessorKey: "file_name",
      header: "文件名",
      cell: ({ row }) => {
        return <div className="font-medium">{row.getValue("file_name")}</div>
      },
      filterFn: (row, id, value) => {
        const fileName = row.getValue(id) as string
        const transfer = row.original
        const searchValue = value.toLowerCase()
        return (
          fileName.toLowerCase().includes(searchValue) ||
          transfer.source_path.toLowerCase().includes(searchValue) ||
          transfer.dest_path.toLowerCase().includes(searchValue)
        )
      },
    },

    // 大小列
    {
      accessorKey: "file_size",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            大小
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        return (
          <div className="font-mono text-sm">
            {formatFileSize(row.getValue("file_size"))}
          </div>
        )
      },
    },

    // 路径列
    {
      id: "paths",
      header: "路径",
      cell: ({ row }) => {
        const transfer = row.original
        return (
          <div className="text-xs max-w-xs">
            <div className="text-muted-foreground truncate" title={transfer.source_path}>
              源: {transfer.source_path}
            </div>
            <div className="text-muted-foreground truncate" title={transfer.dest_path}>
              目标: {transfer.dest_path}
            </div>
          </div>
        )
      },
    },

    // 速度列
    {
      accessorKey: "speed",
      header: "速度",
      cell: ({ row }) => {
        return (
          <div className="font-mono text-sm">
            {formatSpeed(row.getValue("speed"))}
          </div>
        )
      },
    },

    // 状态列
    {
      accessorKey: "status",
      header: "状态",
      cell: ({ row }) => {
        const transfer = row.original
        const status = transfer.status as keyof typeof statusColors
        return (
          <div>
            <Badge className={statusColors[status]}>
              {statusLabels[status]}
            </Badge>
            {transfer.status === "transferring" && (
              <div className="mt-1 min-w-[100px]">
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${transfer.progress}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{transfer.progress}%</div>
              </div>
            )}
            {transfer.error_message && (
              <div className="text-xs text-red-600 mt-1">{transfer.error_message}</div>
            )}
            {transfer.duration && transfer.status === "completed" && (
              <div className="text-xs text-muted-foreground mt-1">
                耗时: {formatDuration(transfer.duration)}
              </div>
            )}
          </div>
        )
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },

    // 操作列
    {
      id: "actions",
      header: () => <div className="text-right">操作</div>,
      cell: ({ row }) => {
        const transfer = row.original
        return (
          <div className="flex items-center justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => options?.onDelete?.(transfer.id)}
              className="h-8 w-8 p-0"
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        )
      },
      enableSorting: false,
      enableHiding: false,
    },
  ]
}
