import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, ArrowUp, ArrowDown, Clock, User, Server, Globe, AlertTriangle, CheckCircle } from "lucide-react"
import { AuditLog } from "@/lib/api/logs"
import {
  getActionColor,
  formatTimestamp,
} from "@/components/ui/data-table"

type I18nValues = Record<string, string | number | Date>
type I18nT = (key: string, values?: I18nValues) => string

/**
 * 根据传入的多语言函数创建操作日志表格列定义。
 * 将 `useTranslations("logsAudit")` 写在调用方组件中，再把 `t` 传进来。
 */
function getActionLabel(
  t: (key: string) => string,
  action: string,
): string {
  const labelMap: Record<string, string> = {
    login: t("actionLogin"),
    logout: t("actionLogout"),
    ssh_connect: t("actionConnect"),
    ssh_disconnect: t("actionDisconnect"),
    sftp_upload: t("actionUpload"),
    sftp_download: t("actionDownload"),
    sftp_delete: t("actionDelete"),
    sftp_rename: t("actionRename"),
    sftp_mkdir: t("actionMkdir"),
    monitoring_query: t("actionMonitoringQuery"),
    server_create: t("actionServerCreate"),
    server_update: t("actionServerUpdate"),
    server_delete: t("actionServerDelete"),
    server_test: t("actionServerTest"),
    user_create: t("actionUserCreate"),
    user_update: t("actionUserUpdate"),
    user_delete: t("actionUserDelete"),
    connect: t("actionConnect"),
    disconnect: t("actionDisconnect"),
    upload: t("actionUpload"),
    download: t("actionDownload"),
    delete: t("actionDelete"),
    create: t("actionCreate"),
    update: t("actionUpdate"),
  }
  return labelMap[action] || action
}

function getResourceLabel(
  t: (key: string) => string,
  resource: string,
): string {
  const labelMap: Record<string, string> = {
    server: t("resourceServer"),
    file: t("resourceFile"),
    user: t("resourceUser"),
    system: t("resourceSystem"),
    session: t("resourceSession"),
  }
  return labelMap[resource] || resource
}

function formatDurationWithI18n(
  t: I18nT,
  milliseconds: number | undefined,
): string {
  if (!milliseconds) return "-"
  if (milliseconds < 1000) return t("durationMilliseconds", { milliseconds })
  const seconds = Math.round(milliseconds / 1000)
  if (seconds < 60) return t("durationSeconds", { seconds })
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return t("durationMinutesSeconds", {
    minutes,
    seconds: remainingSeconds,
  })
}

export function createAuditLogColumns(
  t: I18nT,
): ColumnDef<AuditLog>[] {
  return [
  // 类别列
  {
    id: "category",
    accessorKey: "category",
    header: t("columnCategory"),
    cell: ({ row }) => {
      const category = row.getValue("category") as string
      return (
        <Badge variant="outline">
          {category === "activity" ? t("categoryActivity") : t("categoryAudit")}
        </Badge>
      )
    },
  },

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
            {t("columnTime")}
          </div>
          {column.getIsSorted() === "asc" ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === "desc" ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
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
          {t("columnUser")}
        </div>
        {column.getIsSorted() === "asc" ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : column.getIsSorted() === "desc" ? (
          <ArrowDown className="ml-2 h-4 w-4" />
        ) : (
          <ArrowUpDown className="ml-2 h-4 w-4" />
        )}
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
        {t("columnAction")}
        {column.getIsSorted() === "asc" ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : column.getIsSorted() === "desc" ? (
          <ArrowDown className="ml-2 h-4 w-4" />
        ) : (
          <ArrowUpDown className="ml-2 h-4 w-4" />
        )}
      </Button>
    ),
    cell: ({ row }) => {
      const action = row.getValue("action") as string
      return (
        <Badge className={getActionColor(action)}>
          {getActionLabel(t, action)}
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
        {t("columnResource")}
        {column.getIsSorted() === "asc" ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : column.getIsSorted() === "desc" ? (
          <ArrowDown className="ml-2 h-4 w-4" />
        ) : (
          <ArrowUpDown className="ml-2 h-4 w-4" />
        )}
      </Button>
    ),
    cell: ({ row }) => {
      const resource = row.getValue("resource") as string
      return (
        <Badge variant="outline">
          {getResourceLabel(t, resource)}
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
        {t("columnStatus")}
        {column.getIsSorted() === "asc" ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : column.getIsSorted() === "desc" ? (
          <ArrowDown className="ml-2 h-4 w-4" />
        ) : (
          <ArrowUpDown className="ml-2 h-4 w-4" />
        )}
      </Button>
    ),
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      const isSuccess = status === "success"
      const isWarning = status === "warning"
      return (
        <div className="flex items-center gap-2">
          {isSuccess ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : isWarning ? (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          )}
          <Badge
            className={
              isSuccess
                ? "bg-green-100 text-green-800 border-green-200"
                : isWarning
                  ? "bg-amber-100 text-amber-800 border-amber-200"
                : "bg-red-100 text-red-800 border-red-200"
            }
          >
            {isSuccess
              ? t("filterStatusSuccessLabel")
              : isWarning
                ? t("filterStatusWarningLabel")
                : t("filterStatusFailureLabel")}
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
          {t("columnIp")}
        </div>
        {column.getIsSorted() === "asc" ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : column.getIsSorted() === "desc" ? (
          <ArrowDown className="ml-2 h-4 w-4" />
        ) : (
          <ArrowUpDown className="ml-2 h-4 w-4" />
        )}
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
    header: t("columnDetails"),
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
        {t("columnDuration")}
        {column.getIsSorted() === "asc" ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : column.getIsSorted() === "desc" ? (
          <ArrowDown className="ml-2 h-4 w-4" />
        ) : (
          <ArrowUpDown className="ml-2 h-4 w-4" />
        )}
      </Button>
    ),
    cell: ({ row }) => {
      const duration = row.getValue("duration") as number
      return (
        <div className="font-mono text-sm">
          {formatDurationWithI18n(t, duration)}
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
          {t("columnServer")}
        </div>
        {column.getIsSorted() === "asc" ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : column.getIsSorted() === "desc" ? (
          <ArrowDown className="ml-2 h-4 w-4" />
        ) : (
          <ArrowUpDown className="ml-2 h-4 w-4" />
        )}
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
}
