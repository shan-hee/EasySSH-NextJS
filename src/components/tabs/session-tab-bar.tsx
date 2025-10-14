"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { TerminalSession } from "@/components/terminal/types"
import { Plus, Maximize2, Minimize2, Settings, X } from "lucide-react"

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
}

type MenuState = {
  open: boolean
  x: number
  y: number
  targetId?: string
}

const getColorForKey = (key?: string) => {
  if (!key) return "#6b7280" // slate-500 兜底
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i)
    hash |= 0
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 70% 45%)`
}

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

  const renderStatus = (status: TerminalSession["status"]) => {
    switch (status) {
      case "connected":
        return "🟢"
      case "reconnecting":
        return "🟡"
      default:
        return "🔴"
    }
  }

  const onAuxClick = (e: React.MouseEvent, id: string, pinned?: boolean) => {
    // 中键关闭
    if (e.button === 1 && !pinned) {
      e.preventDefault()
      onCloseSession(id)
    }
  }

  const onDoubleClick = (id: string) => onTogglePin(id)

  return (
    <div className="w-full border-b bg-muted/40">
      <div className="flex items-center h-12 gap-2 px-2">
        {/* Tabs 容器 */}
        <div className="flex-1 overflow-x-auto">
          <div className="flex items-center gap-1 min-h-0">
            {sessions.map((s) => {
              const colorKey = s.group || s.tags?.[0]
              const color = getColorForKey(colorKey)
              const active = s.id === activeId
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
                          "group relative flex items-center gap-2 h-9 px-3 rounded-md border transition-colors select-none",
                          active ? "bg-background border-primary/40" : "bg-muted/60 border-transparent hover:bg-muted",
                          s.pinned ? "pr-2" : ""
                        )}
                        style={{
                          boxShadow: active ? "0 1px 0 0 var(--border) inset" : undefined,
                        }}
                        title={s.serverName}
                      >
                        <span className="inline-block w-1 h-4 rounded" style={{ backgroundColor: color }} />
                        <span className="text-base leading-none">{renderStatus(s.status)}</span>
                        <span className="max-w-40 truncate text-sm">
                          {s.serverName}
                        </span>
                        {!s.pinned && (
                          <button
                            className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); onCloseSession(s.id) }}
                            aria-label="关闭"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
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

        {/* 右侧动作区 */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNewSession}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleFullscreen}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onOpenSettings}>
            <Settings className="h-4 w-4" />
          </Button>
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
    </div>
  )
}

