"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  History,
  Search,
  Calendar,
  Clock,
  User,
  Server,
  Eye,
  Download
} from "lucide-react"

interface HistorySession {
  id: string
  serverId: number
  serverName: string
  host: string
  port: number
  username: string
  startTime: string
  endTime: string
  duration: string
  commandsCount: number
  dataTransferred: string
  status: "completed" | "disconnected" | "error"
  exitCode?: number
}

interface SessionHistoryProps {
  sessions: HistorySession[]
  onViewDetails: (sessionId: string) => void
  onExportSession: (sessionId: string) => void
}

export function SessionHistory({
  sessions,
  onViewDetails,
  onExportSession
}: SessionHistoryProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dateRange, setDateRange] = useState<string>("7d")
  const [selectedSession, setSelectedSession] = useState<HistorySession | null>(null)

  // 过滤会话
  const filteredSessions = sessions.filter(session => {
    const matchesSearch =
      session.serverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.host.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.username.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || session.status === statusFilter

    // 日期过滤逻辑（简化）
    const now = new Date()
    const sessionDate = new Date(session.startTime)
    let matchesDate = true

    switch (dateRange) {
      case "1d":
        matchesDate = (now.getTime() - sessionDate.getTime()) <= 24 * 60 * 60 * 1000
        break
      case "7d":
        matchesDate = (now.getTime() - sessionDate.getTime()) <= 7 * 24 * 60 * 60 * 1000
        break
      case "30d":
        matchesDate = (now.getTime() - sessionDate.getTime()) <= 30 * 24 * 60 * 60 * 1000
        break
    }

    return matchesSearch && matchesStatus && matchesDate
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-500">正常结束</Badge>
      case "disconnected":
        return <Badge variant="secondary">连接断开</Badge>
      case "error":
        return <Badge variant="destructive">异常结束</Badge>
      default:
        return <Badge variant="secondary">未知</Badge>
    }
  }

  // 统计信息
  const stats = {
    total: sessions.length,
    completed: sessions.filter(s => s.status === "completed").length,
    disconnected: sessions.filter(s => s.status === "disconnected").length,
    error: sessions.filter(s => s.status === "error").length,
    totalCommands: sessions.reduce((sum, s) => sum + s.commandsCount, 0),
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">总会话数</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                <p className="text-sm text-muted-foreground">正常结束</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-2xl font-bold text-orange-600">{stats.disconnected}</p>
                <p className="text-sm text-muted-foreground">连接断开</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-2xl font-bold text-blue-600">{stats.totalCommands}</p>
                <p className="text-sm text-muted-foreground">总命令数</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              会话历史
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="搜索历史会话..."
                  className="pl-10 w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="completed">正常结束</SelectItem>
                  <SelectItem value="disconnected">连接断开</SelectItem>
                  <SelectItem value="error">异常结束</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="时间范围" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1d">最近1天</SelectItem>
                  <SelectItem value="7d">最近7天</SelectItem>
                  <SelectItem value="30d">最近30天</SelectItem>
                  <SelectItem value="all">全部时间</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm">
                导出数据
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filteredSessions.length === 0 ? (
            <div className="text-center py-8">
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">暂无历史会话</h3>
              <p className="text-muted-foreground">
                请尝试调整筛选条件或等待新的会话记录
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>服务器</TableHead>
                  <TableHead>连接信息</TableHead>
                  <TableHead>时间信息</TableHead>
                  <TableHead>持续时间</TableHead>
                  <TableHead>活动统计</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{session.serverName}</div>
                        <div className="text-sm text-muted-foreground">
                          ID: {session.serverId}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="font-mono text-sm">
                        <div>{session.username}@{session.host}:{session.port}</div>
                        <div className="text-muted-foreground">
                          会话: {session.id}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {session.startTime.split(' ')[0]}
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {session.startTime.split(' ')[1]} - {session.endTime.split(' ')[1]}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-sm font-mono">
                        {session.duration}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-sm">
                        <div>命令: {session.commandsCount}</div>
                        <div className="text-muted-foreground">
                          流量: {session.dataTransferred}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {getStatusBadge(session.status)}
                        {session.status === "error" && session.exitCode && (
                          <Badge variant="outline" className="text-xs">
                            退出码: {session.exitCode}
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedSession(session)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onExportSession(session.id)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 会话详情对话框 */}
      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>会话详情</DialogTitle>
            <DialogDescription>
              会话 {selectedSession?.id} 的详细信息
            </DialogDescription>
          </DialogHeader>

          {selectedSession && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">连接信息</h4>
                  <div className="space-y-1 text-sm">
                    <div>服务器: {selectedSession.serverName}</div>
                    <div>地址: {selectedSession.host}:{selectedSession.port}</div>
                    <div>用户: {selectedSession.username}</div>
                    <div>会话ID: {selectedSession.id}</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">会话统计</h4>
                  <div className="space-y-1 text-sm">
                    <div>开始时间: {selectedSession.startTime}</div>
                    <div>结束时间: {selectedSession.endTime}</div>
                    <div>持续时间: {selectedSession.duration}</div>
                    <div>状态: {getStatusBadge(selectedSession.status)}</div>
                    <div>命令数量: {selectedSession.commandsCount}</div>
                    <div>数据传输: {selectedSession.dataTransferred}</div>
                    {selectedSession.exitCode && (
                      <div>退出码: {selectedSession.exitCode}</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <h4 className="font-medium mb-2">操作</h4>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => onViewDetails(selectedSession.id)}>
                    查看命令历史
                  </Button>
                  <Button variant="outline" onClick={() => onExportSession(selectedSession.id)}>
                    导出会话数据
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}