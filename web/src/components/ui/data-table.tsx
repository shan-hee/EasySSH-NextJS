import React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Clock, Loader2, ChevronDown, ChevronUp, Search, Filter, X, RefreshCw } from "lucide-react"
import { AuditLog } from "@/lib/api/audit-logs"
import { cn } from "@/lib/utils"

interface DataTableProps {
  data: AuditLog[]
  loading: boolean
  columns: ColumnDef<AuditLog>[]
  pageCount?: number
  pageSize?: number
  totalRows?: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  emptyMessage?: string
  className?: string
  scrollContainerClassName?: string
  // 新增筛选相关属性
  searchTerm?: string
  onSearchChange?: (value: string) => void
  statusFilter?: string[]
  onStatusFilterChange?: (value: string[]) => void
  userFilter?: string[]
  onUserFilterChange?: (value: string[]) => void
  actionFilter?: string[]
  onActionFilterChange?: (value: string[]) => void
  resourceFilter?: string[]
  onResourceFilterChange?: (value: string[]) => void
  onRefresh?: () => void
  availableUsers?: Array<{ value: string; label: string }>
  showHeaderFilters?: boolean
}

// 格式化时间
export function formatTimestamp(timestamp: string): { date: string; time: string } {
  const date = new Date(timestamp)
  return {
    date: date.toLocaleDateString('zh-CN'),
    time: date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
}

// 格式化时长
export function formatDuration(seconds: number | undefined): string {
  if (!seconds) return '-'
  if (seconds < 60) return `${seconds}秒`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}分${remainingSeconds}秒`
}

// 获取操作类型的颜色
export function getActionColor(action: string): string {
  const colorMap: Record<string, string> = {
    login: "bg-green-100 text-green-800 border-green-200",
    logout: "bg-gray-100 text-gray-800 border-gray-200",
    connect: "bg-blue-100 text-blue-800 border-blue-200",
    disconnect: "bg-orange-100 text-orange-800 border-orange-200",
    upload: "bg-purple-100 text-purple-800 border-purple-200",
    download: "bg-indigo-100 text-indigo-800 border-indigo-200",
    delete: "bg-red-100 text-red-800 border-red-200",
    create: "bg-emerald-100 text-emerald-800 border-emerald-200",
    update: "bg-amber-100 text-amber-800 border-amber-200",
  }
  return colorMap[action] || "bg-gray-100 text-gray-800 border-gray-200"
}

// 获取操作类型的中文名称
export function getActionLabel(action: string): string {
  const labelMap: Record<string, string> = {
    login: "登录",
    logout: "登出",
    connect: "连接",
    disconnect: "断开连接",
    upload: "上传",
    download: "下载",
    delete: "删除",
    create: "创建",
    update: "更新",
  }
  return labelMap[action] || action
}

// 获取资源类型的中文名称
export function getResourceLabel(resource: string): string {
  const labelMap: Record<string, string> = {
    server: "服务器",
    file: "文件",
    user: "用户",
    system: "系统",
    session: "会话",
  }
  return labelMap[resource] || resource
}

// 解析用户代理，获取浏览器信息
export function parseUserAgent(userAgent: string): string {
  if (!userAgent) return "-"

  // 简单的浏览器解析
  if (userAgent.includes("Chrome")) {
    if (userAgent.includes("Edg")) return "Edge"
    return "Chrome"
  }
  if (userAgent.includes("Firefox")) return "Firefox"
  if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) return "Safari"
  if (userAgent.includes("Opera") || userAgent.includes("OPR")) return "Opera"

  return "其他"
}

// 判断是否为内网IP
export function isInternalIP(ip: string): boolean {
  if (!ip) return false

  // 内网IP段
  const internalRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^localhost$/i,
    /^::1$/,
  ]

  return internalRanges.some(range => range.test(ip))
}

export function DataTable({
  data,
  loading,
  columns,
  pageCount,
  pageSize = 20,
  totalRows,
  onPageChange,
  onPageSizeChange,
  emptyMessage = "暂无数据",
  className,
  scrollContainerClassName,
  searchTerm = "",
  onSearchChange,
  statusFilter = [],
  onStatusFilterChange,
  userFilter = [],
  onUserFilterChange,
  actionFilter = [],
  onActionFilterChange,
  resourceFilter = [],
  onResourceFilterChange,
  onRefresh,
  availableUsers = [],
  showHeaderFilters = false,
}: DataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [currentPage, setCurrentPage] = React.useState(1)
  const [inputPage, setInputPage] = React.useState("")

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      pagination: {
        pageIndex: currentPage - 1,
        pageSize,
      },
    },
    manualPagination: !!pageCount,
    pageCount: pageCount,
  })

  React.useEffect(() => {
    if (onPageChange) {
      onPageChange(currentPage)
    }
  }, [currentPage, onPageChange])

  React.useEffect(() => {
    if (onPageSizeChange) {
      onPageSizeChange(pageSize)
    }
  }, [pageSize, onPageSizeChange])

  const handlePageChange = (page: number) => {
    if (page >= 1 && pageCount && page <= pageCount) {
      setCurrentPage(page)
      setInputPage("")
    }
  }

  const handleJumpToPage = () => {
    const page = parseInt(inputPage)
    if (!isNaN(page) && page >= 1 && pageCount && page <= pageCount) {
      handlePageChange(page)
    } else {
      setInputPage("")
    }
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setCurrentPage(1) // 重置到第一页
    onPageSizeChange?.(newPageSize)
  }

  const totalPages = pageCount || Math.ceil((totalRows || data.length) / pageSize)

  // 筛选工具函数
  const handleToggleFilter = (
    currentFilter: string[],
    onChange: (value: string[]) => void,
    value: string
  ) => {
    const newFilter = currentFilter.includes(value)
      ? currentFilter.filter((item) => item !== value)
      : [...currentFilter, value]
    onChange(newFilter)
  }

  // 检查是否有活跃筛选
  const hasActiveFilters =
    searchTerm ||
    statusFilter.length > 0 ||
    userFilter.length > 0 ||
    actionFilter.length > 0 ||
    resourceFilter.length > 0

  // 清除所有筛选
  const clearAllFilters = () => {
    onSearchChange?.("")
    onStatusFilterChange?.([])
    onUserFilterChange?.([])
    onActionFilterChange?.([])
    onResourceFilterChange?.([])
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-4", className)}>
      <div className="rounded-md border overflow-hidden flex min-h-0 flex-col">
        {/* 固定筛选区域 */}
        {showHeaderFilters && (
          <div className="bg-muted/30 border-b p-3 flex-shrink-0">
            <div className="flex items-center gap-3 flex-wrap">
              {/* 搜索框 */}
              <div className="relative min-w-[240px] flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索用户名、IP地址、详情等..."
                  value={searchTerm}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>

              {/* 状态筛选 */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">状态:</span>
                <div className="flex gap-1">
                  {["success", "failure"].map((status) => (
                    <Badge
                      key={status}
                      variant={statusFilter.includes(status) ? "default" : "outline"}
                      className={`cursor-pointer text-xs ${
                        status === "success"
                          ? statusFilter.includes(status)
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "border-green-200 text-green-700"
                          : statusFilter.includes(status)
                          ? "bg-red-100 text-red-800 border-red-200"
                          : "border-red-200 text-red-700"
                      }`}
                      onClick={() =>
                        onStatusFilterChange &&
                        handleToggleFilter(statusFilter, onStatusFilterChange, status)
                      }
                    >
                      {status === "success" ? "成功" : "失败"}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* 用户筛选 */}
              {availableUsers.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">用户:</span>
                  <Select
                    value={userFilter[0] || ""}
                    onValueChange={(value) => onUserFilterChange?.(value ? [value] : [])}
                  >
                    <SelectTrigger className="w-32 h-9">
                      <SelectValue placeholder="选择用户" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map((user) => (
                        <SelectItem key={user.value} value={user.value}>
                          {user.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex items-center gap-2 ml-auto">
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="h-9 text-xs"
                  >
                    <X className="h-3 w-3 mr-1" />
                    清除筛选
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRefresh}
                  disabled={loading}
                  className="h-9"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 固定表头和可滚动内容区域 */}
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background border-b">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="bg-muted/50">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="bg-muted/50 whitespace-nowrap px-4 py-3">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="px-4 py-2">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center px-4"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 分页控件 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          显示第 {Math.min((currentPage - 1) * pageSize + 1, totalRows || data.length)} - {Math.min(currentPage * pageSize, totalRows || data.length)} 项，
          共 {totalRows || data.length} 项
        </div>
        <div className="flex items-center gap-4">
          {/* 每页显示数量 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">每页显示</span>
            <Select value={pageSize.toString()} onValueChange={(value) => handlePageSizeChange(Number(value))}>
              <SelectTrigger className="w-16 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">条</span>
          </div>

          {/* 分页导航 */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              上一页
            </Button>

            {/* 页码显示 */}
            <div className="flex items-center gap-1">
              {totalPages > 0 && (
                <>
                  {/* 第一页 */}
                  {currentPage > 3 && (
                    <>
                      <Button
                        variant={currentPage === 1 ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(1)}
                      >
                        1
                      </Button>
                      {currentPage > 4 && <span className="px-1">...</span>}
                    </>
                  )}

                  {/* 当前页附近的页码 */}
                  {Array.from(
                    { length: Math.min(5, totalPages) },
                    (_, i) => {
                      let pageNum = i
                      if (currentPage > 3) {
                        pageNum = currentPage - 2 + i
                      }
                      if (pageNum < 1) pageNum = 1
                      if (pageNum > totalPages) pageNum = totalPages
                      return pageNum
                    }
                  ).filter((pageNum, index, arr) => arr.indexOf(pageNum) === index && pageNum > 0 && pageNum <= totalPages)
                    .map((pageNum) => (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    ))}

                  {/* 最后一页 */}
                  {currentPage < totalPages - 2 && (
                    <>
                      {currentPage < totalPages - 3 && <span className="px-1">...</span>}
                      <Button
                        variant={currentPage === totalPages ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(totalPages)}
                      >
                        {totalPages}
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              下一页
            </Button>
          </div>

          {/* 页面跳转 */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">跳转至</span>
              <Input
                type="number"
                min={1}
                max={totalPages}
                value={inputPage}
                onChange={(e) => setInputPage(e.target.value)}
                placeholder={currentPage.toString()}
                className="w-16 h-8 text-center"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleJumpToPage()
                  }
                }}
              />
              <span className="text-sm text-muted-foreground">页</span>
              <Button size="sm" onClick={handleJumpToPage} className="h-8">
                跳转
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
