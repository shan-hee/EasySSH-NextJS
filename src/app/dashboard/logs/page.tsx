"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Search,
  Download,
  Clock,
  User,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye
} from "lucide-react"

// 模拟操作日志数据
const mockLogs = [
  {
    id: 1,
    timestamp: "2024-01-15 14:30:25",
    user: "管理员",
    action: "SSH连接",
    target: "Web Server 01 (192.168.1.100)",
    result: "成功",
    risk: "低",
    details: "用户成功建立SSH连接",
    ip: "192.168.1.50",
    sessionId: "session-001"
  },
  {
    id: 2,
    timestamp: "2024-01-15 14:25:18",
    user: "开发者",
    action: "文件删除",
    target: "/var/log/nginx/access.log",
    result: "成功",
    risk: "中",
    details: "删除了Nginx访问日志文件",
    ip: "192.168.1.45",
    sessionId: "session-002"
  },
  {
    id: 3,
    timestamp: "2024-01-15 14:20:42",
    user: "管理员",
    action: "权限修改",
    target: "Database Server (192.168.1.101)",
    result: "成功",
    risk: "高",
    details: "修改了数据库目录权限 chmod 777 /data",
    ip: "192.168.1.50",
    sessionId: "session-003"
  },
  {
    id: 4,
    timestamp: "2024-01-15 14:15:33",
    user: "运维工程师",
    action: "服务重启",
    target: "nginx service",
    result: "失败",
    risk: "中",
    details: "尝试重启nginx服务失败: service not found",
    ip: "192.168.1.55",
    sessionId: "session-004"
  },
  {
    id: 5,
    timestamp: "2024-01-15 14:10:15",
    user: "管理员",
    action: "用户创建",
    target: "系统用户 'deploy'",
    result: "成功",
    risk: "中",
    details: "创建了新的系统用户并授予sudo权限",
    ip: "192.168.1.50",
    sessionId: "session-005"
  },
  {
    id: 6,
    timestamp: "2024-01-15 14:05:08",
    user: "开发者",
    action: "登录失败",
    target: "Dev Server (192.168.1.102)",
    result: "失败",
    risk: "低",
    details: "SSH登录失败: Authentication failed",
    ip: "192.168.1.45",
    sessionId: null
  },
  {
    id: 7,
    timestamp: "2024-01-15 14:00:52",
    user: "管理员",
    action: "配置修改",
    target: "/etc/ssh/sshd_config",
    result: "成功",
    risk: "高",
    details: "修改SSH配置文件，允许root登录",
    ip: "192.168.1.50",
    sessionId: "session-006"
  },
  {
    id: 8,
    timestamp: "2024-01-15 13:55:37",
    user: "运维工程师",
    action: "脚本执行",
    target: "backup_database.sh",
    result: "成功",
    risk: "低",
    details: "执行数据库备份脚本",
    ip: "192.168.1.55",
    sessionId: "session-007"
  }
]

export default function LogsPage() {
  const [logs] = useState(mockLogs)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedUser, setSelectedUser] = useState<string>("all")
  const [selectedResult, setSelectedResult] = useState<string>("all")
  const [selectedRisk, setSelectedRisk] = useState<string>("all")

  // 获取唯一用户列表
  const users = Array.from(new Set(logs.map(log => log.user)))

  // 过滤日志
  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.target.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.details.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesUser = selectedUser === "all" || log.user === selectedUser
    const matchesResult = selectedResult === "all" || log.result === selectedResult
    const matchesRisk = selectedRisk === "all" || log.risk === selectedRisk

    return matchesSearch && matchesUser && matchesResult && matchesRisk
  })

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case "高":
        return <Badge className="bg-red-100 text-red-800">高风险</Badge>
      case "中":
        return <Badge className="bg-yellow-100 text-yellow-800">中风险</Badge>
      case "低":
        return <Badge className="bg-green-100 text-green-800">低风险</Badge>
      default:
        return <Badge variant="secondary">{risk}</Badge>
    }
  }

  const getResultIcon = (result: string) => {
    switch (result) {
      case "成功":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "失败":
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />
    }
  }

  const handleViewDetails = (logId: number) => {
    console.log("查看日志详情:", logId)
    // 这里应该打开详情对话框
  }

  const handleExportLogs = () => {
    console.log("导出日志")
    // 这里应该导出过滤后的日志
  }

  return (
    <>
      <PageHeader
        title="操作日志"
        breadcrumbs={[
          { title: "监控与审计", href: "#" },
          { title: "操作日志" }
        ]}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportLogs}
        >
          <Download className="mr-2 h-4 w-4" />
          导出日志
        </Button>
      </PageHeader>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* 统计卡片 */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">今日操作</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{logs.length}</div>
              <p className="text-xs text-muted-foreground">
                比昨日增加 12%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">成功操作</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {logs.filter(log => log.result === "成功").length}
              </div>
              <p className="text-xs text-muted-foreground">
                成功率 {Math.round(logs.filter(log => log.result === "成功").length / logs.length * 100)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">高风险操作</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {logs.filter(log => log.risk === "高").length}
              </div>
              <p className="text-xs text-muted-foreground">
                需要重点关注
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">活跃用户</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
              <p className="text-xs text-muted-foreground">
                当前在线用户
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
                  placeholder="搜索操作、目标或详情..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="选择用户" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有用户</SelectItem>
                    {users.map(user => (
                      <SelectItem key={user} value={user}>{user}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedResult} onValueChange={setSelectedResult}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="操作结果" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有结果</SelectItem>
                    <SelectItem value="成功">成功</SelectItem>
                    <SelectItem value="失败">失败</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedRisk} onValueChange={setSelectedRisk}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="风险等级" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有风险</SelectItem>
                    <SelectItem value="高">高风险</SelectItem>
                    <SelectItem value="中">中风险</SelectItem>
                    <SelectItem value="低">低风险</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 日志表格 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">操作记录</CardTitle>
            <CardDescription>
              显示 {filteredLogs.length} 条记录，共 {logs.length} 条
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead>操作</TableHead>
                    <TableHead>目标</TableHead>
                    <TableHead>结果</TableHead>
                    <TableHead>风险</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">
                        {log.timestamp}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {log.user}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {log.action}
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={log.target}>
                        {log.target}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getResultIcon(log.result)}
                          {log.result}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getRiskBadge(log.risk)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(log.id)}
                        >
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

