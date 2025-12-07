import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Eye,
  RefreshCw,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  AlertTriangle,
} from "lucide-react"
import { type TaskExecution } from "@/lib/api"

interface ExecutionHistoryColumnsOptions {
  onViewDetails: (execution: TaskExecution) => void
  onRetry: (execution: TaskExecution) => void
  onDownloadOutput: (execution: TaskExecution) => void
  getTriggerTypeLabel: (type: string) => string
  formatDate: (dateString: string) => string
  formatDuration: (ms: number) => string
}

const triggerTypeColors: Record<string, string> = {
  schedule: "bg-blue-50 text-blue-700 border-blue-200",
  manual: "bg-green-50 text-green-700 border-green-200",
}

/**
 * 创建执行记录表格列定义
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createExecutionHistoryColumns(
  t: (key: string, values?: any) => string,
  options: ExecutionHistoryColumnsOptions
): ColumnDef<TaskExecution>[] {
  const { onViewDetails, onRetry, onDownloadOutput, getTriggerTypeLabel, formatDate, formatDuration } = options

  return [
    // 任务信息列
    {
      id: "task_name",
      accessorKey: "task_name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="px-2"
        >
          {t("colTaskInfo")}
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
        const execution = row.original
        return (
          <div>
            <div className="flex items-center gap-2">
              <div className="font-medium">{execution.task_name}</div>
              <Badge
                variant="outline"
                className={triggerTypeColors[execution.trigger_type] || ""}
              >
                {getTriggerTypeLabel(execution.trigger_type)}
              </Badge>
            </div>
            <div className="mt-1 text-xs font-mono text-muted-foreground line-clamp-1">
              {execution.command}
            </div>
          </div>
        )
      },
    },

    // 服务器列
    {
      id: "server",
      accessorFn: (row) => `${row.success_count}/${row.total_servers}`,
      header: t("colServer"),
      cell: ({ row }) => {
        const execution = row.original
        return (
          <div className="text-sm">
            <span className="text-green-600">{execution.success_count}</span>
            <span className="text-muted-foreground"> / </span>
            <span>{execution.total_servers}</span>
            <span className="text-muted-foreground ml-1">台</span>
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
          {t("colStatus")}
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
        const getStatusIcon = () => {
          switch (status) {
            case "success":
              return <CheckCircle className="h-4 w-4 text-green-600" />
            case "failed":
              return <XCircle className="h-4 w-4 text-red-600" />
            case "running":
            case "pending":
              return <Clock className="h-4 w-4 text-blue-600 animate-spin" />
            case "partial":
              return <AlertTriangle className="h-4 w-4 text-yellow-600" />
            default:
              return <Clock className="h-4 w-4 text-muted-foreground" />
          }
        }
        const getStatusBadge = () => {
          switch (status) {
            case "success":
              return <Badge className="bg-green-100 text-green-800">{t("statusSuccess")}</Badge>
            case "failed":
              return <Badge className="bg-red-100 text-red-800">{t("statusFailed")}</Badge>
            case "running":
              return <Badge className="bg-blue-100 text-blue-800">{t("statusRunning")}</Badge>
            case "partial":
              return <Badge className="bg-yellow-100 text-yellow-800">{t("statusPartial")}</Badge>
            default:
              return <Badge variant="secondary">{status}</Badge>
          }
        }
        return (
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            {getStatusBadge()}
          </div>
        )
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },

    // 执行时间列
    {
      id: "start_time",
      accessorKey: "start_time",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="px-2"
        >
          {t("colTime")}
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
        const startTime = row.getValue("start_time") as string
        return (
          <div className="flex items-center gap-2">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <div className="text-sm">{formatDate(startTime)}</div>
          </div>
        )
      },
    },

    // 耗时列
    {
      id: "duration",
      accessorKey: "duration",
      header: t("colDuration"),
      cell: ({ row }) => {
        const execution = row.original
        const isRunning = execution.status === "running" || execution.status === "pending"
        return (
          <div>
            <div className="text-sm font-mono">
              {isRunning ? t("statusRunning") : formatDuration(execution.duration)}
            </div>
          </div>
        )
      },
    },

    // 执行者列
    {
      id: "username",
      accessorKey: "username",
      header: t("colUser"),
      cell: ({ row }) => {
        const username = row.getValue("username") as string
        return <div className="text-sm">{username || "-"}</div>
      },
    },

    // 触发类型列（用于筛选，不显示）
    {
      id: "trigger_type",
      accessorKey: "trigger_type",
      header: () => null,
      cell: () => null,
      enableHiding: true,
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },

    // 任务类型列（用于筛选，不显示）
    {
      id: "task_type",
      accessorKey: "task_type",
      header: () => null,
      cell: () => null,
      enableHiding: true,
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },

    // 操作列
    {
      id: "actions",
      header: () => <div className="text-right">{t("colActions")}</div>,
      cell: ({ row }) => {
        const execution = row.original
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onViewDetails(execution)}>
                  <Eye className="mr-2 h-4 w-4" />
                  {t("actionViewDetails")}
                </DropdownMenuItem>
                {execution.status === "failed" && (
                  <DropdownMenuItem onClick={() => onRetry(execution)}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t("actionRetry")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onDownloadOutput(execution)}>
                  <Download className="mr-2 h-4 w-4" />
                  {t("actionDownloadOutput")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]
}
