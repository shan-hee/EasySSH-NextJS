"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
 Save,
 Database,
 Download,
 Upload,
 RefreshCw,
 Clock,
 HardDrive,
 CheckCircle,
 AlertTriangle,
 PlayCircle,
 FileArchive,
 CloudDownload,
 FolderArchive
} from "lucide-react"

// 模拟备份历史数据
const mockBackupHistory = [
 {
 id: 1,
 filename: "easyssh_backup_20240115_143025.tar.gz",
 type: "auto",
 size: "245 MB",
 status: "success",
 duration: "2m 35s",
 createdAt: "2024-01-15 14:30:25",
 includes: ["数据库", "配置文件", "用户数据"],
 },
 {
 id: 2,
 filename: "easyssh_backup_20240115_020015.tar.gz",
 type: "auto",
 size: "238 MB",
 status: "success",
 duration: "2m 28s",
 createdAt: "2024-01-15 02:00:15",
 includes: ["数据库", "配置文件", "用户数据"],
 },
 {
 id: 3,
 filename: "easyssh_backup_20240114_143010.tar.gz",
 type: "manual",
 size: "242 MB",
 status: "success",
 duration: "2m 31s",
 createdAt: "2024-01-14 14:30:10",
 includes: ["数据库", "配置文件", "用户数据", "日志文件"],
 },
 {
 id: 4,
 filename: "easyssh_backup_20240114_020008.tar.gz",
 type: "auto",
 size: "235 MB",
 status: "success",
 duration: "2m 22s",
 createdAt: "2024-01-14 02:00:08",
 includes: ["数据库", "配置文件", "用户数据"],
 },
 {
 id: 5,
 filename: "easyssh_backup_20240113_020005.tar.gz",
 type: "auto",
 size: "233 MB",
 status: "failed",
 duration: "0m 15s",
 createdAt: "2024-01-13 02:00:05",
 includes: ["数据库"],
 },
]

const typeColors = {
 auto: "bg-blue-100 text-blue-800",
 manual: "bg-purple-100 text-purple-800",
}

const statusColors = {
 success: "bg-green-100 text-green-800",
 failed: "bg-red-100 text-red-800",
 running: "bg-yellow-100 text-yellow-800",
}

export default function SettingsBackupPage() {
 const [autoBackupEnabled, setAutoBackupEnabled] = useState(true)
 const [backupSchedule, setBackupSchedule] = useState("daily")
 const [retentionDays, setRetentionDays] = useState("30")
 const [isBackingUp, setIsBackingUp] = useState(false)

 const handleManualBackup = () => {
 setIsBackingUp(true)
 setTimeout(() => setIsBackingUp(false), 3000)
 }

 const handleDownloadBackup = (filename: string) => {
 console.log("下载备份文件:", filename)
 }

 const handleRestoreBackup = (id: number) => {
 console.log("恢复备份:", id)
 }

 const handleExportData = () => {
 console.log("导出数据")
 }

 const handleImportData = () => {
 console.log("导入数据")
 }

 return (
 <>
 <PageHeader title="备份恢复">
 <Button>
 <Save className="mr-2 h-4 w-4" />
 保存设置
 </Button>
 </PageHeader>

 <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
 <div className="grid gap-4 md:grid-cols-4">
 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">备份总数</CardTitle>
 <Database className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{mockBackupHistory.length}</div>
 <p className="text-xs text-muted-foreground">历史备份文件</p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">最新备份</CardTitle>
 <Clock className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-green-600">2小时前</div>
 <p className="text-xs text-muted-foreground">自动备份成功</p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">占用空间</CardTitle>
 <HardDrive className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">1.2 GB</div>
 <p className="text-xs text-muted-foreground">共 {mockBackupHistory.length} 个备份</p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">成功率</CardTitle>
 <CheckCircle className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-green-600">
 {Math.round((mockBackupHistory.filter(b => b.status === "success").length / mockBackupHistory.length) * 100)}%
 </div>
 <p className="text-xs text-muted-foreground">最近30天</p>
 </CardContent>
 </Card>
 </div>

 <Tabs defaultValue="auto" className="w-full">
 <TabsList className="grid w-full grid-cols-3">
 <TabsTrigger value="auto">自动备份</TabsTrigger>
 <TabsTrigger value="manual">手动备份</TabsTrigger>
 <TabsTrigger value="restore">恢复数据</TabsTrigger>
 </TabsList>

 <TabsContent value="auto" className="space-y-4">
 <Card>
 <CardHeader>
 <div className="flex items-center justify-between">
 <div>
 <CardTitle>自动备份配置</CardTitle>
 <CardDescription>配置定时自动备份策略</CardDescription>
 </div>
 <Badge className={autoBackupEnabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
 {autoBackupEnabled ? "已启用" : "未启用"}
 </Badge>
 </div>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="flex items-center justify-between">
 <Label htmlFor="auto-backup">启用自动备份</Label>
 <Switch id="auto-backup" checked={autoBackupEnabled} onCheckedChange={setAutoBackupEnabled} />
 </div>

 {autoBackupEnabled && (
 <>
 <div className="space-y-2">
 <Label>备份频率</Label>
 <Select value={backupSchedule} onValueChange={setBackupSchedule}>
 <SelectTrigger>
 <SelectValue placeholder="选择备份频率" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="hourly">每小时</SelectItem>
 <SelectItem value="daily">每天</SelectItem>
 <SelectItem value="weekly">每周</SelectItem>
 <SelectItem value="monthly">每月</SelectItem>
 </SelectContent>
 </Select>
 <p className="text-sm text-muted-foreground">
 当前设置：每天凌晨 2:00 自动备份
 </p>
 </div>

 <div className="space-y-2">
 <Label htmlFor="retention">保留天数</Label>
 <Input
 id="retention"
 type="number"
 value={retentionDays}
 onChange={(e) => setRetentionDays(e.target.value)}
 className="w-32"
 />
 <p className="text-sm text-muted-foreground">
 超过 {retentionDays} 天的备份文件将自动删除
 </p>
 </div>

 <div className="space-y-2">
 <Label>备份内容</Label>
 <div className="space-y-2">
 <div className="flex items-center gap-2">
 <Switch defaultChecked />
 <Label>数据库</Label>
 </div>
 <div className="flex items-center gap-2">
 <Switch defaultChecked />
 <Label>配置文件</Label>
 </div>
 <div className="flex items-center gap-2">
 <Switch defaultChecked />
 <Label>用户数据</Label>
 </div>
 <div className="flex items-center gap-2">
 <Switch />
 <Label>日志文件</Label>
 </div>
 <div className="flex items-center gap-2">
 <Switch />
 <Label>会话录像</Label>
 </div>
 </div>
 </div>

 <div className="space-y-2">
 <Label>备份存储位置</Label>
 <Input defaultValue="/var/backups/easyssh" />
 <p className="text-sm text-muted-foreground">
 建议使用独立磁盘或网络存储
 </p>
 </div>
 </>
 )}
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>远程备份</CardTitle>
 <CardDescription>将备份文件同步到远程存储</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <div className="font-medium">启用远程备份</div>
 <div className="text-sm text-muted-foreground">自动上传到云存储</div>
 </div>
 <Switch />
 </div>
 <div className="space-y-2">
 <Label>存储类型</Label>
 <Select defaultValue="s3">
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="s3">AWS S3</SelectItem>
 <SelectItem value="oss">阿里云 OSS</SelectItem>
 <SelectItem value="cos">腾讯云 COS</SelectItem>
 <SelectItem value="sftp">SFTP 服务器</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="manual" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>手动备份</CardTitle>
 <CardDescription>立即创建系统备份</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
 <div className="flex items-start gap-3">
 <Database className="h-5 w-5 text-blue-600 mt-0.5" />
 <div className="flex-1">
 <h4 className="font-medium text-blue-900">备份说明</h4>
 <p className="text-sm text-blue-800 mt-1">
 手动备份将创建当前系统的完整快照，包括数据库、配置文件和用户数据。
 备份过程可能需要几分钟时间，期间系统将继续正常运行。
 </p>
 </div>
 </div>
 </div>

 <div className="space-y-2">
 <Label>备份描述（可选）</Label>
 <Input placeholder="例如：升级前备份、重要配置变更前备份等" />
 </div>

 <div className="space-y-2">
 <Label>备份内容</Label>
 <div className="grid grid-cols-2 gap-2">
 <div className="flex items-center gap-2">
 <Switch defaultChecked />
 <Label>数据库</Label>
 </div>
 <div className="flex items-center gap-2">
 <Switch defaultChecked />
 <Label>配置文件</Label>
 </div>
 <div className="flex items-center gap-2">
 <Switch defaultChecked />
 <Label>用户数据</Label>
 </div>
 <div className="flex items-center gap-2">
 <Switch defaultChecked />
 <Label>日志文件</Label>
 </div>
 </div>
 </div>

 <Button
 size="lg"
 onClick={handleManualBackup}
 disabled={isBackingUp}
 className="w-full"
 >
 {isBackingUp ? (
 <>
 <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
 备份中...
 </>
 ) : (
 <>
 <PlayCircle className="mr-2 h-4 w-4" />
 立即备份
 </>
 )}
 </Button>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>数据导出</CardTitle>
 <CardDescription>导出特定数据用于迁移或分析</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid gap-2">
 <Button variant="outline" onClick={handleExportData}>
 <Download className="mr-2 h-4 w-4" />
 导出服务器列表
 </Button>
 <Button variant="outline" onClick={handleExportData}>
 <Download className="mr-2 h-4 w-4" />
 导出用户数据
 </Button>
 <Button variant="outline" onClick={handleExportData}>
 <Download className="mr-2 h-4 w-4" />
 导出操作日志
 </Button>
 <Button variant="outline" onClick={handleExportData}>
 <Download className="mr-2 h-4 w-4" />
 导出审计记录
 </Button>
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="restore" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>备份历史</CardTitle>
 <CardDescription>查看和恢复历史备份</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="rounded-md border">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>备份文件</TableHead>
 <TableHead>类型</TableHead>
 <TableHead>大小</TableHead>
 <TableHead>状态</TableHead>
 <TableHead>耗时</TableHead>
 <TableHead>备份时间</TableHead>
 <TableHead>操作</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {mockBackupHistory.map(backup => (
 <TableRow key={backup.id}>
 <TableCell>
 <div className="flex items-center gap-2">
 <FileArchive className="h-4 w-4 text-muted-foreground" />
 <div>
 <div className="font-mono text-sm">{backup.filename}</div>
 <div className="text-xs text-muted-foreground">
 {backup.includes.join(", ")}
 </div>
 </div>
 </div>
 </TableCell>
 <TableCell>
 <Badge className={typeColors[backup.type as keyof typeof typeColors]}>
 {backup.type === "auto" ? "自动" : "手动"}
 </Badge>
 </TableCell>
 <TableCell className="font-mono text-sm">{backup.size}</TableCell>
 <TableCell>
 <Badge className={statusColors[backup.status as keyof typeof statusColors]}>
 {backup.status === "success" ? "成功" : backup.status === "failed" ? "失败" : "运行中"}
 </Badge>
 </TableCell>
 <TableCell className="font-mono text-sm">{backup.duration}</TableCell>
 <TableCell className="text-sm">{backup.createdAt}</TableCell>
 <TableCell>
 <div className="flex gap-2">
 {backup.status === "success" && (
 <>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleDownloadBackup(backup.filename)}
 >
 <CloudDownload className="h-4 w-4" />
 </Button>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleRestoreBackup(backup.id)}
 >
 <RefreshCw className="h-4 w-4" />
 </Button>
 </>
 )}
 </div>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>数据导入</CardTitle>
 <CardDescription>从备份文件或其他系统导入数据</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
 <div className="flex items-start gap-3">
 <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
 <div>
 <h4 className="font-medium text-yellow-900">警告</h4>
 <p className="text-sm text-yellow-800 mt-1">
 数据导入将覆盖现有数据，建议在导入前先创建当前系统的备份。
 请确保导入的数据文件格式正确且来源可信。
 </p>
 </div>
 </div>
 </div>

 <div className="space-y-2">
 <Label>选择备份文件</Label>
 <div className="flex gap-2">
 <Input type="file" accept=".tar.gz,.zip" />
 <Button onClick={handleImportData}>
 <Upload className="mr-2 h-4 w-4" />
 导入
 </Button>
 </div>
 </div>

 <div className="space-y-2">
 <Label>或从 URL 导入</Label>
 <div className="flex gap-2">
 <Input placeholder="https://example.com/backup.tar.gz" />
 <Button onClick={handleImportData}>
 <Download className="mr-2 h-4 w-4" />
 下载并导入
 </Button>
 </div>
 </div>
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>

 <Card className="border-blue-200 bg-blue-50">
 <CardContent className="pt-6">
 <div className="flex items-start gap-3">
 <FolderArchive className="h-5 w-5 text-blue-600 mt-0.5" />
 <div>
 <h4 className="font-medium text-blue-900">备份最佳实践</h4>
 <ul className="text-sm text-blue-800 mt-1 space-y-1 list-disc list-inside">
 <li>定期测试备份恢复流程，确保备份文件可用</li>
 <li>将备份文件存储在独立的存储设备或远程位置</li>
 <li>在进行重要操作前创建手动备份</li>
 <li>定期清理过期备份，避免占用过多存储空间</li>
 <li>加密备份文件以保护敏感数据</li>
 </ul>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>
 </>
 )
}
