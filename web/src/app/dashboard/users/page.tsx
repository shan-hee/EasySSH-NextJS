"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Users,
  Shield,
  Eye,
  RefreshCw,
  Loader2,
  Key,
} from "lucide-react"
import { usersApi, type User, type UserRole } from "@/lib/api"

export default function UsersPage() {
  const router = useRouter()

  // 数据状态
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // 统计状态
  const [statistics, setStatistics] = useState({
    totalUsers: 0,
    adminUsers: 0,
    normalUsers: 0,
    viewerUsers: 0,
  })

  // 筛选状态
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRole, setSelectedRole] = useState<string>("all")

  // 对话框状态
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null)

  // 新建用户表单
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    password: "",
    role: "user" as UserRole,
  })

  // 编辑用户表单
  const [editUser, setEditUser] = useState({
    username: "",
    email: "",
    role: "user" as UserRole,
  })

  // 修改密码表单
  const [newPassword, setNewPassword] = useState("")

  // 加载用户列表
  const loadUsers = async () => {
    try {
      const token = localStorage.getItem("easyssh_access_token")
      if (!token) {
        toast.error("未登录，请先登录")
        router.push("/login")
        return
      }

      const [usersRes, statsRes] = await Promise.all([
        usersApi.list(token, { page: 1, limit: 100 }),
        usersApi.getStatistics(token),
      ])

      setUsers(usersRes.data)
      setStatistics({
        totalUsers: statsRes.data.total_users,
        adminUsers: statsRes.data.by_role.admin || 0,
        normalUsers: statsRes.data.by_role.user || 0,
        viewerUsers: statsRes.data.by_role.viewer || 0,
      })
    } catch (error: any) {
      console.error("加载用户列表失败:", error)
      if (error.message?.includes("401") || error.message?.includes("Unauthorized")) {
        toast.error("登录已过期，请重新登录")
        router.push("/login")
      } else {
        toast.error(`加载用户列表失败: ${error.message}`)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // 刷新数据
  const handleRefresh = async () => {
    setRefreshing(true)
    await loadUsers()
  }

  // 初始加载
  useEffect(() => {
    loadUsers()
  }, [])

  // 过滤用户
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = selectedRole === "all" || user.role === selectedRole
    return matchesSearch && matchesRole
  })

  // 创建用户
  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.email || !newUser.password) {
      toast.error("请填写完整的用户信息")
      return
    }

    try {
      const token = localStorage.getItem("easyssh_access_token")
      if (!token) {
        toast.error("未登录，请先登录")
        router.push("/login")
        return
      }

      await usersApi.create(token, newUser)
      toast.success("用户创建成功")
      setIsCreateDialogOpen(false)

      // 重置表单
      setNewUser({
        username: "",
        email: "",
        password: "",
        role: "user",
      })

      // 重新加载列表
      await loadUsers()
    } catch (error: any) {
      console.error("创建用户失败:", error)
      toast.error(`创建用户失败: ${error.message}`)
    }
  }

  // 编辑用户
  const handleEdit = (user: User) => {
    setEditingUserId(user.id)
    setEditUser({
      username: user.username,
      email: user.email,
      role: user.role,
    })
    setIsEditDialogOpen(true)
  }

  // 更新用户
  const handleUpdateUser = async () => {
    if (!editingUserId) return

    if (!editUser.username || !editUser.email) {
      toast.error("请填写完整的用户信息")
      return
    }

    try {
      const token = localStorage.getItem("easyssh_access_token")
      if (!token) {
        toast.error("未登录，请先登录")
        router.push("/login")
        return
      }

      await usersApi.update(token, editingUserId, editUser)
      toast.success("用户更新成功")
      setIsEditDialogOpen(false)
      setEditingUserId(null)

      // 重新加载列表
      await loadUsers()
    } catch (error: any) {
      console.error("更新用户失败:", error)
      toast.error(`更新用户失败: ${error.message}`)
    }
  }

  // 删除用户
  const handleDelete = async (userId: string, username: string) => {
    if (!confirm(`确定要删除用户 "${username}" 吗？`)) {
      return
    }

    try {
      const token = localStorage.getItem("easyssh_access_token")
      if (!token) {
        toast.error("未登录，请先登录")
        router.push("/login")
        return
      }

      await usersApi.delete(token, userId)
      toast.success("用户删除成功")
      await loadUsers()
    } catch (error: any) {
      console.error("删除用户失败:", error)
      toast.error(`删除用户失败: ${error.message}`)
    }
  }

  // 修改密码
  const handleChangePassword = async () => {
    if (!passwordUserId) return

    if (!newPassword || newPassword.length < 6) {
      toast.error("密码长度至少6位")
      return
    }

    try {
      const token = localStorage.getItem("easyssh_access_token")
      if (!token) {
        toast.error("未登录，请先登录")
        router.push("/login")
        return
      }

      await usersApi.changePassword(token, passwordUserId, { new_password: newPassword })
      toast.success("密码修改成功")
      setIsPasswordDialogOpen(false)
      setPasswordUserId(null)
      setNewPassword("")
    } catch (error: any) {
      console.error("修改密码失败:", error)
      toast.error(`修改密码失败: ${error.message}`)
    }
  }

  // 获取角色徽章
  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case "admin":
        return (
          <Badge className="bg-purple-100 text-purple-800">
            <Shield className="mr-1 h-3 w-3" />
            管理员
          </Badge>
        )
      case "user":
        return (
          <Badge className="bg-blue-100 text-blue-800">
            <Users className="mr-1 h-3 w-3" />
            普通用户
          </Badge>
        )
      case "viewer":
        return (
          <Badge className="bg-gray-100 text-gray-800">
            <Eye className="mr-1 h-3 w-3" />
            访客
          </Badge>
        )
    }
  }

  // 格式化日期
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <>
      <PageHeader
        title="用户管理"
        breadcrumbs={[{ title: "用户管理" }]}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            刷新
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            新建用户
          </Button>
        </div>
      </PageHeader>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {/* 统计卡片 */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">总用户数</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.totalUsers}</div>
                <p className="text-xs text-muted-foreground">系统总用户数</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">管理员</CardTitle>
                <Shield className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.adminUsers}</div>
                <p className="text-xs text-muted-foreground">拥有全部权限</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">普通用户</CardTitle>
                <Users className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.normalUsers}</div>
                <p className="text-xs text-muted-foreground">标准操作权限</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">访客</CardTitle>
                <Eye className="h-4 w-4 text-gray-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.viewerUsers}</div>
                <p className="text-xs text-muted-foreground">只读权限</p>
              </CardContent>
            </Card>
          </div>

          {/* 搜索和筛选 */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="搜索用户名或邮箱..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="角色筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部角色</SelectItem>
                <SelectItem value="admin">管理员</SelectItem>
                <SelectItem value="user">普通用户</SelectItem>
                <SelectItem value="viewer">访客</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 用户列表 */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">用户</TableHead>
                  <TableHead className="w-[150px]">角色</TableHead>
                  <TableHead className="w-[180px]">创建时间</TableHead>
                  <TableHead className="w-[180px]">最后登录</TableHead>
                  <TableHead className="w-[120px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Users className="h-8 w-8 mb-2" />
                        <p className="text-sm">
                          {searchTerm || selectedRole !== "all" ? "暂无匹配的用户" : "暂无用户"}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{user.username}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell className="text-sm">{formatDate(user.created_at)}</TableCell>
                      <TableCell className="text-sm">
                        {user.last_login_at ? formatDate(user.last_login_at) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(user)}>
                              <Edit className="mr-2 h-4 w-4" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setPasswordUserId(user.id)
                                setIsPasswordDialogOpen(true)
                              }}
                            >
                              <Key className="mr-2 h-4 w-4" />
                              修改密码
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(user.id, user.username)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* 新建用户对话框 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建用户</DialogTitle>
            <DialogDescription>创建一个新的系统用户账号</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="username">
                用户名 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="username"
                placeholder="请输入用户名"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                邮箱 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="请输入邮箱"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                密码 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="至少6位字符"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">
                角色 <span className="text-destructive">*</span>
              </Label>
              <Select
                value={newUser.role}
                onValueChange={(value: UserRole) => setNewUser({ ...newUser, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">管理员 - 全部权限</SelectItem>
                  <SelectItem value="user">普通用户 - 标准权限</SelectItem>
                  <SelectItem value="viewer">访客 - 只读权限</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateUser}>创建用户</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑用户对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
            <DialogDescription>修改用户的基本信息</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-username">
                用户名 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-username"
                placeholder="请输入用户名"
                value={editUser.username}
                onChange={(e) => setEditUser({ ...editUser, username: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">
                邮箱 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="请输入邮箱"
                value={editUser.email}
                onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-role">
                角色 <span className="text-destructive">*</span>
              </Label>
              <Select
                value={editUser.role}
                onValueChange={(value: UserRole) => setEditUser({ ...editUser, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">管理员 - 全部权限</SelectItem>
                  <SelectItem value="user">普通用户 - 标准权限</SelectItem>
                  <SelectItem value="viewer">访客 - 只读权限</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleUpdateUser}>保存修改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 修改密码对话框 */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改密码</DialogTitle>
            <DialogDescription>为用户设置新密码</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">
                新密码 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="new-password"
                type="password"
                placeholder="至少6位字符"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsPasswordDialogOpen(false)
                setNewPassword("")
              }}
            >
              取消
            </Button>
            <Button onClick={handleChangePassword}>修改密码</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
