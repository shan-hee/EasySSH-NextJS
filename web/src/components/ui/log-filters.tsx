import React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, X, RefreshCw, Filter, Settings } from "lucide-react"

interface LogFiltersProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  actionFilter: string[]
  onActionFilterChange: (value: string[]) => void
  resourceFilter: string[]
  onResourceFilterChange: (value: string[]) => void
  statusFilter: string[]
  onStatusFilterChange: (value: string[]) => void
  userFilter: string[]
  onUserFilterChange: (value: string[]) => void
  onRefresh: () => void
  loading?: boolean
  availableActions?: Array<{ value: string; label: string }>
  availableResources?: Array<{ value: string; label: string }>
  availableUsers?: Array<{ value: string; label: string }>
}

const defaultActions = [
  { value: "login", label: "登录" },
  { value: "logout", label: "登出" },
  { value: "connect", label: "连接" },
  { value: "disconnect", label: "断开连接" },
  { value: "upload", label: "上传" },
  { value: "download", label: "下载" },
  { value: "delete", label: "删除" },
  { value: "create", label: "创建" },
  { value: "update", label: "更新" },
]

const defaultResources = [
  { value: "server", label: "服务器" },
  { value: "file", label: "文件" },
  { value: "user", label: "用户" },
  { value: "system", label: "系统" },
  { value: "session", label: "会话" },
]

const statusOptions = [
  { value: "success", label: "成功" },
  { value: "failure", label: "失败" },
]

export function LogFilters({
  searchTerm,
  onSearchChange,
  actionFilter,
  onActionFilterChange,
  resourceFilter,
  onResourceFilterChange,
  statusFilter,
  onStatusFilterChange,
  userFilter,
  onUserFilterChange,
  onRefresh,
  loading = false,
  availableActions = defaultActions,
  availableResources = defaultResources,
  availableUsers = [],
}: LogFiltersProps) {
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

  const clearAllFilters = () => {
    onSearchChange("")
    onActionFilterChange([])
    onResourceFilterChange([])
    onStatusFilterChange([])
    onUserFilterChange([])
  }

  const hasActiveFilters =
    searchTerm ||
    actionFilter.length > 0 ||
    resourceFilter.length > 0 ||
    statusFilter.length > 0 ||
    userFilter.length > 0

  // 内联筛选组件 - 用于 DataTable 表头
  const InlineFilters = ({ inline = false }: { inline?: boolean }) => {
    if (inline) {
      return (
        <div className="flex items-center gap-2">
          {/* 快速搜索 */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8 h-9 w-48"
            />
          </div>

          {/* 快速状态筛选 */}
          <div className="flex gap-1">
            {statusOptions.map((status) => (
              <Badge
                key={status.value}
                variant={statusFilter.includes(status.value) ? "default" : "outline"}
                className={`cursor-pointer text-xs ${
                  status.value === "success"
                    ? statusFilter.includes(status.value)
                      ? "bg-green-100 text-green-800 border-green-200"
                      : "border-green-200 text-green-700"
                    : statusFilter.includes(status.value)
                    ? "bg-red-100 text-red-800 border-red-200"
                    : "border-red-200 text-red-700"
                }`}
                onClick={() =>
                  handleToggleFilter(statusFilter, onStatusFilterChange, status.value)
                }
              >
                {status.label}
              </Badge>
            ))}
          </div>

          {/* 高级筛选按钮 */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Settings className="h-4 w-4 mr-1" />
                高级筛选
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-2 h-4 px-1 text-xs">
                    {actionFilter.length + resourceFilter.length + userFilter.length}
                  </Badge>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  高级筛选
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                {/* 操作类型筛选 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">操作类型</label>
                  <div className="flex flex-wrap gap-2">
                    {availableActions.map((action) => (
                      <Badge
                        key={action.value}
                        variant={actionFilter.includes(action.value) ? "default" : "outline"}
                        className="cursor-pointer text-sm"
                        onClick={() =>
                          handleToggleFilter(actionFilter, onActionFilterChange, action.value)
                        }
                      >
                        {action.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* 资源类型筛选 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">资源类型</label>
                  <div className="flex flex-wrap gap-2">
                    {availableResources.map((resource) => (
                      <Badge
                        key={resource.value}
                        variant={resourceFilter.includes(resource.value) ? "default" : "outline"}
                        className="cursor-pointer text-sm"
                        onClick={() =>
                          handleToggleFilter(resourceFilter, onResourceFilterChange, resource.value)
                        }
                      >
                        {resource.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* 用户筛选 */}
                {availableUsers.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">用户</label>
                    <Select
                      value={userFilter[0] || ""}
                      onValueChange={(value) => onUserFilterChange(value ? [value] : [])}
                    >
                      <SelectTrigger>
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
                <div className="flex justify-between pt-4 border-t">
                  <div className="flex gap-2">
                    {hasActiveFilters && (
                      <Button
                        variant="outline"
                        onClick={clearAllFilters}
                        className="text-sm"
                      >
                        <X className="h-4 w-4 mr-1" />
                        清除筛选
                      </Button>
                    )}
                  </div>
                  <Button onClick={() => {}}>应用筛选</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* 刷新按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="h-9"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      )
    }

    // 完整的筛选组件（用于兼容旧页面）
    return (
      <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索用户名、IP地址、详情等..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 操作类型筛选 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">操作类型</label>
            <div className="flex flex-wrap gap-1">
              {availableActions.map((action) => (
                <Badge
                  key={action.value}
                  variant={actionFilter.includes(action.value) ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() =>
                    handleToggleFilter(actionFilter, onActionFilterChange, action.value)
                  }
                >
                  {action.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* 资源类型筛选 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">资源类型</label>
            <div className="flex flex-wrap gap-1">
              {availableResources.map((resource) => (
                <Badge
                  key={resource.value}
                  variant={resourceFilter.includes(resource.value) ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() =>
                    handleToggleFilter(resourceFilter, onResourceFilterChange, resource.value)
                  }
                >
                  {resource.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* 状态筛选 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">状态</label>
            <div className="flex flex-wrap gap-1">
              {statusOptions.map((status) => (
                <Badge
                  key={status.value}
                  variant={statusFilter.includes(status.value) ? "default" : "outline"}
                  className={`cursor-pointer text-xs ${
                    status.value === "success"
                      ? statusFilter.includes(status.value)
                        ? "bg-green-100 text-green-800 border-green-200"
                        : "border-green-200 text-green-700"
                      : statusFilter.includes(status.value)
                      ? "bg-red-100 text-red-800 border-red-200"
                      : "border-red-200 text-red-700"
                  }`}
                  onClick={() =>
                    handleToggleFilter(statusFilter, onStatusFilterChange, status.value)
                  }
                >
                  {status.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* 用户筛选 */}
          {availableUsers.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">用户</label>
              <Select
                value={userFilter[0] || ""}
                onValueChange={(value) => onUserFilterChange(value ? [value] : [])}
              >
                <SelectTrigger>
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
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-between pt-2 border-t">
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllFilters}
              className="text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              清除筛选
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>
    )
  }

  // 返回内联筛选组件
  return <InlineFilters />
}