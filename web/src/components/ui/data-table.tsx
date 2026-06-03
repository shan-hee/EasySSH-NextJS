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
import { useTranslations } from "next-intl"

export type TableDensity = "compact" | "standard" | "comfortable"

interface DataTableProps<TData, TValue = unknown> {
  data: TData[]
  columns: ColumnDef<TData, TValue>[]
  loading?: boolean
  currentPage?: number
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

export function formatTimestamp(timestamp: string): { date: string; time: string } {
  const date = new Date(timestamp)
  return {
    // 使用运行环境默认 locale，避免写死为中文
    date: date.toLocaleDateString(),
    time: date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  }
}

export function formatDuration(seconds: number | undefined): string {
  if (!seconds) return "-"
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

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

  return "Other"
}

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
  currentPage: currentPageProp,
  pageCount,
  pageSize: pageSizeProp,
  totalRows,
  onPageChange,
  onPageSizeChange,
  emptyMessage,
  className,
  enableRowSelection = false,
  toolbar,
  density = "standard",
  batchActions,
}: DataTableProps<TData, TValue>) {
  const tCommon = useTranslations("common")
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [internalCurrentPage, setInternalCurrentPage] = React.useState(1)
  const [internalPageSize, setInternalPageSize] = React.useState(pageSizeProp ?? 20)
  const [inputPage, setInputPage] = React.useState("")
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)

  const currentPage = currentPageProp ?? internalCurrentPage
  const pageSize = pageSizeProp ?? internalPageSize
  const totalItems = totalRows ?? data.length
  const totalPages = pageCount ?? Math.ceil(totalItems / pageSize)
  const densityClasses = getDensityClasses(density)

  // TanStack Table 的 hook 按设计会返回带有命令式能力的对象，这里保留其官方用法。
  // eslint-disable-next-line react-hooks/incompatible-library
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
    manualPagination: pageCount !== undefined,
    pageCount: pageCount,
  })

  // 加载时重置滚动位置到顶部
  React.useEffect(() => {
    if (loading && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }
  }, [loading])

  const handlePageChange = (page: number) => {
    if (totalPages < 1) {
      return
    }

    const nextPage = Math.min(Math.max(page, 1), totalPages)
    setInternalCurrentPage(nextPage)
    setInputPage("")

    if (nextPage !== currentPage) {
      onPageChange?.(nextPage)
    }
  }

  const handleJumpToPage = () => {
    const page = parseInt(inputPage, 10)
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      handlePageChange(page)
    } else {
      setInputPage("")
    }
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setInternalPageSize(newPageSize)
    setInternalCurrentPage(1) // 重置到第一页
    setInputPage("")
    onPageSizeChange?.(newPageSize)
  }
  const effectiveEmptyMessage = emptyMessage ?? tCommon("tableEmpty")

  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-4", className)}>
      <div className="rounded-md border overflow-hidden flex min-h-0 flex-col">
        {/* 工具栏区域 */}
        {toolbar && toolbar(table)}

        {enableRowSelection && batchActions && table.getFilteredSelectedRowModel().rows.length > 0 && (
          <div className="border-b bg-muted/50 px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {tCommon("tableBulkSelected", {
                    count: table.getFilteredSelectedRowModel().rows.length,
                  })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => table.toggleAllPageRowsSelected(false)}
                  className="h-7 text-xs"
                >
                  {tCommon("tableBulkClearSelection")}
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
            "flex-1 scrollbar-custom relative bg-table",
            loading ? "overflow-hidden" : "overflow-auto"
          )}
        >
          <Table className={loading ? "invisible" : ""}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className="border-0 bg-table-header hover:bg-table-header"
                >
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "sticky top-0 z-[1] whitespace-nowrap bg-table-header",
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
                    {effectiveEmptyMessage}
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
                  className="flex items-center gap-3"
                >
                  <div className="h-8 bg-primary/10 rounded-md flex-1 animate-pulse" />
                  <div className="h-8 bg-primary/10 rounded-md w-1/4 animate-pulse" />
                  <div className="h-8 bg-primary/10 rounded-md w-1/6 animate-pulse" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 分页控件 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <div>
            {tCommon("tableRange", {
              from: Math.min((currentPage - 1) * pageSize + 1, totalItems),
              to: Math.min(currentPage * pageSize, totalItems),
              total: totalItems,
            })}
          </div>
          {enableRowSelection && table.getFilteredSelectedRowModel().rows.length > 0 && (
            <div className="flex items-center gap-1">
              <span>
                {tCommon("tableSelectedRows", {
                  count: table.getFilteredSelectedRowModel().rows.length,
                })}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {/* 每页显示数量 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {tCommon("tablePerPage")}
            </span>
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
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {tCommon("tableItems")}
            </span>
          </div>

          {/* 分页导航 */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              {tCommon("tablePrevPage")}
            </Button>

            {/* 页码显示 */}
            <div className="hidden items-center gap-1 sm:flex">
              {totalPages > 0 && (
                <>
                  {/* 第一页 */}
                  {currentPage > 3 && (
                    <>
                      <Button
                        variant={currentPage === 1 ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(1)}
                        className={cn(
                          currentPage === 1 && "border-border bg-table-row-selected text-foreground hover:bg-table-row-selected/90"
                        )}
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
                        className={cn(
                          currentPage === pageNum && "border-border bg-table-row-selected text-foreground hover:bg-table-row-selected/90"
                        )}
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
                        className={cn(
                          currentPage === totalPages && "border-border bg-table-row-selected text-foreground hover:bg-table-row-selected/90"
                        )}
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
              {tCommon("tableNextPage")}
            </Button>
          </div>

          {/* 页面跳转 */}
          {totalPages > 1 && (
            <div className="hidden items-center gap-2 lg:flex">
              <span className="text-sm text-muted-foreground">
                {tCommon("tableJumpTo")}
              </span>
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
              <span className="text-sm text-muted-foreground">
                {tCommon("tablePage")}
              </span>
              <Button size="sm" onClick={handleJumpToPage} className="h-8">
                {tCommon("tableJumpButton")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
