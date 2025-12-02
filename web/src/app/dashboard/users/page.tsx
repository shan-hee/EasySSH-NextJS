"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
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
import { useAuthReady } from "@/hooks/use-auth-ready"

export default function UsersPage() {
  const t = useTranslations("users")
  const { ready } = useAuthReady()
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
      const [usersRes, statsRes] = await Promise.all([
        usersApi.list({ page: 1, limit: 100 }),
        usersApi.getStatistics(),
      ])

      // 现在 apiFetch 不会解包包含分页元数据的响应，直接访问 data 字段
      const usersList = Array.isArray(usersRes?.data) ? usersRes.data : []
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

      toast.error(getErrorMessage(error, t("toastLoadFailed")))
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

  // 初始加载（仅在已认证且全局状态就绪时触发）
  useEffect(() => {
    if (!ready) return
    loadUsers()
  }, [ready])

  // 创建用户
  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.email || !newUser.password) {
      toast.error(t("toastFormIncomplete"))
      return
    }

    try {
      await usersApi.create(newUser)
      toast.success(t("toastCreateSuccess"))
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
      toast.error(getErrorMessage(error, t("toastCreateFailed")))
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
      toast.error(t("toastFormIncomplete"))
      return
    }

    try {
      await usersApi.update(editingUserId, editUser)
      toast.success(t("toastUpdateSuccess"))
      setIsEditDialogOpen(false)
      setEditingUserId(null)

      // 重新加载列表
      await loadUsers()
    } catch (error: unknown) {
      console.error("更新用户失败:", error)
      toast.error(getErrorMessage(error, t("toastUpdateFailed")))
    }
  }

  // 删除用户
  const handleDelete = async (userId: string, username: string) => {
    if (!confirm(t("confirmDeleteSingle", { username }))) {
      return
    }

    try {
      await usersApi.delete(userId)
      toast.success(t("toastDeleteSuccess"))
      await loadUsers()
    } catch (error: unknown) {
      console.error("删除用户失败:", error)
      toast.error(getErrorMessage(error, t("toastDeleteFailed")))
    }
  }

  // 批量删除用户
  const handleBatchDelete = async (userIds: string[]) => {
    if (!confirm(t("confirmDeleteBatch", { count: userIds.length }))) {
      return
    }

    try {
      await Promise.all(userIds.map(id => usersApi.delete(id)))
      toast.success(t("toastBatchDeleteSuccess", { count: userIds.length }))
      await loadUsers()
    } catch (error: unknown) {
      console.error("批量删除用户失败:", error)
      toast.error(getErrorMessage(error, t("toastDeleteFailed")))
    }
  }

  // 修改密码
  const handleChangePassword = async () => {
    if (!passwordUserId) return

    if (!newPassword || newPassword.length < 6) {
      toast.error(t("toastPasswordTooShort"))
      return
    }

    try {
      await usersApi.changePassword(passwordUserId, { new_password: newPassword })
      toast.success(t("toastPasswordChangeSuccess"))
      setIsPasswordDialogOpen(false)
      setPasswordUserId(null)
      setNewPassword("")
    } catch (error: unknown) {
      console.error("修改密码失败:", error)
      toast.error(getErrorMessage(error, t("toastPasswordChangeFailed")))
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
      title: t("filterRoleTitle"),
      options: [
        { label: t("filterRoleAdmin"), value: "admin", icon: Shield },
        { label: t("filterRoleUser"), value: "user", icon: Users },
        { label: t("filterRoleViewer"), value: "viewer", icon: Eye },
      ],
    },
  ]

  return (
    <>
      <PageHeader title={t("pageTitle")}>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("btnNewUser")}
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
                <CardTitle className="text-sm font-medium">
                  {t("statsTotalUsers")}
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.totalUsers}</div>
                <p className="text-xs text-muted-foreground">
                  {t("statsTotalUsersDesc")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("statsAdmins")}
                </CardTitle>
                <Shield className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.adminUsers}</div>
                <p className="text-xs text-muted-foreground">
                  {t("statsAdminsDesc")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("statsNormalUsers")}
                </CardTitle>
                <Users className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.normalUsers}</div>
                <p className="text-xs text-muted-foreground">
                  {t("statsNormalUsersDesc")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("statsViewers")}
                </CardTitle>
                <Eye className="h-4 w-4 text-gray-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.viewerUsers}</div>
                <p className="text-xs text-muted-foreground">
                  {t("statsViewersDesc")}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* DataTable */}
          <DataTable
            data={users}
            columns={columns}
            loading={refreshing}
            emptyMessage={t("tableEmpty")}
            enableRowSelection={true}
            toolbar={(table) => (
              <DataTableToolbar
                table={table}
                searchKey="username"
                searchPlaceholder={t("searchPlaceholder")}
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
                {t("batchDelete")}
              </Button>
            )}
          />
        </div>
      )}

      {/* 新建用户对话框 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialogCreateTitle")}</DialogTitle>
            <DialogDescription>{t("dialogCreateDescription")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="username">
                {t("fieldUsername")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="username"
                placeholder={t("placeholderUsername")}
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                {t("fieldEmail")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder={t("placeholderEmail")}
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                {t("fieldPassword")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                placeholder={t("placeholderPassword")}
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">
                {t("fieldRole")} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={newUser.role}
                onValueChange={(value: UserRole) => setNewUser({ ...newUser, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{t("roleAdminFull")}</SelectItem>
                  <SelectItem value="user">{t("roleUserFull")}</SelectItem>
                  <SelectItem value="viewer">{t("roleViewerFull")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              {t("dialogCancel")}
            </Button>
            <Button onClick={handleCreateUser}>{t("dialogCreateSubmit")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑用户对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialogEditTitle")}</DialogTitle>
            <DialogDescription>{t("dialogEditDescription")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-username">
                {t("fieldUsername")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-username"
                placeholder={t("placeholderUsername")}
                value={editUser.username}
                onChange={(e) => setEditUser({ ...editUser, username: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">
                {t("fieldEmail")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-email"
                type="email"
                placeholder={t("placeholderEmail")}
                value={editUser.email}
                onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-role">
                {t("fieldRole")} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={editUser.role}
                onValueChange={(value: UserRole) => setEditUser({ ...editUser, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{t("roleAdminFull")}</SelectItem>
                  <SelectItem value="user">{t("roleUserFull")}</SelectItem>
                  <SelectItem value="viewer">{t("roleViewerFull")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              {t("dialogCancel")}
            </Button>
            <Button onClick={handleUpdateUser}>{t("dialogEditSubmit")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 修改密码对话框 */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialogPasswordTitle")}</DialogTitle>
            <DialogDescription>{t("dialogPasswordDescription")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">
                {t("fieldNewPassword")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="new-password"
                type="password"
                placeholder={t("placeholderNewPassword")}
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
              {t("dialogCancel")}
            </Button>
            <Button onClick={handleChangePassword}>{t("dialogPasswordSubmit")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
