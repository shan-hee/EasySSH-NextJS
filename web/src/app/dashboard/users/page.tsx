"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useTranslations } from "next-intl"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
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
  Eye,
  FileText,
  FolderKey,
  KeyRound,
  Plus,
  Server,
  Settings,
  Shield,
  Terminal,
  Trash2,
  Users,
} from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { permissionsApi, usersApi, type Permission, type UserDetail, type UserRole } from "@/lib/api"
import { DataTable } from "@/components/ui/data-table"
import { DataTableToolbar } from "@/components/ui/data-table-toolbar"
import { useUserColumns } from "./components/user-columns"
import { usePermissionColumns, staticPermissions } from "./components/permission-columns"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog"
import {
  DashboardMetricCard,
  DashboardSideList,
  InlineStatusBadge,
} from "../logs/components/log-dashboard-widgets"

const DAY_MS = 24 * 60 * 60 * 1000

function isLockedUser(user: UserDetail) {
  if (!user.locked_until) return false
  return new Date(user.locked_until) > new Date()
}

function formatUserTime(value?: string) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export default function UsersPage() {
  const t = useTranslations("users")
  const { ready } = useAuthReady()
  const { confirm: requestConfirm, confirmDialog } = useConfirmDialog()

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
    const confirmed = await requestConfirm({
      description: t("confirmDeleteSingle", { username }),
      variant: "destructive",
    })
    if (!confirmed) {
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
    const confirmed = await requestConfirm({
      description: t("confirmDeleteBatch", { count: userIds.length }),
      variant: "destructive",
    })
    if (!confirmed) {
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
    const confirmed = await requestConfirm({
      description: t("confirmUnlock", { username }),
    })
    if (!confirmed) {
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
    const confirmed = await requestConfirm({
      description: t("permConfirmDelete", { name }),
      variant: "destructive",
    })
    if (!confirmed) {
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
    const confirmed = await requestConfirm({
      description: t("permConfirmDeleteBatch", { count: permissionIds.length }),
      variant: "destructive",
    })
    if (!confirmed) {
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

  const lockedUsers = useMemo(() => users.filter(isLockedUser), [users])

  const recentActiveUsers = useMemo(() => {
    const threshold = Date.now() - 7 * DAY_MS
    return users.filter((user) => {
      if (!user.last_login_at) return false
      const loginTime = new Date(user.last_login_at).getTime()
      return !Number.isNaN(loginTime) && loginTime >= threshold
    })
  }, [users])

  const userSpark = useMemo(() => [
    statistics.viewerUsers,
    statistics.normalUsers,
    statistics.adminUsers,
    recentActiveUsers.length,
    users.length,
  ], [recentActiveUsers.length, statistics.adminUsers, statistics.normalUsers, statistics.viewerUsers, users.length])

  const roleDistribution = useMemo(() => [
    { label: t("filterRoleAdmin"), value: statistics.adminUsers, tone: "violet" as const },
    { label: t("filterRoleUser"), value: statistics.normalUsers, tone: "blue" as const },
    { label: t("filterRoleViewer"), value: statistics.viewerUsers, tone: "slate" as const },
  ], [statistics.adminUsers, statistics.normalUsers, statistics.viewerUsers, t])

  const permissionModuleStats = useMemo(() => {
    const labels: Record<Permission["module"], string> = {
      server: t("permModuleServer"),
      file: t("permModuleFile"),
      terminal: t("permModuleTerminal"),
      audit: t("permModuleAudit"),
      system: t("permModuleSystem"),
    }

    return (["server", "file", "terminal", "audit", "system"] as Permission["module"][]).map((module) => ({
      module,
      label: labels[module],
      count: permissions.filter((permission) => permission.module === module).length,
    }))
  }, [permissions, t])

  const rolePermissionCoverage = useMemo(() => ([
    { label: t("filterRoleAdmin"), role: "admin" as const, tone: "violet" as const },
    { label: t("filterRoleUser"), role: "user" as const, tone: "blue" as const },
    { label: t("filterRoleViewer"), role: "viewer" as const, tone: "slate" as const },
  ].map((item) => ({
    ...item,
    count: permissions.filter((permission) => permission.roles.includes(item.role)).length,
    percent: permissions.length > 0
      ? Math.round((permissions.filter((permission) => permission.roles.includes(item.role)).length / permissions.length) * 100)
      : 0,
  }))), [permissions, t])

  const recentLoginItems = useMemo(() => (
    [...users]
      .filter((user) => user.last_login_at)
      .sort((a, b) => new Date(b.last_login_at || 0).getTime() - new Date(a.last_login_at || 0).getTime())
      .slice(0, 5)
      .map((user) => ({
        id: user.id,
        icon: user.role === "admin" ? Shield : user.role === "viewer" ? Eye : Users,
        title: user.username,
        description: user.email,
        time: formatUserTime(user.last_login_at),
        tone: user.role === "admin" ? "violet" as const : user.role === "viewer" ? "slate" as const : "blue" as const,
      }))
  ), [users])

  return (
    <>
      {confirmDialog}
      <PageHeader title={t("pageTitle")} />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 pt-0 sm:gap-4 sm:p-4 sm:pt-0 xl:overflow-hidden">
        <div className="flex shrink-0 flex-col gap-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>集中维护团队成员、角色权限和账号风险，保持小团队协作边界清晰。</p>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
            <span>组织状态正常</span>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          <DashboardMetricCard title={t("statsTotalUsers")} value={statistics.totalUsers} icon={Users} tone="emerald" spark={userSpark} loading={loading} />
          <DashboardMetricCard title="近 7 天活跃" value={recentActiveUsers.length} icon={Users} tone="blue" spark={userSpark} loading={loading} />
          <DashboardMetricCard title={t("statsAdmins")} value={statistics.adminUsers} icon={Shield} tone="violet" spark={userSpark} loading={loading} />
          <DashboardMetricCard title="锁定账户" value={lockedUsers.length} icon={Shield} tone={lockedUsers.length > 0 ? "rose" : "slate"} spark={lockedUsers.map(() => 1)} loading={loading} />
          <DashboardMetricCard title={t("tabPermissions")} value={permissions.length} icon={KeyRound} tone="amber" spark={permissionModuleStats.map((item) => item.count)} loading={loading} />
        </div>

        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(340px,0.9fr)] xl:overflow-hidden">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "users" | "permissions")} className="flex min-h-0 flex-col">
            <div className="flex shrink-0 flex-col gap-3 rounded-md border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <h2 className="text-base font-semibold">成员与权限工作区</h2>
                <p className="mt-1 text-sm text-muted-foreground">在同一工作区维护成员账号、角色策略和模块授权。</p>
              </div>
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
            </div>

            {/* 用户列表 Tab */}
            <TabsContent value="users" className="mt-3 min-h-0 flex-1 overflow-hidden">
              <DataTable
                  data={users}
                  columns={columns}
                  loading={loading || refreshing}
                  emptyMessage={t("tableEmpty")}
                  enableRowSelection={true}
                  className="min-h-0"
                  density="compact"
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
            <TabsContent value="permissions" className="mt-3 min-h-0 flex-1 overflow-hidden">
              <DataTable
                  data={permissions}
                  columns={permissionColumns}
                  loading={loading}
                  emptyMessage={t("permTableEmpty")}
                  enableRowSelection={true}
                  className="min-h-0"
                  density="compact"
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

          <div className="scrollbar-custom grid min-h-0 gap-3 overflow-visible xl:overflow-auto xl:pr-1">
            <Card className="gap-0 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">角色分布</h2>
                <InlineStatusBadge label={`${statistics.totalUsers} 人`} tone="emerald" />
              </div>
              <div className="mt-4 space-y-3 text-sm">
                {roleDistribution.map((item) => {
                  const percent = statistics.totalUsers > 0 ? Math.round((item.value / statistics.totalUsers) * 100) : 0
                  return (
                    <div key={item.label} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <InlineStatusBadge label={item.label} tone={item.tone} />
                        <span className="text-muted-foreground tabular-nums">{item.value} / {percent}%</span>
                      </div>
                      <Progress value={percent} className="h-1.5" />
                    </div>
                  )
                })}
              </div>
            </Card>

            <Card className="gap-0 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">权限覆盖</h2>
                <InlineStatusBadge label={`${permissions.length} 项`} tone="amber" />
              </div>
              <div className="mt-4 space-y-3 text-sm">
                {rolePermissionCoverage.map((item) => (
                  <div key={item.role} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <InlineStatusBadge label={item.label} tone={item.tone} />
                      <span className="text-muted-foreground tabular-nums">{item.count} / {item.percent}%</span>
                    </div>
                    <Progress value={item.percent} className="h-1.5" />
                  </div>
                ))}
              </div>
            </Card>

            <Card className="gap-0 p-4 sm:p-5">
              <h2 className="text-base font-semibold">模块权限</h2>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                {permissionModuleStats.map((item) => (
                  <div key={item.module} className="rounded-md bg-muted/50 p-3">
                    <div className="truncate text-xs text-muted-foreground">{item.label}</div>
                    <div className="mt-1 font-semibold tabular-nums">{item.count}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="gap-0 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">账号风险</h2>
                <InlineStatusBadge label={lockedUsers.length === 0 ? "无锁定" : `${lockedUsers.length} 个锁定`} tone={lockedUsers.length === 0 ? "emerald" : "rose"} />
              </div>
              <div className="mt-4 space-y-2">
                {lockedUsers.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">暂无锁定账户</div>
                ) : lockedUsers.slice(0, 4).map((user) => (
                  <div key={user.id} className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-medium">{user.username}</span>
                      <InlineStatusBadge label="锁定" tone="rose" />
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">{user.lock_reason || formatUserTime(user.locked_until)}</div>
                  </div>
                ))}
              </div>
            </Card>

            <DashboardSideList
              title="最近登录"
              empty="暂无登录记录"
              items={recentLoginItems}
            />
          </div>
        </div>
      </div>

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
