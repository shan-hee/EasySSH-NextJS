import React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Download, Trash2, Eye, Copy, MoreHorizontal } from "lucide-react"
import { AuditLog } from "@/lib/api/audit-logs"

interface BatchActionsProps {
  selectedLogs: AuditLog[]
  onClearSelection: () => void
  onExportSelected: (format: "csv" | "json") => void
  onDeleteSelected?: () => void
  onViewDetails?: (logs: AuditLog[]) => void
}

export function BatchActions({
  selectedLogs,
  onClearSelection,
  onExportSelected,
  onDeleteSelected,
  onViewDetails,
}: BatchActionsProps) {
  const hasSelection = selectedLogs.length > 0

  if (!hasSelection) {
    return null
  }

  return (
    <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg border">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">
          已选择 {selectedLogs.length} 项
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="h-8 px-2 text-xs"
        >
          清除选择
        </Button>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* 基础操作 */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onExportSelected("csv")}
          className="h-8"
        >
          <Download className="h-4 w-4 mr-1" />
          导出CSV
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onExportSelected("json")}
          className="h-8"
        >
          <Download className="h-4 w-4 mr-1" />
          导出JSON
        </Button>

        {onViewDetails && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDetails(selectedLogs)}
            className="h-8"
          >
            <Eye className="h-4 w-4 mr-1" />
            查看详情
          </Button>
        )}

        {/* 更多操作 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                const text = selectedLogs
                  .map(log => `${log.created_at} - ${log.username} - ${log.action} - ${log.status}`)
                  .join('\n')
                navigator.clipboard.writeText(text)
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              复制到剪贴板
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => onExportSelected("csv")}
              className="text-green-600"
            >
              <Download className="h-4 w-4 mr-2" />
              导出为CSV
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => onExportSelected("json")}
              className="text-blue-600"
            >
              <Download className="h-4 w-4 mr-2" />
              导出为JSON
            </DropdownMenuItem>

            {onViewDetails && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onViewDetails(selectedLogs)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  查看详情
                </DropdownMenuItem>
              </>
            )}

            {onDeleteSelected && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDeleteSelected}
                  className="text-red-600"
                  disabled={selectedLogs.length === 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  删除选中项
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

// 导出工具函数
export function exportLogsToCSV(logs: AuditLog[]): string {
  const headers = [
    '时间',
    '用户',
    '操作',
    '资源',
    '状态',
    'IP地址',
    '详情',
    '耗时'
  ]

  const rows = logs.map(log => [
    new Date(log.created_at).toLocaleString('zh-CN'),
    log.username,
    log.action,
    log.resource,
    log.status === 'success' ? '成功' : '失败',
    log.ip,
    log.details || log.error_msg || '',
    log.duration ? `${log.duration}秒` : ''
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  return csvContent
}

export function exportLogsToJSON(logs: AuditLog[]): string {
  return JSON.stringify(logs, null, 2)
}

export function downloadFile(content: string, filename: string, type: string = 'text/plain') {
  const blob = new Blob([content], { type })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}