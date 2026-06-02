"use client"

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { SessionTabBar } from "@/components/tabs/session-tab-bar"
import type {
  TerminalSession,
  TerminalConnectionPhase,
} from "@/components/terminal/types"
import type { Server } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useTerminalStore } from "@/stores/terminal-store"
import { PageHeader } from "@/components/page-header"
import { ActivityLogPane } from "@/components/ssh-workspace/activity-log-pane"
import {
  TerminalSettingsDialog,
  type TerminalSettings,
} from "./terminal-settings-dialog"
import { TabTerminalContent } from "./tab-terminal-content"
import { useTabUIStore } from "@/stores/tab-ui-store"
import { useTranslations } from "next-intl"
import { useOptionalSshWorkspace } from "@/components/ssh-workspace/ssh-workspace"

type LoaderState = "entering" | "loading" | "exiting"

type LoaderAction =
  | { type: "sync"; sessions: TerminalSession[] }
  | { type: "animation-complete"; sessionId: string }

const reduceLoaderStates = (
  state: Record<string, LoaderState>,
  action: LoaderAction
): Record<string, LoaderState> => {
  switch (action.type) {
    case "animation-complete": {
      if (!state[action.sessionId]) {
        return state
      }

      const next = { ...state }
      delete next[action.sessionId]
      return next
    }
    case "sync": {
      let changed = false
      const next = { ...state }
      const sessionIds = new Set(action.sessions.map((session) => session.id))

      Object.keys(next).forEach((sessionId) => {
        if (!sessionIds.has(sessionId)) {
          delete next[sessionId]
          changed = true
        }
      })

      action.sessions.forEach((session) => {
        const shouldShow = shouldShowConnectionLoader(session)
        const currentState = next[session.id]

        if (shouldShow) {
          if (!currentState || currentState === "exiting") {
            next[session.id] = "entering"
            changed = true
          }
          return
        }

        if (currentState && currentState !== "exiting") {
          next[session.id] = "exiting"
          changed = true
        }
      })

      return changed ? next : state
    }
    default:
      return state
  }
}

const PAGE_NAVIGATION_CLEANUP_DELAY_MS = 750
const TAB_SWITCH_CLEANUP_DELAY_MS = 120

const CONNECTION_LOADER_PHASES = new Set<TerminalConnectionPhase>([
  "idle",
  "ticket",
  "ws_connecting",
  "ssh_connecting",
  "authenticating",
  "reconnecting",
])

const shouldShowConnectionLoader = (session?: TerminalSession) => {
  const isResolvingConnectionTarget = !!(
    session?.serverId &&
    !session.host &&
    session.status === "reconnecting"
  )

  return !!(
    session &&
    session.type !== "config" &&
    (session.shouldConnect || isResolvingConnectionTarget) &&
    CONNECTION_LOADER_PHASES.has(session.connectionPhase)
  )
}

type InternalBackHandler = {
  handle: () => boolean | Promise<boolean>
}

const getAdjacentSessionId = (sessions: TerminalSession[], sessionId: string) => {
  const currentIndex = sessions.findIndex((session) => session.id === sessionId)
  if (currentIndex === -1) {
    return sessions[0]?.id
  }

  const nextIndex = currentIndex < sessions.length - 1 ? currentIndex + 1 : currentIndex - 1
  return sessions[nextIndex]?.id
}

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
  // 连接配置：在当前页签中选择服务器以开始终端
  onStartConnectionFromConfig: (sessionId: string, server: Server) => void
  onAuthCancelled?: (sessionId: string) => void
  // 外部控制激活的会话 ID
  externalActiveSessionId?: string | null
  onActiveSessionChange?: (sessionId: string) => void
  onConnectionPhaseChange?: (sessionId: string, phase: TerminalConnectionPhase) => void
  onBehaviorSettingsChange?: (settings: { maxTabs: number; inactiveMinutes: number }) => void
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
  onStartConnectionFromConfig,
  onAuthCancelled,
  externalActiveSessionId,
  onActiveSessionChange,
  onConnectionPhaseChange,
  onBehaviorSettingsChange,
}: TerminalComponentProps) {
  const tTerminal = useTranslations("terminal")
  const workspace = useOptionalSshWorkspace()
  const [activeSession, setActiveSession] = useState<string>(
    externalActiveSessionId || sessions[0]?.id || ""
  )
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [loaderStates, dispatchLoaderStates] = useReducer(reduceLoaderStates, {})
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [internalBackVersion, setInternalBackVersion] = useState(0)
  const [activeSessionHistoryVersion, setActiveSessionHistoryVersion] = useState(0)
  const activeSessionRef = useRef(activeSession)
  const activeSessionHistoryRef = useRef<string[]>([])
  const lastNotifiedActiveSessionRef = useRef(activeSession)
  const internalBackHandlersRef = useRef(new Map<string, InternalBackHandler>())
  const internalBackAvailabilityRef = useRef(new Map<string, boolean>())
  const internalBackSentinelArmedRef = useRef(false)
  const internalBackSentinelDisarmingRef = useRef(false)

  // ==================== 从 Store 获取销毁方法 ====================
  const destroySession = useTerminalStore(state => state.destroySession)
  const deleteTabState = useTabUIStore(state => state.deleteTabState)

  // ==================== 获取活跃会话 ====================
  const sessionIdSet = useMemo(
    () => new Set(sessions.map((session) => session.id)),
    [sessions]
  )
  const active = sessions.find((s) => s.id === activeSession)
  const canUseFullscreenCapability = workspace?.capabilities.fullscreen !== false
  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((current) => !current)
  }, [])

  const setActiveSessionFromUser = useCallback((nextSessionId: string) => {
    setActiveSession((previousSessionId) => {
      if (!nextSessionId || previousSessionId === nextSessionId) {
        return previousSessionId
      }

      if (previousSessionId && sessionIdSet.has(previousSessionId)) {
        activeSessionHistoryRef.current = [
          ...activeSessionHistoryRef.current.filter((id) => id !== previousSessionId),
          previousSessionId,
        ].slice(-20)
        setActiveSessionHistoryVersion((version) => version + 1)
      }

      return nextSessionId
    })
  }, [sessionIdSet])

  const setActiveSessionWithoutHistory = useCallback((nextSessionId: string) => {
    setActiveSession(nextSessionId)
  }, [])

  // 当外部传入 activeSessionId 时，切换激活的会话
  useEffect(() => {
	    if (
	      externalActiveSessionId &&
	      sessionIdSet.has(externalActiveSessionId)
	    ) {
      const frame = window.requestAnimationFrame(() => {
        setActiveSessionWithoutHistory(externalActiveSessionId)
      })
      return () => window.cancelAnimationFrame(frame)
    }
  }, [externalActiveSessionId, sessionIdSet, setActiveSessionWithoutHistory])

  useEffect(() => {
    activeSessionRef.current = activeSession
    if (
      activeSession &&
      activeSession !== lastNotifiedActiveSessionRef.current
    ) {
      lastNotifiedActiveSessionRef.current = activeSession
      onActiveSessionChange?.(activeSession)
    }
  }, [activeSession, onActiveSessionChange])

  useEffect(() => {
    const filteredHistory = activeSessionHistoryRef.current.filter((id) => sessionIdSet.has(id))

    if (filteredHistory.length !== activeSessionHistoryRef.current.length) {
      activeSessionHistoryRef.current = filteredHistory
      const frame = window.requestAnimationFrame(() => {
        setActiveSessionHistoryVersion((version) => version + 1)
      })
      return () => window.cancelAnimationFrame(frame)
    }
  }, [sessionIdSet])

  const handleInternalBackHandlerChange = useCallback((
    sessionId: string,
    handler: InternalBackHandler | null
  ) => {
    if (handler) {
      internalBackHandlersRef.current.set(sessionId, handler)
      return
    }

    internalBackHandlersRef.current.delete(sessionId)
  }, [])

  const handleInternalBackAvailabilityChange = useCallback((
    sessionId: string,
    available: boolean
  ) => {
    const previous = internalBackAvailabilityRef.current.get(sessionId) ?? false

    if (available) {
      internalBackAvailabilityRef.current.set(sessionId, true)
    } else {
      internalBackAvailabilityRef.current.delete(sessionId)
    }

    if (previous !== available) {
      setInternalBackVersion((version) => version + 1)
    }
  }, [])

  const armInternalBackSentinel = useCallback(() => {
    if (typeof window === "undefined" || internalBackSentinelArmedRef.current) {
      return
    }

    window.history.pushState(
      {
        ...(window.history.state ?? {}),
        __easysshTerminalInternalBack: true,
      },
      "",
      window.location.href
    )
    internalBackSentinelArmedRef.current = true
  }, [])

  const disarmInternalBackSentinel = useCallback(() => {
    if (
      typeof window === "undefined" ||
      !internalBackSentinelArmedRef.current ||
      internalBackSentinelDisarmingRef.current
    ) {
      return
    }

    internalBackSentinelDisarmingRef.current = true
    window.history.back()
  }, [])

  useEffect(() => {
    if (!activeSession) return

    if (
      internalBackAvailabilityRef.current.get(activeSession) ||
      activeSessionHistoryRef.current.length > 0
    ) {
      armInternalBackSentinel()
      return
    }

    disarmInternalBackSentinel()
  }, [
    activeSession,
    activeSessionHistoryVersion,
    armInternalBackSentinel,
    disarmInternalBackSentinel,
    internalBackVersion,
  ])

  useEffect(() => {
    const handlePopState = () => {
      if (internalBackSentinelDisarmingRef.current) {
        internalBackSentinelDisarmingRef.current = false
        internalBackSentinelArmedRef.current = false
        return
      }

      if (!internalBackSentinelArmedRef.current) {
        return
      }

      internalBackSentinelArmedRef.current = false

      void (async () => {
        const sessionId = activeSessionRef.current
        const handler = sessionId
          ? internalBackHandlersRef.current.get(sessionId)
          : undefined

        let handled = false

        if (handler) {
          handled = await handler.handle()
        }

        if (!handled) {
          while (activeSessionHistoryRef.current.length > 0) {
            const previousSessionId = activeSessionHistoryRef.current[
              activeSessionHistoryRef.current.length - 1
            ]
            activeSessionHistoryRef.current = activeSessionHistoryRef.current.slice(0, -1)
            setActiveSessionHistoryVersion((version) => version + 1)

            if (sessions.some((session) => session.id === previousSessionId)) {
              setActiveSessionWithoutHistory(previousSessionId)
              handled = true
              break
            }
          }
        }

        if (!handled) {
          window.history.back()
          return
        }

        window.setTimeout(() => {
          const currentSessionId = activeSessionRef.current
          if (
            currentSessionId &&
            (
              internalBackAvailabilityRef.current.get(currentSessionId) ||
              activeSessionHistoryRef.current.length > 0
            )
          ) {
            armInternalBackSentinel()
          }
        }, 50)
      })()
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [armInternalBackSentinel, sessions, setActiveSessionWithoutHistory])

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
      completionEnabled: true,
      completionTrigger: 'auto',
      completionAutoDelay: 300,
      completionMaxItems: 10,
      completionShowIcon: true,
      completionShowDescription: true,
    }
  })

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

      const timer = setTimeout(() => {
        setActiveSessionWithoutHistory(sessions[targetIndex].id)
      }, 0)

      return () => clearTimeout(timer)
    }
  }, [active, sessions, activeSession, setActiveSessionWithoutHistory])

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 保存设置到 localStorage（使用防抖优化性能）
  const handleSettingsChange = (newSettings: TerminalSettings) => {
    setSettings(newSettings)
    onBehaviorSettingsChange?.({
      maxTabs: newSettings.maxTabs,
      inactiveMinutes: newSettings.inactiveMinutes,
    })

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
    if (id) setActiveSessionFromUser(String(id))
  }

  const cleanupSession = (sessionId: string) => {
    destroySession(sessionId)
    deleteTabState(sessionId)
  }

  const cleanupSessionsWhenIdle = (sessionIds: string[]) => {
    const runCleanup = () => {
      sessionIds.forEach(cleanupSession)
    }

    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(runCleanup, { timeout: 1000 })
      return
    }

    window.setTimeout(runCleanup, 0)
  }

  const cleanupSessionsAfterDelay = (sessionIds: string[], delayMs: number) => {
    window.setTimeout(() => {
      cleanupSessionsWhenIdle(sessionIds)
    }, delayMs)
  }

  const cleanupSessionsAfterNavigation = (sessionIds: string[]) => {
    cleanupSessionsAfterDelay(sessionIds, PAGE_NAVIGATION_CLEANUP_DELAY_MS)
  }

  const cleanupSessionsAfterTabSwitch = (sessionIds: string[]) => {
    cleanupSessionsAfterDelay(sessionIds, TAB_SWITCH_CLEANUP_DELAY_MS)
  }

  // ==================== 页签关闭处理：先切换/导航，再清理终端资源，避免可见终端先被清空 ====================
  const handleCloseSession = (sessionId: string) => {
    const willCloseTerminalPage = sessions.length <= 1

    if (willCloseTerminalPage) {
      onCloseSession(sessionId)
      cleanupSessionsAfterNavigation([sessionId])
      return
    }

    if (activeSession === sessionId) {
      const nextActiveSessionId = getAdjacentSessionId(sessions, sessionId)
      if (nextActiveSessionId) {
        setActiveSessionWithoutHistory(nextActiveSessionId)
      }
    }

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

    // 1. 通知父组件更新会话列表，让 UI 先切走
    onCloseSession(sessionId)
    // 2. 稍后再销毁终端实例和 WebSocket，避免可见页签先被清空
    cleanupSessionsAfterTabSwitch([sessionId])
  }

  const handleCloseOthers = (sessionId: string) => {
    const remainingSessions = sessions.filter((session) => session.id === sessionId || session.pinned)
    const removedSessionIds = sessions
      .filter((session) => session.id !== sessionId && !session.pinned)
      .map((session) => session.id)

    if (!remainingSessions.some((session) => session.id === activeSession)) {
      const nextActiveSessionId = remainingSessions.find((session) => session.id === sessionId)?.id ?? remainingSessions[0]?.id
      if (nextActiveSessionId) {
        setActiveSessionWithoutHistory(nextActiveSessionId)
      }
    }

    // ==================== P0 修复：同样删除直接销毁监控连接的调用 ====================
    // 监控连接由引用计数自动管理
    // ❌ 旧代码（导致BUG）：
    // if (session.serverId) {
    //   destroyMonitorConnection(String(session.serverId))
    // }
    onCloseOthers(sessionId)
    cleanupSessionsAfterTabSwitch(removedSessionIds)
  }

  const handleCloseAll = () => {
    const pinnedSessions = sessions.filter((session) => session.pinned)
    const willCloseTerminalPage = pinnedSessions.length === 0

    if (willCloseTerminalPage) {
      onCloseAll()
      cleanupSessionsAfterNavigation(sessions.map((session) => session.id))
      return
    }

    if (!pinnedSessions.some((session) => session.id === activeSession)) {
      setActiveSessionWithoutHistory(pinnedSessions[0].id)
    }

    const removedSessionIds = sessions
      .filter((session) => !session.pinned)
      .map((session) => session.id)

    // ==================== P0 修复：同样删除直接销毁监控连接的调用 ====================
    // 监控连接由引用计数自动管理
    // ❌ 旧代码（导致BUG）：
    // if (session.serverId) {
    //   destroyMonitorConnection(String(session.serverId))
    // }
    onCloseAll()
    cleanupSessionsAfterTabSwitch(removedSessionIds)
  }

	  const handleAnimationComplete = (sessionId: string) => {
	    dispatchLoaderStates({ type: "animation-complete", sessionId })
	  }

  const activeLoaderState = active ? loaderStates[active.id] : undefined
  const effectiveIsLoading = !!(
    active &&
    (shouldShowConnectionLoader(active) || activeLoaderState)
  )

	  // Loader 只跟随连接 phase，不再依赖额外的 onLoadingChange 回调。
	  useEffect(() => {
	    dispatchLoaderStates({ type: "sync", sessions })
	  }, [sessions])

  // 键盘快捷键支持
  // AI 助手快捷键（Ctrl+K）已移至 TabTerminalContent 组件内部
  // 每个页签独立管理快捷键

  return (
    <div className={`h-full flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-background' : ''}`}>
      {!isFullscreen && (
        <PageHeader title={active?.serverName || tTerminal("connectionConfigTitle")}>
          <ActivityLogPane />
        </PageHeader>
      )}

      <div className="flex-1 flex flex-col min-h-0 p-4 pt-0">
        <div className={cn(
          "flex-1 flex flex-col min-h-0 rounded-xl border overflow-hidden shadow-2xl transition-colors",
          "border-border/60 bg-background/70 text-foreground backdrop-blur-md"
        )}>
          {/* 页签栏（仅保留标签，不显示面包屑） */}
          <SessionTabBar
            sessions={sessions}
            activeId={activeSession}
            onChangeActive={setActiveSessionFromUser}
            onNewSession={handleNewSessionClick}
            onCloseSession={handleCloseSession}
            onDuplicateSession={onDuplicateSession}
            onCloseOthers={handleCloseOthers}
            onCloseAll={handleCloseAll}
            onTogglePin={onTogglePin}
            onReorder={onReorderSessions}
            isFullscreen={isFullscreen}
            onToggleFullscreen={canUseFullscreenCapability ? handleToggleFullscreen : undefined}
            onOpenSettings={() => setIsSettingsOpen(true)}
            hideBreadcrumb
          />

          <div className="flex-1 flex flex-col overflow-hidden relative">
            {sessions.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                {tTerminal("emptySessionHint")}
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
                        zIndex: isActive ? 10 : 0,
                        pointerEvents: isActive ? 'auto' : 'none',
                      }}
                    >
                      <TabTerminalContent
                        session={session}
                        isActive={isActive}
                        settings={settings}
                        effectiveIsLoading={effectiveIsLoading && isActive}
                        loaderState={loaderStates[session.id] || "entering"}
                        onAnimationComplete={() => handleAnimationComplete(session.id)}
                        isFullscreen={isFullscreen}
                        onCommand={(command) => handleCommand(session.id, command)}
                        onConnectionPhaseChange={(phase) => onConnectionPhaseChange?.(session.id, phase)}
                        onAuthCancelled={() => onAuthCancelled?.(session.id)}
                        onToggleFullscreen={handleToggleFullscreen}
                        onStartConnectionFromConfig={(server) => onStartConnectionFromConfig(session.id, server)}
                        onInternalBackHandlerChange={handleInternalBackHandlerChange}
                        onInternalBackAvailabilityChange={handleInternalBackAvailabilityChange}
                      />
                    </TabsContent>
                  )
                })}
              </Tabs>
            )}
          </div>
        </div>
      </div>

      {/* 设置对话框 */}
      <TerminalSettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        settings={settings}
        onSettingsChange={handleSettingsChange}
      />
    </div>
  )
}
