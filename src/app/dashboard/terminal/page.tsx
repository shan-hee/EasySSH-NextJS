"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { TerminalComponent } from "@/components/terminal/terminal-component"
import { Terminal, Plus, Server } from "lucide-react"
import { toast } from "sonner"
import { TerminalSession } from "@/components/terminal/types"

// 模拟服务器数据
const servers = [
  {
    id: 1,
    name: "Web Server 01",
    host: "192.168.1.100",
    port: 22,
    username: "root",
    status: "online" as const,
    group: "生产",
    tags: ["web"],
  },
  {
    id: 2,
    name: "Database Server",
    host: "192.168.1.101",
    port: 22,
    username: "admin",
    status: "online" as const,
    group: "生产",
    tags: ["db"],
  },
  {
    id: 3,
    name: "Dev Server",
    host: "192.168.1.102",
    port: 2222,
    username: "developer",
    status: "offline" as const,
    group: "开发",
    tags: ["dev"],
  },
]

export default function TerminalPage() {
  const [sessions, setSessions] = useState<TerminalSession[]>([])
  const [showServerSelector, setShowServerSelector] = useState(false)
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null)
  const [hibernateBackground, setHibernateBackground] = useState(true)
  const [maxTabs, setMaxTabs] = useState(50)
  const [inactiveMinutes, setInactiveMinutes] = useState(60)
  const inactivityNotifiedRef = useRef<Set<string>>(new Set())

  // 读取通用设置（仅使用本地存储集成）
  useEffect(() => {
    try {
      const mt = Number(localStorage.getItem("tab.maxTabs") || "50")
      if (!isNaN(mt)) setMaxTabs(mt)
      const im = Number(localStorage.getItem("tab.inactiveMinutes") || "60")
      if (!isNaN(im)) setInactiveMinutes(im)
      const hb = localStorage.getItem("tab.hibernate")
      if (hb != null) setHibernateBackground(hb === "true")
    } catch {}
  }, [])

  // 创建新会话
  const handleNewSession = () => {
    setShowServerSelector(true)
  }

  // 连接到服务器
  const handleConnectToServer = () => {
    if (!selectedServerId) return

    const server = servers.find(s => s.id === selectedServerId)
    if (!server) return

    // 最大页签数限制
    if (sessions.length >= maxTabs) {
      toast.error(`已达到最大页签数限制 (${maxTabs})`)
      return
    }

    const now = Date.now()
    const newSession: TerminalSession = {
      id: `session-${now}`,
      serverId: server.id,
      serverName: server.name,
      host: server.host,
      port: server.port,
      username: server.username,
      isConnected: server.status === "online",
      status: server.status === "online" ? "connected" : "disconnected",
      lastActivity: now,
      group: server.group,
      tags: server.tags,
      pinned: false,
    }

    setSessions(prev => [...prev, newSession])
    setShowServerSelector(false)
    setSelectedServerId(null)
  }

  // 关闭会话
  const handleCloseSession = (sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId))
  }

  const handleDuplicateSession = (sessionId: string) => {
    const src = sessions.find(s => s.id === sessionId)
    if (!src) return
    if (sessions.length >= maxTabs) {
      toast.error(`已达到最大页签数限制 (${maxTabs})`)
      return
    }
    const now = Date.now()
    const dup: TerminalSession = { ...src, id: `session-${now}`, lastActivity: now, pinned: false }
    setSessions(prev => [...prev, dup])
  }

  const handleCloseOthers = (sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id === sessionId || s.pinned))
  }

  const handleCloseAll = () => {
    setSessions(prev => prev.filter(s => s.pinned))
  }

  const handleTogglePin = (sessionId: string) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, pinned: !s.pinned } : s))
  }

  const handleReorder = (newOrderIds: string[]) => {
    const map = new Map(sessions.map(s => [s.id, s]))
    const newList = newOrderIds.map(id => map.get(id)!).filter(Boolean)
    if (newList.length === sessions.length) setSessions(newList)
  }

  // 发送命令
  const handleSendCommand = (sessionId: string, command: string) => {
    console.log(`Session ${sessionId}: ${command}`)
    // 这里应该处理实际的命令发送逻辑

    // 更新最后活动时间
    const now = Date.now()
    setSessions(prev => prev.map(session => session.id === sessionId ? { ...session, lastActivity: now } : session))
    // 清除已提醒标记
    inactivityNotifiedRef.current.delete(sessionId)
  }

  // 未活动断开提醒
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now()
      const threshold = inactiveMinutes * 60 * 1000
      sessions.forEach(s => {
        if (!s) return
        if (now - s.lastActivity >= threshold && !inactivityNotifiedRef.current.has(s.id)) {
          inactivityNotifiedRef.current.add(s.id)
          toast(`会话“${s.serverName}”长时间未活动`, {
            description: `已超过 ${inactiveMinutes} 分钟未活动，是否断开？`,
            action: { label: "断开", onClick: () => handleCloseSession(s.id) },
          })
        }
      })
    }, 60 * 1000)
    return () => clearInterval(t)
  }, [sessions, inactiveMinutes])

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {sessions.length === 0 ? (
          // 欢迎页面
          <Card className="h-full flex items-center justify-center">
            <CardContent className="text-center">
              <Terminal className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
              <h1 className="text-2xl font-bold mb-2">EasySSH Web终端</h1>
              <p className="text-muted-foreground mb-6 max-w-md">
                在浏览器中直接连接和管理您的服务器，支持多标签页、命令历史和文件传输
              </p>

              <div className="space-y-4">
                <Button onClick={handleNewSession} size="lg">
                  <Plus className="mr-2 h-5 w-5" />
                  创建新的终端会话
                </Button>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">快速连接</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        选择服务器立即开始连接
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">多标签支持</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        同时管理多个SSH连接
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">安全连接</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        基于WebSocket的安全SSH连接
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* 可用服务器列表 */}
                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-4">可用服务器</h3>
                  <div className="grid gap-2">
                    {servers
                      .filter(server => server.status === "online")
                      .map(server => (
                        <div
                          key={server.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                          onClick={() => {
                            setSelectedServerId(server.id)
                            handleConnectToServer()
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <Server className="h-4 w-4 text-green-500" />
                            <div>
                              <div className="font-medium">{server.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {server.username}@{server.host}:{server.port}
                              </div>
                            </div>
                          </div>
                          <Button variant="outline" size="sm">
                            连接
                          </Button>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          // 终端界面
          <TerminalComponent
            sessions={sessions}
            onNewSession={handleNewSession}
            onCloseSession={handleCloseSession}
            onSendCommand={handleSendCommand}
            onDuplicateSession={handleDuplicateSession}
            onCloseOthers={handleCloseOthers}
            onCloseAll={handleCloseAll}
            onTogglePin={handleTogglePin}
            onReorderSessions={handleReorder}
            hibernateBackground={hibernateBackground}
          />
        )}
      </div>

      {/* 服务器选择对话框 */}
      <Dialog open={showServerSelector} onOpenChange={setShowServerSelector}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>选择服务器</DialogTitle>
            <DialogDescription>
              选择要连接的服务器创建新的终端会话
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Select
              value={selectedServerId?.toString()}
              onValueChange={(value) => setSelectedServerId(Number(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择服务器" />
              </SelectTrigger>
              <SelectContent>
                {servers
                  .filter(server => server.status === "online")
                  .map(server => (
                    <SelectItem key={server.id} value={server.id.toString()}>
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        <span>{server.name}</span>
                        <span className="text-muted-foreground">
                          ({server.username}@{server.host})
                        </span>
                      </div>
                    </SelectItem>
                  ))
                }
              </SelectContent>
            </Select>

            {servers.filter(s => s.status === "offline").length > 0 && (
              <div className="text-sm text-muted-foreground">
                <p className="mb-2">离线服务器:</p>
                {servers
                  .filter(server => server.status === "offline")
                  .map(server => (
                    <div key={server.id} className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-muted"></div>
                      {server.name} ({server.host})
                    </div>
                  ))
                }
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowServerSelector(false)}
              >
                取消
              </Button>
              <Button
                onClick={handleConnectToServer}
                disabled={!selectedServerId}
              >
                连接
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
