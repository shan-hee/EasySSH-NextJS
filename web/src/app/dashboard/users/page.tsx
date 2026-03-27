"use client"

import { useState, useEffect, useCallback } from "react"
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
  KeyRound,
} from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { permissionsApi, usersApi, type Permission, type UserDetail, type UserRole } from "@/lib/api"
import { SkeletonStatsCard, SkeletonTable } from "@/components/ui/loading"
import { DataTable } from "@/components/ui/data-table"
import { DataTableToolbar } from "@/components/ui/data-table-toolbar"
import { useUserColumns } from "./components/user-columns"
import { usePermissionColumns, staticPermissions } from "./components/permission-columns"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { Server, FolderKey, Terminal, FileText, Settings } from "lucide-react"

export default function UsersPage() {
  const t = useTranslations("users")
  const { ready } = useAuthReady()

  // Tab 状态
  const [activeTab, setActiveTab] = useState<"users" | "permissions">("users")

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
  const [isLockDialogOpen, setIsLockDialogOpen] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null)
  const [lockUserId, setLockUserId] = useState<string | null>(null)
  const [lockUsername, setLockUsername] = useState<string>("")

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

  // 锁定用户表单
  const [lockForm, setLockForm] = useState<{
    reason: string
    duration_minutes: number
    custom_value?: number
    custom_unit?: "minutes" | "hours" | "days"
  }>({
    reason: "",
    duration_minutes: 60,
  })

  // 权限管理状态
  const [permissions, setPermissions] = useState<Permission[]>(staticPermissions)
  const [isPermCreateDialogOpen, setIsPermCreateDialogOpen] = useState(false)
  const [isPermEditDialogOpen, setIsPermEditDialogOpen] = useState(false)
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null)

  // 新建/编辑权限表单
  const [permForm, setPermForm] = useState<{
    name: string
    code: string
    description: string
    module: Permission["module"]
    roles: Permission["roles"]
  }>({
    name: "",
    code: "",
    description: "",
    module: "server",
    roles: ["admin"],
  })

  // 加载用户列表
  const loadUsers = useCallback(async () => {
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
  }, [t])

  // 加载权限列表
  const loadPermissions = useCallback(async () => {
    try {
      const res = await permissionsApi.list({ page: 1, limit: 200 })
      const list = Array.isArray(res?.data) ? res.data : []
      setPermissions(list)
    } catch (error: unknown) {
      console.error("加载权限列表失败:", error)
      // 保留静态兜底数据，避免页面空白
      setPermissions(staticPermissions)
      toast.error(getErrorMessage(error, t("permToastLoadFailed")))
    }
  }, [t])

  // 刷新数据
  const handleRefresh = async () => {
    setRefreshing(true)
    await loadUsers()
  }

  // 初始加载（仅在已认证且全局状态就绪时触发）
  useEffect(() => {
    if (!ready) return
    loadUsers()
    loadPermissions()
  }, [ready, loadPermissions, loadUsers])

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

  // 解锁用户
  const handleUnlock = async (userId: string, username: string) => {
    if (!confirm(t("confirmUnlock", { username }))) {
      return
    }

    try {
      await usersApi.unlock(userId)
      toast.success(t("toastUnlockSuccess"))
      await loadUsers()
    } catch (error: unknown) {
      console.error("解锁用户失败:", error)
      toast.error(getErrorMessage(error, t("toastUnlockFailed")))
    }
  }

  // 打开锁定对话框
  const handleOpenLockDialog = (userId: string, username: string) => {
    setLockUserId(userId)
    setLockUsername(username)
    setLockForm({ reason: "", duration_minutes: 60 })
    setIsLockDialogOpen(true)
  }

  // 锁定用户
  const handleLockUser = async () => {
    if (!lockUserId) return

    // 计算最终锁定时长（分钟）
    let finalDurationMinutes = lockForm.duration_minutes

    // 自定义时长
    if (lockForm.duration_minutes === -1) {
      const customValue = lockForm.custom_value || 0
      const customUnit = lockForm.custom_unit || "minutes"

      if (customValue < 1) {
        toast.error(t("toastLockDurationInvalid"))
        return
      }

      switch (customUnit) {
        case "hours":
          finalDurationMinutes = customValue * 60
          break
        case "days":
          finalDurationMinutes = customValue * 60 * 24
          break
        default:
          finalDurationMinutes = customValue
      }
    }

    if (finalDurationMinutes < 1) {
      toast.error(t("toastLockDurationInvalid"))
      return
    }

    try {
      await usersApi.lock(lockUserId, {
        reason: lockForm.reason,
        duration_minutes: finalDurationMinutes,
      })
      toast.success(t("toastLockSuccess"))
      setIsLockDialogOpen(false)
      setLockUserId(null)
      setLockUsername("")
      setLockForm({ reason: "", duration_minutes: 60 })
      await loadUsers()
    } catch (error: unknown) {
      console.error("锁定用户失败:", error)
      toast.error(getErrorMessage(error, t("toastLockFailed")))
    }
  }

  // 重置权限表单
  const resetPermForm = () => {
    setPermForm({
      name: "",
      code: "",
      description: "",
      module: "server",
      roles: ["admin"],
    })
  }

  // 打开新建权限对话框
  const handleOpenPermCreateDialog = () => {
    resetPermForm()
    setIsPermCreateDialogOpen(true)
  }

  // 创建权限
  const handleCreatePermission = async () => {
    if (!permForm.name || !permForm.code) {
      toast.error(t("permToastFormIncomplete"))
      return
    }

    // 检查代码是否重复
    if (permissions.some(p => p.code === permForm.code)) {
      toast.error(t("permToastCodeExists"))
      return
    }

    try {
      await permissionsApi.create(permForm)
      toast.success(t("permToastCreateSuccess"))
      setIsPermCreateDialogOpen(false)
      resetPermForm()
      await loadPermissions()
    } catch (error: unknown) {
      console.error("创建权限失败:", error)
      toast.error(getErrorMessage(error, t("permToastCreateFailed")))
    }
  }

  // 打开编辑权限对话框
  const handleEditPermission = (permission: Permission) => {
    setEditingPermission(permission)
    setPermForm({
      name: permission.name,
      code: permission.code,
      description: permission.description,
      module: permission.module,
      roles: [...permission.roles],
    })
    setIsPermEditDialogOpen(true)
  }

  // 更新权限
  const handleUpdatePermission = async () => {
    if (!editingPermission) return

    if (!permForm.name || !permForm.code) {
      toast.error(t("permToastFormIncomplete"))
      return
    }

    // 检查代码是否与其他权限重复
    if (permissions.some(p => p.code === permForm.code && p.id !== editingPermission.id)) {
      toast.error(t("permToastCodeExists"))
      return
    }

    try {
      await permissionsApi.update(editingPermission.id, permForm)
      toast.success(t("permToastUpdateSuccess"))
      setIsPermEditDialogOpen(false)
      setEditingPermission(null)
      resetPermForm()
      await loadPermissions()
    } catch (error: unknown) {
      console.error("更新权限失败:", error)
      toast.error(getErrorMessage(error, t("permToastUpdateFailed")))
    }
  }

  // 删除权限
  const handleDeletePermission = async (permissionId: string, name: string) => {
    if (!confirm(t("permConfirmDelete", { name }))) {
      return
    }

    try {
      await permissionsApi.delete(permissionId)
      toast.success(t("permToastDeleteSuccess"))
      await loadPermissions()
    } catch (error: unknown) {
      console.error("删除权限失败:", error)
      toast.error(getErrorMessage(error, t("permToastDeleteFailed")))
    }
  }

  // 批量删除权限
  const handleBatchDeletePermissions = async (permissionIds: string[]) => {
    if (!confirm(t("permConfirmDeleteBatch", { count: permissionIds.length }))) {
      return
    }

    try {
      await Promise.all(permissionIds.map((id) => permissionsApi.delete(id)))
      toast.success(t("permToastBatchDeleteSuccess", { count: permissionIds.length }))
      await loadPermissions()
    } catch (error: unknown) {
      console.error("批量删除权限失败:", error)
      toast.error(getErrorMessage(error, t("permToastDeleteFailed")))
    }
  }

  // 切换角色选择
  const toggleRole = (role: "admin" | "user" | "viewer") => {
    if (permForm.roles.includes(role)) {
      // 至少保留一个角色
      if (permForm.roles.length > 1) {
        setPermForm({ ...permForm, roles: permForm.roles.filter(r => r !== role) })
      }
    } else {
      setPermForm({ ...permForm, roles: [...permForm.roles, role] })
    }
  }

  // 创建列定义
  const columns = useUserColumns({
    onEdit: handleEdit,
    onDelete: handleDelete,
    onChangePassword: handleOpenPasswordDialog,
    onLock: handleOpenLockDialog,
    onUnlock: handleUnlock,
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

  // 权限列定义
  const permissionColumns = usePermissionColumns({
    onEdit: handleEditPermission,
    onDelete: handleDeletePermission,
  })

  // 模块筛选选项
  const moduleFilters = [
    {
      column: "module",
      title: t("permFilterModule"),
      options: [
        { label: t("permModuleServer"), value: "server", icon: Server },
        { label: t("permModuleFile"), value: "file", icon: FolderKey },
        { label: t("permModuleTerminal"), value: "terminal", icon: Terminal },
        { label: t("permModuleAudit"), value: "audit", icon: FileText },
        { label: t("permModuleSystem"), value: "system", icon: Settings },
      ],
    },
  ]

  return (
    <>
      <PageHeader title={t("pageTitle")} />

      {loading ? (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0 h-full overflow-hidden">
          {/* 统计卡片骨架屏 */}
          <div className="grid gap-4 md:grid-cols-4 shrink-0">
            <SkeletonStatsCard />
            <SkeletonStatsCard />
            <SkeletonStatsCard />
            <SkeletonStatsCard />
          </div>
          {/* 表格骨架屏 */}
          <Card className="flex-1 min-h-0 flex flex-col">
            <CardContent className="flex-1 overflow-y-auto scrollbar-custom p-6">
              <SkeletonTable rows={10} columns={5} showCheckbox showActions />
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

          {/* 用户/权限切换 Tab */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "users" | "permissions")} className="flex-1 min-h-0 flex flex-col">
            <TabsList className="w-fit">
              <TabsTrigger value="users" className="gap-2">
                <Users className="h-4 w-4" />
                {t("tabUsers")}
              </TabsTrigger>
              <TabsTrigger value="permissions" className="gap-2">
                <KeyRound className="h-4 w-4" />
                {t("tabPermissions")}
              </TabsTrigger>
            </TabsList>

            {/* 用户列表 Tab */}
            <TabsContent value="users" className="mt-4 flex-1 min-h-0">
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
                isRefreshing={refreshing}
              >
                <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("btnNewUser")}
                </Button>
              </DataTableToolbar>
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
            </TabsContent>

            {/* 权限列表 Tab */}
            <TabsContent value="permissions" className="mt-4 flex-1 min-h-0">
              <DataTable
                data={permissions}
                columns={permissionColumns}
                loading={false}
                emptyMessage={t("permTableEmpty")}
                enableRowSelection={true}
                toolbar={(table) => (
                  <DataTableToolbar
                    table={table}
                    searchKey="name"
                    searchPlaceholder={t("permSearchPlaceholder")}
                    filters={moduleFilters}
                    showRefresh={false}
                  >
                    <Button size="sm" onClick={handleOpenPermCreateDialog}>
                      <Plus className="mr-2 h-4 w-4" />
                      {t("permBtnNew")}
                    </Button>
                  </DataTableToolbar>
                )}
                batchActions={(table) => (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      const selectedRows = table.getFilteredSelectedRowModel().rows
                      const permissionIds = selectedRows.map(row => row.original.id)
                      handleBatchDeletePermissions(permissionIds)
                    }}
                    className="h-7"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("batchDelete")}
                  </Button>
                )}
              />
            </TabsContent>
          </Tabs>
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

      {/* 锁定用户对话框 */}
      <Dialog open={isLockDialogOpen} onOpenChange={setIsLockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialogLockTitle")}</DialogTitle>
            <DialogDescription>
              {t("dialogLockDescription", { username: lockUsername })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lock-duration">
                {t("fieldLockDuration")} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={String(lockForm.duration_minutes)}
                onValueChange={(value) => {
                  const minutes = parseInt(value, 10)
                  setLockForm({ ...lockForm, duration_minutes: minutes })
                }}
              >
                <SelectTrigger id="lock-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">{t("lockDuration15min")}</SelectItem>
                  <SelectItem value="30">{t("lockDuration30min")}</SelectItem>
                  <SelectItem value="60">{t("lockDuration1hour")}</SelectItem>
                  <SelectItem value="180">{t("lockDuration3hours")}</SelectItem>
                  <SelectItem value="360">{t("lockDuration6hours")}</SelectItem>
                  <SelectItem value="720">{t("lockDuration12hours")}</SelectItem>
                  <SelectItem value="1440">{t("lockDuration24hours")}</SelectItem>
                  <SelectItem value="4320">{t("lockDuration3days")}</SelectItem>
                  <SelectItem value="10080">{t("lockDuration7days")}</SelectItem>
                  <SelectItem value="43200">{t("lockDuration30days")}</SelectItem>
                  <SelectItem value="525600">{t("lockDurationPermanent")}</SelectItem>
                  <SelectItem value="-1">{t("lockDurationCustom")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 自定义时长输入 */}
            {lockForm.duration_minutes === -1 && (
              <div className="space-y-2">
                <Label htmlFor="custom-duration">
                  {t("fieldCustomDuration")} <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="custom-duration"
                    type="number"
                    min="1"
                    placeholder={t("placeholderCustomDuration")}
                    value={lockForm.custom_value || ""}
                    onChange={(e) =>
                      setLockForm({ ...lockForm, custom_value: parseInt(e.target.value, 10) || 0 })
                    }
                    className="flex-1"
                  />
                  <Select
                    value={lockForm.custom_unit || "minutes"}
                    onValueChange={(value) =>
                      setLockForm({ ...lockForm, custom_unit: value as "minutes" | "hours" | "days" })
                    }
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">{t("unitMinutes")}</SelectItem>
                      <SelectItem value="hours">{t("unitHours")}</SelectItem>
                      <SelectItem value="days">{t("unitDays")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="lock-reason">{t("fieldLockReason")}</Label>
              <Input
                id="lock-reason"
                placeholder={t("placeholderLockReason")}
                value={lockForm.reason}
                onChange={(e) => setLockForm({ ...lockForm, reason: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsLockDialogOpen(false)
                setLockUserId(null)
                setLockUsername("")
                setLockForm({ reason: "", duration_minutes: 60 })
              }}
            >
              {t("dialogCancel")}
            </Button>
            <Button variant="destructive" onClick={handleLockUser}>
              {t("dialogLockSubmit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新建权限对话框 */}
      <Dialog open={isPermCreateDialogOpen} onOpenChange={setIsPermCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("permDialogCreateTitle")}</DialogTitle>
            <DialogDescription>{t("permDialogCreateDescription")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="perm-name">
                {t("permFieldName")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="perm-name"
                placeholder={t("permPlaceholderName")}
                value={permForm.name}
                onChange={(e) => setPermForm({ ...permForm, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="perm-code">
                {t("permFieldCode")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="perm-code"
                placeholder={t("permPlaceholderCode")}
                value={permForm.code}
                onChange={(e) => setPermForm({ ...permForm, code: e.target.value })}
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="perm-description">{t("permFieldDescription")}</Label>
              <Input
                id="perm-description"
                placeholder={t("permPlaceholderDescription")}
                value={permForm.description}
                onChange={(e) => setPermForm({ ...permForm, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="perm-module">
                {t("permFieldModule")} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={permForm.module}
                onValueChange={(value: Permission["module"]) => setPermForm({ ...permForm, module: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="server">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      {t("permModuleServer")}
                    </div>
                  </SelectItem>
                  <SelectItem value="file">
                    <div className="flex items-center gap-2">
                      <FolderKey className="h-4 w-4" />
                      {t("permModuleFile")}
                    </div>
                  </SelectItem>
                  <SelectItem value="terminal">
                    <div className="flex items-center gap-2">
                      <Terminal className="h-4 w-4" />
                      {t("permModuleTerminal")}
                    </div>
                  </SelectItem>
                  <SelectItem value="audit">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {t("permModuleAudit")}
                    </div>
                  </SelectItem>
                  <SelectItem value="system">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      {t("permModuleSystem")}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("permFieldRoles")} <span className="text-destructive">*</span></Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={permForm.roles.includes("admin") ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleRole("admin")}
                  className="gap-1"
                >
                  <Shield className="h-3 w-3" />
                  {t("filterRoleAdmin")}
                </Button>
                <Button
                  type="button"
                  variant={permForm.roles.includes("user") ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleRole("user")}
                  className="gap-1"
                >
                  <Users className="h-3 w-3" />
                  {t("filterRoleUser")}
                </Button>
                <Button
                  type="button"
                  variant={permForm.roles.includes("viewer") ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleRole("viewer")}
                  className="gap-1"
                >
                  <Eye className="h-3 w-3" />
                  {t("filterRoleViewer")}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPermCreateDialogOpen(false)}>
              {t("dialogCancel")}
            </Button>
            <Button onClick={handleCreatePermission}>{t("permDialogCreateSubmit")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑权限对话框 */}
      <Dialog open={isPermEditDialogOpen} onOpenChange={setIsPermEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("permDialogEditTitle")}</DialogTitle>
            <DialogDescription>{t("permDialogEditDescription")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-perm-name">
                {t("permFieldName")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-perm-name"
                placeholder={t("permPlaceholderName")}
                value={permForm.name}
                onChange={(e) => setPermForm({ ...permForm, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-perm-code">
                {t("permFieldCode")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-perm-code"
                placeholder={t("permPlaceholderCode")}
                value={permForm.code}
                onChange={(e) => setPermForm({ ...permForm, code: e.target.value })}
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-perm-description">{t("permFieldDescription")}</Label>
              <Input
                id="edit-perm-description"
                placeholder={t("permPlaceholderDescription")}
                value={permForm.description}
                onChange={(e) => setPermForm({ ...permForm, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-perm-module">
                {t("permFieldModule")} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={permForm.module}
                onValueChange={(value: Permission["module"]) => setPermForm({ ...permForm, module: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="server">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      {t("permModuleServer")}
                    </div>
                  </SelectItem>
                  <SelectItem value="file">
                    <div className="flex items-center gap-2">
                      <FolderKey className="h-4 w-4" />
                      {t("permModuleFile")}
                    </div>
                  </SelectItem>
                  <SelectItem value="terminal">
                    <div className="flex items-center gap-2">
                      <Terminal className="h-4 w-4" />
                      {t("permModuleTerminal")}
                    </div>
                  </SelectItem>
                  <SelectItem value="audit">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {t("permModuleAudit")}
                    </div>
                  </SelectItem>
                  <SelectItem value="system">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      {t("permModuleSystem")}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("permFieldRoles")} <span className="text-destructive">*</span></Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={permForm.roles.includes("admin") ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleRole("admin")}
                  className="gap-1"
                >
                  <Shield className="h-3 w-3" />
                  {t("filterRoleAdmin")}
                </Button>
                <Button
                  type="button"
                  variant={permForm.roles.includes("user") ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleRole("user")}
                  className="gap-1"
                >
                  <Users className="h-3 w-3" />
                  {t("filterRoleUser")}
                </Button>
                <Button
                  type="button"
                  variant={permForm.roles.includes("viewer") ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleRole("viewer")}
                  className="gap-1"
                >
                  <Eye className="h-3 w-3" />
                  {t("filterRoleViewer")}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPermEditDialogOpen(false)}>
              {t("dialogCancel")}
            </Button>
            <Button onClick={handleUpdatePermission}>{t("permDialogEditSubmit")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
