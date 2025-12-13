"use client"

import { Cross2Icon } from "@radix-ui/react-icons"
import { Table } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTableFacetedFilter } from "@/components/ui/data-table-faceted-filter"
import { RefreshCw, Download } from "lucide-react"
import { useTranslations } from "next-intl"

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
  /** 自定义筛选器插槽（放在搜索框后面，用于服务端筛选等场景） */
  filterSlot?: React.ReactNode
  onRefresh?: () => void
  onExport?: (format: "csv" | "json") => void
  showColumnVisibility?: boolean
  showExport?: boolean
  showRefresh?: boolean
  isRefreshing?: boolean
  children?: React.ReactNode
}

export function DataTableToolbar<TData>({
  table,
  searchKey,
  searchPlaceholder,
  filters = [],
  filterSlot,
  onRefresh,
  onExport,
  showExport = false,
  showRefresh = true,
  isRefreshing = false,
  children,
}: DataTableToolbarProps<TData>) {
  const tCommon = useTranslations("common")
  const effectiveSearchPlaceholder =
    searchPlaceholder ?? tCommon("tableSearchPlaceholder")

  const isFiltered = table.getState().columnFilters.length > 0

  return (
    <div className="flex items-center justify-between gap-2 p-4 border-b bg-muted/30">
      <div className="flex flex-1 items-center gap-2 flex-wrap">
        {/* 搜索框 */}
        {searchKey && (
          <Input
            placeholder={effectiveSearchPlaceholder}
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

        {/* 自定义筛选器插槽 */}
        {filterSlot}

        {/* 清除筛选按钮 */}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 lg:px-3"
          >
            {tCommon("tableClearFilters")}
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
            disabled={isRefreshing}
            className="h-8"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {tCommon("tableRefresh")}
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
