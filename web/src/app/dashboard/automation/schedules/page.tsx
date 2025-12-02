"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
 Calendar,
 Play,
 Pause,
 Edit,
 Trash2,
 CheckCircle,
 XCircle,
 Zap,
 Server as ServerIcon,
 RefreshCw,
 Loader2,
 Terminal,
 FileText
} from "lucide-react"
import {
 scheduledTasksApi,
 scriptsApi,
 serversApi,
 type ScheduledTask,
 type Script,
 type Server
} from "@/lib/api"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { useClientAuth } from "@/components/client-auth-provider"
import { useSystemConfig } from "@/hooks/use-system-config"
import { formatInTimezone, getEffectiveLocale, getEffectiveTimezone } from "@/utils/datetime"
import { useTranslations } from "next-intl"

export default function AutomationSchedulesPage() {
 const { ready } = useAuthReady()
 const { user } = useClientAuth()
 const { data: systemConfig } = useSystemConfig()
 const effectiveLocale = getEffectiveLocale(user, systemConfig || null)
 const effectiveTimezone = getEffectiveTimezone(user, systemConfig || null)
 const t = useTranslations("automationSchedules")
 // 数据状态
 const [tasks, setTasks] = useState<ScheduledTask[]>([])
 const [servers, setServers] = useState<Server[]>([])
 const [scripts, setScripts] = useState<Script[]>([])
 const [loading, setLoading] = useState(true)
 const [refreshing, setRefreshing] = useState(false)

 // 统计状态
 const [statistics, setStatistics] = useState({
 total: 0,
 enabled: 0,
 disabled: 0,
 totalRuns: 0,
 })

 // 筛选状态
 const [searchTerm, setSearchTerm] = useState("")
 const [selectedStatus, setSelectedStatus] = useState<string>("all")
 const [selectedType, setSelectedType] = useState<string>("all")

 // 对话框状态
 const [isDialogOpen, setIsDialogOpen] = useState(false)
 const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
 const [isScriptLibraryOpen, setIsScriptLibraryOpen] = useState(false)
 const [editingTaskId, setEditingTaskId] = useState<string | null>(null)

 // 新建任务表单状态
 const [newTask, setNewTask] = useState({
 task_name: "",
 description: "",
 task_type: "command" as "command" | "script" | "batch",
 command: "",
 script_id: null as string | null,
 cron_expression: "",
 timezone: "Asia/Shanghai",
 enabled: true,
 server_ids: [] as string[],
 })

 // 编辑任务表单状态
 const [editTask, setEditTask] = useState({
 task_name: "",
 description: "",
 command: "",
 cron_expression: "",
 timezone: "Asia/Shanghai",
 enabled: true,
 server_ids: [] as string[],
 })

 // 服务器选择器状态
 const serverSearchTerm = "" // TODO: 实现服务器搜索功能
 const [scriptSearchTerm, setScriptSearchTerm] = useState("")

 // 加载所有数据
 const loadData = async () => {
 try {
// 并行加载所有数据
 const [tasksRes, serversRes, scriptsRes, statsRes] = await Promise.all([
 scheduledTasksApi.list({ page: 1, limit: 100 }),
 serversApi.list(),
 scriptsApi.list({ page: 1, limit: 100 }),
 scheduledTasksApi.getStatistics(),
 ])

 // 现在 apiFetch 不会解包包含分页元数据的响应，直接访问 data 字段
 const tasksList = Array.isArray(tasksRes?.data) ? tasksRes.data : []
 const serversList = Array.isArray(serversRes?.data) ? serversRes.data : []
 const scriptsList = Array.isArray(scriptsRes?.data) ? scriptsRes.data : []
 const statsData = statsRes?.data || statsRes || {}

 setTasks(Array.isArray(tasksList) ? tasksList : [])
 setServers(Array.isArray(serversList) ? serversList : [])
 setScripts(Array.isArray(scriptsList) ? scriptsList : [])
 setStatistics({
 total: statsData.total_tasks || 0,
 enabled: statsData.enabled_tasks || 0,
 disabled: statsData.disabled_tasks || 0,
 totalRuns: statsData.total_runs || 0,
 })
 } catch (error: unknown) {
 console.error("加载数据失败:", error)

 // 确保状态为空数组，避免undefined错误
 setTasks([])
 setServers([])
 setScripts([])

 toast.error(getErrorMessage(error, "加载数据失败"))
 } finally {
 setLoading(false)
 setRefreshing(false)
 }
 }

 // 刷新数据
 const handleRefresh = async () => {
 setRefreshing(true)
 await loadData()
 }

 // 初始加载（仅在已认证且全局状态就绪时触发）
 useEffect(() => {
   if (!ready) return
   loadData()
 }, [ready])

 // 过滤任务
 const filteredTasks = tasks.filter((task) => {
 const matchesSearch =
 task.task_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
 task.description.toLowerCase().includes(searchTerm.toLowerCase())
 const matchesStatus =
 selectedStatus === "all" ||
 (selectedStatus === "enabled" && task.enabled) ||
 (selectedStatus === "disabled" && !task.enabled)
 const matchesType = selectedType === "all" || task.task_type === selectedType
 return matchesSearch && matchesStatus && matchesType
 })

 // 过滤服务器
 const filteredServers = servers.filter(
 (server) =>
 (server.name?.toLowerCase().includes(serverSearchTerm.toLowerCase()) ?? false) ||
 server.host.toLowerCase().includes(serverSearchTerm.toLowerCase())
 )

 // 过滤脚本
 const filteredScripts = scripts.filter(
 (script) =>
 script.name.toLowerCase().includes(scriptSearchTerm.toLowerCase()) ||
 (script.description &&
 script.description.toLowerCase().includes(scriptSearchTerm.toLowerCase()))
 )

 // 服务器选择处理
 const toggleServer = (serverId: string) => {
 const server = servers.find((s) => s.id === serverId)
 if (server && server.status !== "online") {
 toast.warning(t("toastOnlyOnline"))
 return
 }

 setNewTask((prev) => ({
 ...prev,
 server_ids: prev.server_ids.includes(serverId)
 ? prev.server_ids.filter((id) => id !== serverId)
 : [...prev.server_ids, serverId],
 }))
 }

 // 编辑模式的服务器选择
 const toggleEditServer = (serverId: string) => {
 const server = servers.find((s) => s.id === serverId)
 if (server && server.status !== "online") {
 toast.warning(t("toastOnlyOnline"))
 return
 }

 setEditTask((prev) => ({
 ...prev,
 server_ids: prev.server_ids.includes(serverId)
 ? prev.server_ids.filter((id) => id !== serverId)
 : [...prev.server_ids, serverId],
 }))
 }

 // 全选/取消全选服务器
 const toggleSelectAll = () => {
 const onlineServers = filteredServers.filter((s) => s.status === "online")
 if (newTask.server_ids.length === onlineServers.length) {
 setNewTask({ ...newTask, server_ids: [] })
 } else {
 setNewTask({ ...newTask, server_ids: onlineServers.map((s) => s.id) })
 }
 }

 // 编辑模式全选/取消全选
 const toggleEditSelectAll = () => {
 const onlineServers = filteredServers.filter((s) => s.status === "online")
 if (editTask.server_ids.length === onlineServers.length) {
 setEditTask({ ...editTask, server_ids: [] })
 } else {
 setEditTask({ ...editTask, server_ids: onlineServers.map((s) => s.id) })
 }
 }

 // 从脚本库选择脚本
 const handleSelectScript = (script: Script) => {
 setNewTask({
 ...newTask,
 command: script.content,
 script_id: script.id,
 task_type: "script",
 })
 setIsScriptLibraryOpen(false)
 setScriptSearchTerm("")
 }

 // 创建定时任务
 const handleCreateTask = async () => {
 if (!newTask.task_name || !newTask.cron_expression) {
 toast.error(t("toastMustNameCron"))
 return
 }

 if (newTask.task_type === "command" && !newTask.command) {
 toast.error(t("toastCmdRequired"))
 return
 }

 if (newTask.task_type === "script" && !newTask.script_id && !newTask.command) {
 toast.error(t("toastScriptRequired"))
 return
 }

 if (newTask.server_ids.length === 0) {
 toast.error(t("toastSelectServer"))
 return
 }

 try {
 // 认证基于 HttpOnly Cookie

 await scheduledTasksApi.create({
 task_name: newTask.task_name,
 task_type: newTask.task_type,
 command: newTask.command || undefined,
 script_id: newTask.script_id || undefined,
 server_ids: newTask.server_ids,
 cron_expression: newTask.cron_expression,
 timezone: newTask.timezone,
 enabled: newTask.enabled,
 description: newTask.description || undefined,
 })

 toast.success(t("toastCreateSuccess"))
 setIsDialogOpen(false)

 // 重置表单
 setNewTask({
 task_name: "",
 description: "",
 task_type: "command",
 command: "",
 script_id: null,
 cron_expression: "",
 timezone: "Asia/Shanghai",
 enabled: true,
 server_ids: [],
 })

 // 重新加载任务列表
 await loadData()
 } catch (error: unknown) {
 console.error("创建定时任务失败:", error)
 toast.error(getErrorMessage(error, t("toastCreateFailed")))
 }
 }

 // 编辑任务
 const handleEdit = (task: ScheduledTask) => {
 setEditingTaskId(task.id)
 setEditTask({
 task_name: task.task_name,
 description: task.description || "",
 command: task.command || "",
 cron_expression: task.cron_expression,
 timezone: task.timezone,
 enabled: task.enabled,
 server_ids: task.server_ids || [],
 })
 setIsEditDialogOpen(true)
 }

 // 更新定时任务
 const handleUpdateTask = async () => {
 if (!editTask.task_name || !editTask.cron_expression) {
 toast.error(t("toastMustNameCron"))
 return
 }

 if (editingTaskId === null) return

 try {
 // 认证基于 HttpOnly Cookie

 await scheduledTasksApi.update(editingTaskId, {
 task_name: editTask.task_name,
 command: editTask.command || undefined,
 server_ids: editTask.server_ids,
 cron_expression: editTask.cron_expression,
 timezone: editTask.timezone,
 enabled: editTask.enabled,
 description: editTask.description || undefined,
 })

 toast.success(t("toastUpdateSuccess"))
 setIsEditDialogOpen(false)
 setEditingTaskId(null)

 // 重置表单
 setEditTask({
 task_name: "",
 description: "",
 command: "",
 cron_expression: "",
 timezone: "Asia/Shanghai",
 enabled: true,
 server_ids: [],
 })

 // 重新加载任务列表
 await loadData()
 } catch (error: unknown) {
 console.error("更新定时任务失败:", error)
 toast.error(getErrorMessage(error, t("toastUpdateFailed")))
 }
 }

 // 删除任务
 const handleDelete = async (taskId: string) => {
 if (!confirm(t("toastDeleteConfirm"))) {
 return
 }

 try {
 // 认证基于 HttpOnly Cookie

 await scheduledTasksApi.delete(taskId)
 toast.success(t("toastDeleteSuccess"))
 await loadData()
 } catch (error: unknown) {
 console.error("删除定时任务失败:", error)
 toast.error(getErrorMessage(error, t("toastDeleteFailed")))
 }
 }

 // 启用/禁用任务
 const handleToggle = async (taskId: string, enabled: boolean) => {
 try {
 // 认证基于 HttpOnly Cookie

 await scheduledTasksApi.toggle(taskId, !enabled)
 toast.success(enabled ? t("toastToggleDisabled") : t("toastToggleEnabled"))
 await loadData()
 } catch (error: unknown) {
 console.error("切换任务状态失败:", error)
 toast.error(getErrorMessage(error, t("toastToggleFailed")))
 }
 }

 // 手动触发任务
 const handleTrigger = async (taskId: string) => {
 try {
 // 认证基于 HttpOnly Cookie

 await scheduledTasksApi.trigger(taskId)
 toast.success(t("toastTriggerSuccess"))
 await loadData()
 } catch (error: unknown) {
 console.error("触发任务失败:", error)
 toast.error(getErrorMessage(error, t("toastTriggerFailed")))
 }
 }

 // 格式化日期（按用户/系统时区）
 const formatDate = (dateString: string | undefined) => {
   if (!dateString) return "-"
   return formatInTimezone(
     dateString,
     { second: undefined },
     effectiveLocale,
     effectiveTimezone,
   )
 }

 // 计算成功率
 const calculateSuccessRate = (task: ScheduledTask) => {
 if (task.run_count === 0) return 100
 const successCount = task.run_count - task.failure_count
 return ((successCount / task.run_count) * 100).toFixed(1)
 }

 // 获取类型图标
 const getTypeIcon = (type: string) => {
 switch (type) {
 case "command":
 return <Terminal className="h-4 w-4" />
 case "script":
 return <FileText className="h-4 w-4" />
 case "batch":
 return <Zap className="h-4 w-4" />
 default:
 return <ServerIcon className="h-4 w-4" />
 }
 }

 // 获取类型名称
 const getTypeName = (type: string) => {
 switch (type) {
 case "command":
 return t("typeCommand")
 case "script":
 return t("typeScript")
 case "batch":
 return t("typeBatch")
 default:
 return type
 }
 }

 // 获取状态Badge
 const getStatusBadge = (task: ScheduledTask) => {
 if (!task.enabled) {
 return <Badge variant="secondary">{t("statusDisabled")}</Badge>
 }

 if (task.last_status === "success") {
 return <Badge className="bg-green-100 text-green-800">{t("statusRunning")}</Badge>
 } else if (task.last_status === "failed") {
 return <Badge className="bg-red-100 text-red-800">{t("statusFailed")}</Badge>
 }

 return <Badge className="bg-blue-100 text-blue-800">{t("statusPending")}</Badge>
 }

 return (
 <>
 <PageHeader
 title={t("pageTitle")}>
 <div className="flex items-center gap-2">
 <Button
 variant="outline"
 size="sm"
 onClick={handleRefresh}
 disabled={refreshing}
 >
 <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
 {t("refresh")}
 </Button>
 <Button onClick={() => setIsDialogOpen(true)}>
 <Plus className="mr-2 h-4 w-4" />
 {t("newTask")}
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
 <CardTitle className="text-sm font-medium">{t("statsTotalTasks")}</CardTitle>
 <Calendar className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{statistics.total}</div>
 <p className="text-xs text-muted-foreground">{t("statsTotalTasksDesc")}</p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">{t("statsEnabled")}</CardTitle>
 <CheckCircle className="h-4 w-4 text-green-600" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{statistics.enabled}</div>
 <p className="text-xs text-muted-foreground">{t("statsEnabledDesc")}</p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">{t("statsDisabled")}</CardTitle>
 <Pause className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{statistics.disabled}</div>
 <p className="text-xs text-muted-foreground">{t("statsDisabledDesc")}</p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">{t("statsTotalRuns")}</CardTitle>
 <Zap className="h-4 w-4 text-yellow-600" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{statistics.totalRuns}</div>
 <p className="text-xs text-muted-foreground">{t("statsTotalRunsDesc")}</p>
 </CardContent>
 </Card>
 </div>

 {/* 搜索和筛选 */}
 <div className="flex flex-col gap-4">
 <div className="flex items-center gap-4">
<div className="relative flex-1 max-w-md">
<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
<Input
 placeholder={t("searchPlaceholder")}
 className="pl-10"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 />
 </div>

<Select value={selectedStatus} onValueChange={setSelectedStatus}>
<SelectTrigger className="w-[150px]">
 <SelectValue placeholder={t("statusFilterPlaceholder")} />
</SelectTrigger>
<SelectContent>
 <SelectItem value="all">{t("statusFilterAll")}</SelectItem>
 <SelectItem value="enabled">{t("statusFilterEnabled")}</SelectItem>
 <SelectItem value="disabled">{t("statusFilterDisabled")}</SelectItem>
 </SelectContent>
 </Select>

<Select value={selectedType} onValueChange={setSelectedType}>
<SelectTrigger className="w-[150px]">
 <SelectValue placeholder={t("typeFilterPlaceholder")} />
</SelectTrigger>
<SelectContent>
 <SelectItem value="all">{t("typeFilterAll")}</SelectItem>
 <SelectItem value="command">{t("typeCommand")}</SelectItem>
 <SelectItem value="script">{t("typeScript")}</SelectItem>
 <SelectItem value="batch">{t("typeBatch")}</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>

 {/* 任务列表 */}
 <Card>
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead className="w-[200px]">{t("tableColTaskName")}</TableHead>
 <TableHead className="w-[100px]">{t("tableColType")}</TableHead>
 <TableHead className="w-[120px]">{t("tableColCron")}</TableHead>
 <TableHead className="w-[100px]">{t("tableColStatus")}</TableHead>
 <TableHead className="w-[150px]">{t("tableColLastRun")}</TableHead>
 <TableHead className="w-[150px]">{t("tableColNextRun")}</TableHead>
 <TableHead className="w-[80px] text-center">{t("tableColRunCount")}</TableHead>
 <TableHead className="w-[80px] text-center">{t("tableColSuccessRate")}</TableHead>
 <TableHead className="w-[120px] text-right">{t("tableColActions")}</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filteredTasks.length === 0 ? (
 <TableRow>
 <TableCell colSpan={9} className="h-32 text-center">
 <div className="flex flex-col items-center justify-center text-muted-foreground">
 <Calendar className="h-8 w-8 mb-2" />
 <p className="text-sm">
 {searchTerm || selectedStatus !== "all" || selectedType !== "all"
 ? t("emptyFiltered")
 : t("emptyAll")}
 </p>
 </div>
 </TableCell>
 </TableRow>
 ) : (
 filteredTasks.map((task) => (
 <TableRow key={task.id}>
 <TableCell className="font-medium">
 <div className="flex flex-col">
 <span>{task.task_name}</span>
 {task.description && (
 <span className="text-xs text-muted-foreground line-clamp-1">
 {task.description}
 </span>
 )}
 </div>
 </TableCell>
 <TableCell>
 <div className="flex items-center gap-2">
 {getTypeIcon(task.task_type)}
 <span className="text-sm">{getTypeName(task.task_type)}</span>
 </div>
 </TableCell>
 <TableCell>
 <code className="text-xs bg-muted px-2 py-1 rounded">
 {task.cron_expression}
 </code>
 </TableCell>
 <TableCell>{getStatusBadge(task)}</TableCell>
 <TableCell>
 <div className="flex flex-col text-sm">
 <span>{formatDate(task.last_run_at)}</span>
 {task.last_status && (
 <div className="flex items-center gap-1 mt-1">
 {task.last_status === "success" ? (
 <CheckCircle className="h-3 w-3 text-green-600" />
 ) : (
 <XCircle className="h-3 w-3 text-red-600" />
 )}
 <span className="text-xs text-muted-foreground">
 {task.last_status === "success" ? t("lastStatusSuccess") : t("lastStatusFailed")}
 </span>
 </div>
 )}
 </div>
 </TableCell>
 <TableCell>
 <span className="text-sm">{formatDate(task.next_run_at)}</span>
 </TableCell>
 <TableCell className="text-center">
 <span className="text-sm">{task.run_count}</span>
 </TableCell>
 <TableCell className="text-center">
 <span className="text-sm">{calculateSuccessRate(task)}%</span>
 </TableCell>
 <TableCell className="text-right">
 <div className="flex items-center justify-end gap-1">
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleToggle(task.id, task.enabled)}
 className="h-8 w-8 p-0"
 title={task.enabled ? t("tooltipToggleDisable") : t("tooltipToggleEnable")}
 >
 {task.enabled ? (
 <Pause className="h-4 w-4" />
 ) : (
 <Play className="h-4 w-4" />
 )}
 </Button>
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
 <MoreHorizontal className="h-4 w-4" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
 <DropdownMenuItem onClick={() => handleTrigger(task.id)}>
 <Zap className="mr-2 h-4 w-4" />
 {t("actionImmediateRun")}
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => handleEdit(task)}>
 <Edit className="mr-2 h-4 w-4" />
 {t("actionEdit")}
 </DropdownMenuItem>
 <DropdownMenuItem
 onClick={() => handleDelete(task.id)}
 className="text-destructive"
 >
 <Trash2 className="mr-2 h-4 w-4" />
 {t("actionDelete")}
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 </div>
 </TableCell>
 </TableRow>
 ))
 )}
 </TableBody>
 </Table>
 </Card>
 </div>
 )}

 {/* 新建任务对话框 */}
 <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
 <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
 <DialogHeader className="shrink-0">
 <DialogTitle>{t("dialogCreateTitle")}</DialogTitle>
 <DialogDescription>{t("dialogCreateDescription")}</DialogDescription>
 </DialogHeader>

 <div className="space-y-4 py-4 flex-1 min-h-0 overflow-y-auto scrollbar-custom">
 {/* 任务名称 */}
 <div className="space-y-2">
 <Label htmlFor="task-name">
 {t("fieldTaskName")} <span className="text-destructive">*</span>
 </Label>
 <Input
 id="task-name"
 placeholder={t("fieldTaskNamePlaceholder")}
 value={newTask.task_name}
 onChange={(e) => setNewTask({ ...newTask, task_name: e.target.value })}
 />
 </div>

 {/* 任务描述 */}
 <div className="space-y-2">
 <Label htmlFor="task-description">{t("fieldTaskDescription")}</Label>
 <Input
 id="task-description"
 placeholder={t("fieldTaskDescriptionPlaceholder")}
 value={newTask.description}
 onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
 />
 </div>

 {/* 任务类型 */}
 <div className="space-y-2">
 <Label htmlFor="task-type">
 {t("fieldTaskType")} <span className="text-destructive">*</span>
 </Label>
 <Select
 value={newTask.task_type}
 onValueChange={(value: "command" | "script" | "batch") =>
 setNewTask({ ...newTask, task_type: value })
 }
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="command">{t("typeCommand")}</SelectItem>
 <SelectItem value="script">{t("typeScript")}</SelectItem>
 <SelectItem value="batch">{t("typeBatch")}</SelectItem>
 </SelectContent>
 </Select>
 </div>

 {/* 命令/脚本内容 */}
 {newTask.task_type !== "batch" && (
 <div className="space-y-2">
 <Label htmlFor="task-command">
 {newTask.task_type === "command" ? t("fieldCommandLabel") : t("fieldScriptLabel")}{" "}
 <span className="text-destructive">*</span>
 </Label>
 <div className="flex gap-2">
 <Textarea
 id="task-command"
 placeholder={
 newTask.task_type === "command"
 ? t("fieldCommandPlaceholder")
 : t("fieldScriptPlaceholder")
 }
 className="font-mono min-h-[100px]"
 value={newTask.command}
 onChange={(e) => setNewTask({ ...newTask, command: e.target.value })}
 />
 {newTask.task_type === "script" && (
 <Button
 type="button"
 variant="outline"
 onClick={() => setIsScriptLibraryOpen(true)}
 >
 {t("scriptLibraryButton")}
 </Button>
 )}
 </div>
 </div>
 )}

 {/* 服务器选择 */}
    <div className="space-y-2">
    <Label>
    {t("fieldTargetServers")} <span className="text-destructive">*</span>
    </Label>
    <div className="border rounded-md p-3 max-h-[200px] overflow-y-auto">
    <div className="flex items-center justify-between mb-2">
    <span className="text-sm text-muted-foreground">
    {t("selectedServersCount", { selected: newTask.server_ids.length })}
    </span>
 <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
 {newTask.server_ids.length === servers.filter((s) => s.status === "online").length
 ? t("unselectAll")
 : t("selectAll")}
 </Button>
 </div>
 <div className="space-y-1">
 {servers
 .filter((s) => s.status === "online")
 .map((server) => (
 <div
 key={server.id}
 className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-accent ${
 newTask.server_ids.includes(server.id) ? "bg-accent" : ""
 }`}
 onClick={() => toggleServer(server.id)}
 >
 <input
 type="checkbox"
 checked={newTask.server_ids.includes(server.id)}
 onChange={() => toggleServer(server.id)}
 className="cursor-pointer"
 />
 <div className="flex-1">
 <div className="font-medium text-sm">{server.name || server.host}</div>
 <div className="text-xs text-muted-foreground">{server.host}</div>
 </div>
 <Badge variant="outline" className="text-xs">
 {server.status}
 </Badge>
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* Cron表达式 */}
 <div className="space-y-2">
 <Label htmlFor="cron-expression">
 {t("fieldCronExpression")} <span className="text-destructive">*</span>
 </Label>
 <Input
 id="cron-expression"
 placeholder={t("fieldCronPlaceholder")}
 value={newTask.cron_expression}
 onChange={(e) => setNewTask({ ...newTask, cron_expression: e.target.value })}
 className="font-mono"
 />
 <p className="text-xs text-muted-foreground">
 {t("fieldCronHelp")}
 </p>
 </div>

 {/* 时区 */}
 <div className="space-y-2">
 <Label htmlFor="timezone">{t("fieldTimezone")}</Label>
 <Select
 value={newTask.timezone}
 onValueChange={(value) => setNewTask({ ...newTask, timezone: value })}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="Asia/Shanghai">{t("timezoneAsiaShanghai")}</SelectItem>
 <SelectItem value="UTC">{t("timezoneUTC")}</SelectItem>
 <SelectItem value="America/New_York">{t("timezoneAmericaNewYork")}</SelectItem>
 <SelectItem value="Europe/London">{t("timezoneEuropeLondon")}</SelectItem>
 </SelectContent>
 </Select>
 </div>

 {/* 启用状态 */}
 <div className="flex items-center gap-2">
 <input
 type="checkbox"
 id="task-enabled"
 checked={newTask.enabled}
 onChange={(e) => setNewTask({ ...newTask, enabled: e.target.checked })}
 className="cursor-pointer"
 />
 <Label htmlFor="task-enabled" className="cursor-pointer">
 {t("fieldEnableOnCreate")}
 </Label>
 </div>
 </div>

 <DialogFooter className="shrink-0">
 <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
 {t("dialogCancel")}
 </Button>
 <Button onClick={handleCreateTask}>{t("dialogCreateSubmit")}</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* 编辑任务对话框 */}
 <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
 <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
 <DialogHeader className="shrink-0">
 <DialogTitle>{t("dialogEditTitle")}</DialogTitle>
 <DialogDescription>{t("dialogEditDescription")}</DialogDescription>
 </DialogHeader>

 <div className="space-y-4 py-4 flex-1 min-h-0 overflow-y-auto scrollbar-custom">
 {/* 任务名称 */}
 <div className="space-y-2">
 <Label htmlFor="edit-task-name">
 {t("fieldTaskName")} <span className="text-destructive">*</span>
 </Label>
 <Input
 id="edit-task-name"
 placeholder={t("fieldTaskNamePlaceholder")}
 value={editTask.task_name}
 onChange={(e) => setEditTask({ ...editTask, task_name: e.target.value })}
 />
 </div>

 {/* 任务描述 */}
 <div className="space-y-2">
 <Label htmlFor="edit-task-description">{t("fieldTaskDescription")}</Label>
 <Input
 id="edit-task-description"
 placeholder={t("fieldTaskDescriptionPlaceholder")}
 value={editTask.description}
 onChange={(e) => setEditTask({ ...editTask, description: e.target.value })}
 />
 </div>

 {/* 命令内容 */}
 <div className="space-y-2">
 <Label htmlFor="edit-task-command">{t("fieldCommandScriptLabel")}</Label>
 <Textarea
 id="edit-task-command"
 placeholder={t("fieldCommandScriptPlaceholder")}
 className="font-mono min-h-[100px]"
 value={editTask.command}
 onChange={(e) => setEditTask({ ...editTask, command: e.target.value })}
 />
 </div>

 {/* 服务器选择 */}
    <div className="space-y-2">
    <Label>{t("fieldTargetServers")}</Label>
    <div className="border rounded-md p-3 max-h-[200px] overflow-y-auto">
    <div className="flex items-center justify-between mb-2">
    <span className="text-sm text-muted-foreground">
    {t("selectedServersCount", { selected: editTask.server_ids.length })}
    </span>
 <Button variant="ghost" size="sm" onClick={toggleEditSelectAll}>
 {editTask.server_ids.length === servers.filter((s) => s.status === "online").length
 ? t("unselectAll")
 : t("selectAll")}
 </Button>
 </div>
 <div className="space-y-1">
 {servers
 .filter((s) => s.status === "online")
 .map((server) => (
 <div
 key={server.id}
 className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-accent ${
 editTask.server_ids.includes(server.id) ? "bg-accent" : ""
 }`}
 onClick={() => toggleEditServer(server.id)}
 >
 <input
 type="checkbox"
 checked={editTask.server_ids.includes(server.id)}
 onChange={() => toggleEditServer(server.id)}
 className="cursor-pointer"
 />
 <div className="flex-1">
 <div className="font-medium text-sm">{server.name || server.host}</div>
 <div className="text-xs text-muted-foreground">{server.host}</div>
 </div>
 <Badge variant="outline" className="text-xs">
 {server.status}
 </Badge>
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* Cron表达式 */}
 <div className="space-y-2">
 <Label htmlFor="edit-cron-expression">
 {t("fieldCronExpression")} <span className="text-destructive">*</span>
 </Label>
 <Input
 id="edit-cron-expression"
 placeholder={t("fieldCronPlaceholder")}
 value={editTask.cron_expression}
 onChange={(e) => setEditTask({ ...editTask, cron_expression: e.target.value })}
 className="font-mono"
 />
 </div>

 {/* 时区 */}
 <div className="space-y-2">
 <Label htmlFor="edit-timezone">{t("fieldTimezone")}</Label>
 <Select
 value={editTask.timezone}
 onValueChange={(value) => setEditTask({ ...editTask, timezone: value })}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="Asia/Shanghai">{t("timezoneAsiaShanghai")}</SelectItem>
 <SelectItem value="UTC">{t("timezoneUTC")}</SelectItem>
 <SelectItem value="America/New_York">{t("timezoneAmericaNewYork")}</SelectItem>
 <SelectItem value="Europe/London">{t("timezoneEuropeLondon")}</SelectItem>
 </SelectContent>
 </Select>
 </div>

 {/* 启用状态 */}
 <div className="flex items-center gap-2">
 <input
 type="checkbox"
 id="edit-task-enabled"
 checked={editTask.enabled}
 onChange={(e) => setEditTask({ ...editTask, enabled: e.target.checked })}
 className="cursor-pointer"
 />
 <Label htmlFor="edit-task-enabled" className="cursor-pointer">
 {t("fieldEnableTask")}
 </Label>
 </div>
 </div>

 <DialogFooter className="shrink-0">
 <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
 {t("dialogCancel")}
 </Button>
 <Button onClick={handleUpdateTask}>{t("dialogEditSubmit")}</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* 脚本库选择对话框 */}
 <Dialog open={isScriptLibraryOpen} onOpenChange={setIsScriptLibraryOpen}>
 <DialogContent className="max-w-2xl max-h-[80vh]">
 <DialogHeader>
 <DialogTitle>{t("scriptLibraryTitle")}</DialogTitle>
 <DialogDescription>{t("scriptLibraryDescription")}</DialogDescription>
 </DialogHeader>

 <div className="space-y-4">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
 <Input
 placeholder={t("scriptLibrarySearchPlaceholder")}
 className="pl-10"
 value={scriptSearchTerm}
 onChange={(e) => setScriptSearchTerm(e.target.value)}
 />
 </div>

 <div className="border rounded-md max-h-[400px] overflow-y-auto">
 {filteredScripts.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
 <FileText className="h-8 w-8 mb-2" />
 <p className="text-sm">{t("scriptLibraryEmpty")}</p>
 </div>
 ) : (
 <div className="divide-y">
 {filteredScripts.map((script) => (
 <div
 key={script.id}
 className="p-3 hover:bg-accent cursor-pointer"
 onClick={() => handleSelectScript(script)}
 >
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <div className="font-medium">{script.name}</div>
 {script.description && (
 <div className="text-sm text-muted-foreground mt-1">
 {script.description}
 </div>
 )}
 <div className="flex gap-1 mt-2">
 {script.tags.map((tag) => (
 <Badge key={tag} variant="secondary" className="text-xs">
 {tag}
 </Badge>
 ))}
 </div>
 </div>
 </div>
 <div className="mt-2 bg-muted rounded p-2">
 <pre className="text-xs font-mono text-muted-foreground line-clamp-3">
 {script.content}
 </pre>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 </DialogContent>
 </Dialog>
 </>
 )
}
