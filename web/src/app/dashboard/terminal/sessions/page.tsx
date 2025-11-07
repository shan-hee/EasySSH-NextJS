"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, RefreshCw, Activity, Server, ArrowUpDown, ArrowDownUp, Loader2, XCircle } from "lucide-react"
import { sshSessionsApi, type SSHSessionDetail, type SSHSessionStatistics } from "@/lib/api/ssh-sessions"
import { toast } from "@/components/ui/sonner"
import { getErrorMessage } from "@/lib/error-utils"

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

export default function TerminalSessionsPage() {
  const [sessions, setSessions] = useState<SSHSessionDetail[]>([])
  const [statistics, setStatistics] = useState<SSHSessionStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  // 获取 token
  const getToken = () => {
    return localStorage.getItem("easyssh_access_token") || ""
  }

  // 加载数据
  const loadData = async () => {
    try {
      setLoading(true)
      const token = getToken()

      // 并行加载活动会话列表和统计信息
      const [sessionsResponse, statsResponse] = await Promise.all([
        sshSessionsApi.list(token, {
          status: "active",
          limit: 100,
        }),
        sshSessionsApi.getStatistics(token),
      ])

      setSessions(sessionsResponse.data || [])
      setStatistics(statsResponse.data)
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "无法加载活动会话"))
    } finally {
      setLoading(false)
    }
  }

  // 初始加载
  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "无法删除会话记录"))
    }
  }

  return (
    <>
      <PageHeader title="活动会话">
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
              <CardTitle className="text-sm font-medium">活动会话</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {statistics?.active_sessions || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                当前在线
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总会话</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statistics?.total_sessions || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                历史总数
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

        {/* 搜索栏 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">搜索</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="搜索会话ID、客户端IP或终端类型..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* 活动会话表格 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">活动会话列表</CardTitle>
            <CardDescription>
              显示 {filteredSessions.length} 个活动会话，共 {sessions.length} 个
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无活动会话
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>会话ID</TableHead>
                      <TableHead>客户端信息</TableHead>
                      <TableHead>终端类型</TableHead>
                      <TableHead>连接时间</TableHead>
                      <TableHead>持续时长</TableHead>
                      <TableHead>数据传输</TableHead>
                      <TableHead>命令数</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSessions.map(session => {
                      const { date, time } = formatTimestamp(session.connected_at)
                      const duration = session.duration || 0
                      return (
                        <TableRow key={session.id}>
                          <TableCell className="font-mono text-sm">
                            {session.session_id.substring(0, 8)}...
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-medium">{session.client_ip}</div>
                              <div className="text-xs text-muted-foreground">
                                Port: {session.client_port}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{session.terminal_type}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            <div>
                              <div>{time}</div>
                              <div className="text-xs text-muted-foreground">{date}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDuration(duration)}
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
                          <TableCell className="font-medium">
                            N/A
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[session.status as keyof typeof statusColors]}>
                              {session.status === "active" ? "活动" :
                                session.status === "closed" ? "已关闭" : "超时"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(session.id)}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
