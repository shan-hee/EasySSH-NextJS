"use client"

import { useState, useEffect, useRef } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Kbd } from "@/components/ui/kbd"
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
  Server
} from "lucide-react"

// 模拟定时任务数据
const mockSchedules = [
  {
    id: 1,
    name: "数据库备份",
    description: "每天凌晨2点备份所有数据库",
    cron: "0 2 * * *",
    cronDesc: "每天 02:00",
    type: "backup",
    status: "active",
    servers: ["DB Server 01", "DB Server 02"],
    command: "bash /scripts/backup_db.sh",
    lastRun: "2024-01-15 02:00:00",
    lastResult: "success",
    nextRun: "2024-01-16 02:00:00",
    execCount: 365,
    successRate: 99.7,
    createdBy: "管理员",
  },
  {
    id: 2,
    name: "日志清理",
    description: "每周日凌晨3点清理旧日志",
    cron: "0 3 * * 0",
    cronDesc: "每周日 03:00",
    type: "maintenance",
    status: "active",
    servers: ["Web Server 01", "Web Server 02", "App Server 01"],
    command: "find /var/log -name '*.log' -mtime +30 -delete",
    lastRun: "2024-01-14 03:00:00",
    lastResult: "success",
    nextRun: "2024-01-21 03:00:00",
    execCount: 52,
    successRate: 100,
    createdBy: "运维工程师",
  },
  {
    id: 3,
    name: "系统更新检查",
    description: "每天早上8点检查系统更新",
    cron: "0 8 * * *",
    cronDesc: "每天 08:00",
    type: "check",
    status: "active",
    servers: ["All Servers"],
    command: "apt update && apt list --upgradable",
    lastRun: "2024-01-15 08:00:00",
    lastResult: "success",
    nextRun: "2024-01-16 08:00:00",
    execCount: 180,
    successRate: 98.3,
    createdBy: "管理员",
  },
  {
    id: 4,
    name: "性能监控报告",
    description: "每小时收集性能指标",
    cron: "0 * * * *",
    cronDesc: "每小时执行",
    type: "monitoring",
    status: "active",
    servers: ["Monitoring Server"],
    command: "python /scripts/collect_metrics.py",
    lastRun: "2024-01-15 14:00:00",
    lastResult: "success",
    nextRun: "2024-01-15 15:00:00",
    execCount: 8760,
    successRate: 99.9,
    createdBy: "运维工程师",
  },
  {
    id: 5,
    name: "SSL证书检查",
    description: "每月1号检查SSL证书过期情况",
    cron: "0 9 1 * *",
    cronDesc: "每月1号 09:00",
    type: "check",
    status: "inactive",
    servers: ["Web Server 01", "Web Server 02"],
    command: "bash /scripts/check_ssl_cert.sh",
    lastRun: "2024-01-01 09:00:00",
    lastResult: "failed",
    nextRun: "2024-02-01 09:00:00",
    execCount: 12,
    successRate: 91.7,
    createdBy: "管理员",
  },
  {
    id: 6,
    name: "临时文件清理",
    description: "每6小时清理临时文件",
    cron: "0 */6 * * *",
    cronDesc: "每6小时执行",
    type: "maintenance",
    status: "active",
    servers: ["All Servers"],
    command: "rm -rf /tmp/* && rm -rf /var/tmp/*",
    lastRun: "2024-01-15 12:00:00",
    lastResult: "success",
    nextRun: "2024-01-15 18:00:00",
    execCount: 1460,
    successRate: 99.8,
    createdBy: "运维工程师",
  },
]

export default function AutomationSchedulesPage() {
  const [schedules, setSchedules] = useState(mockSchedules)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null)

  // 新建任务表单
  const [newSchedule, setNewSchedule] = useState({
    name: "",
    description: "",
    cron: "",
    servers: [] as string[],
    command: "",
  })

  // 编辑任务表单
  const [editSchedule, setEditSchedule] = useState({
    name: "",
    description: "",
    cron: "",
    servers: [] as string[],
    command: "",
  })

  const [serverInput, setServerInput] = useState("")
  const [editServerInput, setEditServerInput] = useState("")
  const [showServerSuggestions, setShowServerSuggestions] = useState(false)
  const [showEditServerSuggestions, setShowEditServerSuggestions] = useState(false)
  const [selectedServerIndex, setSelectedServerIndex] = useState(-1)
  const [selectedEditServerIndex, setSelectedEditServerIndex] = useState(-1)
  const serverSuggestionRefs = useRef<(HTMLButtonElement | null)[]>([])
  const editServerSuggestionRefs = useRef<(HTMLButtonElement | null)[]>([])

  // 获取所有服务器列表
  const allServers = Array.from(new Set(schedules.flatMap(s => s.servers)))

  // 可用服务器（排除已选择的）
  const availableServers = allServers.filter(server => !newSchedule.servers.includes(server))
  const availableEditServers = allServers.filter(server => !editSchedule.servers.includes(server))

  // 服务器建议过滤
  const filteredServerSuggestions = serverInput.trim()
    ? availableServers.filter(server =>
        server.toLowerCase().includes(serverInput.toLowerCase())
      )
    : availableServers

  const filteredEditServerSuggestions = editServerInput.trim()
    ? availableEditServers.filter(server =>
        server.toLowerCase().includes(editServerInput.toLowerCase())
      )
    : availableEditServers

  // 自动滚动服务器建议
  useEffect(() => {
    if (selectedServerIndex >= 0 && serverSuggestionRefs.current[selectedServerIndex]) {
      serverSuggestionRefs.current[selectedServerIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      })
    }
  }, [selectedServerIndex])

  useEffect(() => {
    if (selectedEditServerIndex >= 0 && editServerSuggestionRefs.current[selectedEditServerIndex]) {
      editServerSuggestionRefs.current[selectedEditServerIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      })
    }
  }, [selectedEditServerIndex])

  // 过滤任务
  const filteredSchedules = schedules.filter(schedule => {
    const matchesSearch = schedule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         schedule.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         schedule.command.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = selectedStatus === "all" || schedule.status === selectedStatus
    const matchesType = selectedType === "all" || schedule.type === selectedType

    return matchesSearch && matchesStatus && matchesType
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">启用</Badge>
      case "inactive":
        return <Badge className="bg-gray-100 text-gray-800">禁用</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getResultIcon = (result: string) => {
    switch (result) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const handleToggleStatus = (scheduleId: number) => {
    console.log("切换任务状态:", scheduleId)
  }

  const handleRunNow = (scheduleId: number) => {
    console.log("立即执行任务:", scheduleId)
  }

  const handleEdit = (scheduleId: number) => {
    const schedule = schedules.find(s => s.id === scheduleId)
    if (schedule) {
      setEditingScheduleId(scheduleId)
      setEditSchedule({
        name: schedule.name,
        description: schedule.description,
        cron: schedule.cron,
        servers: [...schedule.servers],
        command: schedule.command,
      })
      setIsEditDialogOpen(true)
    }
  }

  const handleDuplicate = (scheduleId: number) => {
    console.log("复制任务:", scheduleId)
  }

  const handleDelete = (scheduleId: number) => {
    console.log("删除任务:", scheduleId)
  }

  const handleAddServer = (server?: string) => {
    const serverToAdd = server || serverInput.trim()
    if (serverToAdd && !newSchedule.servers.includes(serverToAdd)) {
      setNewSchedule({
        ...newSchedule,
        servers: [...newSchedule.servers, serverToAdd],
      })
      setServerInput("")
      setShowServerSuggestions(false)
      setSelectedServerIndex(-1)
    }
  }

  const handleKeyDownServer = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showServerSuggestions || filteredServerSuggestions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleAddServer()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedServerIndex((prev) =>
          prev < filteredServerSuggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedServerIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedServerIndex >= 0) {
          handleAddServer(filteredServerSuggestions[selectedServerIndex])
        } else {
          handleAddServer()
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowServerSuggestions(false)
        setSelectedServerIndex(-1)
        break
    }
  }

  const handleRemoveServer = (server: string) => {
    setNewSchedule({
      ...newSchedule,
      servers: newSchedule.servers.filter(s => s !== server),
    })
  }

  const handleAddEditServer = (server?: string) => {
    const serverToAdd = server || editServerInput.trim()
    if (serverToAdd && !editSchedule.servers.includes(serverToAdd)) {
      setEditSchedule({
        ...editSchedule,
        servers: [...editSchedule.servers, serverToAdd],
      })
      setEditServerInput("")
      setShowEditServerSuggestions(false)
      setSelectedEditServerIndex(-1)
    }
  }

  const handleKeyDownEditServer = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showEditServerSuggestions || filteredEditServerSuggestions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleAddEditServer()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedEditServerIndex((prev) =>
          prev < filteredEditServerSuggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedEditServerIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedEditServerIndex >= 0) {
          handleAddEditServer(filteredEditServerSuggestions[selectedEditServerIndex])
        } else {
          handleAddEditServer()
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowEditServerSuggestions(false)
        setSelectedEditServerIndex(-1)
        break
    }
  }

  const handleRemoveEditServer = (server: string) => {
    setEditSchedule({
      ...editSchedule,
      servers: editSchedule.servers.filter(s => s !== server),
    })
  }

  const parseCronDesc = (cron: string) => {
    // 简单的 cron 解析，实际应该使用专业库
    return cron
  }

  const handleCreateSchedule = () => {
    if (!newSchedule.name || !newSchedule.cron || !newSchedule.command) {
      alert("请填写任务名称、调度规则和命令")
      return
    }

    const schedule = {
      id: schedules.length + 1,
      name: newSchedule.name,
      description: newSchedule.description,
      cron: newSchedule.cron,
      cronDesc: parseCronDesc(newSchedule.cron),
      type: "backup",
      status: "active",
      servers: newSchedule.servers.length > 0 ? newSchedule.servers : ["All Servers"],
      command: newSchedule.command,
      lastRun: "-",
      lastResult: "pending",
      nextRun: new Date().toISOString().split('T')[0] + " 00:00:00",
      execCount: 0,
      successRate: 0,
      createdBy: "管理员",
    }

    setSchedules([schedule, ...schedules])
    setIsDialogOpen(false)

    // 重置表单
    setNewSchedule({
      name: "",
      description: "",
      cron: "",
      servers: [],
      command: "",
    })
    setServerInput("")
  }

  const handleUpdateSchedule = () => {
    if (!editSchedule.name || !editSchedule.cron || !editSchedule.command) {
      alert("请填写任务名称、调度规则和命令")
      return
    }

    if (editingScheduleId === null) return

    setSchedules(schedules.map(schedule => {
      if (schedule.id === editingScheduleId) {
        return {
          ...schedule,
          name: editSchedule.name,
          description: editSchedule.description,
          cron: editSchedule.cron,
          cronDesc: parseCronDesc(editSchedule.cron),
          servers: editSchedule.servers.length > 0 ? editSchedule.servers : ["All Servers"],
          command: editSchedule.command,
        }
      }
      return schedule
    }))

    setIsEditDialogOpen(false)
    setEditingScheduleId(null)

    // 重置表单
    setEditSchedule({
      name: "",
      description: "",
      cron: "",
      servers: [],
      command: "",
    })
    setEditServerInput("")
  }

  const handleOpenDialog = () => {
    setIsDialogOpen(true)
  }

  const handleCloseDialog = (open: boolean) => {
    setIsDialogOpen(open)
    if (!open) {
      setNewSchedule({
        name: "",
        description: "",
        cron: "",
        servers: [],
        command: "",
      })
      setServerInput("")
    }
  }

  const handleCloseEditDialog = (open: boolean) => {
    setIsEditDialogOpen(open)
    if (!open) {
      setEditingScheduleId(null)
      setEditSchedule({
        name: "",
        description: "",
        cron: "",
        servers: [],
        command: "",
      })
      setEditServerInput("")
    }
  }

  return (
    <>
      <PageHeader
        title="任务调度"
        breadcrumbs={[
          { title: "自动化", href: "#" },
          { title: "任务调度" }
        ]}
      >
        <Button onClick={handleOpenDialog}>
          <Plus className="mr-2 h-4 w-4" />
          新建定时任务
        </Button>
      </PageHeader>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* 统计卡片 */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总任务数</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{schedules.length}</div>
              <p className="text-xs text-muted-foreground">
                启用: {schedules.filter(s => s.status === "active").length}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">今日执行</CardTitle>
              <Play className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">42</div>
              <p className="text-xs text-muted-foreground">
                成功率 98.5%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">待执行任务</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {schedules.filter(s => s.status === "active").length}
              </div>
              <p className="text-xs text-muted-foreground">
                下一次: 15:00
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">失败任务</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {schedules.filter(s => s.lastResult === "failed").length}
              </div>
              <p className="text-xs text-muted-foreground">
                需要检查
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 筛选器 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">筛选器</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="搜索任务名称、描述或命令..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有状态</SelectItem>
                    <SelectItem value="active">启用</SelectItem>
                    <SelectItem value="inactive">禁用</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有类型</SelectItem>
                    <SelectItem value="backup">备份</SelectItem>
                    <SelectItem value="maintenance">维护</SelectItem>
                    <SelectItem value="check">检查</SelectItem>
                    <SelectItem value="monitoring">监控</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 任务列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">定时任务列表</CardTitle>
            <CardDescription>
              显示 {filteredSchedules.length} 个任务，共 {schedules.length} 个
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>任务名称</TableHead>
                    <TableHead>调度规则</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>服务器</TableHead>
                    <TableHead>最后执行</TableHead>
                    <TableHead>成功率</TableHead>
                    <TableHead>下次执行</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSchedules.map(schedule => (
                    <TableRow key={schedule.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{schedule.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {schedule.description}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono mt-1">
                            {schedule.command}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-mono text-sm">{schedule.cron}</div>
                            <div className="text-xs text-muted-foreground">
                              {schedule.cronDesc}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(schedule.status)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {schedule.servers.length === 1 && schedule.servers[0] === "All Servers" ? (
                            <Badge variant="outline">所有服务器</Badge>
                          ) : (
                            <div>
                              {schedule.servers.slice(0, 1).map(server => (
                                <div key={server} className="text-muted-foreground">
                                  {server}
                                </div>
                              ))}
                              {schedule.servers.length > 1 && (
                                <div className="text-xs text-muted-foreground">
                                  +{schedule.servers.length - 1} 更多
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getResultIcon(schedule.lastResult)}
                          <div>
                            <div className="text-sm font-mono">
                              {schedule.lastRun.split(' ')[1]}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {schedule.lastRun.split(' ')[0]}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`text-sm font-medium ${schedule.successRate >= 99 ? 'text-green-600' : schedule.successRate >= 95 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {schedule.successRate}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ({schedule.execCount}次)
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        <div className="text-sm">
                          {schedule.nextRun.split(' ')[1]}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {schedule.nextRun.split(' ')[0]}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleRunNow(schedule.id)}>
                              <Play className="mr-2 h-4 w-4" />
                              立即执行
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleStatus(schedule.id)}>
                              {schedule.status === "active" ? (
                                <>
                                  <Pause className="mr-2 h-4 w-4" />
                                  禁用
                                </>
                              ) : (
                                <>
                                  <Zap className="mr-2 h-4 w-4" />
                                  启用
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(schedule.id)}>
                              <Edit className="mr-2 h-4 w-4" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(schedule.id)}>
                              <Copy className="mr-2 h-4 w-4" />
                              复制
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(schedule.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 新建任务弹窗 */}
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新建定时任务</DialogTitle>
            <DialogDescription>
              创建新的定时任务，自动执行脚本或命令
            </DialogDescription>
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
                value={newSchedule.name}
                onChange={(e) => setNewSchedule({ ...newSchedule, name: e.target.value })}
              />
            </div>

            {/* 任务描述 */}
            <div className="space-y-2">
              <Label htmlFor="task-description">任务描述</Label>
              <Input
                id="task-description"
                placeholder="简要描述任务的目的"
                value={newSchedule.description}
                onChange={(e) => setNewSchedule({ ...newSchedule, description: e.target.value })}
              />
            </div>

            {/* Cron 表达式 */}
            <div className="space-y-2">
              <Label htmlFor="task-cron">
                Cron 表达式 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="task-cron"
                placeholder="例如：0 2 * * * (每天凌晨2点)"
                value={newSchedule.cron}
                onChange={(e) => setNewSchedule({ ...newSchedule, cron: e.target.value })}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                格式：分 时 日 月 周，例如 0 2 * * * 表示每天凌晨2点执行
              </p>
            </div>

            {/* 目标服务器 */}
            <div className="space-y-2">
              <Label htmlFor="task-servers">目标服务器</Label>
              <div className="relative">
                <Input
                  id="task-servers"
                  placeholder="输入服务器名称，按回车添加"
                  value={serverInput}
                  onChange={(e) => {
                    setServerInput(e.target.value)
                    setShowServerSuggestions(true)
                    setSelectedServerIndex(-1)
                  }}
                  onFocus={() => setShowServerSuggestions(true)}
                  onBlur={() => {
                    setTimeout(() => {
                      setShowServerSuggestions(false)
                      setSelectedServerIndex(-1)
                    }, 200)
                  }}
                  onKeyDown={handleKeyDownServer}
                />

                {/* 服务器建议下拉框 */}
                {showServerSuggestions && filteredServerSuggestions.length > 0 && serverInput.trim() && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-[200px] overflow-y-auto scrollbar-custom">
                    <div className="p-1">
                      {filteredServerSuggestions.map((server, index) => (
                        <button
                          key={server}
                          ref={(el) => {
                            serverSuggestionRefs.current[index] = el
                          }}
                          type="button"
                          className={`w-full text-left px-2 py-1.5 text-sm rounded-sm cursor-pointer transition-colors ${
                            index === selectedServerIndex
                              ? 'bg-accent text-accent-foreground'
                              : 'hover:bg-accent/50'
                          }`}
                          onMouseEnter={() => setSelectedServerIndex(index)}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            handleAddServer(server)
                          }}
                        >
                          {server}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                输入服务器名称，
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                选择建议，
                <Kbd>Enter</Kbd>
                添加，
                <Kbd>Esc</Kbd>
                关闭。不添加则默认所有服务器
              </p>

              {/* 已添加的服务器 */}
              {newSchedule.servers.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {newSchedule.servers.map((server) => (
                    <Badge key={server} variant="secondary" className="gap-1">
                      <Server className="h-3 w-3" />
                      {server}
                      <button
                        type="button"
                        onClick={() => handleRemoveServer(server)}
                        className="ml-1 hover:text-destructive"
                      >
                        <XCircle className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* 执行命令 */}
            <div className="space-y-2">
              <Label htmlFor="task-command">
                执行命令 <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="task-command"
                placeholder="bash /scripts/backup.sh"
                className="font-mono min-h-[100px]"
                value={newSchedule.command}
                onChange={(e) => setNewSchedule({ ...newSchedule, command: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                输入要执行的命令或脚本路径
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateSchedule}>
              创建任务
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑任务弹窗 */}
      <Dialog open={isEditDialogOpen} onOpenChange={handleCloseEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑定时任务</DialogTitle>
            <DialogDescription>
              修改定时任务的配置信息
            </DialogDescription>
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
                value={editSchedule.name}
                onChange={(e) => setEditSchedule({ ...editSchedule, name: e.target.value })}
              />
            </div>

            {/* 任务描述 */}
            <div className="space-y-2">
              <Label htmlFor="edit-task-description">任务描述</Label>
              <Input
                id="edit-task-description"
                placeholder="简要描述任务的目的"
                value={editSchedule.description}
                onChange={(e) => setEditSchedule({ ...editSchedule, description: e.target.value })}
              />
            </div>

            {/* Cron 表达式 */}
            <div className="space-y-2">
              <Label htmlFor="edit-task-cron">
                Cron 表达式 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-task-cron"
                placeholder="例如：0 2 * * * (每天凌晨2点)"
                value={editSchedule.cron}
                onChange={(e) => setEditSchedule({ ...editSchedule, cron: e.target.value })}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                格式：分 时 日 月 周，例如 0 2 * * * 表示每天凌晨2点执行
              </p>
            </div>

            {/* 目标服务器 */}
            <div className="space-y-2">
              <Label htmlFor="edit-task-servers">目标服务器</Label>
              <div className="relative">
                <Input
                  id="edit-task-servers"
                  placeholder="输入服务器名称，按回车添加"
                  value={editServerInput}
                  onChange={(e) => {
                    setEditServerInput(e.target.value)
                    setShowEditServerSuggestions(true)
                    setSelectedEditServerIndex(-1)
                  }}
                  onFocus={() => setShowEditServerSuggestions(true)}
                  onBlur={() => {
                    setTimeout(() => {
                      setShowEditServerSuggestions(false)
                      setSelectedEditServerIndex(-1)
                    }, 200)
                  }}
                  onKeyDown={handleKeyDownEditServer}
                />

                {/* 服务器建议下拉框 */}
                {showEditServerSuggestions && filteredEditServerSuggestions.length > 0 && editServerInput.trim() && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-[200px] overflow-y-auto scrollbar-custom">
                    <div className="p-1">
                      {filteredEditServerSuggestions.map((server, index) => (
                        <button
                          key={server}
                          ref={(el) => {
                            editServerSuggestionRefs.current[index] = el
                          }}
                          type="button"
                          className={`w-full text-left px-2 py-1.5 text-sm rounded-sm cursor-pointer transition-colors ${
                            index === selectedEditServerIndex
                              ? 'bg-accent text-accent-foreground'
                              : 'hover:bg-accent/50'
                          }`}
                          onMouseEnter={() => setSelectedEditServerIndex(index)}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            handleAddEditServer(server)
                          }}
                        >
                          {server}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                输入服务器名称，
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                选择建议，
                <Kbd>Enter</Kbd>
                添加，
                <Kbd>Esc</Kbd>
                关闭。不添加则默认所有服务器
              </p>

              {/* 已添加的服务器 */}
              {editSchedule.servers.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {editSchedule.servers.map((server) => (
                    <Badge key={server} variant="secondary" className="gap-1">
                      <Server className="h-3 w-3" />
                      {server}
                      <button
                        type="button"
                        onClick={() => handleRemoveEditServer(server)}
                        className="ml-1 hover:text-destructive"
                      >
                        <XCircle className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* 执行命令 */}
            <div className="space-y-2">
              <Label htmlFor="edit-task-command">
                执行命令 <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="edit-task-command"
                placeholder="bash /scripts/backup.sh"
                className="font-mono min-h-[100px]"
                value={editSchedule.command}
                onChange={(e) => setEditSchedule({ ...editSchedule, command: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                输入要执行的命令或脚本路径
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleUpdateSchedule}>
              保存修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
