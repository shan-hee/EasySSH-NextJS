"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Kbd } from "@/components/ui/kbd"
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
  Calendar,
  Clock,
  Play,
  Pause,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  Copy,
  Server,
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

export default function AutomationSchedulesPage() {
  const router = useRouter()

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
  const [serverSearchTerm, setServerSearchTerm] = useState("")
  const [scriptSearchTerm, setScriptSearchTerm] = useState("")
  const [showServerDropdown, setShowServerDropdown] = useState(false)
  const serverInputRef = useRef<HTMLInputElement>(null)

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
        scheduledTasksApi.list(token, { page: 1, limit: 100 }),
        serversApi.list(token),
        scriptsApi.list(token, { page: 1, limit: 100 }),
        scheduledTasksApi.getStatistics(token),
      ])

      setTasks(tasksRes.data)
      setServers(serversRes.data)
      setScripts(scriptsRes.data)
      setStatistics({
        total: statsRes.data.total_tasks || 0,
        enabled: statsRes.data.enabled_tasks || 0,
        disabled: statsRes.data.disabled_tasks || 0,
        totalRuns: statsRes.data.total_runs || 0,
      })
    } catch (error: any) {
      console.error("加载数据失败:", error)
      if (error.message?.includes("401") || error.message?.includes("Unauthorized")) {
        toast.error("登录已过期，请重新登录")
        router.push("/login")
      } else {
        toast.error(`加载数据失败: ${error.message}`)
      }
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
  }, [])

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
      server.name.toLowerCase().includes(serverSearchTerm.toLowerCase()) ||
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
      toast.warning("只能选择在线的服务器")
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
      toast.warning("只能选择在线的服务器")
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
      toast.error("请填写任务名称和Cron表达式")
      return
    }

    if (newTask.task_type === "command" && !newTask.command) {
      toast.error("请输入命令内容")
      return
    }

    if (newTask.task_type === "script" && !newTask.script_id && !newTask.command) {
      toast.error("请选择脚本或输入脚本内容")
      return
    }

    if (newTask.server_ids.length === 0) {
      toast.error("请选择至少一个服务器")
      return
    }

    try {
      const token = localStorage.getItem("easyssh_access_token")
      if (!token) {
        toast.error("未登录，请先登录")
        router.push("/login")
        return
      }

      await scheduledTasksApi.create(token, {
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

      toast.success("定时任务创建成功")
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
    } catch (error: any) {
      console.error("创建定时任务失败:", error)
      toast.error(`创建定时任务失败: ${error.message}`)
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
      toast.error("请填写任务名称和Cron表达式")
      return
    }

    if (editingTaskId === null) return

    try {
      const token = localStorage.getItem("easyssh_access_token")
      if (!token) {
        toast.error("未登录，请先登录")
        router.push("/login")
        return
      }

      await scheduledTasksApi.update(token, editingTaskId, {
        task_name: editTask.task_name,
        command: editTask.command || undefined,
        server_ids: editTask.server_ids,
        cron_expression: editTask.cron_expression,
        timezone: editTask.timezone,
        enabled: editTask.enabled,
        description: editTask.description || undefined,
      })

      toast.success("定时任务更新成功")
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
    } catch (error: any) {
      console.error("更新定时任务失败:", error)
      toast.error(`更新定时任务失败: ${error.message}`)
    }
  }

  // 删除任务
  const handleDelete = async (taskId: string) => {
    if (!confirm("确定要删除这个定时任务吗？")) {
      return
    }

    try {
      const token = localStorage.getItem("easyssh_access_token")
      if (!token) {
        toast.error("未登录，请先登录")
        router.push("/login")
        return
      }

      await scheduledTasksApi.delete(token, taskId)
      toast.success("定时任务删除成功")
      await loadData()
    } catch (error: any) {
      console.error("删除定时任务失败:", error)
      toast.error(`删除定时任务失败: ${error.message}`)
    }
  }

  // 启用/禁用任务
  const handleToggle = async (taskId: string, enabled: boolean) => {
    try {
      const token = localStorage.getItem("easyssh_access_token")
      if (!token) {
        toast.error("未登录，请先登录")
        router.push("/login")
        return
      }

      await scheduledTasksApi.toggle(token, taskId, !enabled)
      toast.success(enabled ? "任务已禁用" : "任务已启用")
      await loadData()
    } catch (error: any) {
      console.error("切换任务状态失败:", error)
      toast.error(`切换任务状态失败: ${error.message}`)
    }
  }

  // 手动触发任务
  const handleTrigger = async (taskId: string) => {
    try {
      const token = localStorage.getItem("easyssh_access_token")
      if (!token) {
        toast.error("未登录，请先登录")
        router.push("/login")
        return
      }

      await scheduledTasksApi.trigger(token, taskId)
      toast.success("任务已手动触发")
      await loadData()
    } catch (error: any) {
      console.error("触发任务失败:", error)
      toast.error(`触发任务失败: ${error.message}`)
    }
  }

  // 格式化日期
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
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
        return <Server className="h-4 w-4" />
    }
  }

  // 获取类型名称
  const getTypeName = (type: string) => {
    switch (type) {
      case "command":
        return "命令"
      case "script":
        return "脚本"
      case "batch":
        return "批量任务"
      default:
        return type
    }
  }

  // 获取状态Badge
  const getStatusBadge = (task: ScheduledTask) => {
    if (!task.enabled) {
      return <Badge variant="secondary">已禁用</Badge>
    }

    if (task.last_status === "success") {
      return <Badge className="bg-green-100 text-green-800">运行中</Badge>
    } else if (task.last_status === "failed") {
      return <Badge className="bg-red-100 text-red-800">失败</Badge>
    }

    return <Badge className="bg-blue-100 text-blue-800">待执行</Badge>
  }

  return (
    <>
      <PageHeader
        title="定时任务"
        breadcrumbs={[
          { title: "自动化", href: "#" },
          { title: "定时任务" },
        ]}
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
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            新建任务
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
                <CardTitle className="text-sm font-medium">总任务数</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.total}</div>
                <p className="text-xs text-muted-foreground">已创建的定时任务</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">启用中</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.enabled}</div>
                <p className="text-xs text-muted-foreground">正在运行的任务</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">已禁用</CardTitle>
                <Pause className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.disabled}</div>
                <p className="text-xs text-muted-foreground">暂停的任务</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">总执行次数</CardTitle>
                <Zap className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.totalRuns}</div>
                <p className="text-xs text-muted-foreground">累计执行次数</p>
              </CardContent>
            </Card>
          </div>

          {/* 搜索和筛选 */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="搜索定时任务..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="状态筛选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="enabled">启用中</SelectItem>
                  <SelectItem value="disabled">已禁用</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="类型筛选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="command">命令</SelectItem>
                  <SelectItem value="script">脚本</SelectItem>
                  <SelectItem value="batch">批量任务</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 任务列表 */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">任务名称</TableHead>
                  <TableHead className="w-[100px]">类型</TableHead>
                  <TableHead className="w-[120px]">Cron表达式</TableHead>
                  <TableHead className="w-[100px]">状态</TableHead>
                  <TableHead className="w-[150px]">上次执行</TableHead>
                  <TableHead className="w-[150px]">下次执行</TableHead>
                  <TableHead className="w-[80px] text-center">执行次数</TableHead>
                  <TableHead className="w-[80px] text-center">成功率</TableHead>
                  <TableHead className="w-[120px] text-right">操作</TableHead>
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
                            ? "暂无匹配的定时任务"
                            : "暂无定时任务"}
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
                                {task.last_status === "success" ? "成功" : "失败"}
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
                            title={task.enabled ? "禁用任务" : "启用任务"}
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
                                立即执行
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(task)}>
                                <Edit className="mr-2 h-4 w-4" />
                                编辑
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(task.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                删除
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新建定时任务</DialogTitle>
            <DialogDescription>创建一个新的定时任务，按照Cron表达式定时执行</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 任务名称 */}
            <div className="space-y-2">
              <Label htmlFor="task-name">
                任务名称 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="task-name"
                placeholder="例如：数据库备份"
                value={newTask.task_name}
                onChange={(e) => setNewTask({ ...newTask, task_name: e.target.value })}
              />
            </div>

            {/* 任务描述 */}
            <div className="space-y-2">
              <Label htmlFor="task-description">任务描述</Label>
              <Input
                id="task-description"
                placeholder="简要描述任务的功能"
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              />
            </div>

            {/* 任务类型 */}
            <div className="space-y-2">
              <Label htmlFor="task-type">
                任务类型 <span className="text-destructive">*</span>
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
                  <SelectItem value="command">执行命令</SelectItem>
                  <SelectItem value="script">执行脚本</SelectItem>
                  <SelectItem value="batch">批量任务</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 命令/脚本内容 */}
            {newTask.task_type !== "batch" && (
              <div className="space-y-2">
                <Label htmlFor="task-command">
                  {newTask.task_type === "command" ? "命令内容" : "脚本内容"}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-2">
                  <Textarea
                    id="task-command"
                    placeholder={
                      newTask.task_type === "command"
                        ? "输入要执行的命令..."
                        : "输入脚本内容或从脚本库选择..."
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
                      脚本库
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* 服务器选择 */}
            <div className="space-y-2">
              <Label>
                目标服务器 <span className="text-destructive">*</span>
              </Label>
              <div className="border rounded-md p-3 max-h-[200px] overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">
                    已选择 {newTask.server_ids.length} 台服务器
                  </span>
                  <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
                    {newTask.server_ids.length === servers.filter((s) => s.status === "online").length
                      ? "取消全选"
                      : "全选"}
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
                          <div className="font-medium text-sm">{server.name}</div>
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
                Cron表达式 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cron-expression"
                placeholder="例如：0 2 * * * (每天凌晨2点)"
                value={newTask.cron_expression}
                onChange={(e) => setNewTask({ ...newTask, cron_expression: e.target.value })}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                格式：秒 分 时 日 月 周。示例：0 0 * * * (每小时), 0 2 * * * (每天2点), 0 0 * * 0 (每周日)
              </p>
            </div>

            {/* 时区 */}
            <div className="space-y-2">
              <Label htmlFor="timezone">时区</Label>
              <Select
                value={newTask.timezone}
                onValueChange={(value) => setNewTask({ ...newTask, timezone: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asia/Shanghai">中国标准时间 (UTC+8)</SelectItem>
                  <SelectItem value="UTC">UTC (UTC+0)</SelectItem>
                  <SelectItem value="America/New_York">美东时间 (UTC-5)</SelectItem>
                  <SelectItem value="Europe/London">伦敦时间 (UTC+0)</SelectItem>
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
                创建后立即启用
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateTask}>创建任务</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑任务对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑定时任务</DialogTitle>
            <DialogDescription>修改定时任务的配置</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 任务名称 */}
            <div className="space-y-2">
              <Label htmlFor="edit-task-name">
                任务名称 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-task-name"
                placeholder="例如：数据库备份"
                value={editTask.task_name}
                onChange={(e) => setEditTask({ ...editTask, task_name: e.target.value })}
              />
            </div>

            {/* 任务描述 */}
            <div className="space-y-2">
              <Label htmlFor="edit-task-description">任务描述</Label>
              <Input
                id="edit-task-description"
                placeholder="简要描述任务的功能"
                value={editTask.description}
                onChange={(e) => setEditTask({ ...editTask, description: e.target.value })}
              />
            </div>

            {/* 命令内容 */}
            <div className="space-y-2">
              <Label htmlFor="edit-task-command">命令/脚本内容</Label>
              <Textarea
                id="edit-task-command"
                placeholder="输入要执行的命令或脚本..."
                className="font-mono min-h-[100px]"
                value={editTask.command}
                onChange={(e) => setEditTask({ ...editTask, command: e.target.value })}
              />
            </div>

            {/* 服务器选择 */}
            <div className="space-y-2">
              <Label>目标服务器</Label>
              <div className="border rounded-md p-3 max-h-[200px] overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">
                    已选择 {editTask.server_ids.length} 台服务器
                  </span>
                  <Button variant="ghost" size="sm" onClick={toggleEditSelectAll}>
                    {editTask.server_ids.length === servers.filter((s) => s.status === "online").length
                      ? "取消全选"
                      : "全选"}
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
                          <div className="font-medium text-sm">{server.name}</div>
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
                Cron表达式 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-cron-expression"
                placeholder="例如：0 2 * * * (每天凌晨2点)"
                value={editTask.cron_expression}
                onChange={(e) => setEditTask({ ...editTask, cron_expression: e.target.value })}
                className="font-mono"
              />
            </div>

            {/* 时区 */}
            <div className="space-y-2">
              <Label htmlFor="edit-timezone">时区</Label>
              <Select
                value={editTask.timezone}
                onValueChange={(value) => setEditTask({ ...editTask, timezone: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asia/Shanghai">中国标准时间 (UTC+8)</SelectItem>
                  <SelectItem value="UTC">UTC (UTC+0)</SelectItem>
                  <SelectItem value="America/New_York">美东时间 (UTC-5)</SelectItem>
                  <SelectItem value="Europe/London">伦敦时间 (UTC+0)</SelectItem>
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
                启用任务
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleUpdateTask}>保存修改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 脚本库选择对话框 */}
      <Dialog open={isScriptLibraryOpen} onOpenChange={setIsScriptLibraryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>选择脚本</DialogTitle>
            <DialogDescription>从脚本库中选择一个脚本作为任务内容</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="搜索脚本..."
                className="pl-10"
                value={scriptSearchTerm}
                onChange={(e) => setScriptSearchTerm(e.target.value)}
              />
            </div>

            <div className="border rounded-md max-h-[400px] overflow-y-auto">
              {filteredScripts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mb-2" />
                  <p className="text-sm">暂无脚本</p>
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
