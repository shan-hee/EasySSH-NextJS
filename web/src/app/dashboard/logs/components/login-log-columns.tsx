import React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, Clock, User, Globe, Monitor, AlertTriangle, CheckCircle, Wifi } from "lucide-react"
import { AuditLog } from "@/lib/api/audit-logs"
import {
  formatTimestamp,
  isInternalIP,
  parseUserAgent
} from "@/components/ui/data-table"

export const loginLogColumns: ColumnDef<AuditLog>[] = [

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
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <div className="font-medium">{username}</div>
        </div>
      )
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
      const isInternal = isInternalIP(ip)
      return (
        <div className="flex items-center gap-2">
          <div className={`font-mono text-sm ${isInternal ? "text-green-600" : "text-orange-600"}`}>
            {ip}
          </div>
          {!isInternal && (
            <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
              外网
            </Badge>
          )}
        </div>
      )
    },
  },

  // 位置列
  {
    id: "location",
    accessorKey: "location",
    header: "位置",
    cell: ({ row }) => {
      const ip = row.getValue("ip") as string
      const isInternal = isInternalIP(ip)
      return (
        <div className="flex items-center gap-2">
          <Wifi className={`h-4 w-4 ${isInternal ? "text-green-600" : "text-orange-600"}`} />
          <Badge
            variant="outline"
            className={
              isInternal
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-orange-50 text-orange-700 border-orange-200"
            }
          >
            {isInternal ? "内部网络" : "外部网络"}
          </Badge>
        </div>
      )
    },
    enableSorting: false,
  },

  // 浏览器列
  {
    id: "user_agent",
    accessorKey: "user_agent",
    header: "浏览器",
    cell: ({ row }) => {
      const userAgent = row.getValue("user_agent") as string
      const browser = parseUserAgent(userAgent)
      return (
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-muted-foreground" />
          <div className="text-sm">{browser}</div>
        </div>
      )
    },
    enableSorting: false,
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
          {log.error_msg ? (
            <div className="text-sm text-red-600 truncate" title={log.error_msg}>
              {log.error_msg}
            </div>
          ) : log.details ? (
            <div className="text-sm truncate" title={log.details}>
              {log.details}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">-</div>
          )}
          {log.user_agent && (
            <div
              className="text-xs text-muted-foreground truncate mt-1"
              title={log.user_agent}
            >
              {log.user_agent}
            </div>
          )}
        </div>
      )
    },
  },
]