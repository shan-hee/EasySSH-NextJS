"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  RefreshCw,
} from "lucide-react"
import { usersApi, type UserDetail, type UserRole } from "@/lib/api"
import { SkeletonCard } from "@/components/ui/loading"
import { DataTable } from "@/components/ui/data-table"
import { DataTableToolbar } from "@/components/ui/data-table-toolbar"
import { createUserColumns } from "@/app/dashboard/users/components/user-columns"

// 提取自 /dashboard/users/page.tsx 的用户管理内容
// 去掉了 PageHeader，作为 Tab 内容使用
export function UserManagementContent() {
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
      setNewUser({ username: "", email: "", password: "", role: "user" })
      await loadUsers()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "创建用户失败"))
    }
  }

  // 打开编辑对话框
  const handleOpenEditDialog = (user: UserDetail) => {
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
      await loadUsers()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "更新用户失败"))
    }
  }

  // 打开修改密码对话框
  const handleOpenPasswordDialog = (userId: string) => {
    setPasswordUserId(userId)
    setNewPassword("")
    setIsPasswordDialogOpen(true)
  }

  // 修改密码
  const handleChangePassword = async () => {
    if (!passwordUserId) return
    if (!newPassword) {
      toast.error("请输入新密码")
      return
    }

    try {
      const token = localStorage.getItem("easyssh_access_token")
      if (!token) {
        toast.error("未登录，请先登录")
        router.push("/login")
        return
      }

      await usersApi.updatePassword(token, passwordUserId, { password: newPassword })
      toast.success("密码修改成功")
      setIsPasswordDialogOpen(false)
      setPasswordUserId(null)
      setNewPassword("")
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "修改密码失败"))
    }
  }

  // 删除用户
  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`确定要删除用户 "${username}" 吗？此操作不可恢复。`)) {
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
      toast.error(getErrorMessage(error, "删除用户失败"))
    }
  }

  // 批量删除
  const handleBatchDelete = async (userIds: string[]) => {
    if (!confirm(`确定要删除选中的 ${userIds.length} 个用户吗？此操作不可恢复。`)) {
      return
    }

    try {
      const token = localStorage.getItem("easyssh_access_token")
      if (!token) {
        toast.error("未登录，请先登录")
        router.push("/login")
        return
      }

      await Promise.all(
        userIds.map((id) => usersApi.delete(token, id))
      )
      toast.success(`成功删除 ${userIds.length} 个用户`)
      await loadUsers()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "批量删除失败"))
    }
  }

  // 角色筛选
  const roleFilters = [
    { label: "全部角色", value: "" },
    { label: "管理员", value: "admin" },
    { label: "普通用户", value: "user" },
    { label: "只读用户", value: "viewer" },
  ]

  // 表格列定义
  const columns = createUserColumns({
    onEdit: handleOpenEditDialog,
    onChangePassword: handleOpenPasswordDialog,
    onDelete: handleDeleteUser,
  })

  // 渲染主体内容（去掉 PageHeader）
  return loading ? (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      {/* 统计卡片骨架屏 */}
      <div className="grid gap-4 md:grid-cols-4">
        <SkeletonCard showHeader={false} lines={2} />
        <SkeletonCard showHeader={false} lines={2} />
        <SkeletonCard showHeader={false} lines={2} />
        <SkeletonCard showHeader={false} lines={2} />
      </div>
      {/* 表格骨架屏 */}
      <SkeletonCard showHeader lines={8} className="flex-1" />
    </div>
  ) : (
    <div className="flex flex-1 h-full min-h-0 flex-col gap-4 p-4 pt-0 overflow-hidden">
      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总用户数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">管理员</CardTitle>
            <Shield className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.adminUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">普通用户</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.normalUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">只读用户</CardTitle>
            <Eye className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.viewerUsers}</div>
          </CardContent>
        </Card>
      </div>

      {/* 用户管理表格 */}
      <Card className="flex-1 min-h-0">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">用户管理</CardTitle>
            <CardDescription>显示 {users.length} 位用户</CardDescription>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            新建用户
          </Button>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 p-4 pt-0">
          <DataTable
            columns={columns}
            data={users}
            enableRowSelection={true}
            toolbar={(table) => (
              <DataTableToolbar
                table={table}
                searchKey="username"
                searchPlaceholder="搜索用户名或邮箱..."
                filters={[
                  {
                    column: "role",
                    title: "角色",
                    options: [
                      { label: "管理员", value: "admin", icon: Shield },
                      { label: "普通用户", value: "user", icon: Users },
                      { label: "只读用户", value: "viewer", icon: Eye },
                    ],
                  },
                ]}
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
                  const userIds = selectedRows.map((row) => (row.original as UserDetail).id)
                  handleBatchDelete(userIds)
                }}
                className="h-7"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                批量删除
              </Button>
            )}
          />
        </CardContent>
      </Card>

      {/* 创建用户对话框 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建用户</DialogTitle>
            <DialogDescription>添加新的系统用户账户</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-username">用户名 *</Label>
              <Input
                id="create-username"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                placeholder="请输入用户名"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">邮箱 *</Label>
              <Input
                id="create-email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="请输入邮箱地址"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">密码 *</Label>
              <Input
                id="create-password"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="请输入密码"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-role">角色 *</Label>
              <Select
                value={newUser.role}
                onValueChange={(value: UserRole) => setNewUser({ ...newUser, role: value })}
              >
                <SelectTrigger id="create-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">管理员</SelectItem>
                  <SelectItem value="user">普通用户</SelectItem>
                  <SelectItem value="viewer">只读用户</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateUser}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑用户对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
            <DialogDescription>修改用户信息和权限</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-username">用户名 *</Label>
              <Input
                id="edit-username"
                value={editUser.username}
                onChange={(e) => setEditUser({ ...editUser, username: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">邮箱 *</Label>
              <Input
                id="edit-email"
                type="email"
                value={editUser.email}
                onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">角色 *</Label>
              <Select
                value={editUser.role}
                onValueChange={(value: UserRole) => setEditUser({ ...editUser, role: value })}
              >
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">管理员</SelectItem>
                  <SelectItem value="user">普通用户</SelectItem>
                  <SelectItem value="viewer">只读用户</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleUpdateUser}>保存</Button>
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
              <Label htmlFor="new-password">新密码 *</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="请输入新密码"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleChangePassword}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
