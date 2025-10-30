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
import { useTerminalStore } from "@/stores/terminal-store"
import { useMonitorStore } from "@/stores/monitor-store"
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
import { MonitorWebSocketProvider } from "./monitor/contexts/MonitorWebSocketContext"
import { useSftpSession } from "@/hooks/useSftpSession"
import { TabTerminalContent } from "./tab-terminal-content"
import { useTabUIStore } from "@/stores/tab-ui-store"

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
  // 快速连接：在当前页签中选择服务器以开始终端
  onStartConnectionFromQuick: (sessionId: string, server: QuickServer) => void
  servers: QuickServer[]
  serversLoading?: boolean
  // 外部控制激活的会话 ID
  externalActiveSessionId?: string | null
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
  onStartConnectionFromQuick,
  servers,
  serversLoading,
  externalActiveSessionId,
}: TerminalComponentProps) {
  const [activeSession, setActiveSession] = useState<string>(sessions[0]?.id || "")
  const [isFullscreen, setIsFullscreen] = useState(false)
  // ==================== 方案A：多页签并发加载状态管理 ====================
  const [loadingSessionIds, setLoadingSessionIds] = useState<Set<string>>(new Set())
  const [loaderStates, setLoaderStates] = useState<Record<string, "entering" | "loading" | "exiting">>({})
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  // 文件管理器挂载容器与锚点（终端内部悬浮、位于工具栏下方）
  const toolbarRef = useRef<HTMLDivElement>(null)
  const floatingPanelRootRef = useRef<HTMLDivElement>(null)
  const [toolbarHeight, setToolbarHeight] = useState(0)

  // ==================== 从 Store 获取销毁方法 ====================
  const destroySession = useTerminalStore(state => state.destroySession)
  // ==================== P0 修复：移除 destroyMonitorConnection 的引用 ====================
  // 监控连接现在完全由 useMonitorWebSocket 的引用计数自动管理
  // const destroyMonitorConnection = useMonitorStore(state => state.destroyConnection) // ❌ 不再需要
  const deleteTabState = useTabUIStore(state => state.deleteTabState)

  // 当外部传入 activeSessionId 时，切换激活的会话
  useEffect(() => {
    if (externalActiveSessionId) {
      setActiveSession(externalActiveSessionId)
    }
  }, [externalActiveSessionId])

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
      monitorInterval: 2, // 默认 2 秒
      copyShortcut: 'Ctrl+Shift+C',
      pasteShortcut: 'Ctrl+Shift+V',
      clearShortcut: 'Ctrl+L',
    }
  })

  // 获取当前活跃会话
  const active = sessions.find((s) => s.id === activeSession)

  // 如果当前激活的会话不存在（被删除），自动切换到合适的会话
  // 使用 ref 跟踪上一次的 sessions 数组，用于找到被删除页签的位置
  const prevSessionsRef = useRef(sessions)

  useEffect(() => {
    const prevSessions = prevSessionsRef.current
    const isSessionAdded = sessions.length > prevSessions.length

    // 更新 ref
    prevSessionsRef.current = sessions

    // 只在会话被删除（而非新增）且当前激活会话不存在时才切换
    if (!active && sessions.length > 0 && !isSessionAdded) {
      // 位置策略：优先激活右侧页签，没有则激活左侧
      // 找到被删除页签在原数组中的索引位置
      const deletedIndex = prevSessions.findIndex((s) => s.id === activeSession)

      let targetIndex = 0
      if (deletedIndex >= 0) {
        // 优先选择右侧页签（原索引位置，因为左侧页签会左移）
        // 如果右侧没有页签了（删除的是最后一个），则取最后一个页签
        targetIndex = Math.min(deletedIndex, sessions.length - 1)
      }

      setActiveSession(sessions[targetIndex].id)
    }
  }, [active, sessions, activeSession])

  // 记录已经完成一次初始化（展示过加载遮罩并完成退出动画）的会话，避免重复触发
  const initializedSessionsRef = useRef<Set<string>>(new Set())
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 保存设置到 localStorage（使用防抖优化性能）
  const handleSettingsChange = (newSettings: TerminalSettings) => {
    setSettings(newSettings)

    // 防抖保存到 localStorage，避免频繁写入
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = setTimeout(() => {
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('terminal-settings', JSON.stringify(newSettings))
        } catch (error) {
          console.error('Failed to save terminal settings:', error)
        }
      }
    }, 500) // 500ms 防抖延迟
  }

  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  const handleCommand = (sessionId: string, command: string) => {
    onSendCommand(sessionId, command)
  }

  const handleNewSessionClick = () => {
    const id = onNewSession()
    if (id) setActiveSession(String(id))
  }

  // ==================== 页签关闭处理：先销毁终端实例，依赖引用计数自动管理监控连接 ====================
  const handleCloseSession = (sessionId: string) => {
    // 1. 从 Store 中销毁终端实例和 WebSocket
    destroySession(sessionId)

    // ==================== P0 修复：删除直接销毁调用，依赖 useMonitorWebSocket 的引用计数自动管理 ====================
    // 注释说明：
    // - useMonitorWebSocket 的 useEffect 清理函数会自动调用 unsubscribe()
    // - unsubscribe() 会减少引用计数
    // - 当引用计数归零时，monitor-store.ts 会自动调用 destroyConnection()
    // - 这样可以确保：同一服务器的多个页签共享连接，只有最后一个页签关闭时才断开连接

    // ❌ 旧代码（导致BUG）：
    // if (session?.serverId) {
    //   destroyMonitorConnection(String(session.serverId))
    // }

    // 2. 清理页签 UI 状态
    deleteTabState(sessionId)

    // 3. 通知父组件更新会话列表
    onCloseSession(sessionId)
  }

  const handleCloseOthers = (sessionId: string) => {
    // ==================== P0 修复：同样删除直接销毁监控连接的调用 ====================
    // 销毁所有其他会话的终端实例，监控连接由引用计数自动管理
    sessions.forEach((session) => {
      if (session.id !== sessionId) {
        destroySession(session.id)
        // ❌ 旧代码（导致BUG）：
        // if (session.serverId) {
        //   destroyMonitorConnection(String(session.serverId))
        // }
        deleteTabState(session.id)
      }
    })
    onCloseOthers(sessionId)
  }

  const handleCloseAll = () => {
    // ==================== P0 修复：同样删除直接销毁监控连接的调用 ====================
    // 销毁所有会话的终端实例，监控连接由引用计数自动管理
    sessions.forEach((session) => {
      destroySession(session.id)
      // ❌ 旧代码（导致BUG）：
      // if (session.serverId) {
      //   destroyMonitorConnection(String(session.serverId))
      // }
      deleteTabState(session.id)
    })
    onCloseAll()
  }

  const handleLoadingChange = (sessionId: string, isLoading: boolean) => {
    if (isLoading) {
      // 添加到加载中的页签集合
      setLoadingSessionIds(prev => new Set(prev).add(sessionId))
      // 设置该页签的状态为 entering
      setLoaderStates(prev => ({ ...prev, [sessionId]: "entering" }))
    } else {
      // 连接成功，触发该页签的退出动画
      if (loadingSessionIds.has(sessionId)) {
        setLoaderStates(prev => ({ ...prev, [sessionId]: "exiting" }))
      }
    }
  }

  const handleAnimationComplete = (sessionId: string) => {
    // 退出动画完成后，标记该会话已初始化并清除加载状态
    initializedSessionsRef.current.add(sessionId)
    // 从加载集合中移除
    setLoadingSessionIds(prev => {
      const next = new Set(prev)
      next.delete(sessionId)
      return next
    })
    // 清除该页签的状态
    setLoaderStates(prev => {
      const next = { ...prev }
      delete next[sessionId]
      return next
    })
  }

  const isActiveSessionLoading = loadingSessionIds.has(activeSession)
  const shouldForceLoading = !!(active && active.type !== 'quick' && !initializedSessionsRef.current.has(active.id))
  const effectiveIsLoading = !!(active && active.type !== 'quick' && (isActiveSessionLoading || shouldForceLoading))

  // 当从"快速连接"升级为"终端"或首次连接新会话时，立刻设置为加载中
  useEffect(() => {
    if (shouldForceLoading && active) {
      // 若还未设置当前加载会话，则添加到加载集合
      if (!loadingSessionIds.has(active.id)) {
        setLoadingSessionIds(prev => new Set(prev).add(active.id))
        setLoaderStates(prev => ({ ...prev, [active.id]: "entering" }))
      }
    } else if (!shouldForceLoading && active && loadingSessionIds.has(active.id)) {
      // 如果切换到已初始化的会话，清除加载状态
      setLoadingSessionIds(prev => {
        const next = new Set(prev)
        next.delete(active.id)
        return next
      })
      setLoaderStates(prev => {
        const next = { ...prev }
        delete next[active.id]
        return next
      })
    }
  }, [shouldForceLoading, active?.id, loadingSessionIds])

  // 键盘快捷键支持
  // AI 助手快捷键（Ctrl+K）已移至 TabTerminalContent 组件内部
  // 每个页签独立管理快捷键

  // SFTP 会话管理 - 为当前激活的终端会话
  // 性能优化：只在文件管理器打开时才加载 SFTP 数据
  // 避免在终端连接时就立即发起 SFTP 列表请求（500-800ms）
  const sftpSession = useSftpSession(
    active && active.type !== 'quick' && useTabUIStore.getState().getTabState(active.id).isFileManagerOpen
      ? String(active.serverId)
      : '',
    '/root'
  )

  // 监听工具栏高度变化，确保文件管理器面板紧贴其下方
  useEffect(() => {
    const el = toolbarRef.current
    if (!el) return
    const update = () => setToolbarHeight(el.offsetHeight || 0)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [toolbarRef])

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
          onCloseSession={handleCloseSession}
          onDuplicateSession={onDuplicateSession}
          onCloseOthers={handleCloseOthers}
          onCloseAll={handleCloseAll}
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
              state={loaderStates[active.id] || "entering"}
              onAnimationComplete={() => handleAnimationComplete(active.id)}
            />
          </div>
        )}

        {sessions.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-zinc-500">
            暂无活动会话，使用右上角 + 新建
          </div>
        ) : (
          <Tabs value={active?.id || sessions[0]?.id || ''} className="flex-1 flex flex-col gap-0">
            {/* ==================== 每个页签独立的 Provider 和内容 ==================== */}
            {sessions.map((session) => {
              const isActive = session.id === activeSession

              return (
                <TabsContent
                  key={session.id}
                  value={session.id}
                  forceMount // 强制保持挂载
                  className={cn(
                    "flex-1 flex flex-col m-0 absolute inset-0 transition-none"
                  )}
                  style={{
                    visibility: isActive ? 'visible' : 'hidden',
                    zIndex: isActive ? 1 : 0,
                  }}
                >
                  <TabTerminalContent
                    session={session}
                    isActive={isActive}
                    settings={settings}
                    effectiveIsLoading={effectiveIsLoading && isActive}
                    isFullscreen={isFullscreen}
                    servers={servers}
                    serversLoading={serversLoading}
                    onCommand={(command) => handleCommand(session.id, command)}
                    onLoadingChange={(isLoading) => handleLoadingChange(session.id, isLoading)}
                    onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
                    onToggleSettings={() => setIsSettingsOpen(true)}
                    onStartConnectionFromQuick={(server) => onStartConnectionFromQuick(session.id, server)}
                  />
                </TabsContent>
              )
            })}
          </Tabs>
        )}

        {/* AI 助手悬浮输入框 - 终端内部悬浮 */}
        {/* 只在非加载状态时渲染，避免与 ConnectionLoader 动画冲突 */}
        {active && active.type !== 'quick' && !effectiveIsLoading && (
          <AiAssistantPanel
            isOpen={useTabUIStore.getState().getTabState(active.id).isAiInputOpen}
            onClose={() => useTabUIStore.getState().setTabState(active.id, { isAiInputOpen: false })}
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
          isOpen={useTabUIStore.getState().getTabState(active.id).isFileManagerOpen}
          onClose={() => useTabUIStore.getState().setTabState(active.id, { isFileManagerOpen: false })}
          mountContainer={floatingPanelRootRef.current || undefined}
          anchorTop={toolbarHeight}
          serverId={Number(active.serverId)}
          serverName={active.serverName || ''}
          host={active.host || ''}
          username={active.username || ''}
          isConnected={active.isConnected || false}
          currentPath={sftpSession.currentPath}
          files={sftpSession.files}
          sessionId={active.id}
          sessionLabel={active.serverName || ''}
          onNavigate={sftpSession.navigate}
          onUpload={sftpSession.uploadFiles}
          onDownload={sftpSession.downloadFile}
          onDelete={sftpSession.deleteFile}
          onCreateFolder={sftpSession.createFolder}
          onCreateFile={sftpSession.createFile}
          onRename={sftpSession.renameFile}
          onDisconnect={() => useTabUIStore.getState().setTabState(active.id, { isFileManagerOpen: false })}
          onRefresh={sftpSession.refresh}
          onReadFile={sftpSession.readFile}
          onSaveFile={sftpSession.saveFile}
        />
      )}
    </div>
  )
}
