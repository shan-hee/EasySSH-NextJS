"use client"

import { useEffect, useRef, useState } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { TerminalSession } from "@/components/terminal/types"
import { Plus, Maximize2, Minimize2, Settings, X } from "lucide-react"
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
                  <BreadcrumbLink asChild>
                    <Link href="/dashboard/terminal">终端管理</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {activeSession && (
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

      {/* 页签栏（与终端同色背景） */}
      <div className="w-full bg-black">
        <div className="flex items-center h-9 gap-0">
          {/* Tabs 容器 */}
          <div className="flex-1 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-0 min-h-0">
            {sessions.map((s, idx) => {
              const active = s.id === activeId
              const statusClass =
                s.status === "connected"
                  ? "text-status-connected"
                  : s.status === "reconnecting"
                  ? "text-status-warning"
                  : "text-status-danger"
              return (
                <TooltipProvider key={s.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
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
                          "group relative flex items-center gap-2 h-9 px-3 transition-colors select-none",
                          statusClass,
                          active ? "opacity-100" : "opacity-75 hover:opacity-100"
                        )}
                        title={s.serverName}
                      >
                        <span className="max-w-40 truncate text-sm">
                          {s.serverName}
                        </span>
                        {!s.pinned && (
                          <button
                            className="hover:bg-accent rounded-sm p-0.5"
                            onClick={(e) => { e.stopPropagation(); onCloseSession(s.id) }}
                            aria-label="关闭"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {idx < sessions.length - 1 && (
                          <span aria-hidden className="text-current select-none">|</span>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="start">
                      <div className="text-xs space-y-1">
                        <div className="font-medium">{s.serverName}</div>
                        <div className="text-muted-foreground">{s.username}@{s.host}{s.port ? `:${s.port}` : ""}</div>
                        <div>最后活动: {new Date(s.lastActivity).toLocaleString()}</div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            })}
          </div>
        </div>
      </div>
      </div>

      {/* 右键菜单 */}
      {menu.open && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-44 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          style={{ left: menu.x, top: menu.y }}
        >
          <div className="text-xs px-2 py-1.5 text-muted-foreground">页签操作</div>
          <button
            className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted"
            onClick={() => { menu.targetId && onDuplicateSession(menu.targetId); setMenu(m => ({ ...m, open: false })) }}
          >复制会话</button>
          <button
            className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted"
            onClick={() => { menu.targetId && onCloseOthers(menu.targetId); setMenu(m => ({ ...m, open: false })) }}
          >关闭其他</button>
          <button
            className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted"
            onClick={() => { onCloseAll(); setMenu(m => ({ ...m, open: false })) }}
          >全部关闭</button>
          <button
            className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted"
            onClick={() => { menu.targetId && onTogglePin(menu.targetId); setMenu(m => ({ ...m, open: false })) }}
          >固定/取消固定</button>
        </div>
      )}
    </>
  )
}
