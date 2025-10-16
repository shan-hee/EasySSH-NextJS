"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  Copy
} from "lucide-react"
import Link from "next/link"

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

const typeColors = {
  backup: "bg-blue-100 text-blue-800",
  maintenance: "bg-purple-100 text-purple-800",
  check: "bg-green-100 text-green-800",
  monitoring: "bg-orange-100 text-orange-800",
}

const typeLabels = {
  backup: "备份",
  maintenance: "维护",
  check: "检查",
  monitoring: "监控",
}

export default function AutomationSchedulesPage() {
  const [schedules] = useState(mockSchedules)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [selectedType, setSelectedType] = useState<string>("all")

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
    console.log("编辑任务:", scheduleId)
  }

  const handleDuplicate = (scheduleId: number) => {
    console.log("复制任务:", scheduleId)
  }

  const handleDelete = (scheduleId: number) => {
    console.log("删除任务:", scheduleId)
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
        <Link href="/dashboard/automation/schedules/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            新建定时任务
          </Button>
        </Link>
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
                    <TableHead>类型</TableHead>
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
                        <Badge className={typeColors[schedule.type as keyof typeof typeColors]}>
                          {typeLabels[schedule.type as keyof typeof typeLabels]}
                        </Badge>
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
    </>
  )
}
