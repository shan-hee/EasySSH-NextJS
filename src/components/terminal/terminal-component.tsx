"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { WebTerminal } from "./web-terminal"
import { QuickConnect, QuickServer } from "./quick-connect"
import { SessionTabBar } from "@/components/tabs/session-tab-bar"
import { TerminalSession } from "@/components/terminal/types"
import { Maximize2, Minimize2, Settings, FolderOpen, Globe, Activity, Bot } from "lucide-react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import Link from "next/link"

interface TerminalComponentProps {
  sessions: TerminalSession[]
  // 返回新建会话的 id，便于自动激活
  onNewSession: () => string | void
  onCloseSession: (sessionId: string) => void
  onSendCommand: (sessionId: string, command: string) => void
  onDuplicateSession: (sessionId: string) => void
  onCloseOthers: (sessionId: string) => void
  onCloseAll: () => void
  onTogglePin: (sessionId: string) => void
  onReorderSessions: (newOrderIds: string[]) => void
  hibernateBackground?: boolean
  // 快速连接：在当前页签中选择服务器以开始终端
  onStartConnectionFromQuick: (sessionId: string, server: QuickServer) => void
  servers: QuickServer[]
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
  onStartConnectionFromQuick,
  servers,
}: TerminalComponentProps) {
  const [activeSession, setActiveSession] = useState<string>(sessions[0]?.id || "")
  const [isFullscreen, setIsFullscreen] = useState(false)

  const handleCommand = (sessionId: string, command: string) => {
    onSendCommand(sessionId, command)
  }

  const active = sessions.find(s => s.id === activeSession) || sessions[0]

  const handleNewSessionClick = () => {
    const id = onNewSession()
    if (id) setActiveSession(String(id))
  }

  return (
    <div className={`h-full flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-black' : ''}`}>
      {/* 面包屑头部：放在圆角容器之外 */}
      <header className="flex h-16 shrink-0 items-center gap-2 sticky top-0 z-30 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-none group-data-[ready=true]/sidebar-wrapper:transition-[width,height] group-data-[ready=true]/sidebar-wrapper:duration-200 group-data-[ready=true]/sidebar-wrapper:ease-in-out group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink asChild>
                  <Link href="/dashboard">EasySSH 控制台</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/dashboard/terminal">快速连接</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              {/* 根据需求：终端内操作不再把服务器名称或标签加入面包屑，仅保留到“快速连接” */}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex-1 flex flex-col rounded-xl border border-zinc-800/50 overflow-hidden bg-gradient-to-b from-black to-zinc-950 shadow-2xl">
        {/* 页签栏（仅保留标签，不显示面包屑） */}
        <SessionTabBar
          sessions={sessions}
          activeId={activeSession}
          onChangeActive={setActiveSession}
          onNewSession={handleNewSessionClick}
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
          <div className="flex-1 flex items-center justify-center text-zinc-500">
            暂无活动会话，使用右上角 + 新建
          </div>
        ) : (
          <Tabs value={active?.id} className="flex-1 flex flex-col gap-0">
            {/* 工具栏（会话信息条）- 现代化设计 */}
            {active && active.type !== 'quick' && (
              <div className="bg-gradient-to-b from-black/90 to-black border-b border-zinc-800/30 text-sm flex items-center justify-between px-3 py-1.5 backdrop-blur-sm">
                {/* 左侧工具图标组 */}
                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md hover:bg-zinc-800/60 hover:text-white text-zinc-400 transition-all duration-200 hover:scale-105"
                    aria-label="文件管理器"
                    title="文件管理器"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                  </Button>

                  <div className="h-4 w-px bg-zinc-800/50" />

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-md hover:bg-zinc-800/60 transition-all duration-200 flex items-center gap-2 px-2.5"
                    aria-label="网络延迟"
                    title="网络延迟"
                  >
                    <Globe className="h-3.5 w-3.5 text-green-400" />
                    <div className="flex flex-col items-start leading-none text-left">
                      <span className="text-[9px] text-zinc-500 uppercase font-semibold">RTT</span>
                      <span className="text-xs tabular-nums text-green-400 font-medium">2 ms</span>
                    </div>
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md hover:bg-zinc-800/60 hover:text-white text-zinc-400 transition-all duration-200 hover:scale-105"
                    aria-label="监控"
                    title="系统监控"
                  >
                    <Activity className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md hover:bg-purple-500/20 hover:text-purple-400 text-zinc-400 transition-all duration-200 hover:scale-105"
                    aria-label="AI 助手"
                    title="AI 助手"
                  >
                    <Bot className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* 中间：会话信息 */}
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="font-mono">
                    {active.username}@{active.host}
                  </span>
                  <span className="text-zinc-700">|</span>
                  <span className={active.isConnected ? "text-green-400" : "text-red-400"}>
                    {active.isConnected ? "已连接" : "已断开"}
                  </span>
                </div>

                {/* 右侧工具按钮 */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md hover:bg-zinc-800/60 hover:text-white text-zinc-400 transition-all duration-200"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    title={isFullscreen ? "退出全屏" : "全屏"}
                  >
                    {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md hover:bg-zinc-800/60 hover:text-white text-zinc-400 transition-all duration-200"
                    title="设置"
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* 内容区域：快速连接或终端 */}
            <div className="flex-1 min-h-0 relative">
              {active?.type === 'quick' ? (
                <TabsContent value={active.id} className="flex-1 flex flex-col m-0 data-[state=inactive]:hidden absolute inset-0">
                  <QuickConnect
                    servers={servers}
                    onSelectServer={(server) => onStartConnectionFromQuick(active.id, server)}
                  />
                </TabsContent>
              ) : hibernateBackground ? (
                active && (
                  <TabsContent value={active.id} className="flex-1 flex flex-col m-0 data-[state=inactive]:hidden absolute inset-0">
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
                  <TabsContent key={session.id} value={session.id} className="flex-1 flex flex-col m-0 absolute inset-0">
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
