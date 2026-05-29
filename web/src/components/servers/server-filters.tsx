"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Filter,
  SortAsc,
  SortDesc,
  Grid,
  List,
  RefreshCw
} from "lucide-react"

interface FilterOptions {
  group: string
  tag: string
  os: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
  search: string
}

interface Server {
  id: number
  name: string
  host: string
  port: number
  username: string
  group?: string
  os: string
  cpu: string
  memory: string
  disk: string
  lastConnected: string
  uptime: string
  tags: string[]
}

interface ServerFiltersProps {
  servers: Server[]
  onFiltersChange: (filters: FilterOptions) => void
  onViewModeChange?: (mode: 'grid' | 'list') => void
  viewMode?: 'grid' | 'list'
}

export function ServerFilters({
  servers,
  onFiltersChange,
  onViewModeChange,
  viewMode: externalViewMode = 'grid'
}: ServerFiltersProps) {
  const t = useTranslations("servers")
  const [filters, setFilters] = useState<FilterOptions>({
    group: 'all',
    tag: 'all',
    os: 'all',
    sortBy: 'name',
    sortOrder: 'asc',
    search: ''
  })

  const viewMode = externalViewMode

  const handleViewModeChange = (mode: 'grid' | 'list') => {
    onViewModeChange?.(mode)
  }

  // 获取唯一的标签列表
  const uniqueTags = Array.from(
    new Set(servers.flatMap(server => server.tags || []))
  )

  // 获取唯一的操作系统列表（过滤空值）
  const uniqueOS = Array.from(
    new Set(servers.map(server => server.os).filter(os => os && os.trim()))
  )

  // 获取分组统计
  const groupCounts = Array.from(
    servers.reduce((counts, server) => {
      const group = server.group?.trim()
      if (!group) return counts
      counts.set(group, (counts.get(group) || 0) + 1)
      return counts
    }, new Map<string, number>())
  ).sort(([a], [b]) => a.localeCompare(b, "zh-CN"))

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    onFiltersChange(newFilters)
  }

  const handleSortOrderToggle = () => {
    const newOrder = filters.sortOrder === 'asc' ? 'desc' : 'asc'
    handleFilterChange('sortOrder', newOrder)
  }

  const resetFilters = () => {
    const defaultFilters: FilterOptions = {
      group: 'all',
      tag: 'all',
      os: 'all',
      sortBy: 'name',
      sortOrder: 'asc',
      search: ''
    }
    setFilters(defaultFilters)
    onFiltersChange(defaultFilters)
  }

  return (
    <div className={"rounded-lg border bg-card p-4 text-card-foreground border-border"}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className={"h-4 w-4 text-muted-foreground"} />
          <h3 className={"text-sm font-semibold text-foreground"}>筛选和排序</h3>
        </div>

        {/* 视图模式切换 */}
        <div className="flex gap-1">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleViewModeChange('grid')}
            className="h-8 w-8 p-0"
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleViewModeChange('list')}
            className="h-8 w-8 p-0"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {/* 分组筛选 */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filters.group === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange('group', 'all')}
            className="h-8"
          >
            {t("tabAll")} ({servers.length})
          </Button>
          {groupCounts.map(([group, count]) => (
            <Button
              key={group}
              variant={filters.group === group ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFilterChange('group', group)}
              className="h-8"
            >
              {group} ({count})
            </Button>
          ))}
        </div>

        {/* 高级筛选 - 只在有数据时显示 */}
        {(uniqueTags.length > 0 || uniqueOS.length > 0) && (
          <>
            <div className={"h-px bg-gradient-to-r from-transparent via-border to-transparent"} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {uniqueTags.length > 0 && (
                <div className="space-y-1.5">
                  <label className={"text-xs font-medium text-muted-foreground"}>
                    {t("filterTagLabel")}
                  </label>
                  <Select
                    value={filters.tag}
                    onValueChange={(value) => handleFilterChange('tag', value)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder={t("filterTagPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t("filterTagAll")}
                      </SelectItem>
                      {uniqueTags.map((tag) => (
                        <SelectItem key={tag} value={tag}>
                          {tag}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {uniqueOS.length > 0 && (
                <div className="space-y-1.5">
                  <label className={"text-xs font-medium text-muted-foreground"}>
                    {t("filterOsLabel")}
                  </label>
                  <Select
                    value={filters.os}
                    onValueChange={(value) => handleFilterChange('os', value)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder={t("filterOsPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t("filterOsAll")}
                      </SelectItem>
                      {uniqueOS.map((os) => (
                        <SelectItem key={os} value={os}>
                          {os}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className={"text-xs font-medium text-muted-foreground"}>
                  {t("filterSortLabel")}
                </label>
                <div className="flex gap-2">
                  <Select
                    value={filters.sortBy}
                    onValueChange={(value) => handleFilterChange('sortBy', value)}
                  >
                    <SelectTrigger className="flex-1 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">
                        {t("filterSortOptionName")}
                      </SelectItem>
                      <SelectItem value="host">
                        {t("filterSortOptionHost")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleSortOrderToggle}
                    className="h-8 w-8 flex-shrink-0"
                  >
                    {filters.sortOrder === 'asc' ?
                      <SortAsc className="h-3.5 w-3.5" /> :
                      <SortDesc className="h-3.5 w-3.5" />
                    }
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* 重置按钮 */}
        {(filters.group !== 'all' || filters.tag !== 'all' || filters.os !== 'all' || filters.sortBy !== 'name' || filters.sortOrder !== 'asc') && (
          <>
            <div className={"h-px bg-gradient-to-r from-transparent via-border to-transparent"} />
            <div className="flex justify-between items-center">
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8">
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                {t("filterResetButton")}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
