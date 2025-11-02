"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, RefreshCw, Clock, Activity, Database, ArrowUpDown, ArrowDownUp, Loader2, XCircle, Download } from "lucide-react"
import { sshSessionsApi, type SSHSession, type SSHSessionStatistics } from "@/lib/api/ssh-sessions"
import { toast } from "@/components/ui/sonner"

const statusColors = {
  active: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
  timeout: "bg-red-100 text-red-800",
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

export default function ServersHistoryPage() {
  const [sessions, setSessions] = useState<SSHSession[]>([])
  const [statistics, setStatistics] = useState<SSHSessionStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // 获取 token
  const getToken = () => {
    return localStorage.getItem("easyssh_access_token") || ""
  }

  // 加载数据
  const loadData = async () => {
    try {
      setLoading(true)
      const token = getToken()

      // 并行加载会话列表和统计信息
      const [sessionsResponse, statsResponse] = await Promise.all([
        sshSessionsApi.list(token, {
          page,
          limit: 20,
          status: selectedStatus !== "all" ? selectedStatus as any : undefined,
        }),
        sshSessionsApi.getStatistics(token),
      ])

      // 确保 data 是数组
      const sessionData = Array.isArray(sessionsResponse.data)
        ? sessionsResponse.data
        : []
      setSessions(sessionData)
      setTotalPages(sessionsResponse.total_pages || 1)
      setStatistics(statsResponse.data)
    } catch (error: any) {
      toast.error(error.message || "无法加载历史连接")
    } finally {
      setLoading(false)
    }
  }

  // 初始加载和筛选变化时重新加载
  useEffect(() => {
    loadData()
  }, [page, selectedStatus])

  // 客户端搜索过滤
  const filteredSessions = sessions.filter(session => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      session.session_id.toLowerCase().includes(searchLower) ||
      session.client_ip.toLowerCase().includes(searchLower) ||
      session.terminal_type.toLowerCase().includes(searchLower)
    )
  })

  // 删除会话记录
  const handleDelete = async (id: string) => {
    try {
      const token = getToken()
      await sshSessionsApi.delete(token, id)
      toast.success("会话记录已删除")
      loadData()
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
      commandsCount: session.commands_count,
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

  return (
    <>
      <PageHeader title="历史连接">
        <Button variant="outline" size="sm" onClick={() => loadData()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新
        </Button>
      </PageHeader>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* 统计卡片 */}
        <div className="grid gap-4 md:grid-cols-4">
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

        {/* 筛选器 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">筛选器</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="搜索会话ID、客户端IP或终端类型..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有状态</SelectItem>
                    <SelectItem value="active">活动</SelectItem>
                    <SelectItem value="closed">已关闭</SelectItem>
                    <SelectItem value="timeout">超时</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 历史会话表格 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">历史会话记录</CardTitle>
            <CardDescription>
              显示 {filteredSessions.length} 条记录，共 {sessions.length} 条
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无历史会话记录
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>服务器</TableHead>
                      <TableHead>会话ID</TableHead>
                      <TableHead>客户端信息</TableHead>
                      <TableHead>连接时间</TableHead>
                      <TableHead>断开时间</TableHead>
                      <TableHead>持续时长</TableHead>
                      <TableHead>数据传输</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSessions.map(session => {
                      const connectedTime = formatTimestamp(session.connected_at)
                      const disconnectedTime = session.disconnected_at ? formatTimestamp(session.disconnected_at) : null

                      // 格式化客户端IP
                      const formatClientIP = (ip: string) => {
                        if (ip === '::1' || ip === '127.0.0.1') {
                          return '本地连接'
                        }
                        return ip
                      }

                      return (
                        <TableRow key={session.id}>
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-medium">{session.server_name || '未知服务器'}</div>
                              <div className="text-xs text-muted-foreground font-mono">{session.server_host || '-'}</div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {session.session_id.substring(0, 8)}...
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{formatClientIP(session.client_ip)}</div>
                            {session.client_port > 0 && (
                              <div className="text-xs text-muted-foreground">
                                端口: {session.client_port}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            <div>
                              <div>{connectedTime.time}</div>
                              <div className="text-xs text-muted-foreground">{connectedTime.date}</div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {disconnectedTime ? (
                              <div>
                                <div>{disconnectedTime.time}</div>
                                <div className="text-xs text-muted-foreground">{disconnectedTime.date}</div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDuration(session.duration)}
                          </TableCell>
                          <TableCell>
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
                          </TableCell>
                          <TableCell>
                            <div>
                              <Badge className={statusColors[session.status as keyof typeof statusColors]}>
                                {session.status === "active" ? "活动" :
                                  session.status === "closed" ? "已关闭" : "超时"}
                              </Badge>
                              {session.error_message && (
                                <div className="text-xs text-red-600 mt-1">{session.error_message}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleExportSession(session)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(session.id)}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* 分页 */}
            {!loading && totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  第 {page} 页，共 {totalPages} 页
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
