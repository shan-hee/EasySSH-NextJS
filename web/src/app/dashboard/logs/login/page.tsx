"use client"

import React, { useState, useEffect, useMemo } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, XCircle, Shield, AlertTriangle, User } from "lucide-react"
import { auditLogsApi, type AuditLog, type AuditLogStatisticsResponse } from "@/lib/api/audit-logs"
import { toast } from "@/components/ui/sonner"
import { DataTable } from "@/components/ui/data-table"
import { DataTableToolbar } from "@/components/ui/data-table-toolbar"
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
  const [totalRows, setTotalRows] = useState(0)
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

      // 并行加载日志列表和统计信息
      const [logsResponse, statsResponse] = await Promise.all([
        auditLogsApi.list(token, {
          page,
          page_size: pageSize,
          action: "login",
        }),
        auditLogsApi.getStatistics(token),
      ])

      const filteredLogs = logsResponse.logs.filter(log => log.action === "login")
      setLogs(filteredLogs || [])
      setTotalPages(logsResponse.total_pages || 1)
      setTotalRows(logsResponse.total || 0)
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
    } finally {
      setLoading(false)
    }
  }

  // 初始加载和分页变化时重新加载
  useEffect(() => {
    loadData()
  }, [page, pageSize])

  // 导出操作函数
  const handleExportAll = (format: "csv" | "json") => {
    try {
      let content: string
      let filename: string
      let type: string

      if (format === "csv") {
        content = exportLogsToCSV(logs)
        filename = `登录日志_${new Date().toISOString().split('T')[0]}.csv`
        type = 'text/csv;charset=utf-8'
      } else {
        content = exportLogsToJSON(logs)
        filename = `登录日志_${new Date().toISOString().split('T')[0]}.json`
        type = 'application/json;charset=utf-8'
      }

      downloadFile(content, filename, type)
      toast.success(`成功导出 ${logs.length} 条日志`)
    } catch (error) {
      console.error("导出失败:", error)
      toast.error("导出失败")
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

  // 计算统计数据
  const loginStats = useMemo(() => ({
    total: logs.length,
    success: logs.filter(log => log.status === "success").length,
    failure: logs.filter(log => log.status === "failure").length,
    abnormalIP: logs.filter(log => isAbnormalIP(log.ip)).length,
  }), [logs])

  // 筛选选项配置
  const filterOptions = useMemo(() => {
    const uniqueUsers = Array.from(new Set(logs.map(log => log.username)))

    return {
      status: [
        { label: "成功", value: "success", icon: CheckCircle },
        { label: "失败", value: "failure", icon: XCircle },
      ],
      users: uniqueUsers.map(user => ({
        label: user,
        value: user,
        icon: User,
      })),
    }
  }, [logs])

  // 可见列配置
  const visibleColumns = useMemo(() =>
    loginLogColumns.filter(column =>
      columnVisibility[column.id as keyof typeof columnVisibility] ?? true
    ),
    [columnVisibility]
  )

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
                显示 {logs.length} 条记录
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
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 p-4 pt-0">
            <DataTable
              data={logs}
              columns={visibleColumns}
              loading={loading}
              pageCount={totalPages}
              pageSize={pageSize}
              totalRows={totalRows}
              onPageSizeChange={setPageSize}
              onPageChange={setPage}
              emptyMessage="暂无登录日志"
              className="flex h-full flex-col"
              toolbar={(table) => (
                <DataTableToolbar
                  table={table}
                  searchKey="username"
                  searchPlaceholder="搜索用户名..."
                  filters={[
                    {
                      column: "status",
                      title: "状态",
                      options: filterOptions.status,
                    },
                    {
                      column: "username",
                      title: "用户",
                      options: filterOptions.users,
                    },
                  ]}
                  onRefresh={loadData}
                  onExport={handleExportAll}
                  showRefresh={true}
                  showExport={true}
                />
              )}
            />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
