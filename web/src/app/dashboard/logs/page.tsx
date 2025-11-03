"use client"

import React, { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, Activity, User, RefreshCw } from "lucide-react"
import { auditLogsApi, type AuditLog, type AuditLogStatisticsResponse } from "@/lib/api/audit-logs"
import { toast } from "@/components/ui/sonner"
import { DataTable } from "@/components/ui/data-table"
import { ColumnVisibility } from "@/components/ui/column-visibility"
import { LogFilters } from "@/components/ui/log-filters"
import { exportLogsToCSV, exportLogsToJSON, downloadFile } from "@/components/ui/batch-actions"
import { auditLogColumns } from "./components/audit-log-columns"


export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [statistics, setStatistics] = useState<AuditLogStatisticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const [actionFilter, setActionFilter] = useState<string[]>([])
  const [resourceFilter, setResourceFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [userFilter, setUserFilter] = useState<string[]>([])
  const [columnVisibility, setColumnVisibility] = useState({
    created_at: true,
    username: true,
    action: true,
    resource: true,
    status: true,
    ip: true,
    details: true,
    duration: true,
    server_id: false, // 默认隐藏服务器列
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

      // 并行加载日志列表和统计信息
      const [logsResponse, statsResponse] = await Promise.all([
        auditLogsApi.list(token, {
          page,
          page_size: pageSize,
          action: actionFilter.length > 0 ? actionFilter[0] : undefined,
          resource: resourceFilter.length > 0 ? resourceFilter[0] : undefined,
          status: statusFilter.length > 0 ? statusFilter[0] as any : undefined,
          user_id: userFilter.length > 0 ? userFilter[0] : undefined,
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
          pageSize,
          actionFilter,
          resourceFilter,
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
  }, [page, pageSize, actionFilter, resourceFilter, statusFilter, userFilter])

  // 客户端搜索过滤
  const filteredLogs = logs.filter(log => {
    const matchesSearch = !searchTerm ||
      log.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.ip.includes(searchTerm) ||
      (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesAction = actionFilter.length === 0 || actionFilter.includes(log.action)
    const matchesResource = resourceFilter.length === 0 || resourceFilter.includes(log.resource)
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(log.status)
    const matchesUser = userFilter.length === 0 || userFilter.includes(log.username)

    return matchesSearch && matchesAction && matchesResource && matchesStatus && matchesUser
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
        filename = `操作日志_${new Date().toISOString().split('T')[0]}.csv`
        type = 'text/csv;charset=utf-8'
      } else {
        content = exportLogsToJSON(filteredLogs)
        filename = `操作日志_${new Date().toISOString().split('T')[0]}.json`
        type = 'application/json;charset=utf-8'
      }

      downloadFile(content, filename, type)
      toast.success(`成功导出 ${filteredLogs.length} 条日志`)
    } catch (error) {
      console.error("导出失败:", error)
      toast.error("导出失败")
    }
  }

  return (
    <>
      <PageHeader title="操作日志" />

      <div className="flex flex-1 h-full min-h-0 flex-col gap-4 p-4 pt-0 overflow-hidden">
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

        {/* 操作日志表格 */}
        <Card className="flex-1 min-h-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">操作日志</CardTitle>
              <CardDescription>
                显示 {filteredLogs.length} 条记录，共 {logs.length} 条
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <ColumnVisibility
                columns={[
                  { id: 'created_at', label: '时间' },
                  { id: 'username', label: '用户' },
                  { id: 'action', label: '操作' },
                  { id: 'resource', label: '资源' },
                  { id: 'status', label: '状态' },
                  { id: 'ip', label: 'IP地址' },
                  { id: 'details', label: '详情' },
                  { id: 'duration', label: '耗时' },
                  { id: 'server_id', label: '服务器' },
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
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 p-0">
            <DataTable
              data={filteredLogs}
              loading={loading}
              columns={auditLogColumns.filter(column =>
                columnVisibility[column.id as keyof typeof columnVisibility] ?? true
              )}
              pageCount={totalPages}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              onPageChange={setPage}
              emptyMessage="暂无操作日志"
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
              actionFilter={actionFilter}
              onActionFilterChange={setActionFilter}
              resourceFilter={resourceFilter}
              onResourceFilterChange={setResourceFilter}
              onRefresh={loadData}
              availableUsers={uniqueUsers}
            />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
