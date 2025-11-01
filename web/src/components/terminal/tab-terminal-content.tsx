/**
 * 单个页签的完整内容组件
 * 每个 TabsContent 渲染一个独立的 TabTerminalContent
 * 包含独立的 MonitorWebSocketProvider
 */

'use client'

import React, { useRef, useState, useEffect } from 'react'
import { MonitorWebSocketProvider } from './monitor/contexts/MonitorWebSocketContext'
import { Button } from '@/components/ui/button'
import { Maximize2, Minimize2, Settings, FolderOpen, Activity, Bot } from 'lucide-react'
import { NetworkLatencyPopover } from './network-latency-popover'
import { MonitorPanel } from './monitor/MonitorPanel'
import { WebTerminal } from './web-terminal'
import { QuickConnect, QuickServer } from './quick-connect'
import { ConnectionLoader } from './connection-loader'
import { FileManagerPanel } from './file-manager-panel'
import { AiAssistantPanel } from './ai-assistant-panel'
import { useSftpSession } from '@/hooks/useSftpSession'
import { cn } from '@/lib/utils'
import { useTabUIStore } from '@/stores/tab-ui-store'
import type { TerminalSession } from './types'
import type { TerminalSettings } from './terminal-settings-dialog'

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
  onLoadingChange: (isLoading: boolean) => void
  onToggleFullscreen: () => void
  onToggleSettings: () => void
  onStartConnectionFromQuick: (server: QuickServer) => void
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
  onLoadingChange,
  onToggleFullscreen,
  onToggleSettings,
  onStartConnectionFromQuick,
}: TabTerminalContentProps) {
  // 工具栏引用和浮动面板根容器
  const toolbarRef = useRef<HTMLDivElement>(null)
  const floatingPanelRootRef = useRef<HTMLDivElement>(null)
  const [toolbarHeight, setToolbarHeight] = useState(0)

  // 从 Store 获取当前页签的 UI 状态
  const tabState = useTabUIStore((state) => state.getTabState(session.id))
  const setTabState = useTabUIStore((state) => state.setTabState)

  const isMonitorOpen = tabState.isMonitorOpen
  const isFileManagerOpen = tabState.isFileManagerOpen
  const isAiInputOpen = tabState.isAiInputOpen

  // SFTP 会话管理
  const sftpSession = useSftpSession(
    isFileManagerOpen && session.type !== 'quick' ? String(session.serverId) : '',
    '/root'
  )

  // 监听工具栏高度变化
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
  }, [])

  // 计算监控参数
  const serverId = session.type !== 'quick' && session.isConnected
    ? String(session.serverId)
    : ''
  const monitorEnabled = !!(session.type !== 'quick' && session.isConnected)

  return (
    <MonitorWebSocketProvider
      serverId={serverId}
      enabled={monitorEnabled}
      interval={settings.monitorInterval || 2}
      latencyIntervalMs={5000}
    >
      <div className="flex-1 flex flex-col h-full relative">
        {/* 加载动画覆盖层 - 覆盖整个页签内容 */}
        {effectiveIsLoading && session.type !== 'quick' && (
          <div className="absolute inset-0 z-[60]">
            <ConnectionLoader
              serverName={`${session.username}@${session.host}`}
              message="正在连接"
              state={loaderState}
              onAnimationComplete={onAnimationComplete}
            />
          </div>
        )}

        {/* 工具栏 - 只在非快速连接且非加载时显示 */}
        {session.type !== 'quick' && !effectiveIsLoading && (
          <div
            ref={toolbarRef}
            className={cn(
              'border-b text-sm flex items-center justify-between px-3 py-1.5 backdrop-blur-sm transition-colors',
              'bg-gradient-to-b from-white to-zinc-50 border-zinc-200 dark:from-black/90 dark:to-black dark:border-zinc-800/30',
              'relative z-10'
            )}
          >
            {/* 左侧工具图标组 */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md transition-colors text-foreground hover:bg-accent hover:text-accent-foreground"
                aria-label="文件管理器"
                title="文件管理器 (Ctrl+E)"
                onClick={() => setTabState(session.id, { isFileManagerOpen: !isFileManagerOpen })}
              >
                <FolderOpen className="h-3.5 w-3.5" />
              </Button>

              <NetworkLatencyPopover />

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md transition-colors text-foreground hover:bg-accent hover:text-accent-foreground"
                aria-label="监控"
                title="系统监控"
                onClick={() => setTabState(session.id, { isMonitorOpen: !isMonitorOpen })}
              >
                <Activity className="h-3.5 w-3.5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md transition-colors text-foreground hover:bg-accent hover:text-accent-foreground"
                aria-label="AI 助手"
                title="AI 助手 (Ctrl+K)"
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
                className="h-7 w-7 rounded-md transition-colors text-foreground hover:bg-accent hover:text-accent-foreground"
                onClick={onToggleFullscreen}
                title={isFullscreen ? '退出全屏' : '全屏'}
              >
                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md transition-colors text-foreground hover:bg-accent hover:text-accent-foreground"
                onClick={onToggleSettings}
                title="设置"
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* 内容区域：监控面板 + 终端 */}
        <div className="flex-1 min-h-0 relative flex">
          {/* 监控面板 - 左侧固定 280px */}
          <div
            className={cn(
              'transition-all duration-300 ease-out overflow-hidden',
              'border-r border-zinc-200 dark:border-zinc-800/30',
              'bg-white dark:bg-black',
              isMonitorOpen && session.type !== 'quick'
                ? 'w-[280px] opacity-100 translate-x-0'
                : 'w-0 opacity-0 -translate-x-4'
            )}
          >
            {isMonitorOpen && session.type !== 'quick' && session.isConnected && (
              <MonitorPanel />
            )}
          </div>

          {/* 终端区域 */}
          <div className="flex-1 min-w-0 relative">
            {/* 文件管理器悬浮挂载根，位于终端容器内部 */}
            <div ref={floatingPanelRootRef} className="absolute inset-0 pointer-events-none" />

            {session.type === 'quick' ? (
              <QuickConnect
                servers={servers}
                isLoading={serversLoading}
                onSelectServer={onStartConnectionFromQuick}
              />
            ) : (
              <WebTerminal
                sessionId={session.id}
                serverId={typeof session.serverId === 'string' ? session.serverId : undefined}
                serverName={session.serverName}
                host={session.host}
                username={session.username}
                isConnected={session.isConnected}
                onCommand={onCommand}
                onLoadingChange={onLoadingChange}
                theme={settings.theme}
                fontSize={settings.fontSize}
                fontFamily={settings.fontFamily}
                cursorStyle={settings.cursorStyle}
                cursorBlink={settings.cursorBlink}
                scrollback={settings.scrollback}
                rightClickPaste={settings.rightClickPaste}
                copyOnSelect={settings.copyOnSelect}
                opacity={settings.opacity}
                backgroundImage={settings.backgroundImage}
                backgroundImageOpacity={settings.backgroundImageOpacity}
                copyShortcut={settings.copyShortcut}
                pasteShortcut={settings.pasteShortcut}
                clearShortcut={settings.clearShortcut}
              />
            )}
          </div>
        </div>

        {/* 文件管理器面板 - 渲染到 floatingPanelRootRef */}
        {session.type !== 'quick' && (
          <FileManagerPanel
            isOpen={isFileManagerOpen}
            onClose={() => setTabState(session.id, { isFileManagerOpen: false })}
            mountContainer={floatingPanelRootRef.current || undefined}
            anchorTop={toolbarHeight}
            serverId={String(session.serverId)}
            serverName={session.serverName || ''}
            host={session.host || ''}
            username={session.username || ''}
            isConnected={session.isConnected || false}
            sessionId={session.id}
            sessionLabel={session.serverName || 'Session'}
            currentPath={sftpSession.currentPath}
            files={sftpSession.files}
            onNavigate={sftpSession.navigate}
            onRefresh={sftpSession.refresh}
            onUpload={sftpSession.uploadFiles}
            onDownload={sftpSession.downloadFile}
            onDelete={sftpSession.deleteFile}
            onRename={sftpSession.renameFile}
            onCreateFolder={sftpSession.createFolder}
            onReadFile={sftpSession.readFile}
            onSaveFile={sftpSession.saveFile}
            onDisconnect={() => setTabState(session.id, { isFileManagerOpen: false })}
            transferTasks={sftpSession.transferTasks}
            onClearCompletedTransfers={sftpSession.clearCompletedTransfers}
          />
        )}

        {/* AI 助手面板 */}
        {session.type !== 'quick' && !effectiveIsLoading && (
          <AiAssistantPanel
            isOpen={isAiInputOpen}
            onClose={() => setTabState(session.id, { isAiInputOpen: false })}
          />
        )}
      </div>
    </MonitorWebSocketProvider>
  )
}
