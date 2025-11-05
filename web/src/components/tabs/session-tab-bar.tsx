"use client"

import { useEffect, useRef, useState } from "react"
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
          ? "bg-gradient-to-b from-zinc-100 to-zinc-200 border-zinc-300 shadow-lg shadow-zinc-200/50 dark:from-zinc-800/90 dark:to-zinc-900/90 dark:border-zinc-700/50 dark:shadow-black/20"
          : "bg-zinc-50 border-zinc-200 hover:bg-zinc-100 hover:border-zinc-300 opacity-75 hover:opacity-100 dark:bg-zinc-900/40 dark:border-zinc-800/30 dark:hover:bg-zinc-800/60 dark:hover:border-zinc-700/40",
        s.pinned && "ring-1 ring-blue-500/20",
        isDragging && "cursor-grabbing"
      )}
    >
      {/* 状态指示点 */}
      <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", statusColor)} />

      <span className={cn(
        "max-w-32 truncate text-xs font-medium transition-colors",
        active ? "text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-gray-400"
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
  const [menu, setMenu] = useState<MenuState>({ open: false, x: 0, y: 0 })
  const menuRef = useRef<HTMLDivElement>(null)

  // 客户端挂载状态（解决 DndContext 水合不匹配问题）
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // 溢出检测：判断页签是否超出容器
  const [isOverflowing, setIsOverflowing] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const tabsContainerRef = useRef<HTMLDivElement>(null)

  // 检测页签溢出
  useEffect(() => {
    const checkOverflow = () => {
      if (scrollContainerRef.current && tabsContainerRef.current) {
        const isOverflow = tabsContainerRef.current.scrollWidth > scrollContainerRef.current.clientWidth
        setIsOverflowing(isOverflow)
      }
    }

    checkOverflow()
    window.addEventListener('resize', checkOverflow)
    return () => window.removeEventListener('resize', checkOverflow)
  }, [sessions])

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

    const oldIndex = sessions.findIndex((s) => s.id === active.id)
    const newIndex = sessions.findIndex((s) => s.id === over.id)

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(sessions, oldIndex, newIndex).map((s) => s.id)
      onReorder(newOrder)
    }
  }

  // 拖拽开始处理
  const handleDragStart = (event: any) => {
    const session = sessions.find((s) => s.id === event.active.id)
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
                    <Link href="/dashboard">{config?.system_name || "EasySSH"} 控制台</Link>
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
      <div className={
        "w-full min-w-0 border-b transition-colors bg-gradient-to-b from-white to-zinc-50 border-zinc-200 dark:from-black/95 dark:to-black dark:border-white/5"
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
                          "ml-1 h-8 w-8 rounded-lg hover:text-green-400 transition-all duration-200 hover:scale-105 hover:bg-zinc-200 text-zinc-500 dark:hover:bg-zinc-800/60 dark:text-gray-500",
                        )}
                        onClick={onNewSession}
                        aria-label="新建会话"
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
                      "bg-gradient-to-b from-zinc-100 to-zinc-200 border-zinc-300 dark:from-zinc-800/90 dark:to-zinc-900/90 dark:border-zinc-700/50",
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
                      <span className="max-w-32 truncate text-xs font-medium text-zinc-900 dark:text-white">
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
                          ? "bg-gradient-to-b from-zinc-100 to-zinc-200 border-zinc-300 shadow-lg shadow-zinc-200/50 dark:from-zinc-800/90 dark:to-zinc-900/90 dark:border-zinc-700/50 dark:shadow-black/20"
                          : "bg-zinc-50 border-zinc-200 hover:bg-zinc-100 hover:border-zinc-300 opacity-75 hover:opacity-100 dark:bg-zinc-900/40 dark:border-zinc-800/30 dark:hover:bg-zinc-800/60 dark:hover:border-zinc-700/40",
                        s.pinned && "ring-1 ring-blue-500/20"
                      )}
                    >
                      {/* 状态指示点 */}
                      <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", statusColor)} />

                      <span className={cn(
                        "max-w-32 truncate text-xs font-medium transition-colors",
                        active ? "text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-gray-400"
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
                {/* 新建会话按钮：页签不溢出时显示 */}
                {!isOverflowing && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "ml-1 h-8 w-8 rounded-lg hover:text-green-400 transition-all duration-200 hover:scale-105 hover:bg-zinc-200 text-zinc-500 dark:hover:bg-zinc-800/60 dark:text-gray-500",
                    )}
                    onClick={onNewSession}
                    aria-label="新建会话"
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
                  "h-8 w-8 rounded-lg hover:text-green-400 transition-all duration-200 hover:scale-105 hover:bg-zinc-200 text-zinc-500 dark:hover:bg-zinc-800/60 dark:text-gray-500",
                )}
                onClick={onNewSession}
                aria-label="新建会话"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}

          {onOpenSettings && (
            <div className={"flex items-center gap-1 px-2 border-l border-zinc-200 dark:border-white/5"}>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-lg hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900 dark:hover:bg-zinc-800/60 dark:text-gray-400 dark:hover:text-white",
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
            "fixed z-50 min-w-48 rounded-lg border p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-200 border-zinc-200 bg-gradient-to-b from-white to-zinc-50 text-zinc-900 shadow-zinc-300/50 dark:border-zinc-800/50 dark:from-zinc-900 dark:to-black dark:text-white dark:shadow-black/50",
          )}
          style={{ left: menu.x, top: menu.y }}
        >
          <div className={cn(
            "text-[10px] px-3 py-1.5 uppercase font-semibold tracking-wider text-zinc-600 dark:text-zinc-500",
          )}>页签操作</div>
          <div className={cn(
            "h-px bg-gradient-to-r from-transparent to-transparent my-1 via-zinc-300 dark:via-zinc-800",
          )} />

          <button
            className={cn(
              "w-full text-left text-sm px-3 py-2 rounded-md transition-colors flex items-center gap-2 group hover:bg-zinc-200 dark:hover:bg-zinc-800/60",
            )}
            onClick={() => { menu.targetId && onDuplicateSession(menu.targetId); setMenu(m => ({ ...m, open: false })) }}
          >
            <span className={cn(
              "transition-colors text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-white",
            )}>复制会话</span>
          </button>

          <button
            className={cn(
              "w-full text-left text-sm px-3 py-2 rounded-md transition-colors flex items-center gap-2 group hover:bg-zinc-200 dark:hover:bg-zinc-800/60",
            )}
            onClick={() => { menu.targetId && onCloseOthers(menu.targetId); setMenu(m => ({ ...m, open: false })) }}
          >
            <span className={cn(
              "transition-colors text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-white",
            )}>关闭其他</span>
          </button>

          <button
            className={cn(
              "w-full text-left text-sm px-3 py-2 rounded-md hover:bg-red-500/20 hover:text-red-400 transition-colors flex items-center gap-2 text-zinc-600 dark:text-zinc-400",
            )}
            onClick={() => { onCloseAll(); setMenu(m => ({ ...m, open: false })) }}
          >
            全部关闭
          </button>

          <div className={cn(
            "h-px bg-gradient-to-r from-transparent to-transparent my-1 via-zinc-300 dark:via-zinc-800",
          )} />

          <button
            className={cn(
              "w-full text-left text-sm px-3 py-2 rounded-md hover:bg-blue-500/20 hover:text-blue-400 transition-colors flex items-center gap-2 text-zinc-600 dark:text-zinc-400",
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
