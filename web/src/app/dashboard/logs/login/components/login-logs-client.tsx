"use client"

import React, { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, XCircle, Shield, AlertTriangle, User } from "lucide-react"
import { auditLogsApi, type AuditLog } from "@/lib/api/audit-logs"
import { getErrorMessage } from "@/lib/error-utils"
import { toast } from "@/components/ui/sonner"
import { DataTable } from "@/components/ui/data-table"
import { DataTableToolbar } from "@/components/ui/data-table-toolbar"
import { ColumnVisibility } from "@/components/ui/column-visibility"
import { exportLogsToCSV, exportLogsToJSON, downloadFile } from "@/components/ui/batch-actions"
import { loginLogColumns } from "../../components/login-log-columns"
import type { LoginLogsPageData } from "@/lib/api/audit-logs-server"

interface LoginLogsClientProps {
  initialData: LoginLogsPageData
}

/**
 * 登录日志客户端组件
 * 接收服务端传递的初始数据和预计算的统计数据
 */
export function LoginLogsClient({ initialData }: LoginLogsClientProps) {
  const [logs, setLogs] = useState<AuditLog[]>(initialData.logs)
  const [loginStats, setLoginStats] = useState(initialData.loginStats)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(initialData.currentPage)
  const [pageSize, setPageSize] = useState(initialData.pageSize)
  const [totalPages, setTotalPages] = useState(initialData.totalPages)
  const [totalRows, setTotalRows] = useState(initialData.totalCount)
  const [columnVisibility, setColumnVisibility] = useState({
    created_at: true,
    username: true,
    status: true,
    ip: true,
    location: true,
    user_agent: true,
    details: true,
  })


  // 检测异常IP（简单的内网IP检测）
  function isAbnormalIP(ip: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^localhost/,
    ]
    const isPrivate = privateRanges.some((range) => range.test(ip))
    return !isPrivate && ip !== "::1" && !ip.startsWith("fe80::")
  }

  // 加载数据
  const loadData = async (currentPage: number, currentPageSize: number) => {
    try {
      setLoading(true)
      // 加载日志列表
      const logsResponse = await auditLogsApi.list({
        page: currentPage,
        page_size: currentPageSize,
        action: "login",
      })

      const filteredLogs = logsResponse.logs.filter((log) => log.action === "login")
      setLogs(filteredLogs || [])
      setTotalPages(logsResponse.total_pages || 1)
      setTotalRows(logsResponse.total || 0)

      // 重新计算统计数据
      setLoginStats({
        total: filteredLogs.length,
        success: filteredLogs.filter((log) => log.status === "success").length,
        failure: filteredLogs.filter((log) => log.status === "failure").length,
        abnormalIP: filteredLogs.filter((log) => isAbnormalIP(log.ip)).length,
      })
    } catch (error: unknown) {
      console.error("登录日志加载失败:", error)
      toast.error(getErrorMessage(error, "无法加载登录日志"))
    } finally {
      setLoading(false)
    }
  }

  // 页码变化
  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    loadData(newPage, pageSize)
  }

  // 每页数量变化
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize)
    setPage(1)
    loadData(1, newPageSize)
  }

  // 刷新数据
  const handleRefresh = () => {
    loadData(page, pageSize)
  }

  // 导出操作函数
  const handleExportAll = (format: "csv" | "json") => {
    try {
      let content: string
      let filename: string
      let type: string

      if (format === "csv") {
        content = exportLogsToCSV(logs)
        filename = `登录日志_${new Date().toISOString().split("T")[0]}.csv`
        type = "text/csv;charset=utf-8"
      } else {
        content = exportLogsToJSON(logs)
        filename = `登录日志_${new Date().toISOString().split("T")[0]}.json`
        type = "application/json;charset=utf-8"
      }

      downloadFile(content, filename, type)
      toast.success(`成功导出 ${logs.length} 条日志`)
    } catch (error) {
      console.error("导出失败:", error)
      toast.error("导出失败")
    }
  }

  // 筛选选项配置
  const filterOptions = useMemo(() => {
    const uniqueUsers = Array.from(new Set(logs.map((log) => log.username)))

    return {
      status: [
        { label: "成功", value: "success", icon: CheckCircle },
        { label: "失败", value: "failure", icon: XCircle },
      ],
      users: uniqueUsers.map((user) => ({
        label: user,
        value: user,
        icon: User,
      })),
    }
  }, [logs])

  // 可见列配置
  const visibleColumns = useMemo(
    () =>
      loginLogColumns.filter(
        (column) => columnVisibility[column.id as keyof typeof columnVisibility] ?? true
      ),
    [columnVisibility]
  )

  return (
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
            <p className="text-xs text-muted-foreground">记录所有登录尝试</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">成功登录</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{loginStats.success}</div>
            <p className="text-xs text-muted-foreground">
              成功率{" "}
              {loginStats.total ? Math.round((loginStats.success / loginStats.total) * 100) : 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">失败登录</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{loginStats.failure}</div>
            <p className="text-xs text-muted-foreground">需要关注的异常</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">异常IP</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{loginStats.abnormalIP}</div>
            <p className="text-xs text-muted-foreground">外网IP登录</p>
          </CardContent>
        </Card>
      </div>

      {/* 登录日志表格 */}
      <Card className="flex-1 min-h-0">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">登录日志</CardTitle>
            <CardDescription>显示 {logs.length} 条记录</CardDescription>
          </div>
          <div className="flex gap-2">
            <ColumnVisibility
              columns={[
                { id: "created_at", label: "时间" },
                { id: "username", label: "用户" },
                { id: "status", label: "状态" },
                { id: "ip", label: "IP地址" },
                { id: "location", label: "位置" },
                { id: "user_agent", label: "浏览器" },
                { id: "details", label: "详情" },
              ].map((column) => ({
                id: column.id,
                label: column.label,
                visible: columnVisibility[column.id as keyof typeof columnVisibility] ?? true,
                onToggle: () =>
                  setColumnVisibility((prev) => ({
                    ...prev,
                    [column.id as keyof typeof columnVisibility]:
                      !prev[column.id as keyof typeof columnVisibility],
                  })),
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
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            emptyMessage="暂无登录日志"
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
                ]}
                onRefresh={handleRefresh}
                showRefresh={true}
              />
            )}
          />
        </CardContent>
      </Card>
    </div>
  )
}
