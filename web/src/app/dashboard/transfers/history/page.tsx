"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Download, Upload as UploadIcon, Download as DownloadIcon, RefreshCw, CheckCircle, XCircle, Clock, ArrowUpDown } from "lucide-react"

const mockTransfers = [
  {
    id: 1,
    timestamp: "2024-01-15 14:30:25",
    user: "管理员",
    type: "upload",
    fileName: "app_backup.tar.gz",
    fileSize: "850 MB",
    source: "本地",
    destination: "Web Server 01:/var/backups/",
    status: "completed",
    speed: "45 MB/s",
    duration: "19秒",
    progress: 100
  },
  {
    id: 2,
    timestamp: "2024-01-15 14:28:15",
    user: "开发者",
    type: "download",
    fileName: "logs.zip",
    fileSize: "125 MB",
    source: "App Server 01:/var/log/",
    destination: "本地",
    status: "completed",
    speed: "38 MB/s",
    duration: "3秒",
    progress: 100
  },
  {
    id: 3,
    timestamp: "2024-01-15 14:25:42",
    user: "运维工程师",
    type: "upload",
    fileName: "config.tar.gz",
    fileSize: "2.3 GB",
    source: "本地",
    destination: "Database Server:/data/",
    status: "running",
    speed: "52 MB/s",
    duration: "进行中",
    progress: 65
  },
  {
    id: 4,
    timestamp: "2024-01-15 14:22:33",
    user: "开发者",
    type: "download",
    fileName: "database_dump.sql",
    fileSize: "1.5 GB",
    source: "Database Server:/backups/",
    destination: "本地",
    status: "failed",
    speed: "-",
    duration: "超时",
    progress: 45,
    error: "连接超时"
  },
  {
    id: 5,
    timestamp: "2024-01-15 14:20:15",
    user: "管理员",
    type: "upload",
    fileName: "deploy.sh",
    fileSize: "12 KB",
    source: "本地",
    destination: "All Servers:/opt/scripts/",
    status: "completed",
    speed: "1 MB/s",
    duration: "< 1秒",
    progress: 100
  },
]

const typeColors = {
  upload: "bg-blue-100 text-blue-800",
  download: "bg-green-100 text-green-800",
}

const statusColors = {
  completed: "bg-green-100 text-green-800",
  running: "bg-blue-100 text-blue-800",
  failed: "bg-red-100 text-red-800",
  paused: "bg-yellow-100 text-yellow-800",
}

export default function TransfersHistoryPage() {
  const [transfers] = useState(mockTransfers)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")

  const filteredTransfers = transfers.filter(transfer => {
    const matchesSearch = transfer.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transfer.user.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = selectedType === "all" || transfer.type === selectedType
    const matchesStatus = selectedStatus === "all" || transfer.status === selectedStatus
    return matchesSearch && matchesType && matchesStatus
  })

  const totalSize = transfers.reduce((acc, t) => {
    const size = parseFloat(t.fileSize)
    const unit = t.fileSize.includes("GB") ? 1024 : t.fileSize.includes("KB") ? 0.001 : 1
    return acc + (size * unit)
  }, 0)

  return (
    <>
      <PageHeader
        title="传输记录"
        breadcrumbs={[
          { title: "文件传输", href: "#" },
          { title: "传输记录" }
        ]}
      >
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          导出记录
        </Button>
      </PageHeader>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">今日传输</CardTitle>
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{transfers.length}</div>
              <p className="text-xs text-muted-foreground">共 {totalSize.toFixed(1)} GB</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">上传</CardTitle>
              <UploadIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {transfers.filter(t => t.type === "upload").length}
              </div>
              <p className="text-xs text-muted-foreground">成功 {transfers.filter(t => t.type === "upload" && t.status === "completed").length} 次</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">下载</CardTitle>
              <DownloadIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {transfers.filter(t => t.type === "download").length}
              </div>
              <p className="text-xs text-muted-foreground">成功 {transfers.filter(t => t.type === "download" && t.status === "completed").length} 次</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">失败传输</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {transfers.filter(t => t.status === "failed").length}
              </div>
              <p className="text-xs text-muted-foreground">需要重试</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">筛选器</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="搜索文件名或用户..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="传输类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有类型</SelectItem>
                    <SelectItem value="upload">上传</SelectItem>
                    <SelectItem value="download">下载</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有状态</SelectItem>
                    <SelectItem value="completed">已完成</SelectItem>
                    <SelectItem value="running">进行中</SelectItem>
                    <SelectItem value="failed">失败</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">传输记录</CardTitle>
            <CardDescription>显示 {filteredTransfers.length} 条记录，共 {transfers.length} 条</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>文件名</TableHead>
                    <TableHead>大小</TableHead>
                    <TableHead>路径</TableHead>
                    <TableHead>速度</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransfers.map(transfer => (
                    <TableRow key={transfer.id}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <div>
                            <div>{transfer.timestamp.split(' ')[1]}</div>
                            <div className="text-xs text-muted-foreground">{transfer.timestamp.split(' ')[0]}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{transfer.user}</TableCell>
                      <TableCell>
                        <Badge className={typeColors[transfer.type as keyof typeof typeColors]}>
                          {transfer.type === "upload" ? "上传" : "下载"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{transfer.fileName}</TableCell>
                      <TableCell className="font-mono text-sm">{transfer.fileSize}</TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <div className="text-muted-foreground">源: {transfer.source}</div>
                          <div className="text-muted-foreground">目标: {transfer.destination}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{transfer.speed}</TableCell>
                      <TableCell>
                        <div>
                          <Badge className={statusColors[transfer.status as keyof typeof statusColors]}>
                            {transfer.status === "completed" ? "已完成" :
                             transfer.status === "running" ? "进行中" :
                             transfer.status === "failed" ? "失败" : "已暂停"}
                          </Badge>
                          {transfer.status === "running" && (
                            <div className="mt-1">
                              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500" style={{width: `${transfer.progress}%`}} />
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">{transfer.progress}%</div>
                            </div>
                          )}
                          {transfer.error && (
                            <div className="text-xs text-red-600 mt-1">{transfer.error}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {transfer.status === "failed" && (
                          <Button variant="ghost" size="sm">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
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
