import React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  RowSelectionState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type TableDensity = "compact" | "standard" | "comfortable"

interface DataTableProps<TData, TValue = unknown> {
  data: TData[]
  columns: ColumnDef<TData, TValue>[]
  loading?: boolean
  pageCount?: number
  pageSize?: number
  totalRows?: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  emptyMessage?: string
  className?: string
  scrollContainerClassName?: string
  enableRowSelection?: boolean
  toolbar?: (table: ReturnType<typeof useReactTable<TData>>) => React.ReactNode
  density?: TableDensity
  onDensityChange?: (density: TableDensity) => void
  batchActions?: (table: ReturnType<typeof useReactTable<TData>>) => React.ReactNode
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

// 获取密度对应的样式类名
function getDensityClasses(density: TableDensity) {
  switch (density) {
    case "compact":
      return {
        header: "px-2 py-1 h-8 text-xs",
        cell: "px-2 py-0.5 text-xs",
      }
    case "comfortable":
      return {
        header: "px-4 py-3 h-12",
        cell: "px-4 py-2.5",
      }
    default: // standard
      return {
        header: "px-3 py-2 h-10",
        cell: "px-3 py-1.5",
      }
  }
}

export function DataTable<TData, TValue = unknown>({
  data,
  columns,
  loading = false,
  pageCount,
  pageSize = 20,
  totalRows,
  onPageChange,
  onPageSizeChange,
  emptyMessage = "暂无数据",
  className,
  scrollContainerClassName,
  enableRowSelection = false,
  toolbar,
  density = "standard",
  onDensityChange,
  batchActions,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [currentPage, setCurrentPage] = React.useState(1)
  const [inputPage, setInputPage] = React.useState("")
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)

  const densityClasses = getDensityClasses(density)

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: enableRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination: {
        pageIndex: currentPage - 1,
        pageSize,
      },
    },
    manualPagination: !!pageCount,
    pageCount: pageCount,
  })

  // 加载时重置滚动位置到顶部
  React.useEffect(() => {
    if (loading && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }
  }, [loading])

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

  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-4", className)}>
      <div className="rounded-md border overflow-hidden flex min-h-0 flex-col">
        {/* 工具栏区域 */}
        {toolbar && toolbar(table)}

        {/* 批量操作工具栏 */}
        {enableRowSelection && batchActions && table.getFilteredSelectedRowModel().rows.length > 0 && (
          <div className="border-b bg-muted/50 px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  已选择 {table.getFilteredSelectedRowModel().rows.length} 项
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => table.toggleAllPageRowsSelected(false)}
                  className="h-7 text-xs"
                >
                  取消选择
                </Button>
              </div>
              <div className="flex items-center gap-2">
                {batchActions(table)}
              </div>
            </div>
          </div>
        )}

        {/* 可滚动内容区域（单表 + 吸顶表头，避免对不齐） */}
        <div
          ref={scrollContainerRef}
          className={cn(
            "flex-1 scrollbar-custom relative bg-accent",
            loading ? "overflow-hidden" : "overflow-auto"
          )}
        >
          <Table className={loading ? "invisible" : ""}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className="bg-accent border-0 hover:bg-accent hover:text-inherit"
                >
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "bg-accent sticky top-0 z-[1] whitespace-nowrap",
                        densityClasses.header
                      )}
                    >
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
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={densityClasses.cell}
                      >
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
                    className={cn("h-24 text-center", densityClasses.cell)}
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {loading && (
            <div className="absolute inset-0 bg-background/95 backdrop-blur-sm p-4 space-y-3 overflow-hidden">
              {Array.from({ length: Math.min(pageSize, 10) }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 animate-pulse"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="h-8 bg-muted rounded flex-1" />
                  <div className="h-8 bg-muted rounded w-1/4" />
                  <div className="h-8 bg-muted rounded w-1/6" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 分页控件 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div>
            第 {Math.min((currentPage - 1) * pageSize + 1, totalRows || data.length)} - {Math.min(currentPage * pageSize, totalRows || data.length)} 项，
            共 {totalRows || data.length} 项
          </div>
          {enableRowSelection && table.getFilteredSelectedRowModel().rows.length > 0 && (
            <div className="flex items-center gap-1">
              <span>已选择 {table.getFilteredSelectedRowModel().rows.length} 行</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          {/* 每页显示数量 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">每页</span>
            <Select value={pageSize.toString()} onValueChange={(value) => handlePageSizeChange(Number(value))}>
              <SelectTrigger className="w-[70px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground whitespace-nowrap">条</span>
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
