"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { getErrorMessage } from "@/lib/error-utils"
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
  Plus,
  Users,
  Shield,
  Eye,
  Trash2,
} from "lucide-react"
import { usersApi, type UserDetail, type UserRole } from "@/lib/api"
import { SkeletonCard } from "@/components/ui/loading"
import { DataTable } from "@/components/ui/data-table"
import { DataTableToolbar } from "@/components/ui/data-table-toolbar"
import { createUserColumns } from "./components/user-columns"

export default function UsersPage() {
  const router = useRouter()

  // 数据状态
  const [users, setUsers] = useState<UserDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // 统计状态
  const [statistics, setStatistics] = useState({
    totalUsers: 0,
    adminUsers: 0,
    normalUsers: 0,
    viewerUsers: 0,
  })

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

      // 防御性检查：处理apiFetch自动解包
      const usersList = Array.isArray(usersRes)
        ? usersRes
        : (Array.isArray(usersRes?.data) ? usersRes.data : [])
      const statsData = statsRes?.data || statsRes || {}

      setUsers(usersList)
      setStatistics({
        totalUsers: statsData.total_users || 0,
        adminUsers: statsData.by_role?.admin || 0,
        normalUsers: statsData.by_role?.user || 0,
        viewerUsers: statsData.by_role?.viewer || 0,
      })
    } catch (error: unknown) {
      console.error("加载用户列表失败:", error)

      // 确保状态为空数组
      setUsers([])

      toast.error(getErrorMessage(error, "加载用户列表失败"))
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    } catch (error: unknown) {
      console.error("创建用户失败:", error)
      toast.error(getErrorMessage(error, "创建用户失败"))
    }
  }

  // 编辑用户
  const handleEdit = (user: UserDetail) => {
    setEditingUserId(user.id)
    setEditUser({
      username: user.username,
      email: user.email,
      role: user.role as UserRole,
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
    } catch (error: unknown) {
      console.error("更新用户失败:", error)
      toast.error(getErrorMessage(error, "更新用户失败"))
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
    } catch (error: unknown) {
      console.error("删除用户失败:", error)
      toast.error(getErrorMessage(error, "删除用户失败"))
    }
  }

  // 批量删除用户
  const handleBatchDelete = async (userIds: string[]) => {
    if (!confirm(`确定要删除选中的 ${userIds.length} 个用户吗？`)) {
      return
    }

    try {
      const token = localStorage.getItem("easyssh_access_token")
      if (!token) {
        toast.error("未登录，请先登录")
        router.push("/login")
        return
      }

      await Promise.all(userIds.map(id => usersApi.delete(token, id)))
      toast.success(`成功删除 ${userIds.length} 个用户`)
      await loadUsers()
    } catch (error: unknown) {
      console.error("批量删除用户失败:", error)
      toast.error(getErrorMessage(error, "批量删除用户失败"))
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
    } catch (error: unknown) {
      console.error("修改密码失败:", error)
      toast.error(getErrorMessage(error, "修改密码失败"))
    }
  }

  // 处理修改密码
  const handleOpenPasswordDialog = (userId: string) => {
    setPasswordUserId(userId)
    setIsPasswordDialogOpen(true)
  }

  // 创建列定义
  const columns = createUserColumns({
    onEdit: handleEdit,
    onDelete: handleDelete,
    onChangePassword: handleOpenPasswordDialog,
  })

  // 角色筛选选项
  const roleFilters = [
    {
      column: "role",
      title: "角色",
      options: [
        { label: "管理员", value: "admin", icon: Shield },
        { label: "普通用户", value: "user", icon: Users },
        { label: "访客", value: "viewer", icon: Eye },
      ],
    },
  ]

  return (
    <>
      <PageHeader title="用户管理">
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          新建用户
        </Button>
      </PageHeader>

      {loading ? (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0 h-full overflow-hidden">
          {/* 统计卡片骨架屏 */}
          <div className="grid gap-4 md:grid-cols-4 shrink-0">
            <SkeletonCard showHeader={false} lines={2} />
            <SkeletonCard showHeader={false} lines={2} />
            <SkeletonCard showHeader={false} lines={2} />
            <SkeletonCard showHeader={false} lines={2} />
          </div>
          {/* 表格骨架屏 */}
          <Card className="flex-1 min-h-0 flex flex-col">
            <CardContent className="flex-1 overflow-y-auto scrollbar-custom p-8">
              <div className="space-y-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0 h-full overflow-hidden">
          {/* 统计卡片 */}
          <div className="grid gap-4 md:grid-cols-4 shrink-0">
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

          {/* DataTable */}
          <DataTable
            data={users}
            columns={columns}
            loading={refreshing}
            emptyMessage="暂无用户"
            enableRowSelection={true}
            toolbar={(table) => (
              <DataTableToolbar
                table={table}
                searchKey="username"
                searchPlaceholder="搜索用户名或邮箱..."
                filters={roleFilters}
                onRefresh={handleRefresh}
                showRefresh={true}
              />
            )}
            batchActions={(table) => (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  const selectedRows = table.getFilteredSelectedRowModel().rows
                  const userIds = selectedRows.map(row => row.original.id)
                  handleBatchDelete(userIds)
                }}
                className="h-7"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                批量删除
              </Button>
            )}
          />
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
