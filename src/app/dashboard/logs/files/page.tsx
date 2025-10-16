"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Download, FileText, Upload, Trash2, Edit, Shield, Eye, Clock, User, Server } from "lucide-react"

const mockFileOperations = [
  {
    id: 1,
    timestamp: "2024-01-15 14:30:25",
    user: "管理员",
    server: "Web Server 01",
    operation: "delete",
    filePath: "/var/log/nginx/access.log",
    fileSize: "2.3 GB",
    riskLevel: "high",
    status: "success",
    clientIp: "192.168.1.50"
  },
  {
    id: 2,
    timestamp: "2024-01-15 14:28:15",
    user: "开发者",
    server: "App Server 01",
    operation: "upload",
    filePath: "/var/www/html/config.php",
    fileSize: "5.2 KB",
    riskLevel: "medium",
    status: "success",
    clientIp: "192.168.1.45"
  },
  {
    id: 3,
    timestamp: "2024-01-15 14:25:42",
    user: "运维工程师",
    server: "Database Server",
    operation: "chmod",
    filePath: "/data/mysql/ibdata1",
    fileSize: "15.6 GB",
    riskLevel: "critical",
    status: "blocked",
    clientIp: "192.168.1.55"
  },
  {
    id: 4,
    timestamp: "2024-01-15 14:22:33",
    user: "开发者",
    server: "App Server 02",
    operation: "download",
    filePath: "/var/backups/app_backup.tar.gz",
    fileSize: "850 MB",
    riskLevel: "low",
    status: "success",
    clientIp: "192.168.1.45"
  },
  {
    id: 5,
    timestamp: "2024-01-15 14:20:15",
    user: "管理员",
    server: "Web Server 01",
    operation: "rename",
    filePath: "/etc/nginx/nginx.conf → nginx.conf.bak",
    fileSize: "12 KB",
    riskLevel: "medium",
    status: "success",
    clientIp: "192.168.1.50"
  },
]

const operationColors = {
  upload: "bg-blue-100 text-blue-800",
  download: "bg-green-100 text-green-800",
  delete: "bg-red-100 text-red-800",
  rename: "bg-yellow-100 text-yellow-800",
  chmod: "bg-purple-100 text-purple-800",
}

const riskLevelColors = {
  critical: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-green-100 text-green-800",
}

export default function LogsFilesPage() {
  const [operations] = useState(mockFileOperations)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedOperation, setSelectedOperation] = useState<string>("all")
  const [selectedRisk, setSelectedRisk] = useState<string>("all")

  const filteredOps = operations.filter(op => {
    const matchesSearch = op.filePath.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         op.user.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesOperation = selectedOperation === "all" || op.operation === selectedOperation
    const matchesRisk = selectedRisk === "all" || op.riskLevel === selectedRisk
    return matchesSearch && matchesOperation && matchesRisk
  })

  return (
    <>
      <PageHeader
        title="文件审计"
        breadcrumbs={[
          { title: "监控与审计", href: "#" },
          { title: "操作日志", href: "/dashboard/logs" },
          { title: "文件审计" }
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
              <CardTitle className="text-sm font-medium">今日操作</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{operations.length}</div>
              <p className="text-xs text-muted-foreground">文件操作次数</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">上传文件</CardTitle>
              <Upload className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {operations.filter(op => op.operation === "upload").length}
              </div>
              <p className="text-xs text-muted-foreground">总计 150 MB</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">删除文件</CardTitle>
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {operations.filter(op => op.operation === "delete").length}
              </div>
              <p className="text-xs text-muted-foreground">释放 2.5 GB</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">高风险操作</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {operations.filter(op => op.riskLevel === "high" || op.riskLevel === "critical").length}
              </div>
              <p className="text-xs text-muted-foreground">需要关注</p>
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
                  placeholder="搜索文件路径或用户..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Select value={selectedOperation} onValueChange={setSelectedOperation}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="操作类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有操作</SelectItem>
                    <SelectItem value="upload">上传</SelectItem>
                    <SelectItem value="download">下载</SelectItem>
                    <SelectItem value="delete">删除</SelectItem>
                    <SelectItem value="rename">重命名</SelectItem>
                    <SelectItem value="chmod">权限变更</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedRisk} onValueChange={setSelectedRisk}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="风险等级" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有风险</SelectItem>
                    <SelectItem value="critical">极高</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                    <SelectItem value="medium">中</SelectItem>
                    <SelectItem value="low">低</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">文件操作记录</CardTitle>
            <CardDescription>显示 {filteredOps.length} 条记录，共 {operations.length} 条</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead>服务器</TableHead>
                    <TableHead>操作</TableHead>
                    <TableHead>文件路径</TableHead>
                    <TableHead>大小</TableHead>
                    <TableHead>风险</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOps.map(op => (
                    <TableRow key={op.id}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <div>
                            <div>{op.timestamp.split(' ')[1]}</div>
                            <div className="text-xs text-muted-foreground">{op.timestamp.split(' ')[0]}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{op.user}</div>
                            <div className="text-xs text-muted-foreground">{op.clientIp}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-muted-foreground" />
                          <div className="text-sm">{op.server}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={operationColors[op.operation as keyof typeof operationColors]}>
                          {op.operation === "upload" ? "上传" :
                           op.operation === "download" ? "下载" :
                           op.operation === "delete" ? "删除" :
                           op.operation === "rename" ? "重命名" : "权限变更"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm max-w-xs truncate" title={op.filePath}>
                        {op.filePath}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{op.fileSize}</TableCell>
                      <TableCell>
                        <Badge className={riskLevelColors[op.riskLevel as keyof typeof riskLevelColors]}>
                          {op.riskLevel === "critical" ? "极高" :
                           op.riskLevel === "high" ? "高" :
                           op.riskLevel === "medium" ? "中" : "低"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={op.status === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                          {op.status === "success" ? "成功" : "已阻止"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
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
