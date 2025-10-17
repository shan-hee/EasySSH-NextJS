"use client"

import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { TerminalSession } from "@/components/terminal/types"
import { Plus, Settings, X } from "lucide-react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

interface SessionTabBarProps {
  sessions: TerminalSession[]
  activeId: string
  onChangeActive: (id: string) => void
  onNewSession: () => void
  onCloseSession: (id: string) => void
  onDuplicateSession: (id: string) => void
  onCloseOthers: (id: string) => void
  onCloseAll: () => void
  onTogglePin: (id: string) => void
  onReorder: (newOrderIds: string[]) => void
  isFullscreen: boolean
  onToggleFullscreen: () => void
  onOpenSettings?: () => void
  hideBreadcrumb?: boolean
}

type MenuState = {
  open: boolean
  x: number
  y: number
  targetId?: string
}

// 标签色彩算法暂不需要，后续如需按分组着色可恢复

export function SessionTabBar(props: SessionTabBarProps) {
  const {
    sessions,
    activeId,
    onChangeActive,
    onNewSession,
    onCloseSession,
    onDuplicateSession,
    onCloseOthers,
    onCloseAll,
    onTogglePin,
    onReorder,
    isFullscreen,
    onToggleFullscreen,
    onOpenSettings,
    hideBreadcrumb = false,
  } = props

  const [menu, setMenu] = useState<MenuState>({ open: false, x: 0, y: 0 })
  const menuRef = useRef<HTMLDivElement>(null)

  // 获取应用主题
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // 确保只在客户端渲染时应用主题
  useEffect(() => {
    setMounted(true)
  }, [])

  // 初始从 html.dark 读取，挂载后使用 resolvedTheme，避免浅色初始黑屏
  const initialIsDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  const isDark = mounted ? resolvedTheme === 'dark' : initialIsDark

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu(m => ({ ...m, open: false }))
      }
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(m => ({ ...m, open: false }))
    }
    document.addEventListener("mousedown", onDocClick)
    document.addEventListener("keydown", onEsc)
    return () => {
      document.removeEventListener("mousedown", onDocClick)
      document.removeEventListener("keydown", onEsc)
    }
  }, [])

  const onContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    setMenu({ open: true, x: e.clientX, y: e.clientY, targetId: id })
  }

  // 拖拽排序
  const dragIdRef = useRef<string | null>(null)
  const onDragStart = (e: React.DragEvent, id: string) => {
    dragIdRef.current = id
    e.dataTransfer.effectAllowed = "move"
  }
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }
  const onDrop = (e: React.DragEvent, dropId: string) => {
    e.preventDefault()
    const dragId = dragIdRef.current
    if (!dragId || dragId === dropId) return
    const order = sessions.map(s => s.id)
    const from = order.indexOf(dragId)
    const to = order.indexOf(dropId)
    if (from === -1 || to === -1) return
    order.splice(to, 0, order.splice(from, 1)[0])
    dragIdRef.current = null
    onReorder(order)
  }

  // 去除状态图标，使用激活标签文字颜色表示状态

  const onAuxClick = (e: React.MouseEvent, id: string, pinned?: boolean) => {
    // 中键关闭
    if (e.button === 1 && !pinned) {
      e.preventDefault()
      onCloseSession(id)
    }
  }

  const onDoubleClick = (id: string) => onTogglePin(id)

  const activeSession = sessions.find(s => s.id === activeId)

  return (
    <>
      {/* 面包屑导航（可隐藏） */}
      {!hideBreadcrumb && (
        <header className="flex h-16 shrink-0 items-center gap-2 border-b transition-none">
          <div className="flex items-center gap-2 px-4 flex-1">
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
                {activeSession && activeSession.type !== 'quick' && (
                  <>
                    <BreadcrumbSeparator className="hidden md:block" />
                    {activeSession.group && (
                      <>
                        <BreadcrumbItem className="hidden md:block">
                          <BreadcrumbPage>{activeSession.group}</BreadcrumbPage>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator className="hidden md:block" />
                      </>
                    )}
                    <BreadcrumbItem>
                      <BreadcrumbPage>{activeSession.serverName}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>
            {/* 标签显示 */}
            {activeSession?.tags && activeSession.tags.length > 0 && (
              <div className="flex items-center gap-1 ml-4">
                {activeSession.tags.slice(0, 3).map((tag, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </header>
      )}

      {/* 页签栏（现代化设计） */}
      <div className={`w-full border-b transition-colors ${
        isDark
          ? 'bg-gradient-to-b from-black/95 to-black border-white/5'
          : 'bg-gradient-to-b from-white to-zinc-50 border-zinc-200'
      }`}>
        <div className="flex items-center h-10 gap-0 px-2">
          {/* Tabs 容器 */}
          <div className="flex-1 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-1 min-h-0 py-1">
            {sessions.map((s, idx) => {
              const active = s.id === activeId
              const statusColor =
                s.status === "connected"
                  ? "bg-green-500"
                  : s.status === "reconnecting"
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-red-500"
              const statusClass =
                s.status === "connected"
                  ? "text-green-400"
                  : s.status === "reconnecting"
                  ? "text-yellow-400"
                  : "text-red-400"
              return (
                      <div key={s.id}
                        role="button"
                        draggable
                        onDragStart={(e) => onDragStart(e, s.id)}
                        onDragOver={onDragOver}
                        onDrop={(e) => onDrop(e, s.id)}
                        onClick={() => onChangeActive(s.id)}
                        onContextMenu={(e) => onContextMenu(e, s.id)}
                        onAuxClick={(e) => onAuxClick(e, s.id, s.pinned)}
                        onDoubleClick={() => onDoubleClick(s.id)}
                        className={cn(
                          "group relative flex items-center gap-2 h-8 pl-3 pr-8 transition-all duration-200 ease-out select-none rounded-lg border backdrop-blur-sm",
                          active
                            ? isDark
                              ? "bg-gradient-to-b from-zinc-800/90 to-zinc-900/90 border-zinc-700/50 shadow-lg shadow-black/20"
                              : "bg-gradient-to-b from-zinc-100 to-zinc-200 border-zinc-300 shadow-lg shadow-zinc-200/50"
                            : isDark
                              ? "bg-zinc-900/40 border-zinc-800/30 hover:bg-zinc-800/60 hover:border-zinc-700/40 opacity-75 hover:opacity-100"
                              : "bg-zinc-50 border-zinc-200 hover:bg-zinc-100 hover:border-zinc-300 opacity-75 hover:opacity-100",
                          s.pinned && "ring-1 ring-blue-500/20"
                        )}
                        
                      >
                        {/* 状态指示点 */}
                        <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", statusColor)} />

                        <span className={cn(
                          "max-w-32 truncate text-xs font-medium transition-colors",
                          active
                            ? isDark ? "text-white" : "text-zinc-900"
                            : isDark ? "text-gray-400" : "text-zinc-600"
                        )}>
                          {s.serverName}
                        </span>

                        

                        {/* 固定图标 */}
                        {s.pinned && (
                          <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-blue-400" />
                        )}

                        {!s.pinned && (
                          <button
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-red-500/20 hover:text-red-400 opacity-0 scale-90 pointer-events-none transition-all duration-150 group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto"
                            onClick={(e) => { e.stopPropagation(); onCloseSession(s.id) }}
                            aria-label="关闭"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
              )
            })}
            {/* 新建会话按钮：放在标签之后 */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "ml-1 h-8 w-8 rounded-lg hover:text-green-400 transition-all duration-200 hover:scale-105",
                isDark
                  ? "hover:bg-zinc-800/60 text-gray-500"
                  : "hover:bg-zinc-200 text-zinc-500"
              )}
              onClick={onNewSession}
              aria-label="新建会话"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

          {onOpenSettings && (
            <div className={`flex items-center gap-1 px-2 border-l ${
              isDark ? 'border-white/5' : 'border-zinc-200'
            }`}>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-lg",
                  isDark
                    ? "hover:bg-zinc-800/60 text-gray-400 hover:text-white"
                    : "hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900"
                )}
                onClick={onOpenSettings}
                aria-label="设置"
                title="设置"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 右键菜单（现代化设计） */}
      {menu.open && (
        <div
          ref={menuRef}
          className={cn(
            "fixed z-50 min-w-48 rounded-lg border p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-200",
            isDark
              ? "border-zinc-800/50 bg-gradient-to-b from-zinc-900 to-black text-white shadow-black/50"
              : "border-zinc-200 bg-gradient-to-b from-white to-zinc-50 text-zinc-900 shadow-zinc-300/50"
          )}
          style={{ left: menu.x, top: menu.y }}
        >
          <div className={cn(
            "text-[10px] px-3 py-1.5 uppercase font-semibold tracking-wider",
            isDark ? "text-zinc-500" : "text-zinc-600"
          )}>页签操作</div>
          <div className={cn(
            "h-px bg-gradient-to-r from-transparent to-transparent my-1",
            isDark ? "via-zinc-800" : "via-zinc-300"
          )} />

          <button
            className={cn(
              "w-full text-left text-sm px-3 py-2 rounded-md transition-colors flex items-center gap-2 group",
              isDark ? "hover:bg-zinc-800/60" : "hover:bg-zinc-200"
            )}
            onClick={() => { menu.targetId && onDuplicateSession(menu.targetId); setMenu(m => ({ ...m, open: false })) }}
          >
            <span className={cn(
              "transition-colors",
              isDark
                ? "text-zinc-400 group-hover:text-white"
                : "text-zinc-600 group-hover:text-zinc-900"
            )}>复制会话</span>
          </button>

          <button
            className={cn(
              "w-full text-left text-sm px-3 py-2 rounded-md transition-colors flex items-center gap-2 group",
              isDark ? "hover:bg-zinc-800/60" : "hover:bg-zinc-200"
            )}
            onClick={() => { menu.targetId && onCloseOthers(menu.targetId); setMenu(m => ({ ...m, open: false })) }}
          >
            <span className={cn(
              "transition-colors",
              isDark
                ? "text-zinc-400 group-hover:text-white"
                : "text-zinc-600 group-hover:text-zinc-900"
            )}>关闭其他</span>
          </button>

          <button
            className={cn(
              "w-full text-left text-sm px-3 py-2 rounded-md hover:bg-red-500/20 hover:text-red-400 transition-colors flex items-center gap-2",
              isDark ? "text-zinc-400" : "text-zinc-600"
            )}
            onClick={() => { onCloseAll(); setMenu(m => ({ ...m, open: false })) }}
          >
            全部关闭
          </button>

          <div className={cn(
            "h-px bg-gradient-to-r from-transparent to-transparent my-1",
            isDark ? "via-zinc-800" : "via-zinc-300"
          )} />

          <button
            className={cn(
              "w-full text-left text-sm px-3 py-2 rounded-md hover:bg-blue-500/20 hover:text-blue-400 transition-colors flex items-center gap-2",
              isDark ? "text-zinc-400" : "text-zinc-600"
            )}
            onClick={() => { menu.targetId && onTogglePin(menu.targetId); setMenu(m => ({ ...m, open: false })) }}
          >
            固定/取消固定
          </button>
        </div>
      )}
    </>
  )
}
