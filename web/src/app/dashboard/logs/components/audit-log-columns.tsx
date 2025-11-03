import React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, Clock, User, Server, Globe, AlertTriangle, CheckCircle } from "lucide-react"
import { AuditLog } from "@/lib/api/audit-logs"
import {
  getActionColor,
  getActionLabel,
  getResourceLabel,
  formatTimestamp,
  formatDuration
} from "@/components/ui/data-table"

export const auditLogColumns: ColumnDef<AuditLog>[] = [

  // 时间列
  {
    id: "created_at",
    accessorKey: "created_at",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="px-2"
        >
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            时间
          </div>
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const timestamp = row.getValue("created_at") as string
      const { date, time } = formatTimestamp(timestamp)
      return (
        <div className="font-mono text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <div>
              <div>{time}</div>
              <div className="text-xs text-muted-foreground">{date}</div>
            </div>
          </div>
        </div>
      )
    },
  },

  // 用户列
  {
    id: "username",
    accessorKey: "username",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="px-2"
      >
        <div className="flex items-center gap-2">
          <User className="h-4 w-4" />
          用户
        </div>
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const username = row.getValue("username") as string
      return (
        <div className="font-medium">{username}</div>
      )
    },
  },

  // 操作列
  {
    id: "action",
    accessorKey: "action",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="px-2"
      >
        操作
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const action = row.getValue("action") as string
      return (
        <Badge className={getActionColor(action)}>
          {getActionLabel(action)}
        </Badge>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },

  // 资源列
  {
    id: "resource",
    accessorKey: "resource",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="px-2"
      >
        资源
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const resource = row.getValue("resource") as string
      return (
        <Badge variant="outline">
          {getResourceLabel(resource)}
        </Badge>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },

  // 状态列
  {
    id: "status",
    accessorKey: "status",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="px-2"
      >
        状态
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      const isSuccess = status === "success"
      return (
        <div className="flex items-center gap-2">
          {isSuccess ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          )}
          <Badge
            className={
              isSuccess
                ? "bg-green-100 text-green-800 border-green-200"
                : "bg-red-100 text-red-800 border-red-200"
            }
          >
            {isSuccess ? "成功" : "失败"}
          </Badge>
        </div>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },

  // IP地址列
  {
    id: "ip",
    accessorKey: "ip",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="px-2"
      >
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          IP地址
        </div>
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const ip = row.getValue("ip") as string
      return (
        <div className="font-mono text-sm">{ip}</div>
      )
    },
  },

  // 详情列
  {
    id: "details",
    accessorKey: "details",
    header: "详情",
    cell: ({ row }) => {
      const log = row.original
      return (
        <div className="max-w-xs">
          <div
            className="text-sm truncate"
            title={log.details || log.error_msg}
          >
            {log.details || log.error_msg || "-"}
          </div>
          {log.user_agent && (
            <div
              className="text-xs text-muted-foreground truncate"
              title={log.user_agent}
            >
              {log.user_agent}
            </div>
          )}
        </div>
      )
    },
  },

  // 耗时列
  {
    id: "duration",
    accessorKey: "duration",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="px-2"
      >
        耗时
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const duration = row.getValue("duration") as number
      return (
        <div className="font-mono text-sm">
          {formatDuration(duration)}
        </div>
      )
    },
  },

  // 服务器列（可选）
  {
    id: "server_id",
    accessorKey: "server_id",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="px-2"
      >
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4" />
          服务器
        </div>
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const serverId = row.getValue("server_id") as string
      return (
        <div className="font-mono text-sm">
          {serverId || "-"}
        </div>
      )
    },
    enableHiding: true,
  },
]