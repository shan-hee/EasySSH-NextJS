"use client"

import React, { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, RefreshCw, CheckCircle, XCircle, Shield, AlertTriangle } from "lucide-react"
import { auditLogsApi, type AuditLog, type AuditLogStatisticsResponse } from "@/lib/api/audit-logs"
import { toast } from "@/components/ui/sonner"
import { DataTable } from "@/components/ui/data-table"
import { ColumnVisibility } from "@/components/ui/column-visibility"
import { exportLogsToCSV, exportLogsToJSON, downloadFile } from "@/components/ui/batch-actions"
import { loginLogColumns } from "../components/login-log-columns"

export default function LoginLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [statistics, setStatistics] = useState<AuditLogStatisticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [userFilter, setUserFilter] = useState<string[]>([])
  const [columnVisibility, setColumnVisibility] = useState({
    created_at: true,
    username: true,
    status: true,
    ip: true,
    location: true,
    user_agent: true,
    details: true,
  })

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
        page_size: pageSize,
        action: "login",
        status: statusFilter.length > 0 ? statusFilter[0] as any : undefined,
        user_id: userFilter.length > 0 ? userFilter[0] : undefined,
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
          pageSize,
          statusFilter,
          userFilter,
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
  }, [page, pageSize, statusFilter, userFilter])

  // 客户端搜索过滤
  const filteredLogs = logs.filter(log => {
    const matchesSearch = !searchTerm ||
      log.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.ip.includes(searchTerm) ||
      (log.user_agent && log.user_agent.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(log.status)
    const matchesUser = userFilter.length === 0 || userFilter.includes(log.username)

    return matchesSearch && matchesStatus && matchesUser
  })

  // 获取唯一用户列表
  const uniqueUsers = Array.from(new Set(logs.map(log => log.username)))
    .sort()
    .map(user => ({ value: user, label: user }))

  // 导出操作函数
  const handleExportAll = (format: "csv" | "json") => {
    try {
      let content: string
      let filename: string
      let type: string

      if (format === "csv") {
        content = exportLogsToCSV(filteredLogs)
        filename = `登录日志_${new Date().toISOString().split('T')[0]}.csv`
        type = 'text/csv;charset=utf-8'
      } else {
        content = exportLogsToJSON(filteredLogs)
        filename = `登录日志_${new Date().toISOString().split('T')[0]}.json`
        type = 'application/json;charset=utf-8'
      }

      downloadFile(content, filename, type)
      toast.success(`成功导出 ${filteredLogs.length} 条日志`)
    } catch (error) {
      console.error("导出失败:", error)
      toast.error("导出失败")
    }
  }

  // 计算统计数据
  const loginStats = {
    total: logs.length,
    success: logs.filter(log => log.status === "success").length,
    failure: logs.filter(log => log.status === "failure").length,
    abnormalIP: logs.filter(log => isAbnormalIP(log.ip)).length,
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

  return (
    <>
      <PageHeader title="登录日志" />

      <div className="flex flex-1 h-full min-h-0 flex-col gap-4 p-4 pt-0 overflow-hidden">
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

        {/* 登录日志表格 */}
        <Card className="flex-1 min-h-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">登录日志</CardTitle>
              <CardDescription>
                显示 {filteredLogs.length} 条记录，共 {logs.length} 条
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <ColumnVisibility
                columns={[
                  { id: 'created_at', label: '时间' },
                  { id: 'username', label: '用户' },
                  { id: 'status', label: '状态' },
                  { id: 'ip', label: 'IP地址' },
                  { id: 'location', label: '位置' },
                  { id: 'user_agent', label: '浏览器' },
                  { id: 'details', label: '详情' },
                ].map(column => ({
                  id: column.id,
                  label: column.label,
                  visible: columnVisibility[column.id as keyof typeof columnVisibility] ?? true,
                  onToggle: () => setColumnVisibility(prev => ({
                    ...prev,
                    [column.id as keyof typeof columnVisibility]: !prev[column.id as keyof typeof columnVisibility]
                  }))
                }))}
              />
              <Button variant="outline" size="sm" onClick={() => handleExportAll("csv")}>
                导出CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExportAll("json")}>
                导出JSON
              </Button>
              <Button variant="outline" size="sm" onClick={() => loadData()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                刷新
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 p-0">
            <DataTable
              data={filteredLogs}
              loading={loading}
              columns={loginLogColumns.filter(column =>
                columnVisibility[column.id as keyof typeof columnVisibility] ?? true
              )}
              pageCount={totalPages}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              onPageChange={setPage}
              emptyMessage="暂无登录日志"
              className="flex h-full flex-col"
              scrollContainerClassName="flex-1 overflow-auto"
              // 启用表头筛选
              showHeaderFilters={true}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              userFilter={userFilter}
              onUserFilterChange={setUserFilter}
              onRefresh={loadData}
              availableUsers={uniqueUsers}
            />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
