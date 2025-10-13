"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
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
}

export function ServerFilters({ servers, onFiltersChange }: ServerFiltersProps) {
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    tag: 'all',
    os: 'all',
    sortBy: 'name',
    sortOrder: 'asc',
    search: ''
  })

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // 获取唯一的标签列表
  const uniqueTags = Array.from(
    new Set(servers.flatMap(server => server.tags || []))
  )

  // 获取唯一的操作系统列表
  const uniqueOS = Array.from(
    new Set(servers.map(server => server.os))
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          筛选和排序
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="搜索服务器名称、主机地址..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="pl-10"
          />
        </div>

        {/* 状态筛选 */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filters.status === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange('status', 'all')}
          >
            全部 ({statusCounts.all})
          </Button>
          <Button
            variant={filters.status === 'online' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange('status', 'online')}
          >
            在线 ({statusCounts.online})
          </Button>
          <Button
            variant={filters.status === 'offline' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange('status', 'offline')}
          >
            离线 ({statusCounts.offline})
          </Button>
          <Button
            variant={filters.status === 'warning' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange('status', 'warning')}
          >
            警告 ({statusCounts.warning})
          </Button>
        </div>

        {/* 高级筛选 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">按标签筛选</label>
            <Select
              value={filters.tag}
              onValueChange={(value) => handleFilterChange('tag', value)}
            >
              <SelectTrigger>
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

          <div className="space-y-2">
            <label className="text-sm font-medium">按系统筛选</label>
            <Select
              value={filters.os}
              onValueChange={(value) => handleFilterChange('os', value)}
            >
              <SelectTrigger>
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

          <div className="space-y-2">
            <label className="text-sm font-medium">排序方式</label>
            <div className="flex gap-2">
              <Select
                value={filters.sortBy}
                onValueChange={(value) => handleFilterChange('sortBy', value)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">名称</SelectItem>
                  <SelectItem value="host">主机地址</SelectItem>
                  <SelectItem value="status">状态</SelectItem>
                  <SelectItem value="lastConnected">最后连接</SelectItem>
                  <SelectItem value="uptime">运行时间</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={handleSortOrderToggle}
              >
                {filters.sortOrder === 'asc' ?
                  <SortAsc className="h-4 w-4" /> :
                  <SortDesc className="h-4 w-4" />
                }
              </Button>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-between items-center pt-2 border-t">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetFilters}>
              <RefreshCw className="mr-2 h-4 w-4" />
              重置筛选
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 当前筛选条件显示 */}
        {(filters.search || filters.status !== 'all' || filters.tag !== 'all' || filters.os !== 'all') && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <span className="text-sm text-muted-foreground">当前筛选:</span>
            {filters.search && (
              <Badge variant="secondary">
                搜索: {filters.search}
              </Badge>
            )}
            {filters.status !== 'all' && (
              <Badge variant="secondary">
                状态: {filters.status}
              </Badge>
            )}
            {filters.tag !== 'all' && (
              <Badge variant="secondary">
                标签: {filters.tag}
              </Badge>
            )}
            {filters.os !== 'all' && (
              <Badge variant="secondary">
                系统: {filters.os}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}