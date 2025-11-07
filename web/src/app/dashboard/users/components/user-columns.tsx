"use client"

import { ColumnDef } from "@tanstack/react-table"
import { UserDetail, UserRole } from "@/lib/api/users"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { SmartAvatar } from "@/components/ui/smart-avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ArrowUpDown,
  MoreHorizontal,
  Edit,
  Trash2,
  Key,
  Shield,
  Users,
  Eye,
} from "lucide-react"

// 角色显示组件
function RoleBadge({ role }: { role: UserRole }) {
  switch (role) {
    case "admin":
      return (
        <Badge className="bg-purple-100 text-purple-800 border-purple-200">
          <Shield className="mr-1 h-3 w-3" />
          管理员
        </Badge>
      )
    case "user":
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200">
          <Users className="mr-1 h-3 w-3" />
          普通用户
        </Badge>
      )
    case "viewer":
      return (
        <Badge className="bg-gray-100 text-gray-800 border-gray-200">
          <Eye className="mr-1 h-3 w-3" />
          访客
        </Badge>
      )
  }
}

// 格式化日期
function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

interface UserColumnsOptions {
  onEdit?: (user: UserDetail) => void
  onDelete?: (userId: string, username: string) => void
  onChangePassword?: (userId: string) => void
}

export function createUserColumns(options?: UserColumnsOptions): ColumnDef<UserDetail, unknown>[] {
  return [
    // 多选列
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="全选"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="选择行"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },

    // 用户信息列
    {
      accessorKey: "username",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 data-[state=open]:bg-accent"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            用户
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const user = row.original
        return (
          <div className="flex items-center gap-3">
            <SmartAvatar
              className="h-10 w-10"
              src={user.avatar}
              username={user.username}
              email={user.email}
            />
            <div>
              <div className="font-medium">{user.username}</div>
              <div className="text-sm text-muted-foreground">{user.email}</div>
            </div>
          </div>
        )
      },
      filterFn: (row, id, value) => {
        const user = row.original
        const searchValue = value.toLowerCase()
        return (
          user.username.toLowerCase().includes(searchValue) ||
          user.email.toLowerCase().includes(searchValue)
        )
      },
    },

    // 角色列
    {
      accessorKey: "role",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 data-[state=open]:bg-accent"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            角色
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => <RoleBadge role={row.getValue("role")} />,
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },

    // 创建时间列
    {
      accessorKey: "created_at",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 data-[state=open]:bg-accent"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            创建时间
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        return <div className="text-sm">{formatDate(row.getValue("created_at"))}</div>
      },
    },

    // 最后登录时间列
    {
      accessorKey: "last_login_at",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 data-[state=open]:bg-accent"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            最后登录
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const lastLogin = row.getValue("last_login_at") as string | undefined
        return (
          <div className="text-sm">
            {lastLogin ? formatDate(lastLogin) : "-"}
          </div>
        )
      },
    },

    // 操作列
    {
      id: "actions",
      header: () => <div className="text-right">操作</div>,
      cell: ({ row }) => {
        const user = row.original

        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => options?.onEdit?.(user)}>
                  <Edit className="mr-2 h-4 w-4" />
                  编辑
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => options?.onChangePassword?.(user.id)}>
                  <Key className="mr-2 h-4 w-4" />
                  修改密码
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => options?.onDelete?.(user.id, user.username)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
      enableSorting: false,
      enableHiding: false,
    },
  ]
}
