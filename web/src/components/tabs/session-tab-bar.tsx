"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { TerminalSession } from "@/components/terminal/types"
import { Maximize2, Minimize2, Plus, Settings, X } from "lucide-react"
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
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers"
import { useSystemConfig } from "@/contexts/system-config-context"
import { useTranslations } from "next-intl"

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
  onToggleFullscreen?: () => void
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

// 可排序的页签子组件
interface SortableTabProps {
  session: TerminalSession
  isActive: boolean
  onChangeActive: (id: string) => void
  onCloseSession: (id: string) => void
  onContextMenu: (e: React.MouseEvent, id: string) => void
  onAuxClick: (e: React.MouseEvent, id: string, pinned?: boolean) => void
  onDoubleClick: (id: string) => void
}

function SortableTab({
  session: s,
  isActive: active,
  onChangeActive,
  onCloseSession,
  onContextMenu,
  onAuxClick,
  onDoubleClick,
}: SortableTabProps) {
  const tTerminal = useTranslations("terminal")
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: s.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const statusColor =
    s.status === "connected"
      ? "bg-green-500"
      : s.status === "reconnecting"
      ? "bg-yellow-500 animate-pulse"
      : "bg-red-500"

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="button"
      onClick={() => onChangeActive(s.id)}
      onContextMenu={(e) => onContextMenu(e, s.id)}
      onAuxClick={(e) => onAuxClick(e, s.id, s.pinned)}
      onDoubleClick={() => onDoubleClick(s.id)}
      className={cn(
        "group relative flex items-center gap-2 h-8 pl-3 pr-8 transition-all duration-200 ease-out select-none rounded-lg border backdrop-blur-sm cursor-grab active:cursor-grabbing",
        active
          ? "border-border bg-card/90 text-foreground shadow-sm"
          : "border-border/50 bg-card/35 text-muted-foreground opacity-75 hover:border-border hover:bg-card/65 hover:text-foreground hover:opacity-100",
        s.pinned && "ring-1 ring-blue-500/20",
        isDragging && "cursor-grabbing"
      )}
    >
      {/* 状态指示点 */}
      <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", statusColor)} />

      <span className={cn(
        "max-w-32 truncate text-xs font-medium transition-colors",
        active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
      )}>
        {s.serverName}
      </span>

      {/* 固定图标 */}
      {s.pinned && (
        <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-blue-400" />
      )}

      {!s.pinned && (
        <button
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-red-500/20 hover:text-red-400 opacity-100 scale-100 pointer-events-auto transition-all duration-150 md:opacity-0 md:scale-90 md:pointer-events-none md:group-hover:opacity-100 md:group-hover:scale-100 md:group-hover:pointer-events-auto"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onCloseSession(s.id) }}
          aria-label={tTerminal("ariaCloseTab")}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
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
    hideBreadcrumb = false,
  } = props

  const { config } = useSystemConfig()
  const tTerminal = useTranslations("terminal")
  const [menu, setMenu] = useState<MenuState>({ open: false, x: 0, y: 0 })
  const menuRef = useRef<HTMLDivElement>(null)

  // 客户端挂载状态（解决 DndContext 水合不匹配问题）
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    // 延迟到空闲时初始化 DnD，避免阻塞主线程
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      requestIdleCallback(() => setIsMounted(true))
    } else {
      // 降级方案：使用 setTimeout
      setTimeout(() => setIsMounted(true), 0)
    }
  }, [])

  // 溢出检测：判断页签是否超出容器
  const [isOverflowing, setIsOverflowing] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const tabsContainerRef = useRef<HTMLDivElement>(null)

  // 检测页签溢出 - 优化版本
  const sessionCount = sessions.length
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null
    let rafId: number | null = null

    const checkOverflow = () => {
      // 使用 requestAnimationFrame 延迟 DOM 读取，避免强制重排
      if (rafId) cancelAnimationFrame(rafId)

      rafId = requestAnimationFrame(() => {
        if (scrollContainerRef.current && tabsContainerRef.current) {
          const isOverflow = tabsContainerRef.current.scrollWidth > scrollContainerRef.current.clientWidth
          setIsOverflowing(isOverflow)
        }
      })
    }

    // 节流函数：300ms 内最多执行一次
    const throttledCheck = () => {
      if (timeoutId) return // 如果已有待执行的检测，跳过

      timeoutId = setTimeout(() => {
        checkOverflow()
        timeoutId = null
      }, 300)
    }

    // 初始检测延迟到空闲时执行，避免阻塞主线程
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      requestIdleCallback(checkOverflow)
    } else {
      setTimeout(checkOverflow, 0)
    }

    // resize 事件使用节流
    window.addEventListener('resize', throttledCheck)

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('resize', throttledCheck)
    }
  }, [sessionCount]) // 只依赖 session 数量，不依赖整个数组

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

  // 使用 @dnd-kit 配置拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 移动8px后才激活拖拽，避免与点击事件冲突
      },
    })
  )

  // 拖拽活动状态
  const [draggedSession, setDraggedSession] = useState<TerminalSession | null>(null)

  // 拖拽结束处理
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setDraggedSession(null)

    if (!over || active.id === over.id) return

    const oldIndex = sessions.findIndex((s) => s.id === String(active.id))
    const newIndex = sessions.findIndex((s) => s.id === String(over.id))

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(sessions, oldIndex, newIndex).map((s) => s.id)
      onReorder(newOrder)
    }
  }

  // 拖拽开始处理
  const handleDragStart = (event: { active: { id: string | number } }) => {
    const session = sessions.find((s) => s.id === String(event.active.id))
    if (session) {
      setDraggedSession(session)
    }
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
  const fullscreenButtonLabel = isFullscreen
    ? tTerminal("titleExitFullscreen")
    : tTerminal("titleEnterFullscreen")

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
                    <Link href="/dashboard">
                      {config?.system_name || "EasySSH"}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {activeSession && (
                  <>
                    <BreadcrumbSeparator className="hidden md:block" />
                    {activeSession.type === "config" ? (
                      <BreadcrumbItem>
                        <BreadcrumbPage>{activeSession.serverName}</BreadcrumbPage>
                      </BreadcrumbItem>
                    ) : (
                      <>
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
      <div className={
        "w-full min-w-0 border-b border-border/60 bg-background/65 text-foreground backdrop-blur-md transition-colors"
      }>
        <div className="flex items-center h-10 gap-0 px-2 min-w-0 overflow-hidden">
          {/* Tabs 容器 */}
          <div ref={scrollContainerRef} className="flex-1 min-w-0 h-10 overflow-x-auto overflow-y-hidden scrollbar-custom pb-1">
            {isMounted ? (
              // 客户端渲染：带拖动功能
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                modifiers={[restrictToHorizontalAxis]}
              >
                <SortableContext
                  items={sessions.map((s) => s.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  <div ref={tabsContainerRef} className="flex items-center gap-1 min-h-0 pt-1 w-max">
                    {sessions.map((s) => (
                      <SortableTab
                        key={s.id}
                        session={s}
                        isActive={s.id === activeId}
                        onChangeActive={onChangeActive}
                        onCloseSession={onCloseSession}
                        onContextMenu={onContextMenu}
                        onAuxClick={onAuxClick}
                        onDoubleClick={onDoubleClick}
                      />
                    ))}
                    {/* 新建会话按钮：页签不溢出时显示 */}
                    {!isOverflowing && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "ml-1 h-8 w-8 rounded-lg text-muted-foreground transition-all duration-200 hover:scale-105 hover:bg-accent/70 hover:text-accent-foreground",
                        )}
                        onClick={onNewSession}
                        aria-label={tTerminal("ariaNewSession")}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </SortableContext>

                {/* 拖动预览层 */}
                <DragOverlay>
                  {draggedSession ? (
                    <div className={cn(
                      "group relative flex items-center gap-2 h-8 pl-3 pr-8 transition-all duration-200 ease-out select-none rounded-lg border backdrop-blur-sm shadow-2xl",
                      "border-border bg-card/90 text-foreground",
                      draggedSession.pinned && "ring-1 ring-blue-500/20"
                    )}>
                      {/* 状态指示点 */}
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full flex-shrink-0",
                        draggedSession.status === "connected"
                          ? "bg-green-500"
                          : draggedSession.status === "reconnecting"
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      )} />
                      <span className="max-w-32 truncate text-xs font-medium text-foreground">
                        {draggedSession.serverName}
                      </span>
                      {draggedSession.pinned && (
                        <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-blue-400" />
                      )}
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            ) : (
              // 服务端渲染：静态页签（无拖动功能）
              <div ref={tabsContainerRef} className="flex items-center gap-1 min-h-0 pt-1 w-max">
                {sessions.map((s) => {
                  const active = s.id === activeId
                  const statusColor =
                    s.status === "connected"
                      ? "bg-green-500"
                      : s.status === "reconnecting"
                      ? "bg-yellow-500 animate-pulse"
                      : "bg-red-500"

                  return (
                    <div
                      key={s.id}
                      role="button"
                      onClick={() => onChangeActive(s.id)}
                      onContextMenu={(e) => onContextMenu(e, s.id)}
                      onAuxClick={(e) => onAuxClick(e, s.id, s.pinned)}
                      onDoubleClick={() => onDoubleClick(s.id)}
                      className={cn(
                        "group relative flex items-center gap-2 h-8 pl-3 pr-8 transition-all duration-200 ease-out select-none rounded-lg border backdrop-blur-sm",
                        active
                          ? "border-border bg-card/90 text-foreground shadow-sm"
                          : "border-border/50 bg-card/35 text-muted-foreground opacity-75 hover:border-border hover:bg-card/65 hover:text-foreground hover:opacity-100",
                        s.pinned && "ring-1 ring-blue-500/20"
                      )}
                    >
                      {/* 状态指示点 */}
                      <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", statusColor)} />

                      <span className={cn(
                        "max-w-32 truncate text-xs font-medium transition-colors",
                        active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                      )}>
                        {s.serverName}
                      </span>

                      {/* 固定图标 */}
                      {s.pinned && (
                        <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-blue-400" />
                      )}

                      {!s.pinned && (
                        <button
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-red-500/20 hover:text-red-400 opacity-100 scale-100 pointer-events-auto transition-all duration-150 md:opacity-0 md:scale-90 md:pointer-events-none md:group-hover:opacity-100 md:group-hover:scale-100 md:group-hover:pointer-events-auto"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); onCloseSession(s.id) }}
                          aria-label={tTerminal("ariaCloseTab")}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )
                })}
                {/* 新建会话按钮：页签不溢出时显示 */}
                {!isOverflowing && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "ml-1 h-8 w-8 rounded-lg text-muted-foreground transition-all duration-200 hover:scale-105 hover:bg-accent/70 hover:text-accent-foreground",
                    )}
                    onClick={onNewSession}
                    aria-label={tTerminal("ariaNewSession")}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* 新建会话按钮：页签溢出时固定显示 */}
          {isOverflowing && (
            <div className="flex items-center gap-1 px-2 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-lg text-muted-foreground transition-all duration-200 hover:scale-105 hover:bg-accent/70 hover:text-accent-foreground",
                )}
                onClick={onNewSession}
                aria-label={tTerminal("ariaNewSession")}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}

          {(onOpenSettings || onToggleFullscreen) && (
            <div className="flex items-center gap-1 border-l border-border/60 px-2">
              {onOpenSettings && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-8 w-8 rounded-lg text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground",
                  )}
                  onClick={onOpenSettings}
                  aria-label={tTerminal("ariaSettings")}
                  title={tTerminal("titleSettings")}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}

              {onToggleFullscreen && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-8 w-8 rounded-lg text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground",
                  )}
                  onClick={onToggleFullscreen}
                  aria-label={fullscreenButtonLabel}
                  title={fullscreenButtonLabel}
                >
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 右键菜单（现代化设计） */}
      {menu.open && (
        <div
          ref={menuRef}
          className={cn(
            "fixed z-50 min-w-48 rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-200",
          )}
          style={{ left: menu.x, top: menu.y }}
        >
          <div className={cn(
            "px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
          )}>{tTerminal("tabMenuTitle")}</div>
          <div className={cn(
            "my-1 h-px bg-gradient-to-r from-transparent via-border to-transparent",
          )} />

          <button
            className={cn(
              "group flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
            )}
            onClick={() => {
              if (menu.targetId) onDuplicateSession(menu.targetId)
              setMenu(m => ({ ...m, open: false }))
            }}
          >
            <span className={cn(
              "text-muted-foreground transition-colors group-hover:text-accent-foreground",
            )}>{tTerminal("tabMenuDuplicate")}</span>
          </button>

          <button
            className={cn(
              "group flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
            )}
            onClick={() => {
              if (menu.targetId) onCloseOthers(menu.targetId)
              setMenu(m => ({ ...m, open: false }))
            }}
          >
            <span className={cn(
              "text-muted-foreground transition-colors group-hover:text-accent-foreground",
            )}>{tTerminal("tabMenuCloseOthers")}</span>
          </button>

          <button
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive",
            )}
            onClick={() => { onCloseAll(); setMenu(m => ({ ...m, open: false })) }}
          >
            {tTerminal("tabMenuCloseAll")}
          </button>

          <div className={cn(
            "my-1 h-px bg-gradient-to-r from-transparent via-border to-transparent",
          )} />

          <button
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-primary/15 hover:text-primary",
            )}
            onClick={() => {
              if (menu.targetId) onTogglePin(menu.targetId)
              setMenu(m => ({ ...m, open: false }))
            }}
          >
            {tTerminal("tabMenuTogglePin")}
          </button>
        </div>
      )}
    </>
  )
}
