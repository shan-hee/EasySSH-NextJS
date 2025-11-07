"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, Activity, ArrowUpDown, ArrowDownUp } from "lucide-react"
import { sshSessionsApi, type SSHSession, type SSHSessionStatistics } from "@/lib/api/ssh-sessions"
import { toast } from "@/components/ui/sonner"
import { DataTable } from "@/components/ui/data-table"
import { DataTableToolbar } from "@/components/ui/data-table-toolbar"
import { createSessionColumns } from "./components/session-columns"

// 格式化数据传输量
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

export default function ServersHistoryPage() {
  const [sessions, setSessions] = useState<SSHSession[]>([])
  const [statistics, setStatistics] = useState<SSHSessionStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // 获取 token
  const getToken = () => {
    return localStorage.getItem("easyssh_access_token") || ""
  }

  // 加载数据
  const loadData = useCallback(async (currentPage: number, currentPageSize: number) => {
    try {
      const isInitialLoad = loading
      if (!isInitialLoad) {
        setRefreshing(true)
      }

      const token = getToken()

      // 并行加载会话列表和统计信息
      const [sessionsResponse, statsResponse] = await Promise.all([
        sshSessionsApi.list(token, {
          page: currentPage,
          limit: currentPageSize,
        }),
        sshSessionsApi.getStatistics(token),
      ])

      // 确保 data 是数组
      const sessionData = Array.isArray(sessionsResponse.data)
        ? sessionsResponse.data
        : []
      setSessions(sessionData)
      setTotalPages(sessionsResponse.total_pages || 1)
      setTotalCount(sessionsResponse.total || 0)
      setStatistics(statsResponse.data)
    } catch (error: any) {
      toast.error(error.message || "无法加载历史连接")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [loading])

  // 初始加载
  useEffect(() => {
    loadData(page, pageSize)
  }, [])

  // 刷新数据
  const handleRefresh = async () => {
    await loadData(page, pageSize)
  }

  // 页码变化 - 使用 useCallback 稳定函数引用
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage)
    loadData(newPage, pageSize)
  }, [pageSize, loadData])

  // 每页数量变化 - 使用 useCallback 稳定函数引用
  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize)
    setPage(1) // 重置到第一页
    loadData(1, newPageSize)
  }, [loadData])

  // 删除会话记录
  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这条会话记录吗？")) {
      return
    }

    try {
      const token = getToken()
      await sshSessionsApi.delete(token, id)
      toast.success("会话记录已删除")
      await loadData(page, pageSize)
    } catch (error: any) {
      toast.error(error.message || "无法删除会话记录")
    }
  }

  // 导出会话数据
  const handleExportSession = (session: SSHSession) => {
    const data = {
      sessionId: session.session_id,
      clientIp: session.client_ip,
      clientPort: session.client_port,
      terminalType: session.terminal_type,
      status: session.status,
      connectedAt: session.connected_at,
      disconnectedAt: session.disconnected_at,
      duration: session.duration,
      bytesSent: session.bytes_sent,
      bytesReceived: session.bytes_received,
      errorMessage: session.error_message,
      exportTime: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `session-${session.session_id.substring(0, 8)}-export.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("会话数据已导出")
  }

  // 创建列定义
  const columns = createSessionColumns({
    onExport: handleExportSession,
    onDelete: handleDelete,
  })

  // 状态筛选选项
  const statusFilters = [
    {
      column: "status",
      title: "状态",
      options: [
        { label: "活动", value: "active" },
        { label: "已关闭", value: "closed" },
        { label: "超时", value: "timeout" },
      ],
    },
  ]

  return (
    <>
      <PageHeader title="历史连接" />

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0 h-full overflow-hidden">
        {/* 统计卡片 */}
        <div className="grid gap-4 md:grid-cols-4 shrink-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总会话</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statistics?.total_sessions || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                活动 {statistics?.active_sessions || 0} 个
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">已关闭</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">
                {statistics?.closed_sessions || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                历史会话
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">上传流量</CardTitle>
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {formatBytes(statistics?.total_bytes_sent || 0)}
              </div>
              <p className="text-xs text-muted-foreground">总计发送</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">下载流量</CardTitle>
              <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatBytes(statistics?.total_bytes_received || 0)}
              </div>
              <p className="text-xs text-muted-foreground">总计接收</p>
            </CardContent>
          </Card>
        </div>

        {/* DataTable */}
        <DataTable
          data={sessions}
          columns={columns}
          loading={loading || refreshing}
          pageCount={totalPages}
          pageSize={pageSize}
          totalRows={totalCount}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          emptyMessage="暂无历史会话记录"
          toolbar={(table) => (
            <DataTableToolbar
              table={table}
              searchKey="client_ip"
              searchPlaceholder="搜索客户端IP..."
              filters={statusFilters}
              onRefresh={handleRefresh}
              showRefresh={true}
            />
          )}
        />
      </div>
    </>
  )
}
