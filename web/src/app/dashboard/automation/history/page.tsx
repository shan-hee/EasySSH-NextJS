"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  Search,
  MoreHorizontal,
  Eye,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Terminal,
  Calendar,
  Server,
} from "lucide-react"
import { useAuthReady } from "@/hooks/use-auth-ready"

// 模拟执行记录数据
const mockHistory = [
  {
    id: 1,
    taskName: "数据库备份",
    type: "schedule",
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

const sourceTypeColors = {
  schedule: "bg-blue-50 text-blue-700 border-blue-200",
  manual: "bg-green-50 text-green-700 border-green-200",
  batch: "bg-purple-50 text-purple-700 border-purple-200",
  script: "bg-orange-50 text-orange-700 border-orange-200",
}

export default function AutomationHistoryPage() {
  const t = useTranslations("automationHistory")
  const { ready } = useAuthReady()
  const [history] = useState(mockHistory)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<typeof mockHistory[0] | null>(null)

  // 过滤记录
  const filteredHistory = history.filter(record => {
    const matchesSearch =
      record.taskName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.command.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.server.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = selectedStatus === "all" || record.status === selectedStatus
    const matchesType = selectedType === "all" || record.type === selectedType

    return matchesSearch && matchesStatus && matchesType
  })

  if (!ready) {
    // 未来接入后端前，先等待认证就绪再展示历史记录 UI
    return null
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
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return (
          <Badge className="bg-green-100 text-green-800">
            {t("statusSuccess")}
          </Badge>
        )
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-800">
            {t("statusFailed")}
          </Badge>
        )
      case "running":
        return (
          <Badge className="bg-blue-100 text-blue-800">
            {t("statusRunning")}
          </Badge>
        )
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "success":
        return t("statusSuccess")
      case "failed":
        return t("statusFailed")
      case "running":
        return t("statusRunning")
      default:
        return status
    }
  }

  const getStatusExportLabel = (status: string) => {
    switch (status) {
      case "success":
        return t("exportCsvStatusSuccess")
      case "failed":
        return t("exportCsvStatusFailed")
      case "running":
        return t("exportCsvStatusRunning")
      default:
        return status
    }
  }

  const getSourceTypeBadgeLabel = (type: string) => {
    switch (type) {
      case "schedule":
        return t("sourceTypeScheduleShort")
      case "manual":
        return t("sourceTypeManualShort")
      case "batch":
        return t("sourceTypeBatchShort")
      case "script":
        return t("sourceTypeScriptShort")
      default:
        return type
    }
  }

  const getSourceTypeLabel = (type: string) => {
    switch (type) {
      case "schedule":
        return t("typeFilterSchedule")
      case "manual":
        return t("typeFilterManual")
      case "batch":
        return t("typeFilterBatch")
      case "script":
        return t("typeFilterScript")
      default:
        return type
    }
  }

  const getSourceTypeExportLabel = (type: string) => {
    switch (type) {
      case "schedule":
        return t("exportCsvSourceTypeSchedule")
      case "manual":
        return t("exportCsvSourceTypeManual")
      case "batch":
        return t("exportCsvSourceTypeBatch")
      case "script":
        return t("exportCsvSourceTypeScript")
      default:
        return type
    }
  }

  const handleViewDetails = (recordId: number) => {
    const record = history.find(r => r.id === recordId)
    if (record) {
      setSelectedRecord(record)
      setIsDetailsDialogOpen(true)
    }
  }

  const handleRetry = (recordId: number) => {
    const record = history.find(r => r.id === recordId)
    if (record) {
      console.log("重新执行任务:", record.taskName)
      // TODO: 实际的重新执行逻辑
      alert(`即将重新执行任务: ${record.taskName}`)
    }
  }

  const handleDownloadOutput = (recordId: number) => {
    const record = history.find(r => r.id === recordId)
    if (record) {
      const lines = [
        `${t("fieldTaskName")}: ${record.taskName}`,
        `${t("fieldSourceType")}: ${getSourceTypeLabel(record.type)}`,
        `${t("fieldCommand")}: ${record.command}`,
        `${t("fieldServer")}: ${record.server}`,
        `${t("fieldStatus")}: ${getStatusText(record.status)}`,
        `${t("fieldStartTime")}: ${record.startTime}`,
        `${t("fieldEndTime")}: ${record.endTime || t("exportCsvEndTimeNotFinished")}`,
        `${t("fieldDuration")}: ${record.duration}`,
        `${t("fieldExitCode")}: ${record.exitCode !== null ? record.exitCode : "N/A"}`,
        `${t("fieldUser")}: ${record.user}`,
        "",
        `========== ${t("fieldOutput")} ==========`,
        record.output,
      ]

      const content = lines.join("\n")

      const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `execution_${record.id}_${record.startTime.replace(/[: ]/g, "_")}.txt`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }
  }

  const handleExportRecords = () => {
    const headers = [
      t("exportCsvHeaderId"),
      t("exportCsvHeaderTaskName"),
      t("exportCsvHeaderSourceType"),
      t("exportCsvHeaderCommand"),
      t("exportCsvHeaderServer"),
      t("exportCsvHeaderStatus"),
      t("exportCsvHeaderStartTime"),
      t("exportCsvHeaderEndTime"),
      t("exportCsvHeaderDuration"),
      t("exportCsvHeaderExitCode"),
      t("exportCsvHeaderUser"),
    ]

    const rows = filteredHistory.map(record => [
      record.id,
      record.taskName,
      getSourceTypeExportLabel(record.type),
      record.command,
      record.server,
      getStatusExportLabel(record.status),
      record.startTime,
      record.endTime || t("exportCsvEndTimeNotFinished"),
      record.duration,
      record.exitCode !== null ? record.exitCode : "N/A",
      record.user,
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
    ].join("\n")

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `execution_history_${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const successCount = history.filter(h => h.status === "success").length
  const successRate = history.length > 0 ? Math.round((successCount / history.length) * 100) : 0

  return (
    <>
      <PageHeader title={t("pageTitle")}>
        <Button variant="outline" size="sm" onClick={handleExportRecords}>
          <Download className="mr-2 h-4 w-4" />
          {t("exportButton")}
        </Button>
      </PageHeader>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* 统计卡片 */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("statsTotalRunsTitle")}
              </CardTitle>
              <Terminal className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{history.length}</div>
              <p className="text-xs text-muted-foreground">
                {t("statsTotalRunsDesc")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("statsSuccessTitle")}
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {successCount}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("statsSuccessDesc", { percent: successRate })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("statsFailedTitle")}
              </CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {history.filter(h => h.status === "failed").length}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("statsFailedDesc")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("statsRunningTitle")}
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {history.filter(h => h.status === "running").length}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("statsRunningDesc")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 筛选器 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("filterCardTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                <Input
                  placeholder={t("searchPlaceholder")}
                  className="pl-10"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder={t("statusFilterPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("statusFilterAll")}</SelectItem>
                    <SelectItem value="success">{t("statusFilterSuccess")}</SelectItem>
                    <SelectItem value="failed">{t("statusFilterFailed")}</SelectItem>
                    <SelectItem value="running">{t("statusFilterRunning")}</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder={t("typeFilterPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("typeFilterAll")}</SelectItem>
                    <SelectItem value="schedule">{t("typeFilterSchedule")}</SelectItem>
                    <SelectItem value="manual">{t("typeFilterManual")}</SelectItem>
                    <SelectItem value="batch">{t("typeFilterBatch")}</SelectItem>
                    <SelectItem value="script">{t("typeFilterScript")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 执行记录列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("tableTitle")}</CardTitle>
            <CardDescription>
              {t("tableDescription", {
                current: filteredHistory.length,
                total: history.length,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("colTaskInfo")}</TableHead>
                    <TableHead>{t("colServer")}</TableHead>
                    <TableHead>{t("colStatus")}</TableHead>
                    <TableHead>{t("colTime")}</TableHead>
                    <TableHead>{t("colDuration")}</TableHead>
                    <TableHead>{t("colUser")}</TableHead>
                    <TableHead>{t("colActions")}</TableHead>
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
                              className={
                                sourceTypeColors[record.type as keyof typeof sourceTypeColors]
                              }
                            >
                              {getSourceTypeBadgeLabel(record.type)}
                            </Badge>
                          </div>
                          <div className="mt-1 text-xs font-mono text-muted-foreground">
                            {record.command}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate text-sm" title={record.server}>
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
                              {record.startTime.split(" ")[1]}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {record.startTime.split(" ")[0]}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-mono">{record.duration}</div>
                        {record.exitCode !== null && (
                          <div
                            className={`text-xs ${
                              record.exitCode === 0 ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {t("exitCodeLabel")} {record.exitCode}
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
                              {t("actionViewDetails")}
                            </DropdownMenuItem>
                            {record.status === "failed" && (
                              <DropdownMenuItem onClick={() => handleRetry(record.id)}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                {t("actionRetry")}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleDownloadOutput(record.id)}>
                              <Download className="mr-2 h-4 w-4" />
                              {t("actionDownloadOutput")}
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

      {/* 执行详情对话框 */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("detailsDialogTitle")}</DialogTitle>
            <DialogDescription>{t("detailsDialogDescription")}</DialogDescription>
          </DialogHeader>

          {selectedRecord && (
            <div className="space-y-6 py-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t("fieldTaskName")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{selectedRecord.taskName}</span>
                    <Badge
                      variant="outline"
                      className={
                        sourceTypeColors[selectedRecord.type as keyof typeof sourceTypeColors]
                      }
                    >
                      {getSourceTypeLabel(selectedRecord.type)}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t("fieldStatus")}
                  </Label>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(selectedRecord.status)}
                    {getStatusBadge(selectedRecord.status)}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t("fieldUser")}
                  </Label>
                  <div className="font-medium">{selectedRecord.user}</div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t("fieldServer")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{selectedRecord.server}</span>
                  </div>
                </div>
              </div>

              {/* 执行时间信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t("fieldStartTime")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-mono">{selectedRecord.startTime}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t("fieldEndTime")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-mono">
                      {selectedRecord.endTime || t("endTimeRunning")}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t("fieldDuration")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{selectedRecord.duration}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t("fieldExitCode")}
                  </Label>
                  <div
                    className={`font-mono font-medium ${
                      selectedRecord.exitCode === 0
                        ? "text-green-600"
                        : selectedRecord.exitCode === null
                        ? "text-muted-foreground"
                        : "text-red-600"
                    }`}
                  >
                    {selectedRecord.exitCode !== null ? selectedRecord.exitCode : "N/A"}
                  </div>
                </div>
              </div>

              {/* 执行命令 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  {t("fieldCommand")}
                </Label>
                <div className="rounded-md bg-muted p-3">
                  <code className="text-sm font-mono">{selectedRecord.command}</code>
                </div>
              </div>

              {/* 执行输出 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  {t("fieldOutput")}
                </Label>
                <Textarea
                  value={selectedRecord.output}
                  readOnly
                  className="min-h-[300px] scrollbar-custom text-sm font-mono"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {selectedRecord && selectedRecord.status === "failed" && (
              <Button
                variant="outline"
                onClick={() => {
                  setIsDetailsDialogOpen(false)
                  handleRetry(selectedRecord.id)
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {t("detailsRetryButton")}
              </Button>
            )}
            {selectedRecord && (
              <Button
                variant="outline"
                onClick={() => {
                  handleDownloadOutput(selectedRecord.id)
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                {t("detailsDownloadOutputButton")}
              </Button>
            )}
            <Button onClick={() => setIsDetailsDialogOpen(false)}>
              {t("detailsCloseButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
