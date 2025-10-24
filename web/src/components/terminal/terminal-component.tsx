"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { WebTerminal } from "./web-terminal"
import { ConnectionLoader } from "./connection-loader"
import { QuickConnect, QuickServer } from "./quick-connect"
import { SessionTabBar } from "@/components/tabs/session-tab-bar"
import { TerminalSession } from "@/components/terminal/types"
import { Maximize2, Minimize2, Settings, FolderOpen, Globe, Activity, Bot } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import Link from "next/link"
import {
  TerminalSettingsDialog,
  type TerminalSettings,
} from "./terminal-settings-dialog"
import { FileManagerPanel } from "./file-manager-panel"
import { NetworkLatencyPopover } from "./network-latency-popover"
import { MonitorPanel } from "./monitor/MonitorPanel"
import { AiAssistantPanel } from "./ai-assistant-panel"

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
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null)
  const [loaderState, setLoaderState] = useState<"entering" | "loading" | "exiting">("entering")
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isFileManagerOpen, setIsFileManagerOpen] = useState(false)
  const [isMonitorOpen, setIsMonitorOpen] = useState(true) // 默认显示监控面板
  const [isAiInputOpen, setIsAiInputOpen] = useState(false) // AI 助手输入框状态

  // 主题样式全部改为静态类 + dark: 前缀，避免 SSR/CSR 水合不一致

  const [settings, setSettings] = useState<TerminalSettings>(() => {
    // 从 localStorage 加载设置
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('terminal-settings')
        if (saved) {
          return JSON.parse(saved)
        }
      } catch (error) {
        console.error('Failed to load terminal settings:', error)
      }
    }
    // 默认设置
    return {
      fontSize: 14,
      fontFamily: 'JetBrains Mono',
      cursorStyle: 'block',
      cursorBlink: true,
      scrollback: 1000,
      rightClickPaste: true,
      copyOnSelect: true,
      theme: 'default',
      opacity: 95,
      backgroundImage: '',
      backgroundImageOpacity: 20,
      maxTabs: 50,
      inactiveMinutes: 60,
      hibernateBackground: true,
      autoReconnect: true,
      confirmBeforeClose: true,
      copyShortcut: 'Ctrl+Shift+C',
      pasteShortcut: 'Ctrl+Shift+V',
      clearShortcut: 'Ctrl+L',
    }
  })
  // 记录已经完成一次初始化（展示过加载遮罩并完成退出动画）的会话，避免重复触发
  const initializedSessionsRef = useRef<Set<string>>(new Set())

  // 保存设置到 localStorage
  const handleSettingsChange = (newSettings: TerminalSettings) => {
    setSettings(newSettings)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('terminal-settings', JSON.stringify(newSettings))
      } catch (error) {
        console.error('Failed to save terminal settings:', error)
      }
    }
  }

  const handleCommand = (sessionId: string, command: string) => {
    onSendCommand(sessionId, command)
  }

  const active = sessions.find(s => s.id === activeSession) || sessions[0]

  const handleNewSessionClick = () => {
    const id = onNewSession()
    if (id) setActiveSession(String(id))
  }

  const handleLoadingChange = (sessionId: string, isLoading: boolean) => {
    if (isLoading) {
      setLoadingSessionId(sessionId)
      setLoaderState("entering")
    } else {
      // 连接成功，触发退出动画
      setLoaderState("exiting")
    }
  }

  const handleAnimationComplete = () => {
    // 退出动画完成后，标记该会话已初始化并清除加载状态
    if (loadingSessionId) {
      initializedSessionsRef.current.add(loadingSessionId)
    }
    setLoadingSessionId(null)
    setLoaderState("entering")
  }

  const isActiveSessionLoading = loadingSessionId === activeSession
  const shouldForceLoading = !!(active && active.type !== 'quick' && !initializedSessionsRef.current.has(active.id))
  const effectiveIsLoading = !!(active && active.type !== 'quick' && (isActiveSessionLoading || shouldForceLoading))

  // 当从"快速连接"升级为"终端"时，立刻设置为加载中，避免工具栏闪烁
  useEffect(() => {
    if (shouldForceLoading && active) {
      // 若还未设置当前加载会话，则设置并进入动画
      if (loadingSessionId !== active.id) {
        setLoadingSessionId(active.id)
        setLoaderState("entering")
      }
    }
  }, [shouldForceLoading, active?.id])

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K 或 Cmd+K 切换 AI 输入框
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setIsAiInputOpen(prev => !prev)
      }
      // ESC 关闭 AI 输入框
      if (e.key === 'Escape' && isAiInputOpen) {
        e.preventDefault()
        setIsAiInputOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isAiInputOpen])

  return (
    <div className={`h-full flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-black' : ''}`}>
      {/* 全屏时隐藏面包屑头部 */}
      {!isFullscreen && (
        <header className="flex h-16 shrink-0 items-center gap-2 sticky top-0 z-10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-none group-data-[ready=true]/sidebar-wrapper:transition-[width,height] group-data-[ready=true]/sidebar-wrapper:duration-200 group-data-[ready=true]/sidebar-wrapper:ease-in-out group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
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
                  <BreadcrumbPage>快速连接</BreadcrumbPage>
                </BreadcrumbItem>
                {/* 根据需求：终端内操作不再把服务器名称或标签加入面包屑，仅保留到“快速连接” */}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
      )}

      <div className={cn(
        "flex-1 flex flex-col rounded-xl border overflow-hidden shadow-2xl transition-colors",
        "border-zinc-200 bg-gradient-to-b from-white to-zinc-50 dark:border-zinc-800/50 dark:from-black dark:to-zinc-950"
      )}>
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

        <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* 加载动画覆盖层 - 覆盖工具栏和终端内容区 */}
        {effectiveIsLoading && active && active.type !== 'quick' && (
          <div className="absolute inset-0 z-[60]">
            <ConnectionLoader
              serverName={`${active.username}@${active.host}`}
              message="正在连接"
              state={loaderState}
              onAnimationComplete={handleAnimationComplete}
            />
          </div>
        )}

        {sessions.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-zinc-500">
            暂无活动会话，使用右上角 + 新建
          </div>
        ) : (
          <Tabs value={active?.id} className="flex-1 flex flex-col gap-0">
            {/* 工具栏（会话信息条）- 现代化设计 */}
            {active && active.type !== 'quick' && !effectiveIsLoading && (
              <div className={cn(
                "border-b text-sm flex items-center justify-between px-3 py-1.5 backdrop-blur-sm transition-colors",
                "bg-gradient-to-b from-white to-zinc-50 border-zinc-200 dark:from-black/90 dark:to-black dark:border-zinc-800/30"
              )}>
                {/* 左侧工具图标组 */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md transition-colors text-foreground hover:bg-accent hover:text-accent-foreground"
                    aria-label="文件管理器"
                    title="文件管理器 (Ctrl+E)"
                    onClick={() => setIsFileManagerOpen(!isFileManagerOpen)}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                  </Button>

                  <NetworkLatencyPopover currentLatency={2} />

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md transition-colors text-foreground hover:bg-accent hover:text-accent-foreground"
                    aria-label="监控"
                    title="系统监控"
                    onClick={() => setIsMonitorOpen(!isMonitorOpen)}
                  >
                    <Activity className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md transition-colors text-foreground hover:bg-accent hover:text-accent-foreground"
                    aria-label="AI 助手"
                    title="AI 助手 (Ctrl+K)"
                    onClick={() => setIsAiInputOpen(!isAiInputOpen)}
                  >
                    <Bot className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* 中间：会话信息 */}
                <div className={cn(
                  "flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-500",
                )}>
                  <span className="font-mono">
                    {active.username}@{active.host}
                  </span>
                  <span className={"text-zinc-400 dark:text-zinc-700"}>|</span>
                  <span className={active.isConnected ? "text-green-400" : "text-red-400"}>
                    {active.isConnected ? "已连接" : "已断开"}
                  </span>
                </div>

                {/* 右侧工具按钮 */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md transition-colors text-foreground hover:bg-accent hover:text-accent-foreground"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    title={isFullscreen ? "退出全屏" : "全屏"}
                  >
                    {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md transition-colors text-foreground hover:bg-accent hover:text-accent-foreground"
                    onClick={() => setIsSettingsOpen(true)}
                    title="设置"
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* 内容区域：监控面板 + 终端/快速连接 */}
            <div className="flex-1 min-h-0 relative flex">
              {/* 监控面板 - 左侧固定 250px，带优雅的滑入/滑出动画 */}
              <div
                className={cn(
                  "transition-all duration-300 ease-out overflow-hidden",
                  "border-r border-zinc-200 dark:border-zinc-800/30", // 右边框与工具栏一致
                  "bg-white dark:bg-black", // 背景色与终端一致
                  isMonitorOpen && active && active.type !== 'quick'
                    ? "w-[250px] opacity-100 translate-x-0"
                    : "w-0 opacity-0 -translate-x-4"
                )}
              >
                {isMonitorOpen && active && active.type !== 'quick' && (
                  <MonitorPanel />
                )}
              </div>

              {/* 终端区域 - flex-1 占据剩余空间 */}
              <div className="flex-1 min-w-0 relative">
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
                        serverId={typeof active.serverId === 'string' ? active.serverId : undefined}
                        serverName={active.serverName}
                        host={active.host}
                        username={active.username}
                        isConnected={active.isConnected}
                        onCommand={(command) => handleCommand(active.id, command)}
                        onLoadingChange={(isLoading) => handleLoadingChange(active.id, isLoading)}
                        theme={settings.theme}
                        fontSize={settings.fontSize}
                        fontFamily={settings.fontFamily}
                        cursorStyle={settings.cursorStyle}
                        cursorBlink={settings.cursorBlink}
                        scrollback={settings.scrollback}
                      />
                    </TabsContent>
                  )
                ) : (
                  sessions.map((session) => (
                    <TabsContent key={session.id} value={session.id} className="flex-1 flex flex-col m-0 absolute inset-0">
                      <WebTerminal
                        sessionId={session.id}
                        serverId={typeof session.serverId === 'string' ? session.serverId : undefined}
                        serverName={session.serverName}
                        host={session.host}
                        username={session.username}
                        isConnected={session.isConnected}
                        onCommand={(command) => handleCommand(session.id, command)}
                        onLoadingChange={(isLoading) => handleLoadingChange(session.id, isLoading)}
                        theme={settings.theme}
                        fontSize={settings.fontSize}
                        fontFamily={settings.fontFamily}
                        cursorStyle={settings.cursorStyle}
                        cursorBlink={settings.cursorBlink}
                        scrollback={settings.scrollback}
                      />
                    </TabsContent>
                  ))
                )}
              </div>
            </div>
          </Tabs>
        )}

        {/* AI 助手悬浮输入框 - 终端内部悬浮 */}
        {/* 只在非加载状态时渲染，避免与 ConnectionLoader 动画冲突 */}
        {active && active.type !== 'quick' && !effectiveIsLoading && (
          <AiAssistantPanel
            isOpen={isAiInputOpen}
            onClose={() => setIsAiInputOpen(false)}
          />
        )}
        </div>
      </div>

      {/* 设置对话框 */}
      <TerminalSettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        settings={settings}
        onSettingsChange={handleSettingsChange}
      />

      {/* 文件管理器面板 */}
      {active && active.type !== 'quick' && (
        <FileManagerPanel
          isOpen={isFileManagerOpen}
          onClose={() => setIsFileManagerOpen(false)}
          serverId={0}
          serverName={active.serverName || ''}
          host={active.host || ''}
          username={active.username || ''}
          isConnected={active.isConnected || false}
          currentPath="/home"
          files={[]}
          sessionId={active.id}
          sessionLabel={active.serverName || ''}
          onNavigate={(path) => console.log('Navigate to:', path)}
          onUpload={(files) => console.log('Upload files:', files)}
          onDownload={(fileName) => console.log('Download file:', fileName)}
          onDelete={(fileName) => console.log('Delete file:', fileName)}
          onCreateFolder={(name) => console.log('Create folder:', name)}
          onRename={(oldName, newName) => console.log('Rename:', oldName, '->', newName)}
          onDisconnect={() => setIsFileManagerOpen(false)}
          onRefresh={() => console.log('Refresh')}
        />
      )}
    </div>
  )
}
