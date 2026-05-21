/**
 * 单个页签的完整内容组件
 * 每个 TabsContent 渲染一个独立的 TabTerminalContent
 * 包含独立的 MonitorWebSocketProvider
 */

'use client'

import React, { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { MonitorWebSocketProvider } from './monitor/contexts/MonitorWebSocketContext'
import { Button } from '@/components/ui/button'
import { Maximize2, Minimize2, Settings, FolderOpen, Activity, Bot } from 'lucide-react'
import { NetworkLatencyPopover } from './network-latency-popover'
import { MonitorPanel } from './monitor/MonitorPanel'
import { WebTerminal } from './web-terminal'
import { QuickConnect, type QuickServer } from './quick-connect'
import { ConnectionLoader } from './connection-loader'
import {
  FileManagerPanel,
  FILE_MANAGER_PANEL_ANIMATION_MS,
} from './file-manager-panel'
import { AiAssistantPanel } from './ai-assistant-panel'
import { DockerPopover } from './docker'
import { useSftpSession } from '@/hooks/useSftpSession'
import { cn } from '@/lib/utils'
import { useTabUIStore } from '@/stores/tab-ui-store'
import type { TerminalConnectionPhase, TerminalSession } from './types'
import type { TerminalSettings } from './terminal-settings-dialog'
import { useTranslations } from "next-intl"
import { getTerminalTheme, withTerminalBackgroundOpacity } from './terminal-themes'

const DESKTOP_TERMINAL_LAYOUT_QUERY = '(min-width: 768px)'

type ConnectionLoaderMessageKey =
  | "connectionLoaderConnecting"
  | "connectionLoaderAuthenticating"
  | "connectionLoaderReconnecting"
  | "connectionLoaderSuccess"
  | "connectionLoaderFailed"
  | "connectionLoaderClosed"

type InternalBackHandler = {
  handle: () => boolean | Promise<boolean>
}

const getConnectionLoaderMessageKey = (
  phase: TerminalConnectionPhase
): ConnectionLoaderMessageKey => {
  if (phase === "authenticating") {
    return "connectionLoaderAuthenticating"
  }

  if (phase === "reconnecting") {
    return "connectionLoaderReconnecting"
  }

  return "connectionLoaderConnecting"
}

const getConnectionLoaderExitMessageKey = (
  phase: TerminalConnectionPhase
): ConnectionLoaderMessageKey => {
  if (phase === "failed") {
    return "connectionLoaderFailed"
  }

  if (phase === "closed" || phase === "idle") {
    return "connectionLoaderClosed"
  }

  return "connectionLoaderSuccess"
}

interface TabTerminalContentProps {
  session: TerminalSession
  isActive: boolean
  settings: TerminalSettings
  effectiveIsLoading: boolean
  loaderState: "entering" | "loading" | "exiting"
  onAnimationComplete: () => void
  isFullscreen: boolean
  servers: QuickServer[]
  serversLoading?: boolean
  onCommand: (command: string) => void
  onConnectionPhaseChange: (phase: TerminalConnectionPhase) => void
  onAuthCancelled: () => void
  onToggleFullscreen: () => void
  onToggleSettings: () => void
  onStartConnectionFromQuick: (server: QuickServer) => void
  onInternalBackHandlerChange?: (
    sessionId: string,
    handler: InternalBackHandler | null
  ) => void
  onInternalBackAvailabilityChange?: (sessionId: string, available: boolean) => void
}

export function TabTerminalContent({
  session,
  isActive,
  settings,
  effectiveIsLoading,
  loaderState,
  onAnimationComplete,
  isFullscreen,
  servers,
  serversLoading,
  onCommand,
  onConnectionPhaseChange,
  onAuthCancelled,
  onToggleFullscreen,
  onToggleSettings,
  onStartConnectionFromQuick,
  onInternalBackHandlerChange,
  onInternalBackAvailabilityChange,
}: TabTerminalContentProps) {
  // 浮动面板根容器
  const [floatingPanelRoot, setFloatingPanelRoot] = useState<HTMLDivElement | null>(null)
  const [sftpInternalBackHandler, setSftpInternalBackHandler] =
    useState<InternalBackHandler | null>(null)
  const [shouldRenderFileManager, setShouldRenderFileManager] = useState(false)
  const [isDesktopLayout, setIsDesktopLayout] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return true
    }

    return window.matchMedia(DESKTOP_TERMINAL_LAYOUT_QUERY).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const mediaQuery = window.matchMedia(DESKTOP_TERMINAL_LAYOUT_QUERY)
    const handleChange = () => setIsDesktopLayout(mediaQuery.matches)

    handleChange()
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  // 从 Store 获取当前页签的 UI 状态
  const tabState = useTabUIStore((state) => state.getTabState(session.id))
  const setTabState = useTabUIStore((state) => state.setTabState)

  const isDesktopMonitorOpen = tabState.isMonitorOpen
  const isMobileMonitorOpen = tabState.isMobileMonitorOpen ?? false
  const isFileManagerOpen = tabState.isFileManagerOpen
  const isAiInputOpen = tabState.isAiInputOpen

  const isTerminalReady = session.connectionPhase === "ready"
  const hasReadyServer = session.type !== 'quick' && isTerminalReady && !!session.serverId
  const canUseHeavyPanels = isActive && hasReadyServer
  const canUseFileManager = canUseHeavyPanels && isFileManagerOpen
  const shouldKeepFileManagerMounted = canUseHeavyPanels && shouldRenderFileManager
  const canMountAi = isActive && session.type !== 'quick' && !effectiveIsLoading
  const canUseAi = canMountAi && isAiInputOpen
  const shouldReserveInlineMonitor =
    isDesktopLayout &&
    hasReadyServer &&
    isDesktopMonitorOpen &&
    !!session.serverId
  const canUseMobileMonitor = canUseHeavyPanels && isMobileMonitorOpen && !isDesktopLayout
  const toggleMonitor = () => {
    setTabState(
      session.id,
      isDesktopLayout
        ? { isMonitorOpen: !isDesktopMonitorOpen }
        : { isMobileMonitorOpen: !isMobileMonitorOpen }
    )
  }

  // SFTP 会话管理：只在当前页签且文件管理器打开时加载目录，避免隐藏页签继续触发列表渲染/请求
  const sftpSession = useSftpSession(
    shouldKeepFileManagerMounted && session.serverId
      ? session.serverId
      : '',
    '/root'
  )

  // 监控数据源跟随已就绪的终端页签保持订阅。
  // 桌面端监控面板也保持实时模式，和终端一样只切换可见性，避免切回时图表从冻结快照重绘而闪一下。
  const connectedServerId =
    hasReadyServer && session.serverId
      ? session.serverId
      : ''
  const monitorEnabled = hasReadyServer
  const tTerminal = useTranslations("terminal")
  const { theme: appTheme, resolvedTheme } = useTheme()
  const currentAppTheme = (resolvedTheme || appTheme) as 'light' | 'dark' | 'system'
  const initialIsDark =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  const effectiveAppTheme: 'light' | 'dark' =
    currentAppTheme === 'system' || !currentAppTheme
      ? (initialIsDark ? 'dark' : 'light')
      : currentAppTheme
  const pageTheme = getTerminalTheme(settings.theme, effectiveAppTheme)
  const pageBackgroundColor =
    settings.opacity < 100
      ? withTerminalBackgroundOpacity(pageTheme.background, settings.opacity / 100)
      : pageTheme.background
  const hasBackgroundImage = settings.backgroundImage.trim().length > 0
  const enableTerminalWebgl = true
  const connectionLoaderServerName =
    session.username && session.host
      ? `${session.username}@${session.host}`
      : session.serverName || session.host || session.serverId

	  useEffect(() => {
	    let frame = 0
	    if (canUseFileManager) {
	      frame = window.requestAnimationFrame(() => {
	        setShouldRenderFileManager(true)
	      })
	      return () => window.cancelAnimationFrame(frame)
	    }
	
	    const timer = window.setTimeout(() => {
	      setShouldRenderFileManager(false)
	    }, FILE_MANAGER_PANEL_ANIMATION_MS)
	
	    return () => {
	      if (frame) {
	        window.cancelAnimationFrame(frame)
	      }
	      window.clearTimeout(timer)
	    }
	  }, [canUseFileManager])

  const canHandleInternalBack = isActive && (
    isFullscreen ||
    canUseFileManager ||
    canUseAi ||
    canUseMobileMonitor
  )
  const handleInternalBack = React.useCallback(async () => {
    if (!isActive) {
      return false
    }

    if (isFullscreen) {
      onToggleFullscreen()
      return true
    }

    if (canUseFileManager) {
      if (sftpInternalBackHandler) {
        const handled = await sftpInternalBackHandler.handle()
        if (handled) {
          return true
        }
      }

      setTabState(session.id, { isFileManagerOpen: false })
      return true
    }

    if (canUseAi) {
      setTabState(session.id, { isAiInputOpen: false })
      return true
    }

    if (canUseMobileMonitor) {
      setTabState(session.id, { isMobileMonitorOpen: false })
      return true
    }

    return false
  }, [
    canUseAi,
    canUseFileManager,
    canUseMobileMonitor,
    isActive,
    isFullscreen,
    onToggleFullscreen,
    session.id,
    setTabState,
    sftpInternalBackHandler,
  ])

  useEffect(() => {
    onInternalBackHandlerChange?.(
      session.id,
      canHandleInternalBack ? { handle: handleInternalBack } : null
    )

    return () => {
      onInternalBackHandlerChange?.(session.id, null)
    }
  }, [
    canHandleInternalBack,
    handleInternalBack,
    onInternalBackHandlerChange,
    session.id,
  ])

  useEffect(() => {
    onInternalBackAvailabilityChange?.(session.id, canHandleInternalBack)

    return () => {
      onInternalBackAvailabilityChange?.(session.id, false)
    }
  }, [canHandleInternalBack, onInternalBackAvailabilityChange, session.id])

  return (
    <MonitorWebSocketProvider
      serverId={connectedServerId}
      enabled={monitorEnabled}
      interval={settings.monitorInterval || 2}
      latencyIntervalMs={5000}
    >
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: pageBackgroundColor }}
        />

        {hasBackgroundImage && (
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(${settings.backgroundImage})`,
              opacity: settings.backgroundImageOpacity / 100,
            }}
          />
        )}

        {/* 加载动画覆盖层 - 覆盖整个页签内容 */}
        {effectiveIsLoading && session.type !== 'quick' && (
          <div className="absolute inset-0 z-[60]">
            <ConnectionLoader
              serverName={connectionLoaderServerName}
              message={tTerminal(getConnectionLoaderMessageKey(session.connectionPhase))}
              exitMessage={tTerminal(getConnectionLoaderExitMessageKey(session.connectionPhase))}
              state={loaderState}
              onAnimationComplete={onAnimationComplete}
            />
          </div>
        )}

        <div className="relative z-10 flex flex-1 min-h-0 flex-col">
          {/* 工具栏 - 只在非快速连接且非加载时显示 */}
          {session.type !== 'quick' && !effectiveIsLoading && (
            <div
              className={cn(
                'border-b text-sm flex items-center justify-between px-3 py-1.5 backdrop-blur-md transition-colors',
                'border-zinc-200/70 bg-gradient-to-b from-white/70 via-white/55 to-white/40',
                'dark:border-zinc-800/40 dark:from-black/65 dark:via-black/50 dark:to-black/35'
              )}
            >
              {/* 左侧工具图标组 */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-md transition-colors text-foreground hover:bg-accent/80 hover:text-accent-foreground"
                  aria-label={tTerminal("ariaFileManager")}
                  title={tTerminal("titleFileManagerWithShortcut")}
                  onClick={() => setTabState(session.id, { isFileManagerOpen: !isFileManagerOpen })}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                </Button>

                <NetworkLatencyPopover sessionId={session.id} />

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-md transition-colors text-foreground hover:bg-accent/80 hover:text-accent-foreground"
                  aria-label={tTerminal("ariaMonitor")}
                  title={tTerminal("titleMonitor")}
                  onClick={toggleMonitor}
                >
                  <Activity className="h-3.5 w-3.5" />
                </Button>

                {isActive && (
                  <DockerPopover
                    serverId={session.serverId ?? ''}
                    sessionId={session.id}
                    isConnected={hasReadyServer}
                  />
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-md transition-colors text-foreground hover:bg-accent/80 hover:text-accent-foreground"
                  aria-label={tTerminal("ariaAiAssistant")}
                  title={tTerminal("titleAiAssistantWithShortcut")}
                  onClick={() => setTabState(session.id, { isAiInputOpen: !isAiInputOpen })}
                >
                  <Bot className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* 右侧工具按钮 */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-md transition-colors text-foreground hover:bg-accent/80 hover:text-accent-foreground"
                  onClick={onToggleFullscreen}
                  title={
                    isFullscreen
                      ? tTerminal("titleExitFullscreen")
                      : tTerminal("titleEnterFullscreen")
                  }
                >
                  {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-md transition-colors text-foreground hover:bg-accent/80 hover:text-accent-foreground"
                  onClick={onToggleSettings}
                  title={tTerminal("titleSettings")}
                >
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* 内容区域：监控面板 + 终端 */}
          <div className="flex-1 min-h-0 relative flex">
            {/* 监控面板 - 左侧固定 280px */}
            {session.type !== 'quick' && isDesktopLayout && (
              <div
                className={cn(
                  'transition-all duration-300 ease-out overflow-hidden border-r backdrop-blur-md',
                  'border-zinc-200/70 bg-gradient-to-b from-white/72 via-white/58 to-white/46',
                  'dark:border-zinc-800/40 dark:from-zinc-950/42 dark:via-zinc-950/28 dark:to-zinc-950/18',
                  shouldReserveInlineMonitor
                    ? 'w-[280px] opacity-100 translate-x-0'
                    : 'w-0 opacity-0 -translate-x-4 border-r-0'
                )}
              >
                {shouldReserveInlineMonitor && <MonitorPanel />}
              </div>
            )}

            {/* 终端区域 */}
            <div className="flex-1 min-w-0 relative">
              {/* 文件管理器悬浮挂载根，位于终端容器内部 */}
              <div ref={setFloatingPanelRoot} className="absolute inset-0 pointer-events-none" />

              {session.type === 'quick' ? (
                <QuickConnect
                  servers={servers}
                  isLoading={serversLoading}
                  onSelectServer={onStartConnectionFromQuick}
                />
              ) : (
                <WebTerminal
                  sessionId={session.id}
                  serverId={session.serverId}
                  serverName={session.serverName}
                  host={session.host}
                  username={session.username}
                  isActive={isActive}
                  shouldConnect={session.shouldConnect}
                  onConnectionPhaseChange={onConnectionPhaseChange}
                  onAuthCancelled={onAuthCancelled}
                  onCommand={onCommand}
                  theme={settings.theme}
                  fontSize={settings.fontSize}
                  fontFamily={settings.fontFamily}
                  cursorStyle={settings.cursorStyle}
                  cursorBlink={settings.cursorBlink}
                  scrollback={settings.scrollback}
                  rightClickPaste={settings.rightClickPaste}
                  copyOnSelect={settings.copyOnSelect}
                  copyShortcut={settings.copyShortcut}
                  pasteShortcut={settings.pasteShortcut}
                  clearShortcut={settings.clearShortcut}
                  completionEnabled={settings.completionEnabled}
                  completionTrigger={settings.completionTrigger}
                  completionAutoDelay={settings.completionAutoDelay}
                  completionMaxItems={settings.completionMaxItems}
                  completionShowIcon={settings.completionShowIcon}
                  completionShowDescription={settings.completionShowDescription}
                  enableWebgl={enableTerminalWebgl}
                />
              )}
            </div>

            {canMountAi && (
              <AiAssistantPanel
                isOpen={canUseAi}
                onClose={() => setTabState(session.id, { isAiInputOpen: false })}
                terminalSession={session}
              />
            )}

            {canUseMobileMonitor && (
              <div
                className={cn(
                  'absolute inset-0 z-30 overflow-hidden border-t backdrop-blur-md md:hidden',
                  'border-zinc-200/70 bg-gradient-to-b from-white/92 via-white/86 to-white/78',
                  'dark:border-zinc-800/40 dark:from-zinc-950/96 dark:via-zinc-950/90 dark:to-black/86'
                )}
              >
                <MonitorPanel className="h-full min-h-0 w-full" isLive={isActive} />
              </div>
            )}
          </div>
        </div>

        {/* 文件管理器面板 - 渲染到 floatingPanelRootRef */}
        {shouldKeepFileManagerMounted && (
          <FileManagerPanel
            isOpen={canUseFileManager}
            onClose={() => setTabState(session.id, { isFileManagerOpen: false })}
            mountContainer={floatingPanelRoot || undefined}
            serverId={session.serverId ?? ''}
            serverName={session.serverName || ''}
            host={session.host || ''}
            username={session.username || ''}
            isConnected={isTerminalReady}
            sessionId={session.id}
            sessionLabel={session.serverName || 'Session'}
            currentPath={sftpSession.currentPath}
            files={sftpSession.files}
            isLoading={sftpSession.isLoading}
            onNavigate={sftpSession.navigate}
            onNavigateBack={sftpSession.goBack}
            canNavigateBack={sftpSession.canGoBack}
            onInternalBackHandlerChange={setSftpInternalBackHandler}
            onRefresh={sftpSession.refresh}
            onUpload={sftpSession.uploadFiles}
            onDownload={sftpSession.downloadFile}
            onDelete={sftpSession.deleteFile}
            onRename={sftpSession.renameFile}
            onCreateFolder={sftpSession.createFolder}
            onCreateFile={sftpSession.createFile}
            onBatchDelete={sftpSession.batchDeleteFiles}
            onBatchDownload={sftpSession.batchDownloadFiles}
            onReadFile={sftpSession.readFile}
            onSaveFile={sftpSession.saveFile}
            onDisconnect={() => setTabState(session.id, { isFileManagerOpen: false })}
            transferTasks={sftpSession.transferTasks}
            onClearCompletedTransfers={sftpSession.clearCompletedTransfers}
            onCancelTransfer={sftpSession.cancelTransfer}
          />
        )}

      </div>
    </MonitorWebSocketProvider>
  )
}
