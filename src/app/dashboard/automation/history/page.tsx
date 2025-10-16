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
  Search,
  MoreHorizontal,
  Eye,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Terminal,
  FileText,
  Zap,
  Calendar
} from "lucide-react"

// 模拟执行记录数据
const mockHistory = [
  {
    id: 1,
    taskName: "数据库备份",
    type: "schedule",
    taskType: "backup",
    command: "bash /scripts/backup_db.sh",
    server: "DB Server 01",
    status: "success",
    startTime: "2024-01-15 14:30:00",
    endTime: "2024-01-15 14:32:35",
    duration: "2分35秒",
    exitCode: 0,
    user: "系统",
    output: "Backup completed successfully. File: backup_20240115_143235.sql.gz",
  },
  {
    id: 2,
    taskName: "手动命令执行",
    type: "manual",
    taskType: "command",
    command: "systemctl restart nginx",
    server: "Web Server 01",
    status: "success",
    startTime: "2024-01-15 14:25:18",
    endTime: "2024-01-15 14:25:20",
    duration: "2秒",
    exitCode: 0,
    user: "管理员",
    output: "nginx restarted successfully",
  },
  {
    id: 3,
    taskName: "批量系统更新",
    type: "batch",
    taskType: "command",
    command: "apt update && apt upgrade -y",
    server: "Web Server 01, Web Server 02, App Server 01",
    status: "failed",
    startTime: "2024-01-15 14:20:42",
    endTime: "2024-01-15 14:21:15",
    duration: "33秒",
    exitCode: 1,
    user: "运维工程师",
    output: "Error: Package dependency conflict",
  },
  {
    id: 4,
    taskName: "日志清理",
    type: "schedule",
    taskType: "maintenance",
    command: "find /var/log -name '*.log' -mtime +30 -delete",
    server: "All Servers",
    status: "success",
    startTime: "2024-01-15 14:15:33",
    endTime: "2024-01-15 14:16:18",
    duration: "45秒",
    exitCode: 0,
    user: "系统",
    output: "Cleaned 127 log files, freed 2.3GB space",
  },
  {
    id: 5,
    taskName: "部署脚本",
    type: "script",
    taskType: "deploy",
    command: "bash /scripts/deploy_app.sh",
    server: "App Server 01",
    status: "running",
    startTime: "2024-01-15 14:10:15",
    endTime: null,
    duration: "进行中...",
    exitCode: null,
    user: "开发者",
    output: "Deploying application...\nStep 1/5 completed",
  },
  {
    id: 6,
    taskName: "配置文件分发",
    type: "batch",
    taskType: "file",
    command: "scp /config/nginx.conf remote:/etc/nginx/",
    server: "Web Server 01, Web Server 02",
    status: "success",
    startTime: "2024-01-15 14:05:08",
    endTime: "2024-01-15 14:06:20",
    duration: "1分12秒",
    exitCode: 0,
    user: "运维工程师",
    output: "Files distributed successfully to 2 servers",
  },
  {
    id: 7,
    taskName: "数据库备份",
    type: "schedule",
    taskType: "backup",
    command: "bash /scripts/backup_db.sh",
    server: "DB Server 02",
    status: "failed",
    startTime: "2024-01-15 02:00:00",
    endTime: "2024-01-15 02:00:05",
    duration: "5秒",
    exitCode: 1,
    user: "系统",
    output: "Error: Cannot connect to database server",
  },
  {
    id: 8,
    taskName: "性能监控报告",
    type: "schedule",
    taskType: "monitoring",
    command: "python /scripts/collect_metrics.py",
    server: "Monitoring Server",
    status: "success",
    startTime: "2024-01-15 14:00:00",
    endTime: "2024-01-15 14:00:03",
    duration: "3秒",
    exitCode: 0,
    user: "系统",
    output: "Metrics collected: CPU 45%, Memory 62%, Disk 78%",
  },
]

const taskTypeColors = {
  backup: "bg-blue-100 text-blue-800",
  maintenance: "bg-purple-100 text-purple-800",
  command: "bg-green-100 text-green-800",
  monitoring: "bg-orange-100 text-orange-800",
  deploy: "bg-cyan-100 text-cyan-800",
  file: "bg-pink-100 text-pink-800",
}

const taskTypeLabels = {
  backup: "备份",
  maintenance: "维护",
  command: "命令",
  monitoring: "监控",
  deploy: "部署",
  file: "文件",
}

const sourceTypeColors = {
  schedule: "bg-blue-50 text-blue-700 border-blue-200",
  manual: "bg-green-50 text-green-700 border-green-200",
  batch: "bg-purple-50 text-purple-700 border-purple-200",
  script: "bg-orange-50 text-orange-700 border-orange-200",
}

export default function AutomationHistoryPage() {
  const [history] = useState(mockHistory)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [selectedType, setSelectedType] = useState<string>("all")

  // 过滤记录
  const filteredHistory = history.filter(record => {
    const matchesSearch = record.taskName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.command.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.server.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = selectedStatus === "all" || record.status === selectedStatus
    const matchesType = selectedType === "all" || record.type === selectedType

    return matchesSearch && matchesStatus && matchesType
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-100 text-green-800">成功</Badge>
      case "failed":
        return <Badge className="bg-red-100 text-red-800">失败</Badge>
      case "running":
        return <Badge className="bg-blue-100 text-blue-800">执行中</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />
      case "running":
        return <Clock className="h-4 w-4 text-blue-600 animate-spin" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const handleViewDetails = (recordId: number) => {
    console.log("查看执行详情:", recordId)
  }

  const handleRetry = (recordId: number) => {
    console.log("重新执行任务:", recordId)
  }

  const handleDownloadOutput = (recordId: number) => {
    console.log("下载执行输出:", recordId)
  }

  return (
    <>
      <PageHeader
        title="执行记录"
        breadcrumbs={[
          { title: "自动化", href: "#" },
          { title: "执行记录" }
        ]}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => console.log("导出记录")}
        >
          <Download className="mr-2 h-4 w-4" />
          导出记录
        </Button>
      </PageHeader>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* 统计卡片 */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总执行次数</CardTitle>
              <Terminal className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{history.length}</div>
              <p className="text-xs text-muted-foreground">
                过去24小时
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">成功执行</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {history.filter(h => h.status === "success").length}
              </div>
              <p className="text-xs text-muted-foreground">
                成功率 {Math.round(history.filter(h => h.status === "success").length / history.length * 100)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">失败任务</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {history.filter(h => h.status === "failed").length}
              </div>
              <p className="text-xs text-muted-foreground">
                需要处理
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">执行中</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {history.filter(h => h.status === "running").length}
              </div>
              <p className="text-xs text-muted-foreground">
                正在进行
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
                  placeholder="搜索任务名称、命令或服务器..."
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
                    <SelectItem value="success">成功</SelectItem>
                    <SelectItem value="failed">失败</SelectItem>
                    <SelectItem value="running">执行中</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="来源" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有来源</SelectItem>
                    <SelectItem value="schedule">定时任务</SelectItem>
                    <SelectItem value="manual">手动执行</SelectItem>
                    <SelectItem value="batch">批量操作</SelectItem>
                    <SelectItem value="script">脚本执行</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 执行记录列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">执行历史</CardTitle>
            <CardDescription>
              显示 {filteredHistory.length} 条记录，共 {history.length} 条
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>任务信息</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>服务器</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>执行时间</TableHead>
                    <TableHead>耗时</TableHead>
                    <TableHead>执行者</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.map(record => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="font-medium">{record.taskName}</div>
                            <Badge
                              variant="outline"
                              className={sourceTypeColors[record.type as keyof typeof sourceTypeColors]}
                            >
                              {record.type === "schedule" ? "定时" :
                               record.type === "manual" ? "手动" :
                               record.type === "batch" ? "批量" : "脚本"}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground font-mono mt-1">
                            {record.command}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={taskTypeColors[record.taskType as keyof typeof taskTypeColors]}>
                          {taskTypeLabels[record.taskType as keyof typeof taskTypeLabels]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm max-w-xs truncate" title={record.server}>
                          {record.server}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(record.status)}
                          {getStatusBadge(record.status)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <div>
                            <div className="text-sm font-mono">
                              {record.startTime.split(' ')[1]}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {record.startTime.split(' ')[0]}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-mono">
                          {record.duration}
                        </div>
                        {record.exitCode !== null && (
                          <div className={`text-xs ${record.exitCode === 0 ? 'text-green-600' : 'text-red-600'}`}>
                            退出码: {record.exitCode}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{record.user}</div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetails(record.id)}>
                              <Eye className="mr-2 h-4 w-4" />
                              查看详情
                            </DropdownMenuItem>
                            {record.status === "failed" && (
                              <DropdownMenuItem onClick={() => handleRetry(record.id)}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                重新执行
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleDownloadOutput(record.id)}>
                              <Download className="mr-2 h-4 w-4" />
                              下载输出
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
