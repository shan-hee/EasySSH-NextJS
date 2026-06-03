"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
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
import { DataTable } from "@/components/ui/data-table"
import { DataTableToolbar } from "@/components/ui/data-table-toolbar"
import {
 Plus,
 AlertTriangle,
 Calendar,
 CheckCircle,
 Clock3,
 Pause,
 Zap,
 Search,
 FileText,
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
import { useConfirmDialog } from "@/hooks/use-confirm-dialog"
import { formatInTimezone, getEffectiveLocale, getEffectiveTimezone } from "@/utils/datetime"
import { useTranslations } from "next-intl"
import { createScheduledTaskColumns } from "./components/scheduled-task-columns"
import {
  DashboardMetricCard,
  DashboardSideList,
  InlineStatusBadge,
} from "../../logs/components/log-dashboard-widgets"

export default function AutomationSchedulesPage() {
 const { ready } = useAuthReady()
 const { user } = useClientAuth()
 const { data: systemConfig } = useSystemConfig()
 const effectiveLocale = getEffectiveLocale(user, systemConfig || null)
 const effectiveTimezone = getEffectiveTimezone(user, systemConfig || null)
 const t = useTranslations("automationSchedules")
 const { confirm: requestConfirm, confirmDialog } = useConfirmDialog()
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
 const [serverSearchTerm, setServerSearchTerm] = useState("")
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
 const confirmed = await requestConfirm({
 description: t("toastDeleteConfirm"),
 variant: "destructive",
 })
 if (!confirmed) {
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
 const formatDate = useCallback((dateString: string | undefined) => {
   if (!dateString) return "-"
   return formatInTimezone(
     dateString,
     { second: undefined },
     effectiveLocale,
     effectiveTimezone,
   )
 }, [effectiveLocale, effectiveTimezone])

 // 创建表格列配置
 const columns = createScheduledTaskColumns(t, {
 onToggle: handleToggle,
 onTrigger: handleTrigger,
 onEdit: handleEdit,
 onDelete: handleDelete,
 formatDate,
 })

 const failedTaskCount = useMemo(() => (
 tasks.filter((task) => task.last_status === "failed").length
 ), [tasks])

 const totalFailures = useMemo(() => (
 tasks.reduce((sum, task) => sum + (task.failure_count || 0), 0)
 ), [tasks])

 const successRate = useMemo(() => {
 const totalRuns = statistics.totalRuns || tasks.reduce((sum, task) => sum + (task.run_count || 0), 0)
 if (totalRuns === 0) return 100
 return Math.max(0, Math.round(((totalRuns - totalFailures) / totalRuns) * 100))
 }, [statistics.totalRuns, tasks, totalFailures])

 const taskSpark = useMemo(() => (
 tasks.slice(-12).map((task) => task.run_count || 0)
 ), [tasks])

 const typeCounts = useMemo(() => ({
 command: tasks.filter((task) => task.task_type === "command").length,
 script: tasks.filter((task) => task.task_type === "script").length,
 batch: tasks.filter((task) => task.task_type === "batch").length,
 }), [tasks])

 const targetServerCount = useMemo(() => {
 const serverIds = new Set<string>()
 tasks.forEach((task) => (task.server_ids || []).forEach((id) => serverIds.add(id)))
 return serverIds.size
 }, [tasks])

 const upcomingTasks = useMemo(() => (
 [...tasks]
 .filter((task) => task.enabled && task.next_run_at)
 .sort((a, b) => new Date(a.next_run_at || 0).getTime() - new Date(b.next_run_at || 0).getTime())
 .slice(0, 5)
 ), [tasks])

 const recentTasks = useMemo(() => (
 [...tasks]
 .filter((task) => task.last_run_at)
 .sort((a, b) => new Date(b.last_run_at || 0).getTime() - new Date(a.last_run_at || 0).getTime())
 .slice(0, 5)
 ), [tasks])

 const recentFailureItems = useMemo(() => (
 recentTasks
 .filter((task) => task.last_status === "failed")
 .map((task) => ({
 id: task.id,
 icon: AlertTriangle,
 title: task.task_name,
 description: task.description || task.cron_expression,
 time: formatDate(task.last_run_at),
 tone: "rose" as const,
 }))
 ), [formatDate, recentTasks])

 return (
 <>
 {confirmDialog}
 <PageHeader title={t("pageTitle")} />

 <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 pt-0 sm:gap-4 sm:p-4 sm:pt-0 xl:overflow-hidden">
   <div className="flex shrink-0 flex-col gap-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
     <p>集中查看定时任务、执行节奏和失败风险，便于快速判断调度状态。</p>
     <div className="flex items-center gap-2">
       <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
       <span>调度服务运行中</span>
     </div>
   </div>

   <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
     <DashboardMetricCard title={t("statsTotalTasks")} value={statistics.total} icon={Calendar} tone="emerald" spark={taskSpark} loading={loading} />
     <DashboardMetricCard title={t("statsEnabled")} value={statistics.enabled} icon={CheckCircle} tone="blue" spark={tasks.map((task) => task.enabled ? 1 : 0)} loading={loading} />
     <DashboardMetricCard title={t("statsDisabled")} value={statistics.disabled} icon={Pause} tone="amber" spark={tasks.map((task) => task.enabled ? 0 : 1)} loading={loading} />
     <DashboardMetricCard title={t("statsTotalRuns")} value={statistics.totalRuns} icon={Zap} tone="violet" spark={taskSpark} loading={loading} />
     <DashboardMetricCard title="成功率" value={`${successRate}%`} icon={CheckCircle} tone={successRate >= 90 ? "emerald" : successRate >= 70 ? "amber" : "rose"} spark={taskSpark} loading={loading} />
   </div>

   <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(320px,0.85fr)] xl:overflow-hidden">
     <div className="flex min-h-0 flex-col gap-3">
       <Card className="shrink-0 gap-0 p-4 sm:p-5">
         <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
           <div>
             <h2 className="text-base font-semibold">调度时间线</h2>
             <p className="mt-1 text-sm text-muted-foreground">最近准备执行的任务按时间排列，异常任务会在右侧聚合。</p>
           </div>
           <Button size="sm" onClick={() => setIsDialogOpen(true)}>
             <Plus className="mr-2 h-4 w-4" />
             {t("newTask")}
           </Button>
         </div>
         <div className="mt-4 grid gap-2 md:grid-cols-2 2xl:grid-cols-4">
           {upcomingTasks.length === 0 ? (
             <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground md:col-span-2 2xl:col-span-4">
               {t("emptyAll")}
             </div>
           ) : upcomingTasks.slice(0, 4).map((task) => (
             <div key={task.id} className="rounded-md border bg-background p-3">
               <div className="flex items-start justify-between gap-3">
                 <div className="min-w-0">
                   <div className="truncate text-sm font-medium">{task.task_name}</div>
                   <div className="mt-1 truncate text-xs text-muted-foreground">{task.cron_expression}</div>
                 </div>
                 <InlineStatusBadge
                   label={task.task_type === "command" ? t("typeCommand") : task.task_type === "script" ? t("typeScript") : t("typeBatch")}
                   tone={task.task_type === "command" ? "blue" : task.task_type === "script" ? "violet" : "amber"}
                 />
               </div>
               <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                 <span>{formatDate(task.next_run_at)}</span>
                 <span className="tabular-nums">{(task.server_ids || []).length} 台</span>
               </div>
             </div>
           ))}
         </div>
       </Card>

       <DataTable
         data={tasks}
         columns={columns}
         loading={loading || refreshing}
         emptyMessage={t("emptyAll")}
         className="min-h-0"
         density="compact"
         toolbar={(table) => (
           <DataTableToolbar
             table={table}
             searchKey="task_name"
             searchPlaceholder={t("searchPlaceholder")}
             filters={[
               {
                 column: "enabled",
                 title: t("statusFilterPlaceholder"),
                 options: [
                   { label: t("statusFilterEnabled"), value: "enabled" },
                   { label: t("statusFilterDisabled"), value: "disabled" },
                 ],
               },
               {
                 column: "task_type",
                 title: t("typeFilterPlaceholder"),
                 options: [
                   { label: t("typeCommand"), value: "command" },
                   { label: t("typeScript"), value: "script" },
                   { label: t("typeBatch"), value: "batch" },
                 ],
               },
             ]}
             onRefresh={handleRefresh}
             showRefresh={true}
             isRefreshing={refreshing}
           >
             <Button size="sm" onClick={() => setIsDialogOpen(true)}>
               <Plus className="mr-2 h-4 w-4" />
               {t("newTask")}
             </Button>
           </DataTableToolbar>
         )}
       />
     </div>

     <div className="scrollbar-custom grid min-h-0 gap-3 overflow-visible xl:overflow-auto xl:pr-1">
       <Card className="gap-0 p-4 sm:p-5">
         <div className="flex items-center justify-between gap-3">
           <h2 className="text-base font-semibold">任务健康度</h2>
           <InlineStatusBadge label={failedTaskCount === 0 ? "稳定" : "需关注"} tone={failedTaskCount === 0 ? "emerald" : "rose"} />
         </div>
         <div className="mt-4 space-y-4">
           <div>
             <div className="mb-2 flex items-center justify-between text-sm">
               <span className="text-muted-foreground">执行成功率</span>
               <span className="font-semibold tabular-nums">{successRate}%</span>
             </div>
             <Progress value={successRate} className="h-2" />
           </div>
           <div className="grid grid-cols-2 gap-2 text-sm">
             <div className="rounded-md bg-muted/50 p-3">
               <div className="text-xs text-muted-foreground">失败任务</div>
               <div className="mt-1 font-semibold tabular-nums">{failedTaskCount}</div>
             </div>
             <div className="rounded-md bg-muted/50 p-3">
               <div className="text-xs text-muted-foreground">目标服务器</div>
               <div className="mt-1 font-semibold tabular-nums">{targetServerCount}</div>
             </div>
           </div>
         </div>
       </Card>

       <Card className="gap-0 p-4 sm:p-5">
         <h2 className="text-base font-semibold">任务类型分布</h2>
         <div className="mt-4 space-y-3 text-sm">
           {[
             { label: t("typeCommand"), value: typeCounts.command, tone: "blue" as const },
             { label: t("typeScript"), value: typeCounts.script, tone: "violet" as const },
             { label: t("typeBatch"), value: typeCounts.batch, tone: "amber" as const },
           ].map((item) => {
             const percent = statistics.total > 0 ? Math.round((item.value / statistics.total) * 100) : 0
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

       <DashboardSideList
         title="最近异常"
         empty="暂无失败执行"
         items={recentFailureItems}
       />

       <Card className="gap-0 p-4 sm:p-5">
         <div className="flex items-center justify-between gap-3">
           <h2 className="text-base font-semibold">最近执行</h2>
           <Clock3 className="h-4 w-4 text-muted-foreground" />
         </div>
         <div className="mt-4 space-y-2">
           {recentTasks.length === 0 ? (
             <div className="py-8 text-center text-sm text-muted-foreground">{t("emptyAll")}</div>
           ) : recentTasks.map((task) => (
             <div key={task.id} className="flex items-start justify-between gap-3 rounded-md px-1 py-2 hover:bg-accent">
               <div className="min-w-0">
                 <div className="truncate text-sm font-medium">{task.task_name}</div>
                 <div className="truncate text-xs text-muted-foreground">{formatDate(task.last_run_at)}</div>
               </div>
               <InlineStatusBadge
                 label={task.last_status === "failed" ? t("lastStatusFailed") : task.last_status === "success" ? t("lastStatusSuccess") : t("statusPending")}
                 tone={task.last_status === "failed" ? "rose" : task.last_status === "success" ? "emerald" : "slate"}
               />
             </div>
           ))}
         </div>
       </Card>
     </div>
   </div>
 </div>

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
 {newTask.server_ids.length === filteredServers.filter((s) => s.status === "online").length
 ? t("unselectAll")
 : t("selectAll")}
 </Button>
 </div>
 <div className="relative mb-2">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 placeholder={t("serverSearchPlaceholder")}
 className="pl-10"
 value={serverSearchTerm}
 onChange={(e) => setServerSearchTerm(e.target.value)}
 />
 </div>
 <div className="space-y-1">
 {filteredServers
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
 {editTask.server_ids.length === filteredServers.filter((s) => s.status === "online").length
 ? t("unselectAll")
 : t("selectAll")}
 </Button>
 </div>
 <div className="relative mb-2">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 placeholder={t("serverSearchPlaceholder")}
 className="pl-10"
 value={serverSearchTerm}
 onChange={(e) => setServerSearchTerm(e.target.value)}
 />
 </div>
 <div className="space-y-1">
 {filteredServers
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
