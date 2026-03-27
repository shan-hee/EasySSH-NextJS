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
  Calendar,
  Play,
  Pause,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Zap,
  MoreHorizontal,
  Terminal,
  FileText,
} from "lucide-react"
import { type ScheduledTask } from "@/lib/api"

interface ScheduledTaskColumnsOptions {
  onToggle: (taskId: string, enabled: boolean) => void
  onTrigger: (taskId: string) => void
  onEdit: (task: ScheduledTask) => void
  onDelete: (taskId: string) => void
  formatDate: (dateString: string | undefined) => string
}

type I18nValues = Record<string, string | number | Date>
type I18nT = (key: string, values?: I18nValues) => string

/**
 * 获取任务类型图标
 */
function getTypeIcon(type: string) {
  switch (type) {
    case "command":
      return <Terminal className="h-4 w-4" />
    case "script":
      return <FileText className="h-4 w-4" />
    case "batch":
      return <Zap className="h-4 w-4" />
    default:
      return <Calendar className="h-4 w-4" />
  }
}

/**
 * 计算成功率
 */
function calculateSuccessRate(task: ScheduledTask): string {
  if (task.run_count === 0) return "100.0"
  const successCount = task.run_count - task.failure_count
  return ((successCount / task.run_count) * 100).toFixed(1)
}

/**
 * 创建定时任务表格列定义
 */
export function createScheduledTaskColumns(
  t: I18nT,
  options: ScheduledTaskColumnsOptions
): ColumnDef<ScheduledTask>[] {
  const { onToggle, onTrigger, onEdit, onDelete, formatDate } = options

  return [
    // 任务名称列
    {
      id: "task_name",
      accessorKey: "task_name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="px-2"
        >
          {t("tableColTaskName")}
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
        const task = row.original
        return (
          <div className="flex flex-col">
            <span className="font-medium">{task.task_name}</span>
            {task.description && (
              <span className="text-xs text-muted-foreground line-clamp-1">
                {task.description}
              </span>
            )}
          </div>
        )
      },
    },

    // 类型列
    {
      id: "task_type",
      accessorKey: "task_type",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="px-2"
        >
          {t("tableColType")}
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
        const type = row.getValue("task_type") as string
        const typeLabels: Record<string, string> = {
          command: t("typeCommand"),
          script: t("typeScript"),
          batch: t("typeBatch"),
        }
        return (
          <div className="flex items-center gap-2">
            {getTypeIcon(type)}
            <span className="text-sm">{typeLabels[type] || type}</span>
          </div>
        )
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },

    // Cron表达式列
    {
      id: "cron_expression",
      accessorKey: "cron_expression",
      header: t("tableColCron"),
      cell: ({ row }) => {
        const cron = row.getValue("cron_expression") as string
        return (
          <code className="text-xs bg-muted px-2 py-1 rounded">
            {cron}
          </code>
        )
      },
    },

    // 状态列
    {
      id: "enabled",
      accessorKey: "enabled",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="px-2"
        >
          {t("tableColStatus")}
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
        const task = row.original
        if (!task.enabled) {
          return <Badge variant="secondary">{t("statusDisabled")}</Badge>
        }
        if (task.last_status === "success") {
          return <Badge className="bg-green-100 text-green-800">{t("statusRunning")}</Badge>
        } else if (task.last_status === "failed") {
          return <Badge className="bg-red-100 text-red-800">{t("statusFailed")}</Badge>
        }
        return <Badge className="bg-blue-100 text-blue-800">{t("statusPending")}</Badge>
      },
      filterFn: (row, id, value) => {
        const enabled = row.getValue(id) as boolean
        if (value.includes("enabled") && enabled) return true
        if (value.includes("disabled") && !enabled) return true
        return false
      },
    },

    // 上次运行列
    {
      id: "last_run_at",
      accessorKey: "last_run_at",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="px-2"
        >
          {t("tableColLastRun")}
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
        const task = row.original
        return (
          <div className="flex flex-col text-sm">
            <span>{formatDate(task.last_run_at)}</span>
            {task.last_status && (
              <div className="flex items-center gap-1 mt-1">
                {task.last_status === "success" ? (
                  <CheckCircle className="h-3 w-3 text-green-600" />
                ) : (
                  <XCircle className="h-3 w-3 text-red-600" />
                )}
                <span className="text-xs text-muted-foreground">
                  {task.last_status === "success" ? t("lastStatusSuccess") : t("lastStatusFailed")}
                </span>
              </div>
            )}
          </div>
        )
      },
    },

    // 下次运行列
    {
      id: "next_run_at",
      accessorKey: "next_run_at",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="px-2"
        >
          {t("tableColNextRun")}
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
        const nextRun = row.getValue("next_run_at") as string
        return <span className="text-sm">{formatDate(nextRun)}</span>
      },
    },

    // 运行次数列
    {
      id: "run_count",
      accessorKey: "run_count",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="px-2"
        >
          {t("tableColRunCount")}
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
        const count = row.getValue("run_count") as number
        return <span className="text-sm text-center block">{count}</span>
      },
    },

    // 成功率列
    {
      id: "success_rate",
      accessorFn: (row) => calculateSuccessRate(row),
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="px-2"
        >
          {t("tableColSuccessRate")}
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
        const rate = calculateSuccessRate(row.original)
        return <span className="text-sm text-center block">{rate}%</span>
      },
    },

    // 操作列
    {
      id: "actions",
      header: () => <div className="text-right">{t("tableColActions")}</div>,
      cell: ({ row }) => {
        const task = row.original
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggle(task.id, task.enabled)}
              className="h-8 w-8 p-0"
              title={task.enabled ? t("tooltipToggleDisable") : t("tooltipToggleEnable")}
            >
              {task.enabled ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onTrigger(task.id)}>
                  <Zap className="mr-2 h-4 w-4" />
                  {t("actionImmediateRun")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(task)}>
                  <Edit className="mr-2 h-4 w-4" />
                  {t("actionEdit")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(task.id)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("actionDelete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]
}
