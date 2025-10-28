"use client"

import { useState } from "react"
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
  status: string
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
  status: "online" | "offline" | "warning"
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
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
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

  // 获取状态统计
  const statusCounts = {
    all: servers.length,
    online: servers.filter(s => s.status === 'online').length,
    offline: servers.filter(s => s.status === 'offline').length,
    warning: servers.filter(s => s.status === 'warning').length
  }

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
      status: 'all',
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
    <div className={"rounded-lg border p-4 bg-gradient-to-b from-zinc-50 to-white border-zinc-200 dark:from-zinc-900/40 dark:to-zinc-900/20 dark:border-zinc-800/30"}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className={"h-4 w-4 text-zinc-600 dark:text-zinc-500"} />
          <h3 className={"text-sm font-semibold text-zinc-900 dark:text-white"}>筛选和排序</h3>
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
        {/* 状态筛选 */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filters.status === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange('status', 'all')}
            className="h-8"
          >
            全部 ({statusCounts.all})
          </Button>
          <Button
            variant={filters.status === 'online' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange('status', 'online')}
            className="h-8"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5" />
            在线 ({statusCounts.online})
          </Button>
          <Button
            variant={filters.status === 'offline' ? 'outline' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange('status', 'offline')}
            className="h-8"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5" />
            离线 ({statusCounts.offline})
          </Button>
          {statusCounts.warning > 0 && (
            <Button
              variant={filters.status === 'warning' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFilterChange('status', 'warning')}
              className="h-8"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 mr-1.5" />
              警告 ({statusCounts.warning})
            </Button>
          )}
        </div>

        {/* 高级筛选 - 只在有数据时显示 */}
        {(uniqueTags.length > 0 || uniqueOS.length > 0) && (
          <>
            <div className={"h-px bg-gradient-to-r from-transparent to-transparent via-zinc-300 dark:via-zinc-800"} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {uniqueTags.length > 0 && (
                <div className="space-y-1.5">
                  <label className={"text-xs font-medium text-zinc-600 dark:text-zinc-500"}>按标签筛选</label>
                  <Select
                    value={filters.tag}
                    onValueChange={(value) => handleFilterChange('tag', value)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="选择标签" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">所有标签</SelectItem>
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
                  <label className={"text-xs font-medium text-zinc-600 dark:text-zinc-500"}>按系统筛选</label>
                  <Select
                    value={filters.os}
                    onValueChange={(value) => handleFilterChange('os', value)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="选择操作系统" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">所有系统</SelectItem>
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
                <label className={"text-xs font-medium text-zinc-600 dark:text-zinc-500"}>排序方式</label>
                <div className="flex gap-2">
                  <Select
                    value={filters.sortBy}
                    onValueChange={(value) => handleFilterChange('sortBy', value)}
                  >
                    <SelectTrigger className="flex-1 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">名称</SelectItem>
                      <SelectItem value="host">主机地址</SelectItem>
                      <SelectItem value="status">状态</SelectItem>
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
        {(filters.status !== 'all' || filters.tag !== 'all' || filters.os !== 'all' || filters.sortBy !== 'name' || filters.sortOrder !== 'asc') && (
          <>
            <div className={"h-px bg-gradient-to-r from-transparent to-transparent via-zinc-300 dark:via-zinc-800"} />
            <div className="flex justify-between items-center">
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8">
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                重置筛选
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}