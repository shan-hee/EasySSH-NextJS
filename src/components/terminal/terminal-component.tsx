"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { WebTerminal } from "./web-terminal"
import { SessionTabBar } from "@/components/tabs/session-tab-bar"
import { TerminalSession } from "@/components/terminal/types"
import { Plus, Maximize2, Minimize2, Settings } from "lucide-react"

interface TerminalComponentProps {
  sessions: TerminalSession[]
  onNewSession: () => void
  onCloseSession: (sessionId: string) => void
  onSendCommand: (sessionId: string, command: string) => void
  onDuplicateSession: (sessionId: string) => void
  onCloseOthers: (sessionId: string) => void
  onCloseAll: () => void
  onTogglePin: (sessionId: string) => void
  onReorderSessions: (newOrderIds: string[]) => void
  hibernateBackground?: boolean
}

export function TerminalComponent({
  sessions,
  onNewSession,
  onCloseSession,
  onSendCommand,
  onDuplicateSession,
  onCloseOthers,
  onCloseAll,
  onTogglePin,
  onReorderSessions,
  hibernateBackground = true,
}: TerminalComponentProps) {
  const [activeSession, setActiveSession] = useState<string>(sessions[0]?.id || "")
  const [isFullscreen, setIsFullscreen] = useState(false)

  const handleCommand = (sessionId: string, command: string) => {
    onSendCommand(sessionId, command)
  }

  const active = sessions.find(s => s.id === activeSession) || sessions[0]

  return (
    <div className={`h-full flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-background' : ''}`}>
      <div className="flex-1 flex flex-col rounded-xl border overflow-hidden">
        {/* 页签栏（隐藏面包屑，仅保留标签） */}
        <SessionTabBar
          sessions={sessions}
          activeId={activeSession}
          onChangeActive={setActiveSession}
          onNewSession={onNewSession}
          onCloseSession={onCloseSession}
          onDuplicateSession={onDuplicateSession}
          onCloseOthers={onCloseOthers}
          onCloseAll={onCloseAll}
          onTogglePin={onTogglePin}
          onReorder={onReorderSessions}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
          hideBreadcrumb
        />

        <div className="flex-1 flex flex-col overflow-hidden">
        {sessions.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            暂无活动会话，使用右上角 + 新建
          </div>
        ) : (
          <Tabs value={active?.id} className="flex-1 flex flex-col gap-0">
            {/* 工具栏（会话信息条） */}
            {active && (
              <div className="px-4 py-2 bg-black text-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sidebar-foreground">已连接到:</span>
                  <span className="font-mono text-sidebar-foreground">{active.username}@{active.host}{active.port ? `:${active.port}` : ""}</span>
                  <Badge
                    variant={active.isConnected ? "default" : "secondary"}
                    className="ml-2"
                  >
                    {active.isConnected ? "已连接" : "已断开"}
                  </Badge>
                </div>
                {/* 工具按钮 */}
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-sidebar-accent" onClick={onNewSession}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-sidebar-accent" onClick={() => setIsFullscreen(!isFullscreen)}>
                    {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-sidebar-accent">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* 终端区域（可选休眠：仅渲染活动页签） */}
            <div className="flex-1 min-h-0">
              {hibernateBackground ? (
                active && (
                  <TabsContent value={active.id} className="flex-1 flex flex-col m-0 data-[state=inactive]:hidden">
                    <WebTerminal
                      sessionId={active.id}
                      serverName={active.serverName}
                      host={active.host}
                      username={active.username}
                      isConnected={active.isConnected}
                      onCommand={(command) => handleCommand(active.id, command)}
                    />
                  </TabsContent>
                )
              ) : (
                sessions.map((session) => (
                  <TabsContent key={session.id} value={session.id} className="flex-1 flex flex-col m-0">
                    <WebTerminal
                      sessionId={session.id}
                      serverName={session.serverName}
                      host={session.host}
                      username={session.username}
                      isConnected={session.isConnected}
                      onCommand={(command) => handleCommand(session.id, command)}
                    />
                  </TabsContent>
                ))
              )}
            </div>
          </Tabs>
        )}
        </div>
      </div>
    </div>
  )
}
