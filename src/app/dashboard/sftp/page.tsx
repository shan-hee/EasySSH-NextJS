"use client"

import React, { useState, useEffect, useRef } from "react"
import { PageHeader } from "@/components/page-header"
import { SftpManager } from "@/components/sftp/sftp-manager"
import { FolderOpen, Server, Plus, ChevronDown, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useVirtualizer } from '@tanstack/react-virtual'
import { createPortal } from 'react-dom'

// 模拟服务器数据
const servers = [
  {
    id: 1,
    name: "Web Server 01",
    host: "192.168.1.100",
    status: "online" as const,
  },
  {
    id: 2,
    name: "Database Server",
    host: "192.168.1.101",
    status: "online" as const,
  },
  {
    id: 3,
    name: "Dev Server",
    host: "192.168.1.102",
    status: "offline" as const,
  },
]

// 模拟文件数据
const mockFiles = [
  {
    name: "..",
    type: "directory" as const,
    size: "-",
    modified: "2024-01-15 10:30",
    permissions: "drwxr-xr-x",
    owner: "root",
    group: "root",
  },
  {
    name: "var",
    type: "directory" as const,
    size: "-",
    modified: "2024-01-15 09:45",
    permissions: "drwxr-xr-x",
    owner: "root",
    group: "root",
  },
  {
    name: "etc",
    type: "directory" as const,
    size: "-",
    modified: "2024-01-14 16:20",
    permissions: "drwxr-xr-x",
    owner: "root",
    group: "root",
  },
  {
    name: "home",
    type: "directory" as const,
    size: "-",
    modified: "2024-01-13 14:30",
    permissions: "drwxr-xr-x",
    owner: "root",
    group: "root",
  },
  {
    name: "config.txt",
    type: "file" as const,
    size: "2.4 KB",
    modified: "2024-01-15 11:22",
    permissions: "-rw-r--r--",
    owner: "root",
    group: "root",
  },
  {
    name: "script.sh",
    type: "file" as const,
    size: "856 B",
    modified: "2024-01-14 15:45",
    permissions: "-rwxr-xr-x",
    owner: "root",
    group: "root",
  },
  {
    name: "data.json",
    type: "file" as const,
    size: "15.6 MB",
    modified: "2024-01-13 18:30",
    permissions: "-rw-r--r--",
    owner: "admin",
    group: "admin",
  },
  {
    name: "backup.tar.gz",
    type: "file" as const,
    size: "245.8 MB",
    modified: "2024-01-12 22:15",
    permissions: "-rw-r--r--",
    owner: "root",
    group: "root",
  },
]

// 定义连接会话接口
interface SftpSession {
  id: string
  serverId: number | null
  serverName: string
  host: string
  username: string
  currentPath: string
  files: typeof mockFiles
  isConnected: boolean
  label: string  // 会话自定义标签
  color?: string  // 会话标识颜色
}

// 跨会话剪贴板接口
interface ClipboardFile {
  fileName: string
  sessionId: string
  sessionLabel: string
  filePath: string
  fileType: "file" | "directory"
  operation: "copy" | "cut"
}

// 跨会话拖拽数据接口
interface CrossSessionDragData {
  sessionId: string
  fileName: string
  filePath: string
  fileType: 'file' | 'directory'
  sourceSessionId: string
}

// 轻量级工具栏预览组件（VSCode风格）- 使用 memo 避免重复渲染
interface DragPreviewToolbarProps {
  sessionLabel: string
  sessionColor?: string
  host: string
}

const DragPreviewToolbar = React.memo(({ sessionLabel, sessionColor, host }: DragPreviewToolbarProps) => {
  return (
    <div className="bg-card border rounded-lg shadow-2xl px-3 py-2 flex items-center gap-2 min-w-[200px] cursor-grabbing">
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      {sessionColor && (
        <div
          className="w-1 h-5 rounded-full"
          style={{ backgroundColor: sessionColor }}
        />
      )}
      <div className="flex flex-col">
        <span className="text-xs font-semibold text-foreground">{sessionLabel}</span>
        <span className="text-[10px] text-muted-foreground font-mono">{host}</span>
      </div>
    </div>
  )
})

// 可拖拽的会话项组件
interface SortableSessionProps {
  session: SftpSession
  children: React.ReactNode
  onCrossSessionDrop?: (targetSessionId: string, dragData: CrossSessionDragData) => void
}

const SortableSession = React.memo(({ session, children, onCrossSessionDrop }: SortableSessionProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: session.id })

  const [isDragOver, setIsDragOver] = React.useState(false)

  // 使用 useMemo 缓存样式对象
  const style = React.useMemo(() => ({
    transform: CSS.Transform.toString(transform),
    transition,
  }), [transform, transition])

  // 处理跨会话文件拖放
  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    // 检查是否是文件拖拽(不是会话拖拽)
    if (e.dataTransfer.types.includes('application/json')) {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(true)
    }
  }, [])

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    try {
      const jsonData = e.dataTransfer.getData('application/json')
      if (jsonData) {
        const dragData = JSON.parse(jsonData)
        // 跨会话拖拽
        if (dragData.sourceSessionId !== session.id && onCrossSessionDrop) {
          onCrossSessionDrop(session.id, dragData)
        }
      }
    } catch (error) {
      console.error('解析拖拽数据失败:', error)
    }
  }, [session.id, onCrossSessionDrop])

  // 使用 useMemo 缓存 cloneElement 结果
  const childrenWithDragHandle = React.useMemo(() =>
    React.cloneElement(children as React.ReactElement, {
      dragHandleListeners: listeners,
      dragHandleAttributes: attributes,
    }), [children, listeners, attributes])

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "min-h-0",
        // 拖拽时轻微降低透明度，不影响性能
        isDragging && "opacity-60",
        isDragOver && "ring-2 ring-blue-500 ring-offset-2"
      )}
      data-session-id={session.id}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {childrenWithDragHandle}
    </div>
  )
})

DragPreviewToolbar.displayName = "DragPreviewToolbar"
SortableSession.displayName = "SortableSession"

export default function SftpPage() {
  // 改用会话数组管理多个连接
  const [sessions, setSessions] = useState<SftpSession[]>([])
  const [nextSessionId, setNextSessionId] = useState(1)
  const [fullscreenSessionId, setFullscreenSessionId] = useState<string | null>(null)
  const [clipboard, setClipboard] = useState<ClipboardFile[]>([])
  const [activeId, setActiveId] = useState<string | null>(null) // 当前拖拽的会话ID
  const parentRef = useRef<HTMLDivElement>(null)

  // 会话标识颜色列表
  const sessionColors = [
    "#3B82F6", // blue
    "#10B981", // green
    "#F59E0B", // amber
    "#EF4444", // red
    "#8B5CF6", // violet
    "#EC4899", // pink
  ]

  // 配置拖拽传感器 - 最小化激活约束
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 更小的激活距离
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 处理拖拽开始 - 直接更新状态
  const handleDragStart = React.useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  // 处理拖拽结束 - 使用 useCallback 缓存
  const handleDragEnd = React.useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setSessions((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)

        return arrayMove(items, oldIndex, newIndex)
      })
    }

    // 清除拖拽状态
    setActiveId(null)
  }, [])

  // 使用 useMemo 缓存当前拖拽的会话信息，避免重复查找
  const activeSession = React.useMemo(
    () => activeId ? sessions.find(s => s.id === activeId) : null,
    [activeId, sessions]
  )

  // ESC键退出全屏
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fullscreenSessionId) {
        setFullscreenSessionId(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fullscreenSessionId])

  // 切换全屏模式
  const toggleFullscreen = (sessionId: string) => {
    if (fullscreenSessionId === sessionId) {
      setFullscreenSessionId(null)
    } else {
      setFullscreenSessionId(sessionId)
    }
  }

  // 跨会话剪贴板操作
  const handleCopyFiles = (sessionId: string, fileNames: string[]) => {
    const session = sessions.find(s => s.id === sessionId)
    if (!session) return

    const clipboardFiles: ClipboardFile[] = fileNames.map(fileName => {
      const file = session.files.find(f => f.name === fileName)
      return {
        fileName,
        sessionId,
        sessionLabel: session.label,
        filePath: `${session.currentPath}/${fileName}`.replace('//', '/'),
        fileType: file?.type || 'file',
        operation: 'copy' as const,
      }
    })

    setClipboard(clipboardFiles)
    console.log('已复制文件到跨会话剪贴板:', clipboardFiles)
  }

  const handleCutFiles = (sessionId: string, fileNames: string[]) => {
    const session = sessions.find(s => s.id === sessionId)
    if (!session) return

    const clipboardFiles: ClipboardFile[] = fileNames.map(fileName => {
      const file = session.files.find(f => f.name === fileName)
      return {
        fileName,
        sessionId,
        sessionLabel: session.label,
        filePath: `${session.currentPath}/${fileName}`.replace('//', '/'),
        fileType: file?.type || 'file',
        operation: 'cut' as const,
      }
    })

    setClipboard(clipboardFiles)
    console.log('已剪切文件到跨会话剪贴板:', clipboardFiles)
  }

  const handlePasteFiles = (targetSessionId: string) => {
    if (clipboard.length === 0) return

    const targetSession = sessions.find(s => s.id === targetSessionId)
    if (!targetSession) return

    console.log(`粘贴 ${clipboard.length} 个文件到会话 ${targetSession.label}`)
    console.log('目标路径:', targetSession.currentPath)
    console.log('文件列表:', clipboard)

    // 这里应该实现实际的文件传输逻辑
    // 如果是cut操作，粘贴后应该清空剪贴板
    if (clipboard[0]?.operation === 'cut') {
      setClipboard([])
    }
  }

  // 处理跨会话文件拖放
  const handleCrossSessionDrop = (targetSessionId: string, dragData: CrossSessionDragData) => {
    const targetSession = sessions.find(s => s.id === targetSessionId)
    const sourceSession = sessions.find(s => s.id === dragData.sourceSessionId)

    if (!targetSession || !sourceSession) return

    console.log(`跨会话拖拽: ${dragData.fileName}`)
    console.log(`从: ${sourceSession.label} (${dragData.filePath})`)
    console.log(`到: ${targetSession.label} (${targetSession.currentPath})`)

    // TODO: 实现实际的跨会话文件传输
    // 这里应该调用API进行文件下载+上传操作
    // 1. 从源会话下载文件
    // 2. 上传到目标会话
  }

  // 快速创建并连接到服务器
  const handleQuickConnect = (serverId: number) => {
    const server = servers.find(s => s.id === serverId)
    if (!server) return

    const sessionId = `session-${nextSessionId}`
    const newSession: SftpSession = {
      id: sessionId,
      serverId,
      serverName: server.name,
      host: server.host,
      username: "root",
      currentPath: "/",
      files: mockFiles,
      isConnected: true, // 直接连接
      label: `${server.name}`,
      color: sessionColors[(nextSessionId - 1) % sessionColors.length],
    }
    setSessions(prev => [...prev, newSession])
    setNextSessionId(prev => prev + 1)
  }

  // 连接到服务器
  const handleConnectToServer = (sessionId: string, serverId: number) => {
    const server = servers.find(s => s.id === serverId)
    if (!server) return

    setSessions(prev => prev.map(session =>
      session.id === sessionId
        ? {
            ...session,
            serverId,
            serverName: server.name,
            host: server.host,
            isConnected: true,
            files: mockFiles, // 在实际应用中，这里应该触发文件列表加载
          }
        : session
    ))
  }

  // 刷新会话文件列表
  const handleRefreshSession = (sessionId: string) => {
    setSessions(prev => prev.map(session =>
      session.id === sessionId && session.isConnected
        ? {
            ...session,
            files: mockFiles, // 在实际应用中，这里应该从服务器重新加载文件列表
          }
        : session
    ))
  }

  // 断开连接
  const handleDisconnect = (sessionId: string) => {
    setSessions(prev => prev.filter(session => session.id !== sessionId))
  }

  // 重命名会话标签
  const handleRenameSession = (sessionId: string, newLabel: string) => {
    setSessions(prev => prev.map(session =>
      session.id === sessionId
        ? { ...session, label: newLabel }
        : session
    ))
  }

  // 导航到目录
  const handleNavigate = (sessionId: string, path: string) => {
    setSessions(prev => prev.map(session =>
      session.id === sessionId
        ? { ...session, currentPath: path }
        : session
    ))
  }

  // 上传文件
  const handleUpload = (sessionId: string, uploadFiles: FileList) => {
    console.log("上传文件:", Array.from(uploadFiles).map(f => f.name))
  }

  // 下载文件
  const handleDownload = (sessionId: string, fileName: string) => {
    console.log("下载文件:", fileName)
  }

  // 删除文件
  const handleDelete = (sessionId: string, fileName: string) => {
    setSessions(prev => prev.map(session =>
      session.id === sessionId
        ? { ...session, files: session.files.filter(f => f.name !== fileName) }
        : session
    ))
  }

  // 创建文件夹
  const handleCreateFolder = (sessionId: string, name: string) => {
    const newFolder = {
      name,
      type: "directory" as const,
      size: "-",
      modified: new Date().toLocaleString("sv-SE", {
        timeZone: "Asia/Shanghai",
        hour12: false
      }).replace("T", " ").slice(0, 19),
      permissions: "drwxr-xr-x",
      owner: "root",
      group: "root",
    }
    setSessions(prev => prev.map(session =>
      session.id === sessionId
        ? { ...session, files: [newFolder, ...session.files] }
        : session
    ))
  }

  // 重命名
  const handleRename = (sessionId: string, oldName: string, newName: string) => {
    setSessions(prev => prev.map(session =>
      session.id === sessionId
        ? {
            ...session,
            files: session.files.map(f =>
              f.name === oldName ? { ...f, name: newName } : f
            )
          }
        : session
    ))
  }

  // 读取文件
  const handleReadFile = async (sessionId: string, fileName: string): Promise<string> => {
    const session = sessions.find(s => s.id === sessionId)
    return `// 文件: ${fileName}\n// 路径: ${session?.currentPath}/${fileName}\n\n// 这是一个示例文件内容\nconsole.log("Hello from ${fileName}");`
  }

  // 保存文件
  const handleSaveFile = async (sessionId: string, fileName: string, content: string): Promise<void> => {
    console.log("保存文件:", fileName, "内容长度:", content.length)
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  // 获取网格布局类名
  const getGridLayout = (count: number) => {
    if (count === 1) return "grid-cols-1"
    if (count === 2) return "grid-cols-2"
    if (count === 3) return "grid-cols-2 lg:grid-cols-3"
    return "grid-cols-2"
  }

  const onlineServers = servers.filter(s => s.status === "online")
  const offlineServers = servers.filter(s => s.status === "offline")

  // 虚拟化滚动 - 仅在会话数量 >= 10 时启用
  const useVirtualization = sessions.length >= 10

  const virtualizer = useVirtualizer({
    count: sessions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 500, // 估计每个会话项的高度
    enabled: useVirtualization,
  })

  // 连接中占位符（理论上不会显示，因为新会话直接连接）
  const renderWelcomePage = (sessionId: string) => (
    <div className="h-full flex flex-col rounded-xl border bg-card overflow-hidden">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3 py-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg border bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800/30">
            <Server className="h-6 w-6 text-blue-500 animate-pulse" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">正在连接...</p>
            <p className="text-xs text-muted-foreground">请稍候</p>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <PageHeader title="文件传输">
        {/* 新建连接下拉菜单 - 仅在有会话时显示 */}
        {sessions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                新建连接
                <ChevronDown className="h-3.5 w-3.5 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {/* 在线服务器 */}
              {onlineServers.length > 0 && (
                <>
                  <DropdownMenuLabel className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    在线服务器
                  </DropdownMenuLabel>
                  {onlineServers.map(server => (
                    <DropdownMenuItem
                      key={server.id}
                      onClick={() => handleQuickConnect(server.id)}
                      className="gap-2 cursor-pointer"
                    >
                      <Server className="h-4 w-4 text-green-500" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{server.name}</div>
                        <div className="text-xs text-muted-foreground font-mono truncate">
                          {server.host}
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </>
              )}

              {/* 离线服务器 */}
              {offlineServers.length > 0 && (
                <>
                  {onlineServers.length > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full bg-zinc-400" />
                    离线服务器
                  </DropdownMenuLabel>
                  {offlineServers.map(server => (
                    <DropdownMenuItem
                      key={server.id}
                      disabled
                      className="gap-2 opacity-50"
                    >
                      <Server className="h-4 w-4 text-zinc-400" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{server.name}</div>
                        <div className="text-xs text-muted-foreground font-mono truncate">
                          {server.host}
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </>
              )}

              {/* 无服务器提示 */}
              {onlineServers.length === 0 && offlineServers.length === 0 && (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  暂无可用服务器
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </PageHeader>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {sessions.length === 0 ? (
          // 初始欢迎页 - 首次打开
          <div className="h-full flex flex-col">
            <div className="text-center py-12 space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl border bg-gradient-to-b from-zinc-100 to-zinc-200 dark:from-zinc-800/90 dark:to-zinc-900/90 border-zinc-300 dark:border-zinc-700/50">
                <FolderOpen className="h-8 w-8 text-blue-500" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold">文件传输</h1>
                <p className="text-sm text-muted-foreground">
                  通过 SFTP 协议安全管理服务器文件
                </p>
              </div>
            </div>

            {/* 服务器列表 */}
            {(onlineServers.length > 0 || offlineServers.length > 0) && (
              <div className="flex-1 overflow-auto px-6 pb-6">
                <div className="max-w-4xl mx-auto space-y-6">
                  {/* 在线服务器 */}
                  {onlineServers.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <h2 className="text-sm font-medium text-muted-foreground">
                          在线服务器 ({onlineServers.length})
                        </h2>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {onlineServers.map(server => (
                          <div
                            key={server.id}
                            onClick={() => handleQuickConnect(server.id)}
                            className="group rounded-lg border cursor-pointer transition-all duration-200 p-4 flex flex-col items-center text-center space-y-2.5 bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800/30 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:border-zinc-300 dark:hover:border-zinc-700/40"
                          >
                            <div className="w-12 h-12 rounded-lg flex items-center justify-center transition-all bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900">
                              <Server className="h-6 w-6 transition-colors text-zinc-600 dark:text-zinc-400 group-hover:text-green-500" />
                            </div>
                            <div className="space-y-0.5 w-full">
                              <h3 className="font-medium text-xs truncate transition-colors text-zinc-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400">
                                {server.name}
                              </h3>
                              <p className="text-[10px] text-zinc-600 dark:text-zinc-600 font-mono truncate">
                                {server.host}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 text-[10px]">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                              <span className="text-green-600 dark:text-green-400">在线</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 离线服务器 */}
                  {offlineServers.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-2">
                        <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                        <h2 className="text-sm font-medium text-muted-foreground">
                          离线服务器 ({offlineServers.length})
                        </h2>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {offlineServers.map(server => (
                          <div
                            key={server.id}
                            className="group rounded-lg border bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800/30 p-4 flex flex-col items-center text-center space-y-2.5 opacity-60"
                          >
                            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900">
                              <Server className="h-6 w-6 text-zinc-400 dark:text-zinc-600" />
                            </div>
                            <div className="space-y-0.5 w-full">
                              <h3 className="font-medium text-xs truncate text-zinc-600 dark:text-zinc-400">
                                {server.name}
                              </h3>
                              <p className="text-[10px] text-zinc-600 dark:text-zinc-600 font-mono truncate">
                                {server.host}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 text-[10px]">
                              <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                              <span className="text-zinc-500 dark:text-zinc-600">离线</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : fullscreenSessionId ? (
          // 全屏模式 - 只显示一个会话
          <div className="h-full relative">
            {sessions.filter(s => s.id === fullscreenSessionId).map(session => (
              <div key={session.id} className="h-full" data-session-id={session.id}>
                {session.isConnected ? (
                  <SftpManager
                    serverId={session.serverId!}
                    serverName={session.serverName}
                    host={session.host}
                    username={session.username}
                    isConnected={session.isConnected}
                    currentPath={session.currentPath}
                    files={session.files}
                    sessionId={session.id}
                    sessionLabel={session.label}
                    sessionColor={session.color}
                    isFullscreen={true}
                    onNavigate={(path) => handleNavigate(session.id, path)}
                    onUpload={(files) => handleUpload(session.id, files)}
                    onDownload={(fileName) => handleDownload(session.id, fileName)}
                    onDelete={(fileName) => handleDelete(session.id, fileName)}
                    onCreateFolder={(name) => handleCreateFolder(session.id, name)}
                    onRename={(oldName, newName) => handleRename(session.id, oldName, newName)}
                    onDisconnect={() => handleDisconnect(session.id)}
                    onRefresh={() => handleRefreshSession(session.id)}
                    onReadFile={(fileName) => handleReadFile(session.id, fileName)}
                    onSaveFile={(fileName, content) => handleSaveFile(session.id, fileName, content)}
                    onRenameSession={(newLabel) => handleRenameSession(session.id, newLabel)}
                    onCopyFiles={(fileNames) => handleCopyFiles(session.id, fileNames)}
                    onCutFiles={(fileNames) => handleCutFiles(session.id, fileNames)}
                    onPasteFiles={() => handlePasteFiles(session.id)}
                    onToggleFullscreen={() => toggleFullscreen(session.id)}
                    clipboard={clipboard}
                  />
                ) : (
                  renderWelcomePage(session.id)
                )}
              </div>
            ))}
          </div>
        ) : (
          // 多会话网格布局
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sessions.map(s => s.id)}
              strategy={rectSortingStrategy}
            >
              <div
                ref={parentRef}
                className={cn(
                  "h-full",
                  sessions.length >= 5 ? "overflow-auto" : "overflow-hidden"
                )}
              >
                <div
                  className={cn(
                    "grid gap-4 h-full",
                    sessions.length >= 5 ? "grid-cols-2 auto-rows-fr" : getGridLayout(sessions.length)
                  )}
                  style={sessions.length >= 5 ? {
                    gridAutoRows: 'minmax(500px, 1fr)'
                  } : undefined}
                >
                  {sessions.map(session => (
                    <SortableSession
                      key={session.id}
                      session={session}
                      onCrossSessionDrop={handleCrossSessionDrop}
                    >
                      {session.isConnected ? (
                        <SftpManager
                          serverId={session.serverId!}
                          serverName={session.serverName}
                          host={session.host}
                          username={session.username}
                          isConnected={session.isConnected}
                          currentPath={session.currentPath}
                          files={session.files}
                          sessionId={session.id}
                          sessionLabel={session.label}
                          sessionColor={session.color}
                          isFullscreen={false}
                          onNavigate={(path) => handleNavigate(session.id, path)}
                          onUpload={(files) => handleUpload(session.id, files)}
                          onDownload={(fileName) => handleDownload(session.id, fileName)}
                          onDelete={(fileName) => handleDelete(session.id, fileName)}
                          onCreateFolder={(name) => handleCreateFolder(session.id, name)}
                          onRename={(oldName, newName) => handleRename(session.id, oldName, newName)}
                          onDisconnect={() => handleDisconnect(session.id)}
                          onRefresh={() => handleRefreshSession(session.id)}
                          onReadFile={(fileName) => handleReadFile(session.id, fileName)}
                          onSaveFile={(fileName, content) => handleSaveFile(session.id, fileName, content)}
                          onRenameSession={(newLabel) => handleRenameSession(session.id, newLabel)}
                          onCopyFiles={(fileNames) => handleCopyFiles(session.id, fileNames)}
                          onCutFiles={(fileNames) => handleCutFiles(session.id, fileNames)}
                          onPasteFiles={() => handlePasteFiles(session.id)}
                          onToggleFullscreen={() => toggleFullscreen(session.id)}
                          clipboard={clipboard}
                        />
                      ) : (
                        renderWelcomePage(session.id)
                      )}
                    </SortableSession>
                  ))}
                </div>
              </div>
            </SortableContext>

            {/* VSCode 风格的轻量级拖拽预览 - 只显示工具栏 */}
            {createPortal(
              <DragOverlay dropAnimation={null}>
                {activeSession ? (
                  <DragPreviewToolbar
                    sessionLabel={activeSession.label}
                    sessionColor={activeSession.color}
                    host={activeSession.host}
                  />
                ) : null}
              </DragOverlay>,
              document.body
            )}
          </DndContext>
        )}
      </div>
    </>
  )
}
