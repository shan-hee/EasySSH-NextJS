"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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

export default function AutomationBatchPage() {
 const router = useRouter()

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
 const token = localStorage.getItem("easyssh_access_token")
 if (!token) {
 toast.error("未登录，请先登录")
 router.push("/login")
 return
 }

 // 并行加载所有数据
 const [tasksRes, serversRes, scriptsRes, statsRes] = await Promise.all([
 batchTasksApi.list(token, { page: 1, limit: 100 }),
 serversApi.list(token),
 scriptsApi.list(token, { page: 1, limit: 100 }),
 batchTasksApi.getStatistics(token),
 ])

 // 防御性检查：处理apiFetch自动解包，确保始终返回数组
 const tasksList = Array.isArray(tasksRes)
 ? tasksRes
 : (Array.isArray(tasksRes?.data) ? tasksRes.data : [])
 const serversList = Array.isArray(serversRes)
 ? serversRes
 : (Array.isArray(serversRes?.data) ? serversRes.data : [])
 const scriptsList = Array.isArray(scriptsRes)
 ? scriptsRes
 : (Array.isArray(scriptsRes?.data) ? scriptsRes.data : [])
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

 // 初始加载
 useEffect(() => {
 loadData()
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [])

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
 toast.warning("只能选择在线的服务器")
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
 toast.error("请选择至少一个服务器")
 return
 }
 if (!command.trim()) {
 toast.error("请输入要执行的命令")
 return
 }
 if (!taskName.trim()) {
 toast.error("请输入任务名称")
 return
 }

 setIsExecuting(true)
 try {
 const token = localStorage.getItem("easyssh_access_token")
 if (!token) {
 toast.error("未登录，请先登录")
 router.push("/login")
 return
 }

 await batchTasksApi.create(token, {
 task_name: taskName,
 task_type: "command",
 content: command,
 server_ids: selectedServers,
 execution_mode: executionMode,
 })

 toast.success("批量命令任务已创建")

 // 重置表单
 setCommand("")
 setTaskName("")
 setSelectedServers([])

 // 重新加载任务列表
 await loadData()
 } catch (error: unknown) {
 console.error("创建任务失败:", error)
 toast.error(getErrorMessage(error, "创建任务失败"))
 } finally {
 setIsExecuting(false)
 }
 }

 // 执行批量脚本
 const handleExecuteScript = async () => {
 if (selectedServers.length === 0) {
 toast.error("请选择至少一个服务器")
 return
 }
 if (!scriptContent.trim() && !selectedScriptId) {
 toast.error("请输入脚本内容或选择脚本库中的脚本")
 return
 }
 if (!taskName.trim()) {
 toast.error("请输入任务名称")
 return
 }

 setIsExecuting(true)
 try {
 const token = localStorage.getItem("easyssh_access_token")
 if (!token) {
 toast.error("未登录，请先登录")
 router.push("/login")
 return
 }

 await batchTasksApi.create(token, {
 task_name: taskName,
 task_type: "script",
 content: scriptContent,
 script_id: selectedScriptId || undefined,
 server_ids: selectedServers,
 execution_mode: executionMode,
 })

 toast.success("批量脚本任务已创建")

 // 重置表单
 setScriptContent("")
 setSelectedScriptId(null)
 setTaskName("")
 setSelectedServers([])

 // 重新加载任务列表
 await loadData()
 } catch (error: unknown) {
 console.error("创建任务失败:", error)
 toast.error(getErrorMessage(error, "创建任务失败"))
 } finally {
 setIsExecuting(false)
 }
 }

 // 执行文件分发
 const handleDistributeFile = async () => {
 if (selectedServers.length === 0) {
 toast.error("请选择至少一个服务器")
 return
 }
 if (!filePath.trim() || !targetPath.trim()) {
 toast.error("请输入源文件路径和目标路径")
 return
 }
 if (!taskName.trim()) {
 toast.error("请输入任务名称")
 return
 }

 setIsExecuting(true)
 try {
 const token = localStorage.getItem("easyssh_access_token")
 if (!token) {
 toast.error("未登录，请先登录")
 router.push("/login")
 return
 }

 await batchTasksApi.create(token, {
 task_name: taskName,
 task_type: "file",
 content: `${filePath} -> ${targetPath}`,
 server_ids: selectedServers,
 execution_mode: executionMode,
 })

 toast.success("文件分发任务已创建")

 // 重置表单
 setFilePath("")
 setTargetPath("")
 setTaskName("")
 setSelectedServers([])

 // 重新加载任务列表
 await loadData()
 } catch (error: unknown) {
 console.error("创建任务失败:", error)
 toast.error(getErrorMessage(error, "创建任务失败"))
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
 if (!confirm("确定要删除这个任务吗？")) {
 return
 }

 try {
 const token = localStorage.getItem("easyssh_access_token")
 if (!token) {
 toast.error("未登录，请先登录")
 router.push("/login")
 return
 }

 await batchTasksApi.delete(token, taskId)
 toast.success("任务删除成功")
 await loadData()
 } catch (error: unknown) {
 console.error("删除任务失败:", error)
 toast.error(getErrorMessage(error, "删除任务失败"))
 }
 }

 // 启动任务
 const handleStartTask = async (taskId: string) => {
 try {
 const token = localStorage.getItem("easyssh_access_token")
 if (!token) {
 toast.error("未登录，请先登录")
 router.push("/login")
 return
 }

 await batchTasksApi.start(token, taskId)
 toast.success("任务已启动")
 await loadData()
 } catch (error: unknown) {
 console.error("启动任务失败:", error)
 toast.error(getErrorMessage(error, "启动任务失败"))
 }
 }

 const getStatusBadge = (status: string) => {
 switch (status) {
 case "completed":
 return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">已完成</Badge>
 case "running":
 return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">执行中</Badge>
 case "failed":
 return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">失败</Badge>
 case "pending":
 return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">等待中</Badge>
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
 try {
 return new Date(dateString).toLocaleString("zh-CN")
 } catch {
 return dateString
 }
 }

 const formatDuration = (started: string | undefined, completed: string | undefined) => {
 if (!started) return "-"
 if (!completed) return "进行中"

 try {
 const start = new Date(started).getTime()
 const end = new Date(completed).getTime()
 const seconds = Math.floor((end - start) / 1000)

 if (seconds < 60) return `${seconds}秒`
 if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`
 return `${Math.floor(seconds / 3600)}小时${Math.floor((seconds % 3600) / 60)}分`
 } catch {
 return "-"
 }
 }

 if (loading) {
 return (
 <>
 <PageHeader title="批量操作" />
 <div className="flex flex-1 items-center justify-center">
 <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
 </div>
 </>
 )
 }

 return (
 <>
 <PageHeader title="批量操作">
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
 <Button
 variant="outline"
 size="sm"
 onClick={() => toast.info("导出功能即将推出")}
 >
 <Download className="mr-2 h-4 w-4" />
 导出报告
 </Button>
 </div>
 </PageHeader>

 <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
 {/* 统计卡片 */}
 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">总任务数</CardTitle>
 <ServerIcon className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{statistics.total}</div>
 <p className="text-xs text-muted-foreground">历史执行任务总数</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">执行中</CardTitle>
 <Clock className="h-4 w-4 text-blue-600" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-blue-600">{statistics.running}</div>
 <p className="text-xs text-muted-foreground">正在执行的任务</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">已完成</CardTitle>
 <CheckCircle className="h-4 w-4 text-green-600" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-green-600">{statistics.completed}</div>
 <p className="text-xs text-muted-foreground">成功完成的任务</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">失败</CardTitle>
 <AlertTriangle className="h-4 w-4 text-red-600" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-red-600">{statistics.failed}</div>
 <p className="text-xs text-muted-foreground">执行失败的任务</p>
 </CardContent>
 </Card>
 </div>

 {/* 主要内容区域 */}
 <Tabs defaultValue="command" className="flex-1">
 <TabsList className="grid w-full grid-cols-3">
 <TabsTrigger value="command">
 <Terminal className="mr-2 h-4 w-4" />
 批量命令
 </TabsTrigger>
 <TabsTrigger value="script">
 <Code2 className="mr-2 h-4 w-4" />
 批量脚本
 </TabsTrigger>
 <TabsTrigger value="file">
 <FileText className="mr-2 h-4 w-4" />
 文件分发
 </TabsTrigger>
 </TabsList>

 {/* 批量命令Tab */}
 <TabsContent value="command" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>批量执行命令</CardTitle>
 <CardDescription>
 在多台服务器上同时执行Shell命令
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-2">
 <Label htmlFor="task-name-cmd">
 任务名称 <span className="text-destructive">*</span>
 </Label>
 <Input
 id="task-name-cmd"
 placeholder="例如：系统更新"
 value={taskName}
 onChange={(e) => setTaskName(e.target.value)}
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="command">
 命令内容 <span className="text-destructive">*</span>
 </Label>
 <Textarea
 id="command"
 placeholder="输入要执行的Shell命令，例如：apt-get update && apt-get upgrade -y"
 className="font-mono"
 rows={4}
 value={command}
 onChange={(e) => setCommand(e.target.value)}
 />
 </div>

 <div className="space-y-2">
 <Label>执行模式</Label>
 <Select value={executionMode} onValueChange={(value: "parallel" | "sequential") => setExecutionMode(value)}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="parallel">并行执行（同时执行）</SelectItem>
 <SelectItem value="sequential">顺序执行（逐个执行）</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <Label>选择目标服务器</Label>
 <div className="text-sm text-muted-foreground">
 已选择 {selectedServers.length} / {filteredServers.filter(s => s.status === "online").length} 台在线服务器
 </div>
 </div>

 <div className="flex items-center gap-2">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
 <Input
 placeholder="搜索服务器..."
 className="pl-10"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 />
 </div>
 <Button variant="outline" size="sm" onClick={toggleSelectAll}>
 {selectedServers.length === filteredServers.filter(s => s.status === "online").length ? "取消全选" : "全选"}
 </Button>
 </div>

 <div className="border rounded-md max-h-[200px] overflow-y-auto">
 {filteredServers.length === 0 ? (
 <div className="p-4 text-center text-sm text-muted-foreground">
 没有找到服务器
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
 {server.status === "online" ? "在线" : "离线"}
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
 创建中...
 </>
 ) : (
 <>
 <Play className="mr-2 h-4 w-4" />
 创建任务
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
 <CardTitle>批量执行脚本</CardTitle>
 <CardDescription>
 在多台服务器上执行自定义脚本
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-2">
 <Label htmlFor="task-name-script">
 任务名称 <span className="text-destructive">*</span>
 </Label>
 <Input
 id="task-name-script"
 placeholder="例如：部署应用"
 value={taskName}
 onChange={(e) => setTaskName(e.target.value)}
 />
 </div>

 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <Label htmlFor="script-content">
 脚本内容 <span className="text-destructive">*</span>
 </Label>
 <Button
 variant="outline"
 size="sm"
 onClick={() => setIsScriptLibraryOpen(true)}
 >
 <Library className="mr-2 h-4 w-4" />
 从脚本库选择
 </Button>
 </div>
 <Textarea
 id="script-content"
 placeholder="输入脚本内容或从脚本库选择..."
 className="font-mono"
 rows={8}
 value={scriptContent}
 onChange={(e) => setScriptContent(e.target.value)}
 />
 </div>

 <div className="space-y-2">
 <Label>执行模式</Label>
 <Select value={executionMode} onValueChange={(value: "parallel" | "sequential") => setExecutionMode(value)}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="parallel">并行执行（同时执行）</SelectItem>
 <SelectItem value="sequential">顺序执行（逐个执行）</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <Label>选择目标服务器</Label>
 <div className="text-sm text-muted-foreground">
 已选择 {selectedServers.length} / {filteredServers.filter(s => s.status === "online").length} 台在线服务器
 </div>
 </div>

 <div className="flex items-center gap-2">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
 <Input
 placeholder="搜索服务器..."
 className="pl-10"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 />
 </div>
 <Button variant="outline" size="sm" onClick={toggleSelectAll}>
 {selectedServers.length === filteredServers.filter(s => s.status === "online").length ? "取消全选" : "全选"}
 </Button>
 </div>

 <div className="border rounded-md max-h-[200px] overflow-y-auto">
 {filteredServers.length === 0 ? (
 <div className="p-4 text-center text-sm text-muted-foreground">
 没有找到服务器
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
 {server.status === "online" ? "在线" : "离线"}
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
 创建中...
 </>
 ) : (
 <>
 <Play className="mr-2 h-4 w-4" />
 创建任务
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
 <CardTitle>文件分发</CardTitle>
 <CardDescription>
 向多台服务器分发文件
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-2">
 <Label htmlFor="task-name-file">
 任务名称 <span className="text-destructive">*</span>
 </Label>
 <Input
 id="task-name-file"
 placeholder="例如：配置文件分发"
 value={taskName}
 onChange={(e) => setTaskName(e.target.value)}
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="file-path">
 源文件路径 <span className="text-destructive">*</span>
 </Label>
 <Input
 id="file-path"
 placeholder="/path/to/local/file"
 value={filePath}
 onChange={(e) => setFilePath(e.target.value)}
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="target-path">
 目标路径 <span className="text-destructive">*</span>
 </Label>
 <Input
 id="target-path"
 placeholder="/path/to/remote/destination"
 value={targetPath}
 onChange={(e) => setTargetPath(e.target.value)}
 />
 </div>

 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <Label>选择目标服务器</Label>
 <div className="text-sm text-muted-foreground">
 已选择 {selectedServers.length} / {filteredServers.filter(s => s.status === "online").length} 台在线服务器
 </div>
 </div>

 <div className="flex items-center gap-2">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
 <Input
 placeholder="搜索服务器..."
 className="pl-10"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 />
 </div>
 <Button variant="outline" size="sm" onClick={toggleSelectAll}>
 {selectedServers.length === filteredServers.filter(s => s.status === "online").length ? "取消全选" : "全选"}
 </Button>
 </div>

 <div className="border rounded-md max-h-[200px] overflow-y-auto">
 {filteredServers.length === 0 ? (
 <div className="p-4 text-center text-sm text-muted-foreground">
 没有找到服务器
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
 {server.status === "online" ? "在线" : "离线"}
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
 创建中...
 </>
 ) : (
 <>
 <Play className="mr-2 h-4 w-4" />
 创建任务
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
 <CardTitle>执行历史</CardTitle>
 <CardDescription>
 查看所有批量任务的执行历史和状态
 </CardDescription>
 </CardHeader>
 <CardContent>
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead className="w-[200px]">任务名称</TableHead>
 <TableHead className="w-[100px]">类型</TableHead>
 <TableHead className="w-[100px]">服务器数</TableHead>
 <TableHead className="w-[120px]">状态</TableHead>
 <TableHead className="w-[100px]">成功/失败</TableHead>
 <TableHead className="w-[180px]">开始时间</TableHead>
 <TableHead className="w-[120px]">耗时</TableHead>
 <TableHead className="w-[100px] text-right">操作</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {tasks.length === 0 ? (
 <TableRow>
 <TableCell colSpan={8} className="h-32 text-center">
 <div className="flex flex-col items-center justify-center text-muted-foreground">
 <ServerIcon className="h-8 w-8 mb-2" />
 <p className="text-sm">暂无执行历史</p>
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
 title="启动任务">
 <Play className="h-4 w-4" />
 </Button>
 )}
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleDeleteTask(task.id)}
 className="h-8 w-8 p-0 text-destructive"
 title="删除任务">
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
 <DialogTitle>脚本库</DialogTitle>
 <DialogDescription>
 从已保存的脚本中选择一个
 </DialogDescription>
 </DialogHeader>

 <div className="space-y-4 py-4 flex-1 min-h-0 overflow-y-auto scrollbar-custom">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
 <Input
 placeholder="搜索脚本..."
 className="pl-10"
 value={scriptSearchTerm}
 onChange={(e) => setScriptSearchTerm(e.target.value)}
 />
 </div>

 <div className="space-y-2">
 {filteredScripts.length === 0 ? (
 <div className="p-8 text-center text-muted-foreground">
 <FileText className="h-8 w-8 mx-auto mb-2" />
 <p className="text-sm">没有找到脚本</p>
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
 <span>执行次数: {script.executions}</span>
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
 取消
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </>
 )
}
