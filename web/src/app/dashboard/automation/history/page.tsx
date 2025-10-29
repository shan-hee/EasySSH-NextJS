"use client"

import { useState } from "react"
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
 Server
} from "lucide-react"

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
 const [history] = useState(mockHistory)
 const [searchTerm, setSearchTerm] = useState("")
 const [selectedStatus, setSelectedStatus] = useState<string>("all")
 const [selectedType, setSelectedType] = useState<string>("all")
 const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
 const [selectedRecord, setSelectedRecord] = useState<typeof mockHistory[0] | null>(null)

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
 // 创建输出内容
 const content = `任务名称: ${record.taskName}
来源类型: ${record.type === "schedule" ? "定时任务" : record.type === "manual" ? "手动执行" : record.type === "batch" ? "批量操作" : "脚本执行"}
执行命令: ${record.command}
服务器: ${record.server}
状态: ${record.status === "success" ? "成功" : record.status === "failed" ? "失败" : "执行中"}
开始时间: ${record.startTime}
结束时间: ${record.endTime || "未结束"}
耗时: ${record.duration}
退出码: ${record.exitCode !== null ? record.exitCode : "N/A"}
执行者: ${record.user}

========== 执行输出 ==========
${record.output}
`
 // 创建 Blob 并下载
 const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
 const url = URL.createObjectURL(blob)
 const link = document.createElement('a')
 link.href = url
 link.download = `execution_${record.id}_${record.startTime.replace(/[: ]/g, '_')}.txt`
 document.body.appendChild(link)
 link.click()
 document.body.removeChild(link)
 URL.revokeObjectURL(url)
 }
 }

 const handleExportRecords = () => {
 // 导出当前筛选的记录为 CSV
 const headers = ['ID', '任务名称', '来源类型', '命令', '服务器', '状态', '开始时间', '结束时间', '耗时', '退出码', '执行者']
 const rows = filteredHistory.map(record => [
 record.id,
 record.taskName,
 record.type === "schedule" ? "定时任务" : record.type === "manual" ? "手动执行" : record.type === "batch" ? "批量操作" : "脚本执行",
 record.command,
 record.server,
 record.status === "success" ? "成功" : record.status === "failed" ? "失败" : "执行中",
 record.startTime,
 record.endTime || "未结束",
 record.duration,
 record.exitCode !== null ? record.exitCode : "N/A",
 record.user
 ])

 const csvContent = [
 headers.join(','),
 ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
 ].join('\n')

 const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' })
 const url = URL.createObjectURL(blob)
 const link = document.createElement('a')
 link.href = url
 link.download = `execution_history_${new Date().toISOString().split('T')[0]}.csv`
 document.body.appendChild(link)
 link.click()
 document.body.removeChild(link)
 URL.revokeObjectURL(url)
 }

 return (
 <>
 <PageHeader
 title="执行记录">
 <Button
 variant="outline"
 size="sm"
 onClick={handleExportRecords}
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

 {/* 执行详情对话框 */}
 <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
 <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>执行详情</DialogTitle>
 <DialogDescription>
 查看任务执行的详细信息和输出结果
 </DialogDescription>
 </DialogHeader>

 {selectedRecord && (
 <div className="space-y-6 py-4">
 {/* 基本信息 */}
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label className="text-sm font-medium text-muted-foreground">任务名称</Label>
 <div className="flex items-center gap-2">
 <span className="font-medium">{selectedRecord.taskName}</span>
 <Badge
 variant="outline"
 className={sourceTypeColors[selectedRecord.type as keyof typeof sourceTypeColors]}
 >
 {selectedRecord.type === "schedule" ? "定时任务" :
 selectedRecord.type === "manual" ? "手动执行" :
 selectedRecord.type === "batch" ? "批量操作" : "脚本执行"}
 </Badge>
 </div>
 </div>

 <div className="space-y-2">
 <Label className="text-sm font-medium text-muted-foreground">执行状态</Label>
 <div className="flex items-center gap-2">
 {getStatusIcon(selectedRecord.status)}
 {getStatusBadge(selectedRecord.status)}
 </div>
 </div>

 <div className="space-y-2">
 <Label className="text-sm font-medium text-muted-foreground">执行者</Label>
 <div className="font-medium">{selectedRecord.user}</div>
 </div>

 <div className="space-y-2">
 <Label className="text-sm font-medium text-muted-foreground">服务器</Label>
 <div className="flex items-center gap-2">
 <Server className="h-4 w-4 text-muted-foreground" />
 <span className="font-medium">{selectedRecord.server}</span>
 </div>
 </div>
 </div>

 {/* 执行时间信息 */}
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label className="text-sm font-medium text-muted-foreground">开始时间</Label>
 <div className="flex items-center gap-2">
 <Calendar className="h-4 w-4 text-muted-foreground" />
 <span className="font-mono text-sm">{selectedRecord.startTime}</span>
 </div>
 </div>

 <div className="space-y-2">
 <Label className="text-sm font-medium text-muted-foreground">结束时间</Label>
 <div className="flex items-center gap-2">
 <Calendar className="h-4 w-4 text-muted-foreground" />
 <span className="font-mono text-sm">{selectedRecord.endTime || "执行中..."}</span>
 </div>
 </div>

 <div className="space-y-2">
 <Label className="text-sm font-medium text-muted-foreground">执行耗时</Label>
 <div className="flex items-center gap-2">
 <Clock className="h-4 w-4 text-muted-foreground" />
 <span className="font-medium">{selectedRecord.duration}</span>
 </div>
 </div>

 <div className="space-y-2">
 <Label className="text-sm font-medium text-muted-foreground">退出码</Label>
 <div className={`font-mono font-medium ${
 selectedRecord.exitCode === 0 ? 'text-green-600' :
 selectedRecord.exitCode === null ? 'text-muted-foreground' : 'text-red-600'
 }`}>
 {selectedRecord.exitCode !== null ? selectedRecord.exitCode : "N/A"}
 </div>
 </div>
 </div>

 {/* 执行命令 */}
 <div className="space-y-2">
 <Label className="text-sm font-medium text-muted-foreground">执行命令</Label>
 <div className="bg-muted rounded-md p-3">
 <code className="text-sm font-mono">{selectedRecord.command}</code>
 </div>
 </div>

 {/* 执行输出 */}
 <div className="space-y-2">
 <Label className="text-sm font-medium text-muted-foreground">执行输出</Label>
 <Textarea
 value={selectedRecord.output}
 readOnly
 className="font-mono text-sm min-h-[300px] scrollbar-custom"
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
 重新执行
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
 下载输出
 </Button>
 )}
 <Button onClick={() => setIsDetailsDialogOpen(false)}>
 关闭
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </>
 )
}
