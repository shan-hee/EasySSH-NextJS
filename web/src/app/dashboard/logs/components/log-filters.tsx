import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search } from "lucide-react"

interface LogFiltersProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  selectedAction?: string
  onActionChange?: (value: string) => void
  selectedResource?: string
  onResourceChange?: (value: string) => void
  selectedStatus: string
  onStatusChange: (value: string) => void
  selectedUser: string
  onUserChange: (value: string) => void
  uniqueUsers: string[]
  actionOptions?: Array<{ value: string; label: string }>
  resourceOptions?: Array<{ value: string; label: string }>
  searchPlaceholder?: string
  showActionFilter?: boolean
  showResourceFilter?: boolean
}

export function LogFilters({
  searchTerm,
  onSearchChange,
  selectedAction = "all",
  onActionChange,
  selectedResource = "all",
  onResourceChange,
  selectedStatus,
  onStatusChange,
  selectedUser,
  onUserChange,
  uniqueUsers,
  actionOptions = [],
  resourceOptions = [],
  searchPlaceholder = "搜索...",
  showActionFilter = true,
  showResourceFilter = true,
}: LogFiltersProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder={searchPlaceholder}
          className="pl-10"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div className="flex gap-2 flex-wrap">
        {showActionFilter && onActionChange && (
          <Select value={selectedAction} onValueChange={onActionChange}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="操作类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有操作</SelectItem>
              {actionOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {showResourceFilter && onResourceChange && (
          <Select value={selectedResource} onValueChange={onResourceChange}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="资源类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有资源</SelectItem>
              {resourceOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={selectedStatus} onValueChange={onStatusChange}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有状态</SelectItem>
            <SelectItem value="success">成功</SelectItem>
            <SelectItem value="failure">失败</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedUser} onValueChange={onUserChange}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="用户" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有用户</SelectItem>
            {uniqueUsers.map(user => (
              <SelectItem key={user} value={user}>{user}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}