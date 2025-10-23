"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Activity,
  MoreHorizontal,
  Terminal,
  Unplug,
  RefreshCw,
  Search,
  X
} from "lucide-react"

interface Session {
  id: string
  serverId: number
  serverName: string
  host: string
  port: number
  username: string
  status: "connected" | "disconnected" | "connecting" | "error"
  startTime: string
  lastActivity: string
  duration: string
  commandsCount: number
  dataTransferred: string
}

interface SessionListProps {
  sessions: Session[]
  onDisconnect: (sessionId: string) => void
  onReconnect: (sessionId: string) => void
  onViewDetails: (sessionId: string) => void
  onForceDisconnect: (sessionId: string) => void
}

export function SessionList({
  sessions,
  onDisconnect,
  onReconnect,
  onViewDetails,
  onForceDisconnect
}: SessionListProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)

  const filteredSessions = sessions.filter(session =>
    session.serverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    session.host.toLowerCase().includes(searchTerm.toLowerCase()) ||
    session.username.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return <Badge variant="default" className="bg-green-500">已连接</Badge>
      case "disconnected":
        return <Badge variant="secondary">已断开</Badge>
      case "connecting":
        return <Badge variant="outline" className="animate-pulse">连接中</Badge>
      case "error":
        return <Badge variant="destructive">错误</Badge>
      default:
        return <Badge variant="secondary">未知</Badge>
    }
  }

  const getActivityIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <Activity className="h-4 w-4 text-green-500 animate-pulse" />
      case "connecting":
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
      default:
        return <X className="h-4 w-4 text-muted-foreground" />
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            活动会话 ({sessions.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="搜索会话..."
                className="pl-10 w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm">
              刷新
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {filteredSessions.length === 0 ? (
          <div className="text-center py-8">
            <Terminal className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {sessions.length === 0 ? "暂无活动会话" : "未找到匹配的会话"}
            </h3>
            <p className="text-muted-foreground">
              {sessions.length === 0
                ? "当前没有活跃的SSH连接"
                : "请尝试调整搜索条件"
              }
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>状态</TableHead>
                <TableHead>服务器</TableHead>
                <TableHead>连接信息</TableHead>
                <TableHead>开始时间</TableHead>
                <TableHead>持续时间</TableHead>
                <TableHead>活动信息</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getActivityIcon(session.status)}
                      {getStatusBadge(session.status)}
                    </div>
                  </TableCell>

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
                      {session.startTime}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="text-sm">
                      {session.duration}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="text-sm">
                      <div>命令: {session.commandsCount}</div>
                      <div className="text-muted-foreground">
                        流量: {session.dataTransferred}
                      </div>
                      <div className="text-muted-foreground">
                        最后活动: {session.lastActivity}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onViewDetails(session.id)}>
                          查看详情
                        </DropdownMenuItem>

                        {session.status === "connected" && (
                          <>
                            <DropdownMenuItem onClick={() => onDisconnect(session.id)}>
                              <Unplug className="h-4 w-4 mr-2" />
                              断开连接
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => onForceDisconnect(session.id)}
                              className="text-destructive"
                            >
                              强制断开
                            </DropdownMenuItem>
                          </>
                        )}

                        {session.status === "disconnected" && (
                          <DropdownMenuItem onClick={() => onReconnect(session.id)}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            重新连接
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* 会话详情对话框 */}
      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="max-w-2xl">
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
                    <div>状态: {getStatusBadge(selectedSession.status)}</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">会话统计</h4>
                  <div className="space-y-1 text-sm">
                    <div>开始时间: {selectedSession.startTime}</div>
                    <div>持续时间: {selectedSession.duration}</div>
                    <div>命令数量: {selectedSession.commandsCount}</div>
                    <div>数据传输: {selectedSession.dataTransferred}</div>
                    <div>最后活动: {selectedSession.lastActivity}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}