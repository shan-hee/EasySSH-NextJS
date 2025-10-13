"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WebTerminal } from "./web-terminal"
import {
  Terminal,
  X,
  Plus,
  Settings,
  Maximize2,
  Minimize2,
  Copy,
  Paste
} from "lucide-react"

interface TerminalSession {
  id: string
  serverId: number
  serverName: string
  host: string
  username: string
  isConnected: boolean
  lastActivity: string
}

interface TerminalComponentProps {
  sessions: TerminalSession[]
  onNewSession: () => void
  onCloseSession: (sessionId: string) => void
  onSendCommand: (sessionId: string, command: string) => void
}

export function TerminalComponent({
  sessions,
  onNewSession,
  onCloseSession,
  onSendCommand
}: TerminalComponentProps) {
  const [activeSession, setActiveSession] = useState<string>(sessions[0]?.id || "")
  const [isFullscreen, setIsFullscreen] = useState(false)

  const currentSession = sessions.find(s => s.id === activeSession)

  const handleCommand = (sessionId: string, command: string) => {
    onSendCommand(sessionId, command)
  }

  return (
    <Card className={`h-full flex flex-col ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Web终端
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onNewSession}>
              <Plus className="h-4 w-4 mr-1" />
              新建会话
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {sessions.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Terminal className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">暂无活动会话</h3>
              <p className="text-muted-foreground mb-4">创建一个新的终端会话开始使用</p>
              <Button onClick={onNewSession}>
                <Plus className="h-4 w-4 mr-2" />
                新建会话
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* 标签页 */}
            <Tabs value={activeSession} onValueChange={setActiveSession} className="flex-1 flex flex-col">
              <TabsList className="w-full justify-start overflow-x-auto px-4">
                {sessions.map((session) => (
                  <TabsTrigger
                    key={session.id}
                    value={session.id}
                    className="flex items-center gap-2 max-w-48"
                  >
                    <Badge
                      variant={session.isConnected ? "default" : "secondary"}
                      className="w-2 h-2 p-0"
                    />
                    <span className="truncate">{session.serverName}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 ml-1"
                      onClick={(e) => {
                        e.stopPropagation()
                        onCloseSession(session.id)
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </TabsTrigger>
                ))}
              </TabsList>

              {sessions.map((session) => (
                <TabsContent
                  key={session.id}
                  value={session.id}
                  className="flex-1 flex flex-col m-0"
                >
                  {/* 会话信息 */}
                  <div className="px-4 py-2 border-b bg-muted/30 text-sm">
                    <span className="text-muted-foreground">已连接到:</span>{" "}
                    <span className="font-mono">{session.username}@{session.host}</span>
                    <Badge
                      variant={session.isConnected ? "default" : "secondary"}
                      className="ml-2"
                    >
                      {session.isConnected ? "已连接" : "已断开"}
                    </Badge>
                  </div>

                  {/* 终端区域 */}
                  <div className="flex-1 min-h-0">
                    <WebTerminal
                      sessionId={session.id}
                      serverName={session.serverName}
                      host={session.host}
                      username={session.username}
                      isConnected={session.isConnected}
                      onCommand={(command) => handleCommand(session.id, command)}
                    />
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  )
}