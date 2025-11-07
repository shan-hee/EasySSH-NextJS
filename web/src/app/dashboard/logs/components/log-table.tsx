import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, Loader2 } from "lucide-react"
import { AuditLog } from "@/lib/api/audit-logs"

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

// 格式化时间
function formatTimestamp(timestamp: string): { date: string; time: string } {
  const date = new Date(timestamp)
  return {
    date: date.toLocaleDateString('zh-CN'),
    time: date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
}

// 格式化时长
function formatDuration(seconds: number | undefined): string {
  if (!seconds) return '-'
  if (seconds < 60) return `${seconds}秒`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}分${remainingSeconds}秒`
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
        暂无日志记录
      </div>
    )
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>时间</TableHead>
              <TableHead>用户</TableHead>
              {showActions && <TableHead>操作</TableHead>}
              <TableHead>资源</TableHead>
              <TableHead>状态</TableHead>
              {showServer && <TableHead>服务器</TableHead>}
              <TableHead>IP地址</TableHead>
              <TableHead>详情</TableHead>
              {showDuration && <TableHead>耗时</TableHead>}
              {customColumns.map(col => (
                <TableHead key={col.key}>{col.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.map(log => {
              const { date, time } = formatTimestamp(log.created_at)
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
                      {log.status === "success" ? "成功" : "失败"}
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
                      {formatDuration(log.duration)}
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
            第 {page} 页，共 {totalPages} 页
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            >
              下一页
            </Button>
          </div>
        </div>
      )}
    </>
  )
}