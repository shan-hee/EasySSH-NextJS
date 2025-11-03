"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, RefreshCw, CheckCircle, XCircle, Clock, Shield, AlertTriangle, User, Loader2 } from "lucide-react"
import { auditLogsApi, type AuditLog, type AuditLogStatisticsResponse } from "@/lib/api/audit-logs"
import { toast } from "@/components/ui/sonner"

const statusColors = {
  success: "bg-green-100 text-green-800",
  failure: "bg-red-100 text-red-800",
}

// 格式化时间
function formatTimestamp(timestamp: string): { date: string; time: string } {
  const date = new Date(timestamp)
  return {
    date: date.toLocaleDateString('zh-CN'),
    time: date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
}

// 检测异常IP（简单的内网IP检测）
function isAbnormalIP(ip: string): boolean {
  // 内网IP范围
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^localhost/,
  ]

  // 检查是否为内网IP
  const isPrivate = privateRanges.some(range => range.test(ip))
  return !isPrivate && ip !== '::1' && !ip.startsWith('fe80::')
}

// 获取用户浏览器信息
function getBrowserInfo(userAgent: string): string {
  if (!userAgent) return "未知"

  const browsers = [
    { name: "Chrome", pattern: /Chrome\/[\d.]+/ },
    { name: "Firefox", pattern: /Firefox\/[\d.]+/ },
    { name: "Safari", pattern: /Safari\/[\d.]+/ },
    { name: "Edge", pattern: /Edge\/[\d.]+/ },
    { name: "Opera", pattern: /Opera\/[\d.]+/ },
  ]

  for (const browser of browsers) {
    if (browser.pattern.test(userAgent)) {
      return browser.name
    }
  }

  return "其他"
}

export default function LoginLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [statistics, setStatistics] = useState<AuditLogStatisticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [selectedUser, setSelectedUser] = useState<string>("all")
  const [selectedIPType, setSelectedIPType] = useState<string>("all")
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

      // 获取登录相关日志
      const logsResponse = await auditLogsApi.list(token, {
        page,
        page_size: 20,
        action: "login",
        status: selectedStatus !== "all" ? selectedStatus as any : undefined,
        user_id: selectedUser !== "all" ? selectedUser : undefined,
      })

      const filteredLogs = logsResponse.logs.filter(log => log.action === "login")
      setLogs(filteredLogs || [])
      setTotalPages(logsResponse.total_pages || 1)

      // 获取统计信息
      const statsResponse = await auditLogsApi.getStatistics(token)
      setStatistics(statsResponse)

    } catch (error: any) {
      console.error("登录日志加载失败:", error)

      let errorMessage = "无法加载登录日志"
      if (error.message) {
        errorMessage = error.message
      }

      // 根据错误状态提供更详细的信息
      if (error.status === 401) {
        errorMessage = "认证失败，请重新登录"
      } else if (error.status === 403) {
        errorMessage = "权限不足，无法查看登录日志"
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
  }, [page, selectedStatus, selectedUser])

  // 客户端搜索过滤
  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.ip.includes(searchTerm) ||
      (log.user_agent && log.user_agent.toLowerCase().includes(searchTerm.toLowerCase()))

    let matchesIPType = true
    if (selectedIPType !== "all") {
      const isAbnormal = isAbnormalIP(log.ip)
      if (selectedIPType === "abnormal") {
        matchesIPType = isAbnormal
      } else if (selectedIPType === "normal") {
        matchesIPType = !isAbnormal
      }
    }

    return matchesSearch && matchesIPType
  })

  // 获取唯一用户列表
  const uniqueUsers = Array.from(new Set(logs.map(log => log.username))).sort()

  // 计算统计数据
  const loginStats = {
    total: logs.length,
    success: logs.filter(log => log.status === "success").length,
    failure: logs.filter(log => log.status === "failure").length,
    abnormalIP: logs.filter(log => isAbnormalIP(log.ip)).length,
  }

  return (
    <>
      <PageHeader title="登录日志">
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
              <CardTitle className="text-sm font-medium">总登录次数</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loginStats.total}</div>
              <p className="text-xs text-muted-foreground">
                记录所有登录尝试
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">成功登录</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {loginStats.success}
              </div>
              <p className="text-xs text-muted-foreground">
                成功率 {loginStats.total ? Math.round((loginStats.success / loginStats.total) * 100) : 0}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">失败登录</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {loginStats.failure}
              </div>
              <p className="text-xs text-muted-foreground">
                需要关注的异常
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">异常IP</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {loginStats.abnormalIP}
              </div>
              <p className="text-xs text-muted-foreground">
                外网IP登录
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
                  placeholder="搜索用户、IP、浏览器..."
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
                    <SelectItem value="success">成功</SelectItem>
                    <SelectItem value="failure">失败</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedIPType} onValueChange={setSelectedIPType}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="IP类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有IP</SelectItem>
                    <SelectItem value="normal">内网IP</SelectItem>
                    <SelectItem value="abnormal">外网IP</SelectItem>
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

        {/* 登录日志表格 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">登录日志</CardTitle>
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
                暂无登录日志
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>时间</TableHead>
                      <TableHead>用户</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>IP地址</TableHead>
                      <TableHead>位置</TableHead>
                      <TableHead>浏览器</TableHead>
                      <TableHead>详情</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map(log => {
                      const { date, time } = formatTimestamp(log.created_at)
                      const isAbnormal = isAbnormalIP(log.ip)
                      const browser = getBrowserInfo(log.user_agent || "")

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
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              {log.username}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge className={statusColors[log.status]}>
                                {log.status === "success" ? "成功" : "失败"}
                              </Badge>
                              {log.status === "failure" && (
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            <div className="flex items-center gap-2">
                              <span className={isAbnormal ? "text-orange-600 font-medium" : ""}>
                                {log.ip}
                              </span>
                              {isAbnormal && (
                                <Badge variant="outline" className="text-orange-600 border-orange-600">
                                  外网
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={isAbnormal ? "destructive" : "secondary"}>
                              {isAbnormal ? "外部" : "内部"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{browser}</span>
                              {log.user_agent && (
                                <div className="text-xs text-muted-foreground truncate max-w-32" title={log.user_agent}>
                                  {log.user_agent.length > 20 ? log.user_agent.substring(0, 20) + "..." : log.user_agent}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs">
                              {log.error_msg && (
                                <div className="text-sm text-red-600 truncate" title={log.error_msg}>
                                  {log.error_msg}
                                </div>
                              )}
                              {log.details && !log.error_msg && (
                                <div className="text-sm truncate" title={log.details}>
                                  {log.details}
                                </div>
                              )}
                              {!log.error_msg && !log.details && (
                                <span className="text-muted-foreground">-</span>
                              )}
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