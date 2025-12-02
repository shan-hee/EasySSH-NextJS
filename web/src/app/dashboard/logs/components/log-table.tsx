import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, Loader2 } from "lucide-react"
import { AuditLog } from "@/lib/api/audit-logs"
import { useClientAuth } from "@/components/client-auth-provider"
import { useSystemConfig } from "@/hooks/use-system-config"
import { formatInTimezone, getEffectiveLocale, getEffectiveTimezone } from "@/utils/datetime"
import { useTranslations } from "next-intl"

interface LogTableProps {
  logs: AuditLog[]
  filteredLogs: AuditLog[]
  loading: boolean
  searchTerm?: string
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  showActions?: boolean
  showDuration?: boolean
  showServer?: boolean
  actionLabels?: Record<string, string>
  resourceLabels?: Record<string, string>
  statusColors?: Record<string, string>
  actionColors?: Record<string, string>
  customColumns?: Array<{
    key: string
    label: string
    render: (log: AuditLog) => React.ReactNode
  }>
}

// 格式化时长
function formatDuration(
  t: (key: string, values?: Record<string, unknown>) => string,
  seconds: number | undefined,
): string {
  if (!seconds) return "-"
  if (seconds < 60) return t("durationSeconds", { seconds })
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return t("durationMinutesSeconds", {
    minutes,
    seconds: remainingSeconds,
  })
}

export function LogTable({
  logs,
  filteredLogs,
  loading,
  page,
  totalPages,
  onPageChange,
  showActions = true,
  showDuration = true,
  showServer = false,
  actionLabels = {},
  resourceLabels = {},
  statusColors = {
    success: "bg-green-100 text-green-800",
    failure: "bg-red-100 text-red-800",
  },
  actionColors = {},
  customColumns = [],
}: LogTableProps) {
  const { user } = useClientAuth()
  const { data: systemConfig } = useSystemConfig()
  const effectiveLocale = getEffectiveLocale(user, systemConfig || null)
  const effectiveTimezone = getEffectiveTimezone(user, systemConfig || null)
  const t = useTranslations("logsAudit")

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t("emptyMessage")}
      </div>
    )
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columnTime")}</TableHead>
              <TableHead>{t("columnUser")}</TableHead>
              {showActions && <TableHead>{t("columnAction")}</TableHead>}
              <TableHead>{t("columnResource")}</TableHead>
              <TableHead>{t("columnStatus")}</TableHead>
              {showServer && <TableHead>{t("columnServer")}</TableHead>}
              <TableHead>{t("columnIp")}</TableHead>
              <TableHead>{t("columnDetails")}</TableHead>
              {showDuration && <TableHead>{t("columnDuration")}</TableHead>}
              {customColumns.map(col => (
                <TableHead key={col.key}>{col.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.map(log => {
              const full = formatInTimezone(
                log.created_at,
                {},
                effectiveLocale,
                effectiveTimezone,
              )
              const [date, time] = full.split(" ")
              return (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <div>
                        <div>{time}</div>
                        <div className="text-xs text-muted-foreground">{date}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{log.username}</TableCell>
                  {showActions && (
                    <TableCell>
                      <Badge className={actionColors[log.action] || "bg-gray-100 text-gray-800"}>
                        {actionLabels[log.action] || log.action}
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge variant="outline">
                      {resourceLabels[log.resource] || log.resource}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[log.status]}>
                      {log.status === "success"
                        ? t("filterStatusSuccessLabel")
                        : t("filterStatusFailureLabel")}
                    </Badge>
                  </TableCell>
                  {showServer && (
                    <TableCell>
                      {log.server_id || "-"}
                    </TableCell>
                  )}
                  <TableCell className="font-mono text-sm">{log.ip}</TableCell>
                  <TableCell>
                    <div className="max-w-xs">
                      <div className="text-sm truncate" title={log.details || log.error_msg}>
                        {log.details || log.error_msg || "-"}
                      </div>
                      {log.user_agent && (
                        <div className="text-xs text-muted-foreground truncate" title={log.user_agent}>
                          {log.user_agent}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  {showDuration && (
                    <TableCell className="font-mono text-sm">
                      {formatDuration(t, log.duration)}
                    </TableCell>
                  )}
                  {customColumns.map(col => (
                    <TableCell key={col.key}>
                      {col.render(log)}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* 分页 */}
          {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            {/* 简单分页文案，可按需进一步抽到 i18n */}
            {page} / {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              {"<"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            >
              {">"}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
