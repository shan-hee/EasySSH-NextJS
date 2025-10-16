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
  Search,
  Download,
  Terminal,
  AlertTriangle,
  Shield,
  Eye,
  Clock,
  User,
  Server
} from "lucide-react"

// 模拟命令审计数据
const mockCommands = [
  {
    id: 1,
    timestamp: "2024-01-15 14:30:25",
    user: "管理员",
    server: "Web Server 01",
    serverIp: "192.168.1.100",
    command: "rm -rf /tmp/cache/*",
    category: "file",
    riskLevel: "medium",
    status: "success",
    duration: "0.5s",
    sessionId: "session-001",
    clientIp: "192.168.1.50"
  },
  {
    id: 2,
    timestamp: "2024-01-15 14:28:15",
    user: "运维工程师",
    server: "Database Server",
    serverIp: "192.168.1.101",
    command: "chmod 777 /data/mysql",
    category: "permission",
    riskLevel: "high",
    status: "success",
    duration: "0.2s",
    sessionId: "session-002",
    clientIp: "192.168.1.55"
  },
  {
    id: 3,
    timestamp: "2024-01-15 14:25:42",
    user: "开发者",
    server: "App Server 01",
    serverIp: "192.168.1.102",
    command: "systemctl restart nginx",
    category: "service",
    riskLevel: "medium",
    status: "success",
    duration: "1.2s",
    sessionId: "session-003",
    clientIp: "192.168.1.45"
  },
  {
    id: 4,
    timestamp: "2024-01-15 14:22:33",
    user: "管理员",
    server: "Web Server 02",
    serverIp: "192.168.1.103",
    command: "sudo su - root",
    category: "privilege",
    riskLevel: "high",
    status: "success",
    duration: "0.1s",
    sessionId: "session-004",
    clientIp: "192.168.1.50"
  },
  {
    id: 5,
    timestamp: "2024-01-15 14:20:15",
    user: "开发者",
    server: "App Server 02",
    serverIp: "192.168.1.104",
    command: "cat /etc/passwd",
    category: "system",
    riskLevel: "low",
    status: "success",
    duration: "0.1s",
    sessionId: "session-005",
    clientIp: "192.168.1.45"
  },
  {
    id: 6,
    timestamp: "2024-01-15 14:18:08",
    user: "运维工程师",
    server: "Database Server",
    serverIp: "192.168.1.101",
    command: "DROP DATABASE test_db;",
    category: "database",
    riskLevel: "critical",
    status: "blocked",
    duration: "0.0s",
    sessionId: "session-006",
    clientIp: "192.168.1.55"
  },
  {
    id: 7,
    timestamp: "2024-01-15 14:15:52",
    user: "管理员",
    server: "Web Server 01",
    serverIp: "192.168.1.100",
    command: "apt update && apt upgrade -y",
    category: "system",
    riskLevel: "medium",
    status: "success",
    duration: "45.3s",
    sessionId: "session-001",
    clientIp: "192.168.1.50"
  },
  {
    id: 8,
    timestamp: "2024-01-15 14:12:37",
    user: "开发者",
    server: "App Server 01",
    serverIp: "192.168.1.102",
    command: "git pull origin main",
    category: "application",
    riskLevel: "low",
    status: "success",
    duration: "2.1s",
    sessionId: "session-003",
    clientIp: "192.168.1.45"
  },
  {
    id: 9,
    timestamp: "2024-01-15 14:10:25",
    user: "管理员",
    server: "All Servers",
    serverIp: "Multiple",
    command: "ps aux | grep nginx",
    category: "monitoring",
    riskLevel: "low",
    status: "success",
    duration: "0.3s",
    sessionId: "session-007",
    clientIp: "192.168.1.50"
  },
  {
    id: 10,
    timestamp: "2024-01-15 14:08:15",
    user: "运维工程师",
    server: "Cache Server",
    serverIp: "192.168.1.105",
    command: "redis-cli FLUSHALL",
    category: "database",
    riskLevel: "high",
    status: "success",
    duration: "0.5s",
    sessionId: "session-008",
    clientIp: "192.168.1.55"
  },
]

const categoryLabels = {
  file: "文件操作",
  permission: "权限管理",
  service: "服务管理",
  privilege: "权限提升",
  system: "系统操作",
  database: "数据库",
  application: "应用操作",
  monitoring: "监控查看",
}

const riskLevelColors = {
  critical: "bg-red-100 text-red-800 border-red-300",
  high: "bg-orange-100 text-orange-800 border-orange-300",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
  low: "bg-green-100 text-green-800 border-green-300",
}

const riskLevelLabels = {
  critical: "极高风险",
  high: "高风险",
  medium: "中风险",
  low: "低风险",
}

const statusColors = {
  success: "bg-green-100 text-green-800",
  blocked: "bg-red-100 text-red-800",
  failed: "bg-gray-100 text-gray-800",
}

export default function LogsCommandsPage() {
  const [commands] = useState(mockCommands)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRisk, setSelectedRisk] = useState<string>("all")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedUser, setSelectedUser] = useState<string>("all")

  // 获取唯一用户列表
  const users = Array.from(new Set(commands.map(cmd => cmd.user)))

  // 过滤命令
  const filteredCommands = commands.filter(cmd => {
    const matchesSearch = cmd.command.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cmd.server.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cmd.user.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRisk = selectedRisk === "all" || cmd.riskLevel === selectedRisk
    const matchesCategory = selectedCategory === "all" || cmd.category === selectedCategory
    const matchesUser = selectedUser === "all" || cmd.user === selectedUser

    return matchesSearch && matchesRisk && matchesCategory && matchesUser
  })

  const getRiskBadge = (risk: string) => {
    return (
      <Badge className={riskLevelColors[risk as keyof typeof riskLevelColors]}>
        {riskLevelLabels[risk as keyof typeof riskLevelLabels]}
      </Badge>
    )
  }

  const getStatusBadge = (status: string) => {
    const labels = {
      success: "成功",
      blocked: "已阻止",
      failed: "失败",
    }
    return (
      <Badge className={statusColors[status as keyof typeof statusColors]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    )
  }

  const handleViewDetails = (commandId: number) => {
    console.log("查看命令详情:", commandId)
  }

  const handleExportCommands = () => {
    console.log("导出命令记录")
  }

  return (
    <>
      <PageHeader
        title="命令审计"
        breadcrumbs={[
          { title: "监控与审计", href: "#" },
          { title: "操作日志", href: "/dashboard/logs" },
          { title: "命令审计" }
        ]}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCommands}
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
              <CardTitle className="text-sm font-medium">今日命令</CardTitle>
              <Terminal className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{commands.length}</div>
              <p className="text-xs text-muted-foreground">
                比昨日减少 5%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">高风险命令</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {commands.filter(cmd => cmd.riskLevel === "high" || cmd.riskLevel === "critical").length}
              </div>
              <p className="text-xs text-muted-foreground">
                需要重点关注
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">阻止命令</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {commands.filter(cmd => cmd.status === "blocked").length}
              </div>
              <p className="text-xs text-muted-foreground">
                安全策略生效
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
                执行命令的用户
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
                  placeholder="搜索命令、服务器或用户..."
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

                <Select value={selectedRisk} onValueChange={setSelectedRisk}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="风险等级" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有风险</SelectItem>
                    <SelectItem value="critical">极高风险</SelectItem>
                    <SelectItem value="high">高风险</SelectItem>
                    <SelectItem value="medium">中风险</SelectItem>
                    <SelectItem value="low">低风险</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="命令类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有类型</SelectItem>
                    <SelectItem value="file">文件操作</SelectItem>
                    <SelectItem value="permission">权限管理</SelectItem>
                    <SelectItem value="service">服务管理</SelectItem>
                    <SelectItem value="database">数据库</SelectItem>
                    <SelectItem value="system">系统操作</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 命令记录表格 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">命令记录</CardTitle>
            <CardDescription>
              显示 {filteredCommands.length} 条记录，共 {commands.length} 条
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead>服务器</TableHead>
                    <TableHead>命令</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>风险等级</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>耗时</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCommands.map(cmd => (
                    <TableRow key={cmd.id}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <div>
                            <div>{cmd.timestamp.split(' ')[1]}</div>
                            <div className="text-xs text-muted-foreground">
                              {cmd.timestamp.split(' ')[0]}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{cmd.user}</div>
                            <div className="text-xs text-muted-foreground">
                              {cmd.clientIp}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium text-sm">{cmd.server}</div>
                            <div className="text-xs text-muted-foreground">
                              {cmd.serverIp}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-sm max-w-md truncate" title={cmd.command}>
                          {cmd.command}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {categoryLabels[cmd.category as keyof typeof categoryLabels]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getRiskBadge(cmd.riskLevel)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(cmd.status)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {cmd.duration}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(cmd.id)}
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
