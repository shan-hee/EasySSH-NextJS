"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Search,
  Plus,
  MoreHorizontal,
  UserPlus,
  Shield,
  Settings,
  Trash2,
  Edit,
  Mail,
  Calendar,
  Clock
} from "lucide-react"
import Link from "next/link"

// 模拟用户数据
const mockUsers = [
  {
    id: 1,
    name: "张三",
    email: "zhangsan@example.com",
    avatar: "/avatars/01.png",
    role: "管理员",
    status: "active",
    lastLogin: "2024-01-15 14:30",
    createdAt: "2024-01-01",
    permissions: ["全部权限"],
    serverAccess: 12,
  },
  {
    id: 2,
    name: "李四",
    email: "lisi@example.com",
    avatar: "/avatars/02.png",
    role: "运维工程师",
    status: "active",
    lastLogin: "2024-01-15 13:45",
    createdAt: "2024-01-05",
    permissions: ["服务器管理", "监控查看", "脚本执行"],
    serverAccess: 8,
  },
  {
    id: 3,
    name: "王五",
    email: "wangwu@example.com",
    avatar: "/avatars/03.png",
    role: "开发者",
    status: "active",
    lastLogin: "2024-01-15 11:20",
    createdAt: "2024-01-08",
    permissions: ["服务器查看", "终端访问"],
    serverAccess: 5,
  },
  {
    id: 4,
    name: "赵六",
    email: "zhaoliu@example.com",
    avatar: "/avatars/04.png",
    role: "访客",
    status: "inactive",
    lastLogin: "2024-01-10 16:15",
    createdAt: "2024-01-12",
    permissions: ["只读权限"],
    serverAccess: 0,
  },
  {
    id: 5,
    name: "孙七",
    email: "sunqi@example.com",
    avatar: "/avatars/05.png",
    role: "审计员",
    status: "active",
    lastLogin: "2024-01-15 09:30",
    createdAt: "2024-01-03",
    permissions: ["日志查看", "监控查看"],
    serverAccess: 3,
  },
]

const roleColors = {
  "管理员": "bg-red-100 text-red-800",
  "运维工程师": "bg-blue-100 text-blue-800",
  "开发者": "bg-green-100 text-green-800",
  "访客": "bg-gray-100 text-gray-800",
  "审计员": "bg-purple-100 text-purple-800",
}

const statusColors = {
  "active": "bg-green-100 text-green-800",
  "inactive": "bg-red-100 text-red-800",
}

export default function UsersPage() {
  const [users] = useState(mockUsers)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRole, setSelectedRole] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")

  // 获取唯一角色列表
  const roles = Array.from(new Set(users.map(user => user.role)))

  // 过滤用户
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = selectedRole === "all" || user.role === selectedRole
    const matchesStatus = selectedStatus === "all" || user.status === selectedStatus
    return matchesSearch && matchesRole && matchesStatus
  })

  const handleEditUser = (userId: number) => {
    console.log("编辑用户:", userId)
    // 这里应该打开编辑对话框
  }

  const handleDeleteUser = (userId: number) => {
    console.log("删除用户:", userId)
    // 这里应该显示确认对话框
  }

  const handleResetPassword = (userId: number) => {
    console.log("重置密码:", userId)
    // 这里应该显示密码重置对话框
  }

  const getAvatarFallback = (name: string) => {
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <>
      <PageHeader
        title="用户管理"
        breadcrumbs={[
          { title: "系统与组织", href: "#" },
          { title: "用户管理" }
        ]}
      >
        <Link href="/dashboard/users/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            新建用户
          </Button>
        </Link>
      </PageHeader>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* 统计卡片 */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总用户数</CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
              <p className="text-xs text-muted-foreground">
                活跃用户: {users.filter(u => u.status === "active").length}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">管理员</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter(u => u.role === "管理员").length}
              </div>
              <p className="text-xs text-muted-foreground">
                最高权限用户
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">在线用户</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">3</div>
              <p className="text-xs text-muted-foreground">
                当前活跃会话
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">服务器访问</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(users.reduce((acc, u) => acc + u.serverAccess, 0) / users.length)}
              </div>
              <p className="text-xs text-muted-foreground">
                平均访问服务器数
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 搜索和筛选 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">筛选器</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="搜索用户名或邮箱..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={selectedRole === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedRole("all")}
                >
                  所有角色
                </Button>
                {roles.map(role => (
                  <Button
                    key={role}
                    variant={selectedRole === role ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedRole(selectedRole === role ? "all" : role)}
                  >
                    {role}
                  </Button>
                ))}

                <Button
                  variant={selectedStatus === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedStatus("all")}
                >
                  所有状态
                </Button>
                <Button
                  variant={selectedStatus === "active" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedStatus(selectedStatus === "active" ? "all" : "active")}
                >
                  活跃
                </Button>
                <Button
                  variant={selectedStatus === "inactive" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedStatus(selectedStatus === "inactive" ? "all" : "inactive")}
                >
                  非活跃
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 用户表格 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">用户列表</CardTitle>
            <CardDescription>
              显示 {filteredUsers.length} 个用户，共 {users.length} 个
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>权限</TableHead>
                    <TableHead>服务器访问</TableHead>
                    <TableHead>最后登录</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map(user => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar} alt={user.name} />
                            <AvatarFallback>{getAvatarFallback(user.name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={roleColors[user.role as keyof typeof roleColors]}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[user.status as keyof typeof statusColors]}>
                          {user.status === "active" ? "活跃" : "非活跃"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.permissions.slice(0, 2).map(permission => (
                            <Badge key={permission} variant="outline" className="text-xs">
                              {permission}
                            </Badge>
                          ))}
                          {user.permissions.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{user.permissions.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        {user.serverAccess} 台
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {user.lastLogin}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditUser(user.id)}>
                              <Edit className="mr-2 h-4 w-4" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleResetPassword(user.id)}>
                              <Shield className="mr-2 h-4 w-4" />
                              重置密码
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

