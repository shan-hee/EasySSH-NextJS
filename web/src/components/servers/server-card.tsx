"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Server,
  MoreHorizontal,
  Terminal,
  Eye,
  Edit,
  Trash2,
} from "lucide-react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { DraggableServerCard } from './draggable-server-card'

interface ServerData {
  id: number
  name: string
  host: string
  port: number
  username: string
  status: 'online' | 'offline' | 'warning'
  os: string
  cpu: string
  memory: string
  disk: string
  lastConnected: string
  uptime: string
  tags: string[]
}

interface ServerCardProps {
  server: ServerData
  onConnect?: (serverId: number) => void
  onEdit?: (serverId: number) => void
  onDelete?: (serverId: number) => void
  onViewDetails?: (serverId: number) => void
}

export function ServerCard({
  server,
  onConnect,
  onEdit,
  onDelete,
  onViewDetails
}: ServerCardProps) {
  const getStatusDot = () => {
    switch (server.status) {
      case 'online':
        return <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 animate-pulse" />
      case 'offline':
        return <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-600 flex-shrink-0" />
      case 'warning':
        return <div className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />
      default:
        return <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-600 flex-shrink-0" />
    }
  }

  const getStatusText = () => {
    switch (server.status) {
      case 'online':
        return <span className="text-xs text-green-600 dark:text-green-400">在线</span>
      case 'offline':
        return <span className="text-xs text-zinc-500 dark:text-zinc-600">离线</span>
      case 'warning':
        return <span className="text-xs text-yellow-600 dark:text-yellow-400">警告</span>
      default:
        return <span className="text-xs text-zinc-500 dark:text-zinc-600">未知</span>
    }
  }

  return (
    <div
      className={
        "group relative rounded-lg border p-4 transition-all duration-200 " +
        "bg-gradient-to-b from-zinc-50 to-white border-zinc-200 " +
        "hover:border-zinc-300 hover:shadow-md " +
        "dark:from-zinc-900/40 dark:to-zinc-900/20 dark:border-zinc-800/30 " +
        "dark:hover:border-zinc-700/40 dark:hover:shadow-lg " +
        (server.status === 'offline' ? "opacity-75" : "")
      }
    >
      {/* 头部 */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {getStatusDot()}
          <div className="flex-1 min-w-0">
            <h3 className={
              "text-base font-semibold truncate transition-colors " +
              "text-zinc-900 dark:text-white " +
              (server.status === 'online' ? "group-hover:text-green-600 dark:group-hover:text-green-400" : "")
            }>
              {server.name}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              {getStatusText()}
              {server.tags && server.tags.length > 0 && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-600 truncate">
                    {server.tags[0]}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>操作</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onConnect?.(server.id)}
              disabled={server.status === 'offline'}
            >
              <Terminal className="mr-2 h-4 w-4" />
              连接终端
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewDetails?.(server.id)}>
              <Eye className="mr-2 h-4 w-4" />
              查看详情
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit?.(server.id)}>
              <Edit className="mr-2 h-4 w-4" />
              编辑配置
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete?.(server.id)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              删除服务器
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 连接信息 */}
      <div className="space-y-2 mb-4">
        <div className="text-xs font-mono text-zinc-600 dark:text-zinc-500 truncate">
          {server.username}@{server.host}:{server.port}
        </div>

        {(server.os || server.uptime) && (
          <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-600">
            {server.os && <span>{server.os}</span>}
            {server.os && server.uptime && <span>•</span>}
            {server.uptime && <span>运行 {server.uptime}</span>}
          </div>
        )}
      </div>

      {/* 标签 */}
      {server.tags && server.tags.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {server.tags.slice(1).map((tag, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="text-xs px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800/50"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <Button
          size="sm"
          className={
            "flex-1 transition-all " +
            (server.status === 'online'
              ? "bg-green-600 hover:bg-green-700 text-white"
              : "")
          }
          disabled={server.status === 'offline'}
          onClick={() => onConnect?.(server.id)}
        >
          <Terminal className="mr-1.5 h-3.5 w-3.5" />
          连接
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => onViewDetails?.(server.id)}
        >
          <Eye className="mr-1.5 h-3.5 w-3.5" />
          详情
        </Button>
      </div>
    </div>
  )
}

// 服务器列表组件
interface ServerListProps {
  servers: ServerData[]
  onConnect?: (serverId: number) => void
  onEdit?: (serverId: number) => void
  onDelete?: (serverId: number) => void
  onViewDetails?: (serverId: number) => void
  onReorder?: (newOrder: ServerData[]) => void
  viewMode?: 'grid' | 'list'
}

export function ServerList({
  servers,
  onConnect,
  onEdit,
  onDelete,
  onViewDetails,
  onReorder,
  viewMode = 'grid'
}: ServerListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = servers.findIndex((server) => server.id === active.id)
      const newIndex = servers.findIndex((server) => server.id === over.id)

      const newOrder = arrayMove(servers, oldIndex, newIndex)
      onReorder?.(newOrder)
    }
  }

  if (servers.length === 0) {
    return null  // 空状态在父组件处理
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={servers.map(s => s.id)}
        strategy={rectSortingStrategy}
      >
        <div
          className={`
            grid gap-4 transition-all duration-300
            ${viewMode === 'grid'
              ? 'md:grid-cols-2 lg:grid-cols-3'
              : 'grid-cols-1'
            }
          `}
        >
          {servers.map((server) => (
            <DraggableServerCard
              key={server.id}
              server={server}
              onConnect={onConnect}
              onEdit={onEdit}
              onDelete={onDelete}
              onViewDetails={onViewDetails}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}