"use client"

import { Cross2Icon } from "@radix-ui/react-icons"
import { Table } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTableFacetedFilter } from "@/components/ui/data-table-faceted-filter"
import { RefreshCw, Download } from "lucide-react"

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  searchKey?: string
  searchPlaceholder?: string
  filters?: {
    column: string
    title: string
    options: {
      label: string
      value: string
      icon?: React.ComponentType<{ className?: string }>
    }[]
  }[]
  onRefresh?: () => void
  onExport?: (format: "csv" | "json") => void
  showColumnVisibility?: boolean
  showExport?: boolean
  showRefresh?: boolean
  children?: React.ReactNode
}

export function DataTableToolbar<TData>({
  table,
  searchKey,
  searchPlaceholder = "搜索...",
  filters = [],
  onRefresh,
  onExport,
  showExport = false,
  showRefresh = true,
  children,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0

  return (
    <div className="flex items-center justify-between gap-2 p-4 border-b bg-muted/30">
      <div className="flex flex-1 items-center gap-2 flex-wrap">
        {/* 搜索框 */}
        {searchKey && (
          <Input
            placeholder={searchPlaceholder}
            value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn(searchKey)?.setFilterValue(event.target.value)
            }
            className="h-8 w-[200px] lg:w-[300px]"
          />
        )}

        {/* 筛选器 */}
        {filters.map((filter) => {
          const column = table.getColumn(filter.column)
          return column ? (
            <DataTableFacetedFilter
              key={filter.column}
              column={column}
              title={filter.title}
              options={filter.options}
            />
          ) : null
        })}

        {/* 清除筛选按钮 */}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 lg:px-3"
          >
            清除筛选
            <Cross2Icon className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

      {/* 右侧操作按钮 */}
      <div className="flex items-center gap-2">
        {/* 自定义内容插槽 */}
        {children}

        {/* 刷新按钮 */}
        {showRefresh && onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="h-8"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}

        {/* 导出按钮 */}
        {showExport && onExport && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExport("csv")}
              className="h-8"
            >
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExport("json")}
              className="h-8"
            >
              <Download className="mr-2 h-4 w-4" />
              JSON
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
