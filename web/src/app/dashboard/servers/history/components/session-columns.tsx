"use client"

import { ColumnDef } from "@tanstack/react-table"
import { SSHSession } from "@/lib/api/ssh-sessions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, ArrowDownUp, Download, XCircle } from "lucide-react"

// 状态颜色映射
const statusColors = {
  active: "bg-green-100 text-green-800 border-green-200",
  closed: "bg-gray-100 text-gray-800 border-gray-200",
  timeout: "bg-red-100 text-red-800 border-red-200",
}

// 状态标签映射
const statusLabels = {
  active: "活动",
  closed: "已关闭",
  timeout: "超时",
}

// 格式化数据传输量
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

// 格式化时长
function formatDuration(seconds: number | undefined): string {
  if (!seconds) return '-'
  if (seconds < 60) return `${seconds}秒`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}分${remainingSeconds}秒` : `${minutes}分钟`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}小时${remainingMinutes}分钟` : `${hours}小时`
}

// 格式化时间
function formatTimestamp(timestamp: string): { date: string; time: string } {
  const date = new Date(timestamp)
  return {
    date: date.toLocaleDateString('zh-CN'),
    time: date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
}

// 格式化客户端IP
function formatClientIP(ip: string) {
  if (ip === '::1' || ip === '127.0.0.1') {
    return '本地连接'
  }
  return ip
}

interface SessionColumnsOptions {
  onExport?: (session: SSHSession) => void
  onDelete?: (sessionId: string) => void
}

export function createSessionColumns(options?: SessionColumnsOptions): ColumnDef<SSHSession>[] {
  return [
    // 服务器信息列
    {
      accessorKey: "server_name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            服务器
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const session = row.original
        return (
          <div className="text-sm">
            <div className="font-medium">{session.server_name || '未知服务器'}</div>
            <div className="text-xs text-muted-foreground font-mono">{session.server_host || '-'}</div>
          </div>
        )
      },
    },

    // 会话ID列
    {
      accessorKey: "session_id",
      header: "会话ID",
      cell: ({ row }) => {
        const sessionId = row.getValue("session_id") as string
        return (
          <div className="font-mono text-sm">{sessionId.substring(0, 8)}...</div>
        )
      },
    },

    // 客户端信息列
    {
      accessorKey: "client_ip",
      header: "客户端",
      cell: ({ row }) => {
        const session = row.original
        return (
          <div className="text-sm">
            <div className="font-medium">{formatClientIP(session.client_ip)}</div>
            {session.client_port > 0 && (
              <div className="text-xs text-muted-foreground">
                端口: {session.client_port}
              </div>
            )}
          </div>
        )
      },
      filterFn: (row, id, value) => {
        return row.original.client_ip.toLowerCase().includes(value.toLowerCase())
      },
    },

    // 连接时间列
    {
      accessorKey: "connected_at",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            连接时间
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const timestamp = formatTimestamp(row.getValue("connected_at"))
        return (
          <div className="font-mono text-sm">
            <div>{timestamp.time}</div>
            <div className="text-xs text-muted-foreground">{timestamp.date}</div>
          </div>
        )
      },
    },

    // 断开时间列
    {
      accessorKey: "disconnected_at",
      header: "断开时间",
      cell: ({ row }) => {
        const disconnectedAt = row.getValue("disconnected_at") as string | null
        if (!disconnectedAt) {
          return <span className="text-muted-foreground">-</span>
        }
        const timestamp = formatTimestamp(disconnectedAt)
        return (
          <div className="font-mono text-sm">
            <div>{timestamp.time}</div>
            <div className="text-xs text-muted-foreground">{timestamp.date}</div>
          </div>
        )
      },
    },

    // 持续时长列
    {
      accessorKey: "duration",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            时长
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        return (
          <div className="text-sm">{formatDuration(row.getValue("duration"))}</div>
        )
      },
    },

    // 数据传输列
    {
      id: "data_transfer",
      header: "数据传输",
      cell: ({ row }) => {
        const session = row.original
        return (
          <div className="text-sm">
            <div className="flex items-center gap-1 text-blue-600">
              <ArrowUpDown className="h-3 w-3" />
              {formatBytes(session.bytes_sent)}
            </div>
            <div className="flex items-center gap-1 text-green-600">
              <ArrowDownUp className="h-3 w-3" />
              {formatBytes(session.bytes_received)}
            </div>
          </div>
        )
      },
    },

    // 状态列
    {
      accessorKey: "status",
      header: "状态",
      cell: ({ row }) => {
        const session = row.original
        const status = session.status as keyof typeof statusColors
        return (
          <div>
            <Badge className={statusColors[status]}>
              {statusLabels[status]}
            </Badge>
            {session.error_message && (
              <div className="text-xs text-red-600 mt-1">{session.error_message}</div>
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
        const session = row.original
        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => options?.onExport?.(session)}
              className="h-8 w-8 p-0"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => options?.onDelete?.(session.id)}
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
