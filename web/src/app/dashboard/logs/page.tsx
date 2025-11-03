"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, RefreshCw, CheckCircle, XCircle, Clock, Activity, User, Shield, Loader2 } from "lucide-react"
import { auditLogsApi, type AuditLog, type AuditLogStatisticsResponse } from "@/lib/api/audit-logs"
import { toast } from "@/components/ui/sonner"

const statusColors = {
  success: "bg-green-100 text-green-800",
  failure: "bg-red-100 text-red-800",
}

const actionColors = {
  login: "bg-blue-100 text-blue-800",
  logout: "bg-gray-100 text-gray-800",
  connect: "bg-purple-100 text-purple-800",
  disconnect: "bg-orange-100 text-orange-800",
  upload: "bg-green-100 text-green-800",
  download: "bg-cyan-100 text-cyan-800",
  delete: "bg-red-100 text-red-800",
  create: "bg-emerald-100 text-emerald-800",
  update: "bg-amber-100 text-amber-800",
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

// 操作类型映射
const actionLabels: Record<string, string> = {
  login: "登录",
  logout: "登出",
  connect: "连接",
  disconnect: "断开连接",
  upload: "上传",
  download: "下载",
  delete: "删除",
  create: "创建",
  update: "更新",
  execute: "执行",
  view: "查看",
}

// 资源类型映射
const resourceLabels: Record<string, string> = {
  server: "服务器",
  file: "文件",
  user: "用户",
  system: "系统",
  script: "脚本",
  transfer: "传输",
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [statistics, setStatistics] = useState<AuditLogStatisticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedAction, setSelectedAction] = useState<string>("all")
  const [selectedResource, setSelectedResource] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [selectedUser, setSelectedUser] = useState<string>("all")
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

      // 检查token是否存在
      if (!token) {
        throw new Error("未找到认证令牌，请重新登录")
      }

      // 并行加载日志列表和统计信息
      const [logsResponse, statsResponse] = await Promise.all([
        auditLogsApi.list(token, {
          page,
          page_size: 20,
          action: selectedAction !== "all" ? selectedAction : undefined,
          resource: selectedResource !== "all" ? selectedResource : undefined,
          status: selectedStatus !== "all" ? selectedStatus as any : undefined,
          user_id: selectedUser !== "all" ? selectedUser : undefined,
        }),
        auditLogsApi.getStatistics(token),
      ])

      setLogs(logsResponse.logs || [])
      setTotalPages(logsResponse.total_pages || 1)
      setStatistics(statsResponse)
    } catch (error: any) {
      console.error("操作日志加载失败:", error)

      let errorMessage = "无法加载操作日志"
      if (error.message) {
        errorMessage = error.message
      }

      // 根据错误状态提供更详细的信息
      if (error.status === 401) {
        errorMessage = "认证失败，请重新登录"
      } else if (error.status === 403) {
        errorMessage = "权限不足，无法查看操作日志"
      } else if (error.status === 404) {
        errorMessage = "API接口不存在，请检查服务器配置"
      } else if (error.status >= 500) {
        errorMessage = "服务器内部错误，请联系管理员"
      }

      toast.error(errorMessage)

      // 如果是开发环境，输出更详细的调试信息
      if (process.env.NODE_ENV === 'development') {
        console.error("API请求详情:", {
          hasToken: !!getToken(),
          page,
          selectedAction,
          selectedResource,
          selectedStatus,
          selectedUser,
          error
        })
      }
    } finally {
      setLoading(false)
    }
  }

  // 初始加载和筛选变化时重新加载
  useEffect(() => {
    loadData()
  }, [page, selectedAction, selectedResource, selectedStatus, selectedUser])

  // 客户端搜索过滤
  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.ip.includes(searchTerm) ||
      (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase()))
    return matchesSearch
  })

  // 获取唯一用户列表
  const uniqueUsers = Array.from(new Set(logs.map(log => log.username))).sort()

  return (
    <>
      <PageHeader title="操作日志">
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
              <CardTitle className="text-sm font-medium">总操作数</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics?.total_logs || 0}</div>
              <p className="text-xs text-muted-foreground">
                记录所有操作
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">成功操作</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {statistics?.success_count || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                成功率 {statistics?.total_logs ? Math.round((statistics.success_count / statistics.total_logs) * 100) : 0}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">失败操作</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {statistics?.failure_count || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                失败率 {statistics?.total_logs ? Math.round((statistics.failure_count / statistics.total_logs) * 100) : 0}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">活跃用户</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statistics?.top_users?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                参与操作的用户数
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 筛选器 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">筛选器</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="搜索用户、操作、资源、IP..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Select value={selectedAction} onValueChange={setSelectedAction}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="操作类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有操作</SelectItem>
                    {Object.entries(actionLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedResource} onValueChange={setSelectedResource}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="资源类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有资源</SelectItem>
                    {Object.entries(resourceLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有状态</SelectItem>
                    <SelectItem value="success">成功</SelectItem>
                    <SelectItem value="failure">失败</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="用户" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有用户</SelectItem>
                    {uniqueUsers.map(user => (
                      <SelectItem key={user} value={user}>{user}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 操作日志表格 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">操作日志</CardTitle>
            <CardDescription>
              显示 {filteredLogs.length} 条记录，共 {logs.length} 条
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无操作日志
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>时间</TableHead>
                      <TableHead>用户</TableHead>
                      <TableHead>操作</TableHead>
                      <TableHead>资源</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>IP地址</TableHead>
                      <TableHead>详情</TableHead>
                      <TableHead>耗时</TableHead>
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
                          <TableCell>
                            <Badge className={actionColors[log.action as keyof typeof actionColors] || "bg-gray-100 text-gray-800"}>
                              {actionLabels[log.action] || log.action}
                            </Badge>
                          </TableCell>
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
                          <TableCell className="font-mono text-sm">
                            {formatDuration(log.duration)}
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