"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
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
 Tabs,
 TabsContent,
 TabsList,
 TabsTrigger,
} from "@/components/ui/tabs"
import {
 Play,
 Server as ServerIcon,
 Terminal,
 FileText,
 CheckCircle,
 Clock,
 AlertTriangle,
 Search,
 Download,
 Zap,
 Library,
 Code2,
 Loader2,
 RefreshCw,
 Trash2,
} from "lucide-react"
import { batchTasksApi, scriptsApi, serversApi, type BatchTask, type Script, type Server } from "@/lib/api"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { useClientAuth } from "@/components/client-auth-provider"
import { useSystemConfig } from "@/hooks/use-system-config"
import { formatInTimezone, getEffectiveLocale, getEffectiveTimezone } from "@/utils/datetime"
import { useTranslations } from "next-intl"

export default function AutomationBatchPage() {
 const { ready } = useAuthReady()
 const { user } = useClientAuth()
 const { data: systemConfig } = useSystemConfig()
 const effectiveLocale = getEffectiveLocale(user, systemConfig || null)
 const effectiveTimezone = getEffectiveTimezone(user, systemConfig || null)
 const t = useTranslations("automationBatch")
 // 数据状态
 const [tasks, setTasks] = useState<BatchTask[]>([])
 const [servers, setServers] = useState<Server[]>([])
 const [scripts, setScripts] = useState<Script[]>([])
 const [loading, setLoading] = useState(true)
 const [refreshing, setRefreshing] = useState(false)

 // 统计状态
 const [statistics, setStatistics] = useState({
 total: 0,
 running: 0,
 completed: 0,
 failed: 0,
 })

 // UI状态
 const [selectedServers, setSelectedServers] = useState<string[]>([])
 const [searchTerm, setSearchTerm] = useState("")
 const [taskName, setTaskName] = useState("")
 const [command, setCommand] = useState("")
 const [scriptContent, setScriptContent] = useState("")
 const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null)
 const [filePath, setFilePath] = useState("")
 const [targetPath, setTargetPath] = useState("")
 const [executionMode, setExecutionMode] = useState<"parallel" | "sequential">("parallel")
 const [isExecuting, setIsExecuting] = useState(false)
 const [isScriptLibraryOpen, setIsScriptLibraryOpen] = useState(false)
 const [scriptSearchTerm, setScriptSearchTerm] = useState("")

 // 加载所有数据
 const loadData = async () => {
 try {
// 并行加载所有数据
 const [tasksRes, serversRes, scriptsRes, statsRes] = await Promise.all([
 batchTasksApi.list({ page: 1, limit: 100 }),
 serversApi.list(),
 scriptsApi.list({ page: 1, limit: 100 }),
 batchTasksApi.getStatistics(),
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
 running: statsData.running_tasks || 0,
 completed: statsData.completed_tasks || 0,
 failed: statsData.failed_tasks || 0,
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
 const filteredServers = servers.filter(server =>
 (server.name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
 server.host.toLowerCase().includes(searchTerm.toLowerCase())
 )

 // 过滤脚本
 const filteredScripts = scripts.filter(script =>
 script.name.toLowerCase().includes(scriptSearchTerm.toLowerCase()) ||
 (script.description && script.description.toLowerCase().includes(scriptSearchTerm.toLowerCase())) ||
 script.tags.some(tag => tag.toLowerCase().includes(scriptSearchTerm.toLowerCase()))
 )

 // 切换服务器选择
 const toggleServer = (serverId: string) => {
 const server = servers.find(s => s.id === serverId)
 if (server && server.status !== "online") {
 toast.warning(t("toastOnlyOnlineServers"))
 return
 }

 setSelectedServers(prev =>
 prev.includes(serverId)
 ? prev.filter(id => id !== serverId)
 : [...prev, serverId]
 )
 }

 // 全选/取消全选（只选择在线服务器）
 const toggleSelectAll = () => {
 const onlineServers = filteredServers.filter(s => s.status === "online")
 if (selectedServers.length === onlineServers.length) {
 setSelectedServers([])
 } else {
 setSelectedServers(onlineServers.map(s => s.id))
 }
 }

 // 执行批量命令
 const handleExecuteCommand = async () => {
 if (selectedServers.length === 0) {
 toast.error(t("toastSelectAtLeastOneServer"))
 return
 }
 if (!command.trim()) {
 toast.error(t("fieldCommandPlaceholder"))
 return
 }
 if (!taskName.trim()) {
 toast.error(t("toastTaskNameRequired"))
 return
 }

 setIsExecuting(true)
 try {
 await batchTasksApi.create({
 task_name: taskName,
 task_type: "command",
 content: command,
 server_ids: selectedServers,
 execution_mode: executionMode,
 })

 toast.success(t("toastCommandTaskCreated"))

 // 重置表单
 setCommand("")
 setTaskName("")
 setSelectedServers([])

 // 重新加载任务列表
 await loadData()
 } catch (error: unknown) {
 console.error("创建任务失败:", error)
 toast.error(getErrorMessage(error, t("toastCreateTaskFailed")))
 } finally {
 setIsExecuting(false)
 }
 }

 // 执行批量脚本
 const handleExecuteScript = async () => {
 if (selectedServers.length === 0) {
 toast.error(t("toastSelectAtLeastOneServer"))
 return
 }
 if (!scriptContent.trim() && !selectedScriptId) {
 toast.error(t("toastEnterCommandOrScript"))
 return
 }
 if (!taskName.trim()) {
 toast.error(t("toastTaskNameRequired"))
 return
 }

 setIsExecuting(true)
 try {
 await batchTasksApi.create({
 task_name: taskName,
 task_type: "script",
 content: scriptContent,
 script_id: selectedScriptId || undefined,
 server_ids: selectedServers,
 execution_mode: executionMode,
 })

 toast.success(t("toastScriptTaskCreated"))

 // 重置表单
 setScriptContent("")
 setSelectedScriptId(null)
 setTaskName("")
 setSelectedServers([])

 // 重新加载任务列表
 await loadData()
 } catch (error: unknown) {
 console.error("创建任务失败:", error)
 toast.error(getErrorMessage(error, t("toastCreateTaskFailed")))
 } finally {
 setIsExecuting(false)
 }
 }

 // 执行文件分发
 const handleDistributeFile = async () => {
 if (selectedServers.length === 0) {
 toast.error(t("toastSelectAtLeastOneServer"))
 return
 }
 if (!filePath.trim() || !targetPath.trim()) {
 toast.error(t("toastEnterFilePaths"))
 return
 }
 if (!taskName.trim()) {
 toast.error(t("toastTaskNameRequired"))
 return
 }

 setIsExecuting(true)
 try {
 await batchTasksApi.create({
 task_name: taskName,
 task_type: "file",
 content: `${filePath} -> ${targetPath}`,
 server_ids: selectedServers,
 execution_mode: executionMode,
 })

 toast.success(t("toastFileTaskCreated"))

 // 重置表单
 setFilePath("")
 setTargetPath("")
 setTaskName("")
 setSelectedServers([])

 // 重新加载任务列表
 await loadData()
 } catch (error: unknown) {
 console.error("创建任务失败:", error)
 toast.error(getErrorMessage(error, t("toastCreateTaskFailed")))
 } finally {
 setIsExecuting(false)
 }
 }

 // 选择脚本库中的脚本
 const handleSelectScript = (script: Script) => {
 setScriptContent(script.content)
 setSelectedScriptId(script.id)
 setIsScriptLibraryOpen(false)
 setScriptSearchTerm("")
 }

// 删除任务
 const handleDeleteTask = async (taskId: string) => {
 if (!confirm(t("toastDeleteConfirm"))) {
 return
 }

 try {
 await batchTasksApi.delete(taskId)
 toast.success(t("toastDeleteSuccess"))
 await loadData()
 } catch (error: unknown) {
 console.error("删除任务失败:", error)
 toast.error(getErrorMessage(error, t("toastDeleteFailed")))
 }
 }

 // 启动任务
 const handleStartTask = async (taskId: string) => {
 try {
 await batchTasksApi.start(taskId)
 toast.success(t("toastStartSuccess"))
 await loadData()
 } catch (error: unknown) {
 console.error("启动任务失败:", error)
 toast.error(getErrorMessage(error, t("toastStartFailed")))
 }
 }

const getStatusBadge = (status: string) => {
 switch (status) {
 case "completed":
 return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">{t("statusCompleted")}</Badge>
 case "running":
 return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">{t("statusRunning")}</Badge>
 case "failed":
 return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">{t("statusFailed")}</Badge>
 case "pending":
 return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">{t("statusPending")}</Badge>
 default:
 return <Badge variant="secondary">{status}</Badge>
 }
 }

 const getTypeIcon = (type: string) => {
 switch (type) {
 case "command":
 return <Terminal className="h-4 w-4" />
 case "file":
 return <FileText className="h-4 w-4" />
 case "script":
 return <Zap className="h-4 w-4" />
 default:
 return <ServerIcon className="h-4 w-4" />
 }
 }

 const formatDate = (dateString: string | undefined) => {
   if (!dateString) return "-"
   return formatInTimezone(
     dateString,
     {},
     effectiveLocale,
     effectiveTimezone,
   )
 }

 const formatDuration = (started: string | undefined, completed: string | undefined) => {
   if (!started) return "-"
   if (!completed) return t("durationInProgress")

   try {
     const start = new Date(started).getTime()
     const end = new Date(completed).getTime()
     const seconds = Math.floor((end - start) / 1000)

     if (seconds < 60) return t("durationSeconds", { seconds })
     if (seconds < 3600) {
       const minutes = Math.floor(seconds / 60)
       const remainingSeconds = seconds % 60
       return t("durationMinutesSeconds", {
         minutes,
         seconds: remainingSeconds,
       })
     }
     const hours = Math.floor(seconds / 3600)
     const minutes = Math.floor((seconds % 3600) / 60)
     return t("durationHoursMinutes", { hours, minutes })
   } catch {
     return "-"
   }
 }

if (loading) {
 return (
 <>
 <PageHeader title={t("pageTitle")} />
 <div className="flex flex-1 items-center justify-center">
 <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
 </div>
 </>
 )
 }

 return (
 <>
 <PageHeader title={t("pageTitle")}>
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
 <Button
 variant="outline"
 size="sm"
 onClick={() => toast.info(t("exportComingSoon"))}
 >
 <Download className="mr-2 h-4 w-4" />
 {t("exportReport")}
 </Button>
 </div>
 </PageHeader>

 <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
 {/* 统计卡片 */}
 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
<Card>
<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">{t("statsTotalTasks")}</CardTitle>
 <ServerIcon className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
<CardContent>
<div className="text-2xl font-bold">{statistics.total}</div>
 <p className="text-xs text-muted-foreground">{t("statsTotalTasksDesc")}</p>
 </CardContent>
 </Card>
<Card>
<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">{t("statsRunning")}</CardTitle>
 <Clock className="h-4 w-4 text-blue-600" />
 </CardHeader>
<CardContent>
<div className="text-2xl font-bold text-blue-600">{statistics.running}</div>
 <p className="text-xs text-muted-foreground">{t("statsRunningDesc")}</p>
 </CardContent>
 </Card>
<Card>
<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">{t("statsCompleted")}</CardTitle>
 <CheckCircle className="h-4 w-4 text-green-600" />
 </CardHeader>
<CardContent>
<div className="text-2xl font-bold text-green-600">{statistics.completed}</div>
 <p className="text-xs text-muted-foreground">{t("statsCompletedDesc")}</p>
 </CardContent>
 </Card>
<Card>
<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">{t("statsFailed")}</CardTitle>
 <AlertTriangle className="h-4 w-4 text-red-600" />
 </CardHeader>
<CardContent>
<div className="text-2xl font-bold text-red-600">{statistics.failed}</div>
 <p className="text-xs text-muted-foreground">{t("statsFailedDesc")}</p>
 </CardContent>
 </Card>
 </div>

 {/* 主要内容区域 */}
<Tabs defaultValue="command" className="flex-1">
<TabsList className="grid w-full grid-cols-3">
<TabsTrigger value="command">
<Terminal className="mr-2 h-4 w-4" />
 {t("tabCommand")}
</TabsTrigger>
<TabsTrigger value="script">
<Code2 className="mr-2 h-4 w-4" />
 {t("tabScript")}
</TabsTrigger>
<TabsTrigger value="file">
<FileText className="mr-2 h-4 w-4" />
 {t("tabFile")}
</TabsTrigger>
 </TabsList>

{/* 批量命令Tab */}
<TabsContent value="command" className="space-y-4">
<Card>
<CardHeader>
 <CardTitle>{t("sectionCommandTitle")}</CardTitle>
 <CardDescription>
 {t("sectionCommandDesc")}
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
<div className="space-y-2">
<Label htmlFor="task-name-cmd">
 {t("fieldTaskName")} <span className="text-destructive">*</span>
</Label>
<Input
id="task-name-cmd"
 placeholder={t("fieldTaskNamePlaceholderExampleUpdate")}
 value={taskName}
 onChange={(e) => setTaskName(e.target.value)}
 />
 </div>

<div className="space-y-2">
<Label htmlFor="command">
 {t("fieldCommandContent")} <span className="text-destructive">*</span>
</Label>
<Textarea
id="command"
 placeholder={t("fieldCommandPlaceholder")}
 className="font-mono"
 rows={4}
 value={command}
 onChange={(e) => setCommand(e.target.value)}
 />
 </div>

<div className="space-y-2">
 <Label>{t("fieldExecutionMode")}</Label>
 <Select value={executionMode} onValueChange={(value: "parallel" | "sequential") => setExecutionMode(value)}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
<SelectContent>
 <SelectItem value="parallel">{t("executionModeParallel")}</SelectItem>
 <SelectItem value="sequential">{t("executionModeSequential")}</SelectItem>
 </SelectContent>
 </Select>
 </div>

<div className="space-y-2">
<div className="flex items-center justify-between">
 <Label>{t("fieldSelectServers")}</Label>
 <div className="text-sm text-muted-foreground">
 {t("selectedServersSummary", {
   selected: selectedServers.length,
   online: filteredServers.filter(s => s.status === "online").length,
 })}
 </div>
 </div>

 <div className="flex items-center gap-2">
 <div className="relative flex-1">
<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
<Input
 placeholder={t("searchServersPlaceholder")}
 className="pl-10"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 />
 </div>
<Button variant="outline" size="sm" onClick={toggleSelectAll}>
 {selectedServers.length === filteredServers.filter(s => s.status === "online").length
   ? t("unselectAll")
   : t("selectAll")}
 </Button>
 </div>

 <div className="border rounded-md max-h-[200px] overflow-y-auto">
{filteredServers.length === 0 ? (
<div className="p-4 text-center text-sm text-muted-foreground">
 {t("noServersFound")}
 </div>
 ) : (
 <div className="p-2 space-y-1">
 {filteredServers.map((server) => (
 <div
 key={server.id}
 className={`flex items-center space-x-2 p-2 rounded-sm hover:bg-accent cursor-pointer ${
 server.status !== "online" ? "opacity-50" : ""
 }`}
 onClick={() => toggleServer(server.id)}
 >
 <Checkbox
 id={server.id}
 checked={selectedServers.includes(server.id)}
 disabled={server.status !== "online"}
 onCheckedChange={() => toggleServer(server.id)}
 />
 <label
 htmlFor={server.id}
 className="flex-1 flex items-center justify-between cursor-pointer"
 >
 <div>
 <div className="font-medium">{server.name || server.host}</div>
 <div className="text-sm text-muted-foreground">{server.host}</div>
 </div>
<Badge variant={server.status === "online" ? "default" : "secondary"}>
 {server.status === "online" ? t("badgeOnline") : t("badgeOffline")}
 </Badge>
 </label>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>

 <Button
 onClick={handleExecuteCommand}
 disabled={isExecuting || selectedServers.length === 0 || !command.trim() || !taskName.trim()}
 className="w-full"
 >
{isExecuting ? (
<>
<Loader2 className="mr-2 h-4 w-4 animate-spin" />
 {t("btnCreating")}
 </>
 ) : (
<>
<Play className="mr-2 h-4 w-4" />
 {t("btnCreateTask")}
 </>
 )}
 </Button>
 </CardContent>
 </Card>
 </TabsContent>

{/* 批量脚本Tab */}
<TabsContent value="script" className="space-y-4">
<Card>
<CardHeader>
 <CardTitle>{t("sectionScriptTitle")}</CardTitle>
 <CardDescription>
 {t("sectionScriptDesc")}
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
<div className="space-y-2">
<Label htmlFor="task-name-script">
 {t("fieldTaskName")} <span className="text-destructive">*</span>
 </Label>
 <Input
id="task-name-script"
 placeholder={t("fieldTaskNamePlaceholderExampleDeploy")}
 value={taskName}
 onChange={(e) => setTaskName(e.target.value)}
 />
 </div>

 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <Label htmlFor="script-content">
 {t("fieldScriptContent")} <span className="text-destructive">*</span>
 </Label>
 <Button
 variant="outline"
 size="sm"
 onClick={() => setIsScriptLibraryOpen(true)}
 >
 <Library className="mr-2 h-4 w-4" />
 {t("scriptLibraryTitle")}
 </Button>
 </div>
 <Textarea
id="script-content"
 placeholder={t("fieldScriptPlaceholder")}
 className="font-mono"
 rows={8}
 value={scriptContent}
 onChange={(e) => setScriptContent(e.target.value)}
 />
 </div>

 <div className="space-y-2">
 <Label>{t("fieldExecutionMode")}</Label>
 <Select value={executionMode} onValueChange={(value: "parallel" | "sequential") => setExecutionMode(value)}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="parallel">{t("executionModeParallel")}</SelectItem>
 <SelectItem value="sequential">{t("executionModeSequential")}</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <Label>{t("fieldSelectServers")}</Label>
 <div className="text-sm text-muted-foreground">
 {t("selectedServersSummary", {
   selected: selectedServers.length,
   online: filteredServers.filter(s => s.status === "online").length,
 })}
 </div>
 </div>

 <div className="flex items-center gap-2">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
 <Input
 placeholder={t("searchServersPlaceholder")}
 className="pl-10"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 />
 </div>
 <Button variant="outline" size="sm" onClick={toggleSelectAll}>
 {selectedServers.length === filteredServers.filter(s => s.status === "online").length
   ? t("unselectAll")
   : t("selectAll")}
 </Button>
 </div>

 <div className="border rounded-md max-h-[200px] overflow-y-auto">
 {filteredServers.length === 0 ? (
 <div className="p-4 text-center text-sm text-muted-foreground">
 {t("noServersFound")}
 </div>
 ) : (
 <div className="p-2 space-y-1">
 {filteredServers.map((server) => (
 <div
 key={server.id}
 className={`flex items-center space-x-2 p-2 rounded-sm hover:bg-accent cursor-pointer ${
 server.status !== "online" ? "opacity-50" : ""
 }`}
 onClick={() => toggleServer(server.id)}
 >
 <Checkbox
 id={`script-${server.id}`}
 checked={selectedServers.includes(server.id)}
 disabled={server.status !== "online"}
 onCheckedChange={() => toggleServer(server.id)}
 />
 <label
 htmlFor={`script-${server.id}`}
 className="flex-1 flex items-center justify-between cursor-pointer"
 >
 <div>
 <div className="font-medium">{server.name || server.host}</div>
 <div className="text-sm text-muted-foreground">{server.host}</div>
 </div>
 <Badge variant={server.status === "online" ? "default" : "secondary"}>
 {server.status === "online" ? t("badgeOnline") : t("badgeOffline")}
 </Badge>
 </label>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>

 <Button
 onClick={handleExecuteScript}
 disabled={isExecuting || selectedServers.length === 0 || !scriptContent.trim() || !taskName.trim()}
 className="w-full"
 >
 {isExecuting ? (
 <>
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 {t("btnCreating")}
 </>
 ) : (
 <>
 <Play className="mr-2 h-4 w-4" />
 {t("btnCreateTask")}
 </>
 )}
 </Button>
 </CardContent>
 </Card>
 </TabsContent>

{/* 文件分发Tab */}
<TabsContent value="file" className="space-y-4">
<Card>
<CardHeader>
 <CardTitle>{t("sectionFileTitle")}</CardTitle>
 <CardDescription>
 {t("sectionFileDesc")}
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
<div className="space-y-2">
<Label htmlFor="task-name-file">
 {t("fieldTaskName")} <span className="text-destructive">*</span>
 </Label>
 <Input
id="task-name-file"
 placeholder={t("fieldTaskNamePlaceholderExampleDistribute")}
 value={taskName}
 onChange={(e) => setTaskName(e.target.value)}
 />
 </div>

<div className="space-y-2">
<Label htmlFor="file-path">
 {t("fieldFilePath")} <span className="text-destructive">*</span>
 </Label>
 <Input
id="file-path"
 placeholder={t("fieldFilePathPlaceholder")}
 value={filePath}
 onChange={(e) => setFilePath(e.target.value)}
 />
 </div>

<div className="space-y-2">
<Label htmlFor="target-path">
 {t("fieldTargetPath")} <span className="text-destructive">*</span>
 </Label>
 <Input
id="target-path"
 placeholder={t("fieldTargetPathPlaceholder")}
 value={targetPath}
 onChange={(e) => setTargetPath(e.target.value)}
 />
 </div>

 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <Label>{t("fieldSelectServers")}</Label>
 <div className="text-sm text-muted-foreground">
 {t("selectedServersSummary", {
   selected: selectedServers.length,
   online: filteredServers.filter(s => s.status === "online").length,
 })}
 </div>
 </div>

 <div className="flex items-center gap-2">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
 <Input
 placeholder={t("searchServersPlaceholder")}
 className="pl-10"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 />
 </div>
 <Button variant="outline" size="sm" onClick={toggleSelectAll}>
 {selectedServers.length === filteredServers.filter(s => s.status === "online").length
   ? t("unselectAll")
   : t("selectAll")}
 </Button>
 </div>

 <div className="border rounded-md max-h-[200px] overflow-y-auto">
 {filteredServers.length === 0 ? (
 <div className="p-4 text-center text-sm text-muted-foreground">
 {t("noServersFound")}
 </div>
 ) : (
 <div className="p-2 space-y-1">
 {filteredServers.map((server) => (
 <div
 key={server.id}
 className={`flex items-center space-x-2 p-2 rounded-sm hover:bg-accent cursor-pointer ${
 server.status !== "online" ? "opacity-50" : ""
 }`}
 onClick={() => toggleServer(server.id)}
 >
 <Checkbox
 id={`file-${server.id}`}
 checked={selectedServers.includes(server.id)}
 disabled={server.status !== "online"}
 onCheckedChange={() => toggleServer(server.id)}
 />
 <label
 htmlFor={`file-${server.id}`}
 className="flex-1 flex items-center justify-between cursor-pointer"
 >
 <div>
 <div className="font-medium">{server.name || server.host}</div>
 <div className="text-sm text-muted-foreground">{server.host}</div>
 </div>
 <Badge variant={server.status === "online" ? "default" : "secondary"}>
 {server.status === "online" ? t("badgeOnline") : t("badgeOffline")}
 </Badge>
 </label>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>

 <Button
 onClick={handleDistributeFile}
 disabled={isExecuting || selectedServers.length === 0 || !filePath.trim() || !targetPath.trim() || !taskName.trim()}
 className="w-full"
 >
 {isExecuting ? (
 <>
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 {t("btnCreating")}
 </>
 ) : (
 <>
 <Play className="mr-2 h-4 w-4" />
 {t("btnCreateTask")}
 </>
 )}
 </Button>
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>

{/* 执行历史 */}
<Card>
<CardHeader>
 <CardTitle>{t("historyTitle")}</CardTitle>
 <CardDescription>
 {t("historyDesc")}
 </CardDescription>
 </CardHeader>
 <CardContent>
 <Table>
 <TableHeader>
 <TableRow>
<TableHead className="w-[200px]">{t("colTaskName")}</TableHead>
 <TableHead className="w-[100px]">{t("colType")}</TableHead>
 <TableHead className="w-[100px]">{t("colServerCount")}</TableHead>
 <TableHead className="w-[120px]">{t("colStatus")}</TableHead>
 <TableHead className="w-[100px]">{t("colSuccessFailed")}</TableHead>
 <TableHead className="w-[180px]">{t("colStartedAt")}</TableHead>
 <TableHead className="w-[120px]">{t("colDuration")}</TableHead>
 <TableHead className="w-[100px] text-right">{t("colActions")}</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {tasks.length === 0 ? (
 <TableRow>
 <TableCell colSpan={8} className="h-32 text-center">
 <div className="flex flex-col items-center justify-center text-muted-foreground">
 <ServerIcon className="h-8 w-8 mb-2" />
<p className="text-sm">{t("historyEmpty")}</p>
 <p className="text-sm">{t("historyEmpty")}</p>
 </div>
 </TableCell>
 </TableRow>
 ) : (
 tasks.map((task) => (
 <TableRow key={task.id}>
 <TableCell className="font-medium">{task.task_name}</TableCell>
 <TableCell>
 <div className="flex items-center gap-2">
 {getTypeIcon(task.task_type)}
 <span className="capitalize">{task.task_type}</span>
 </div>
 </TableCell>
 <TableCell>{task.server_ids?.length || 0}</TableCell>
 <TableCell>{getStatusBadge(task.status)}</TableCell>
 <TableCell>
 <div className="flex items-center gap-2">
 <span className="text-green-600">{task.success_count || 0}</span>
 <span className="text-muted-foreground">/</span>
 <span className="text-red-600">{task.failed_count || 0}</span>
 </div>
 </TableCell>
 <TableCell className="text-sm text-muted-foreground">
 {formatDate(task.started_at)}
 </TableCell>
 <TableCell>{formatDuration(task.started_at, task.completed_at)}</TableCell>
 <TableCell className="text-right">
 <div className="flex items-center justify-end gap-1">
 {task.status === "pending" && (
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleStartTask(task.id)}
 className="h-8 w-8 p-0"
 title={t("tooltipStartTask")}>
 <Play className="h-4 w-4" />
 </Button>
 )}
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleDeleteTask(task.id)}
 className="h-8 w-8 p-0 text-destructive"
 title={t("tooltipDeleteTask")}>
 <Trash2 className="h-4 w-4" />
 </Button>
 </div>
 </TableCell>
 </TableRow>
 ))
 )}
 </TableBody>
 </Table>
 </CardContent>
 </Card>
 </div>

 {/* 脚本库对话框 */}
 <Dialog open={isScriptLibraryOpen} onOpenChange={setIsScriptLibraryOpen}>
 <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
 <DialogHeader className="shrink-0">
<DialogTitle>{t("scriptLibraryTitle")}</DialogTitle>
 <DialogDescription>
 {t("scriptLibraryDesc")}
 </DialogDescription>
 </DialogHeader>

 <div className="space-y-4 py-4 flex-1 min-h-0 overflow-y-auto scrollbar-custom">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
 <Input
 placeholder={t("searchScriptsPlaceholder")}
 className="pl-10"
 value={scriptSearchTerm}
 onChange={(e) => setScriptSearchTerm(e.target.value)}
 />
 </div>

 <div className="space-y-2">
 {filteredScripts.length === 0 ? (
 <div className="p-8 text-center text-muted-foreground">
 <FileText className="h-8 w-8 mx-auto mb-2" />
 <p className="text-sm">{t("noScriptsFound")}</p>
 </div>
 ) : (
 filteredScripts.map((script) => (
 <Card
 key={script.id}
 className="cursor-pointer hover:border-primary transition-colors"
 onClick={() => handleSelectScript(script)}
 >
 <CardHeader className="pb-3">
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <CardTitle className="text-base">{script.name}</CardTitle>
 {script.description && (
 <CardDescription className="mt-1">
 {script.description}
 </CardDescription>
 )}
 </div>
 <div className="flex flex-wrap gap-1 ml-4">
 {script.tags.map((tag) => (
 <Badge key={tag} variant="secondary" className="text-xs">
 {tag}
 </Badge>
 ))}
 </div>
 </div>
 </CardHeader>
 <CardContent>
  <div className="bg-muted rounded-md p-3">
  <pre className="text-xs font-mono whitespace-pre-wrap line-clamp-3">
  {script.content}
  </pre>
  </div>
  <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
  <span>{t("scriptExecutionsLabel", { count: script.executions })}</span>
  <span>{script.language}</span>
  </div>
 </CardContent>
 </Card>
 ))
 )}
 </div>
 </div>

 <DialogFooter className="shrink-0">
 <Button variant="outline" onClick={() => setIsScriptLibraryOpen(false)}>
 {t("dialogCancel")}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </>
 )
}
