"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { X, GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import { SftpManager } from "@/components/sftp/sftp-manager"

interface FileManagerPanelProps {
  isOpen: boolean
  onClose: () => void
  // SFTP Manager props
  serverId: number
  serverName: string
  host: string
  username: string
  isConnected: boolean
  currentPath: string
  files: any[]
  sessionId: string
  sessionLabel: string
  onNavigate: (path: string) => void
  onUpload: (files: FileList) => void
  onDownload: (fileName: string) => void
  onDelete: (fileName: string) => void
  onCreateFolder: (name: string) => void
  onCreateFile?: (name: string) => void
  onRename: (oldName: string, newName: string) => void
  onDisconnect: () => void
  onRefresh: () => void
  onReadFile?: (fileName: string) => Promise<string>
  onSaveFile?: (fileName: string, content: string) => Promise<void>
  // 将文件管理器渲染到指定容器（例如终端内部），而非整个页面
  mountContainer?: HTMLElement | null
  // 面板顶部锚点（用于位于工具栏下方）
  anchorTop?: number
}

export function FileManagerPanel({
  isOpen,
  onClose,
  mountContainer,
  anchorTop,
  ...sftpProps
}: FileManagerPanelProps) {
  const [width, setWidth] = useState(600) // 默认宽度
  const [isResizing, setIsResizing] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)
  const internalContainer = mountContainer || null
  const topOffset = anchorTop ?? 0

  // 处理客户端挂载
  useEffect(() => {
    setIsMounted(true)

    // 从 localStorage 恢复宽度
    const savedWidth = localStorage.getItem('file-manager-panel-width')
    if (savedWidth) {
      setWidth(parseInt(savedWidth, 10))
    }
  }, [])

  // 保存宽度到 localStorage
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('file-manager-panel-width', width.toString())
    }
  }, [width, isMounted])

  // 快捷键支持 (Ctrl/Cmd + E)
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault()
        onClose()
      }
      // Esc 关闭
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // 调整大小处理
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    resizeStartX.current = e.clientX
    resizeStartWidth.current = width
  }, [width])

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return

    const deltaX = resizeStartX.current - e.clientX
    const newWidth = Math.min(
      Math.max(400, resizeStartWidth.current + deltaX),
      window.innerWidth - 100
    )
    setWidth(newWidth)
  }, [isResizing])

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
  }, [])

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove)
      window.addEventListener('mouseup', handleResizeEnd)
      return () => {
        window.removeEventListener('mousemove', handleResizeMove)
        window.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [isResizing, handleResizeMove, handleResizeEnd])

  // 响应式检测（仅在挂载到 body 时使用遮罩）；内部挂载一律悬浮且无遮罩
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    if (!internalContainer) {
      const checkMobile = () => {
        setIsMobile(window.innerWidth < 768)
      }
      checkMobile()
      window.addEventListener('resize', checkMobile)
      return () => window.removeEventListener('resize', checkMobile)
    }
  }, [internalContainer])

  if (!isMounted) return null

  const panelContent = (
    <>
      {/* 面板 */}
      <div
        className={cn(
          // 如果挂载到内部容器，则使用 absolute 并且位于工具栏下方
          internalContainer
            ? "absolute right-0 z-[55] flex transition-transform duration-300 ease-out pointer-events-auto"
            : "fixed top-0 right-0 h-full z-[999] flex transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
        style={{
          width: `${width}px`,
          top: internalContainer ? `${topOffset}px` : 0,
          height: internalContainer ? `calc(100% - ${topOffset}px)` : '100%',
        }}
      >
        {/* 调整大小手柄 - 仅桌面端，左侧圆角 */}
        {(!isMobile || internalContainer) && (
          <div
            className={cn(
              "w-1 cursor-col-resize group hover:bg-blue-500/50 transition-colors relative flex items-center justify-center bg-transparent rounded-l-xl",
              isResizing && "bg-blue-500/50"
            )}
            onMouseDown={handleResizeStart}
          >
            <div
              className={cn(
                "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-zinc-300 dark:bg-zinc-700 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity",
                isResizing && "opacity-100"
              )}
            >
              <GripVertical className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
            </div>
          </div>
        )}

        {/* 主面板内容 */}
        <div className={cn(
          "flex-1 flex flex-col bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl",
          !isMobile && "rounded-l-xl" // 桌面端添加左侧圆角
        )}>
          {/* SFTP 管理器内容 - 直接显示，无顶部工具栏 */}
          <div className="flex-1 overflow-hidden">
            {sftpProps.isConnected ? (
              <SftpManager
                {...sftpProps}
                isFullscreen={false}
                pageContext="terminal"
                onDisconnect={onClose}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="h-16 w-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                    <X className="h-8 w-8 text-zinc-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-zinc-800 dark:text-zinc-200">
                    未连接
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    等待连接到服务器...
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )

  // 如果提供了内部挂载容器，则挂载到该容器内（终端内部悬浮，位于工具栏下方）
  if (internalContainer) {
    return createPortal(panelContent, internalContainer)
  }
  // 否则回退到页面级（保持兼容）
  return createPortal(panelContent, document.body)
}
