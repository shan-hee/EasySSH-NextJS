"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Download, LogIn, AlertTriangle, CheckCircle, XCircle, Clock, User, MapPin, Shield } from "lucide-react"

const mockLoginLogs = [
  {
    id: 1,
    timestamp: "2024-01-15 14:30:25",
    user: "管理员",
    server: "Web Server 01",
    serverIp: "192.168.1.100",
    clientIp: "192.168.1.50",
    location: "北京市",
    method: "SSH密钥",
    status: "success",
    riskLevel: "low",
    sessionDuration: "2小时15分"
  },
  {
    id: 2,
    timestamp: "2024-01-15 14:28:15",
    user: "开发者",
    server: "App Server 01",
    serverIp: "192.168.1.102",
    clientIp: "203.0.113.45",
    location: "上海市",
    method: "密码",
    status: "success",
    riskLevel: "low",
    sessionDuration: "45分钟"
  },
  {
    id: 3,
    timestamp: "2024-01-15 14:25:42",
    user: "unknown",
    server: "Database Server",
    serverIp: "192.168.1.101",
    clientIp: "45.33.22.11",
    location: "美国",
    method: "密码",
    status: "failed",
    riskLevel: "critical",
    sessionDuration: "-",
    failReason: "密码错误(第3次)"
  },
  {
    id: 4,
    timestamp: "2024-01-15 14:22:33",
    user: "运维工程师",
    server: "Web Server 02",
    serverIp: "192.168.1.103",
    clientIp: "192.168.1.55",
    location: "北京市",
    method: "SSH密钥",
    status: "success",
    riskLevel: "low",
    sessionDuration: "1小时30分"
  },
  {
    id: 5,
    timestamp: "2024-01-15 14:20:15",
    user: "管理员",
    server: "All Servers",
    serverIp: "Multiple",
    clientIp: "192.168.1.50",
    location: "北京市",
    method: "Web控制台",
    status: "success",
    riskLevel: "low",
    sessionDuration: "活跃中"
  },
  {
    id: 6,
    timestamp: "2024-01-15 14:18:08",
    user: "admin",
    server: "Database Server",
    serverIp: "192.168.1.101",
    clientIp: "198.51.100.22",
    location: "俄罗斯",
    method: "密码",
    status: "blocked",
    riskLevel: "critical",
    sessionDuration: "-",
    failReason: "异常IP地址"
  },
]

const statusColors = {
  success: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  blocked: "bg-orange-100 text-orange-800",
}

const riskLevelColors = {
  critical: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-green-100 text-green-800",
}

export default function LogsLoginPage() {
  const [logs] = useState(mockLoginLogs)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [selectedRisk, setSelectedRisk] = useState<string>("all")

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.clientIp.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.location.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = selectedStatus === "all" || log.status === selectedStatus
    const matchesRisk = selectedRisk === "all" || log.riskLevel === selectedRisk
    return matchesSearch && matchesStatus && matchesRisk
  })

  return (
    <>
      <PageHeader
        title="登录日志"
        breadcrumbs={[
          { title: "监控与审计", href: "#" },
          { title: "操作日志", href: "/dashboard/logs" },
          { title: "登录日志" }
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
              <CardTitle className="text-sm font-medium">今日登录</CardTitle>
              <LogIn className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{logs.length}</div>
              <p className="text-xs text-muted-foreground">比昨日增加 8%</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">成功登录</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {logs.filter(log => log.status === "success").length}
              </div>
              <p className="text-xs text-muted-foreground">成功率 {Math.round(logs.filter(log => log.status === "success").length / logs.length * 100)}%</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">失败登录</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {logs.filter(log => log.status === "failed").length}
              </div>
              <p className="text-xs text-muted-foreground">需要检查</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">异常登录</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {logs.filter(log => log.riskLevel === "critical" || log.riskLevel === "high").length}
              </div>
              <p className="text-xs text-muted-foreground">高风险尝试</p>
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
                  placeholder="搜索用户、IP或位置..."
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
                    <SelectItem value="blocked">已阻止</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedRisk} onValueChange={setSelectedRisk}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="风险" />
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
            <CardTitle className="text-lg">登录记录</CardTitle>
            <CardDescription>显示 {filteredLogs.length} 条记录，共 {logs.length} 条</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead>服务器</TableHead>
                    <TableHead>来源IP</TableHead>
                    <TableHead>位置</TableHead>
                    <TableHead>方式</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>风险</TableHead>
                    <TableHead>会话时长</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <div>
                            <div>{log.timestamp.split(' ')[1]}</div>
                            <div className="text-xs text-muted-foreground">{log.timestamp.split(' ')[0]}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{log.user}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm">{log.server}</div>
                          <div className="text-xs text-muted-foreground">{log.serverIp}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{log.clientIp}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{log.location}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.method}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[log.status as keyof typeof statusColors]}>
                          {log.status === "success" ? "成功" : log.status === "failed" ? "失败" : "已阻止"}
                        </Badge>
                        {log.failReason && (
                          <div className="text-xs text-red-600 mt-1">{log.failReason}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={riskLevelColors[log.riskLevel as keyof typeof riskLevelColors]}>
                          {log.riskLevel === "critical" ? "极高" :
                           log.riskLevel === "high" ? "高" :
                           log.riskLevel === "medium" ? "中" : "低"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{log.sessionDuration}</TableCell>
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
