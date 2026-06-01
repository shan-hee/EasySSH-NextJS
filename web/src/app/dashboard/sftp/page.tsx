"use client"

import React, { useState, useEffect, useRef, useCallback, startTransition } from "react"
import { PageHeader } from "@/components/page-header"
import { SshWorkspace } from "@/components/ssh-workspace/ssh-workspace"
import { SftpSessionCard } from "@/components/sftp/sftp-session-card"
import { DragPreviewToolbar, SortableSession, type CrossSessionDragData } from "@/components/sftp/sftp-session-sortable"
import { FolderOpen, Server, Plus, ChevronDown, Loader2 } from "lucide-react"
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
import { createPortal } from 'react-dom'
import { serversApi, sftpApi, type Server as ApiServer, type FileInfo } from "@/lib/api"
import { createAuthTicket } from "@/lib/auth-ticket"
import { toast } from "@/components/ui/sonner"
import { getErrorMessage } from "@/lib/error-utils"
import { useFileTransfer } from "@/hooks/useFileTransfer"
import {
  performDelete,
  performCreateFolder,
  performCreateFile,
  performRename,
  performSaveFile,
  performBatchDelete,
} from "@/lib/session/sftp-operations"
import { useAuthReady } from "@/hooks/use-auth-ready"
import { useClientAuth } from "@/components/client-auth-provider"
import { useSystemConfig } from "@/hooks/use-system-config"
import { getEffectiveLocale, getEffectiveTimezone } from "@/utils/datetime"
import { useTranslations } from "next-intl"
import { convertSftpFileInfo, type SftpFileItem } from "@/lib/sftp-file-utils"
import { loadSftpDirectory } from "@/lib/session/sftp-directory"
import { createSftpSessionApi } from "@/lib/session/sftp-session-api"
import type { SftpWorkspaceSession } from "@/lib/session/workspace"
import { createBrowserWorkspacePreferenceAdapter, createWorkspaceAdapters, createWorkspaceAuthTicketProviderAdapter, createWorkspaceI18nAdapter, createWorkspaceNotifierAdapter, createWorkspaceSettingsAdapter, createWorkspaceTransferAuthTicketProviderAdapter, createWorkspaceTransferManagerAdapter } from "@/lib/session/workspace-adapters"
import { createSftpWorkspaceSessionStoreAdapter, useSftpSessionStore } from "@/stores/sftp-session-store"

type ComponentFile = SftpFileItem
type SftpSession = SftpWorkspaceSession

// 会话标识颜色列表（常量）
const SESSION_COLORS = [
  "var(--chart-1)",
  "var(--status-connected)",
  "var(--status-warning)",
  "var(--status-danger)",
  "var(--chart-4)",
  "var(--chart-5)",
]

export default function SftpPage() {
 const { ready } = useAuthReady()
 const { user } = useClientAuth()
 const { data: systemConfig } = useSystemConfig()
 const effectiveLocale = getEffectiveLocale(user, systemConfig || null)
 const effectiveTimezone = getEffectiveTimezone(user, systemConfig || null)
 const tCommon = useTranslations("common")
 const tSftp = useTranslations("sftp")
 const tTerminal = useTranslations("terminal")

 const convertFileInfo = useCallback(
   (file: FileInfo): ComponentFile =>
     convertSftpFileInfo(file, {
       locale: effectiveLocale,
       timezone: effectiveTimezone,
       showDirSizeDash: true,
     }),
   [effectiveLocale, effectiveTimezone],
 )
 const sftpSessionApi = React.useMemo(() => createSftpSessionApi(sftpApi), [])
 const [servers, setServers] = useState<ApiServer[]>([])
 const [loading, setLoading] = useState(true)
 // 认证改为基于 HttpOnly Cookie，不再需要前端 token

 // SFTP 工作区会话状态进入 runtime store，页面只保留业务编排。
 const sessions = useSftpSessionStore((state) => state.sessions)
 const nextSessionId = useSftpSessionStore((state) => state.nextSessionId)
 const fullscreenSessionId = useSftpSessionStore((state) => state.fullscreenSessionId)
 const activeId = useSftpSessionStore((state) => state.activeId)
 const setSessions = useSftpSessionStore((state) => state.setSessions)
 const setNextSessionId = useSftpSessionStore((state) => state.setNextSessionId)
 const setFullscreenSessionId = useSftpSessionStore((state) => state.setFullscreenSessionId)
 const setActiveId = useSftpSessionStore((state) => state.setActiveId)
 const parentRef = useRef<HTMLDivElement>(null)
 const sessionsRef = useRef<SftpSession[]>([])

 // 始终保持 ref 指向最新会话，便于稳定回调访问（避免 useEffect 的一帧滞后）
 sessionsRef.current = sessions

 const workspaceAuthTicketProvider = React.useMemo(() => createWorkspaceAuthTicketProviderAdapter(createAuthTicket), [])
 const transferAuthTicketProvider = React.useMemo(
   () => createWorkspaceTransferAuthTicketProviderAdapter(workspaceAuthTicketProvider),
   [workspaceAuthTicketProvider],
 )

 // 文件传输管理
 const fileTransfer = useFileTransfer({
   createTicket: transferAuthTicketProvider,
 })
 const {
   tasks: transferTasks,
   uploadFile,
   clearCompleted,
   cancelTask,
   directTransfer,
 } = fileTransfer
 const transferTasksRef = useRef(transferTasks)
 transferTasksRef.current = transferTasks
 const workspaceSessionStore = React.useMemo(
   () => createSftpWorkspaceSessionStoreAdapter(() => transferTasksRef.current),
   [],
 )
 const workspacePreferences = React.useMemo(() => createBrowserWorkspacePreferenceAdapter(), [])
 const workspaceAdapters = React.useMemo(() => createWorkspaceAdapters({
   apiClient: {
     sftp: sftpSessionApi,
   },
   i18n: createWorkspaceI18nAdapter({
     locale: effectiveLocale,
     timezone: effectiveTimezone,
     common: tCommon,
     terminal: tTerminal,
     sftp: tSftp,
   }),
   notifier: createWorkspaceNotifierAdapter(toast),
   settings: createWorkspaceSettingsAdapter({
     sftp: {
       downloadExcludePatterns: systemConfig?.download_exclude_patterns,
     },
   }),
   preferences: workspacePreferences,
   authTicketProvider: workspaceAuthTicketProvider,
   sessionStore: workspaceSessionStore,
   transferManager: createWorkspaceTransferManagerAdapter({
     tasks: transferTasks,
     uploadFile,
     directTransfer,
     createTransferTask: fileTransfer.createTransferTask,
     addTask: fileTransfer.addTask,
     updateTask: fileTransfer.updateTask,
     removeTask: fileTransfer.removeTask,
     clearAll: fileTransfer.clearAll,
     clearCompleted,
     cancelTask,
     cancelDirectTransfer: fileTransfer.cancelDirectTransfer,
   }),
 }), [
   cancelTask,
   clearCompleted,
   directTransfer,
   effectiveLocale,
   effectiveTimezone,
   fileTransfer.addTask,
   fileTransfer.cancelDirectTransfer,
   fileTransfer.clearAll,
   fileTransfer.createTransferTask,
   fileTransfer.removeTask,
   fileTransfer.updateTask,
   workspaceAuthTicketProvider,
   systemConfig?.download_exclude_patterns,
   tCommon,
   tSftp,
   tTerminal,
   sftpSessionApi,
   transferTasks,
   uploadFile,
   workspacePreferences,
   workspaceSessionStore,
 ])
 const workspaceCapabilities = React.useMemo(() => ({
   terminal: false,
   sftp: true,
   transfers: true,
   fullscreen: true,
   crossSessionDrag: true,
 }), [])

 // 加载服务器列表
 const loadServers = useCallback(async () => {
 try {
 setLoading(true)
 const response = await serversApi.list({
 page: 1,
 limit: 100,
})

 // 防御性检查：处理apiFetch自动解包导致的数据结构不一致
 const serverList = Array.isArray(response)
 ? response
 : (response?.data || [])

 setServers(serverList)
 } catch (error: unknown) {
 console.error("Failed to load servers:", error)

 toast.error(getErrorMessage(error, tTerminal("errorLoadServers")))
 } finally {
 setLoading(false)
 }
 }, [tTerminal])

 useEffect(() => {
   if (!ready) return
   loadServers()
 }, [loadServers, ready])

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
 const oldIndex = items.findIndex((item) => item.id === String(active.id))
 const newIndex = items.findIndex((item) => item.id === String(over.id))

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

 // 切换全屏模式（稳定回调，避免全局重渲染）
 const toggleFullscreen = useCallback((sessionId: string) => {
   setFullscreenSessionId(prev => (prev === sessionId ? null : sessionId))
 }, [])

 // 处理跨会话文件拖放 - 使用直连传输 (rsync/scp)
 const handleCrossSessionDrop = useCallback(async (targetSessionId: string, dragData: CrossSessionDragData) => {
   const targetSession = sessionsRef.current.find(s => s.id === targetSessionId)
   const sourceSession = sessionsRef.current.find(s => s.id === dragData.sourceSessionId)

   if (!targetSession || !sourceSession) return
   if (!targetSession.isConnected || !sourceSession.isConnected) {
     toast.error(tSftp("toastTransferSessionNotConnected"))
     return
   }

   // 如果是同一服务器，提示用户使用复制/移动
   if (sourceSession.serverId === targetSession.serverId) {
     toast.error(tSftp("toastTransferSameServer"))
     return
   }

   const fileName = dragData.fileName
   const sourcePath = dragData.filePath
   const targetPath = targetSession.currentPath

   try {
     // 使用直连传输（rsync/scp），带实时进度
     await directTransfer(
       sourceSession.serverId,
       sourcePath,
       targetSession.serverId,
       targetPath,
       sourceSession.serverName,
       targetSession.serverName,
       fileName
     )

     // 传输成功后刷新目标会话的文件列表
     try {
       const directory = await loadSftpDirectory({
         serverId: targetSession.serverId,
         path: targetPath,
         convertFileInfo,
         withParentEntry: true,
         api: sftpSessionApi,
       })

       setSessions(prev =>
         prev.map(s =>
           s.id === targetSessionId
             ? { ...s, files: directory.files }
             : s
         )
       )
     } catch {
       // 刷新失败不影响传输结果
     }

     toast.success(tSftp("toastTransferSuccess", {
       file: fileName,
       size: "-"
     }))
   } catch (err) {
     toast.error(getErrorMessage(err, tSftp("toastTransferFailed")))
   }
 }, [tSftp, convertFileInfo, directTransfer, sftpSessionApi])

 // 快速创建并连接到服务器
 const handleQuickConnect = async (serverId: string) => {
 const server = servers.find(s => s.id === serverId)
 if (!server) return

 // 不限制离线服务器的连接，让用户尝试连接
 // 连接失败时会显示错误信息

 const sessionId = `session-${nextSessionId}`
 // 在SFTP页面使用根目录，在终端页面使用用户主目录
 const initialPath = "/"
 const serverDisplayName = server.name || `${server.username}@${server.host}:${server.port}`
 const newSession: SftpSession = {
 id: sessionId,
 serverId: server.id,
 serverName: serverDisplayName,
 host: server.host,
 username: server.username,
 currentPath: initialPath,
 files: [],
 isConnected: false,
 isLoading: true, // 初始加载状态
 label: serverDisplayName,
 color: SESSION_COLORS[(nextSessionId - 1) % SESSION_COLORS.length],
 }
 setSessions(prev => [...prev, newSession])
 setNextSessionId(prev => prev + 1)

 // 连接并加载文件列表
 try {
 const directory = await loadSftpDirectory({
 serverId,
 path: initialPath,
 convertFileInfo,
 withParentEntry: true,
 api: sftpSessionApi,
 })

 setSessions(prev =>
 prev.map(s =>
 s.id === sessionId
 ? { ...s, isConnected: true, isLoading: false, files: directory.files }
 : s
 )
 )
 } catch (error: unknown) {
 console.error("Failed to load directory:", error)
 toast.error(getErrorMessage(error, tSftp("toastLoadDirectoryFailed")))

 // 连接失败，移除会话
 setSessions(prev => prev.filter(s => s.id !== sessionId))
 }
 }

 // 刷新会话文件列表
 const handleRefreshSession = useCallback(async (sessionId: string) => {
 const session = sessionsRef.current.find(s => s.id === sessionId)
 if (!session || !session.isConnected) return

 // 设置加载状态
 setSessions(prev =>
 prev.map(s => (s.id === sessionId ? { ...s, isLoading: true } : s))
 )

 try {
 const directory = await loadSftpDirectory({
 serverId: session.serverId,
 path: session.currentPath,
 convertFileInfo,
 withParentEntry: true,
 api: sftpSessionApi,
 })

 // 使用 startTransition 降低状态更新优先级
 startTransition(() => {
   setSessions(prev =>
     prev.map(s => (s.id === sessionId ? { ...s, isLoading: false, files: directory.files } : s))
   )
 })

 toast.success(tSftp("toastRefreshSuccess"))
 } catch (error: unknown) {
 console.error("Failed to refresh:", error)
 setSessions(prev =>
 prev.map(s => (s.id === sessionId ? { ...s, isLoading: false } : s))
 )
 toast.error(getErrorMessage(error, tSftp("toastRefreshFailed")))
 }
 }, [tSftp, convertFileInfo, sftpSessionApi])

 // 断开连接
 const handleDisconnect = useCallback((sessionId: string) => {
   setSessions(prev => prev.filter(session => session.id !== sessionId))
   setFullscreenSessionId(prev => (prev === sessionId ? null : prev))
   setActiveId(prev => (prev === sessionId ? null : prev))
 }, [setActiveId, setFullscreenSessionId, setSessions])

 // 重命名会话标签
 const handleRenameSession = useCallback((sessionId: string, newLabel: string) => {
 setSessions(prev => prev.map(session =>
 session.id === sessionId
 ? { ...session, label: newLabel }
 : session
 ))
 }, [])

 // 导航到目录
 const handleNavigate = useCallback(async (sessionId: string, path: string) => {
 const session = sessionsRef.current.find(s => s.id === sessionId)
 if (!session || !session.isConnected) return

 // 设置加载状态
 setSessions(prev =>
 prev.map(s => (s.id === sessionId ? { ...s, isLoading: true } : s))
 )

 try {
 const directory = await loadSftpDirectory({
 serverId: session.serverId,
 path,
 convertFileInfo,
 withParentEntry: true,
 api: sftpSessionApi,
 })

 // 使用 startTransition 降低状态更新优先级,避免阻塞 UI
 startTransition(() => {
   setSessions(prev =>
     prev.map(s =>
       s.id === sessionId
         ? { ...s, currentPath: path, isLoading: false, files: directory.files }
         : s
     )
   )
 })
 } catch (error: unknown) {
 console.error("Failed to navigate:", error)
 setSessions(prev =>
 prev.map(s => (s.id === sessionId ? { ...s, isLoading: false } : s))
 )
 toast.error(getErrorMessage(error, tSftp("toastLoadDirectoryFailed")))
}
 }, [tSftp, convertFileInfo, sftpSessionApi])

 // 上传文件（接入统一上传任务 UI）
 const handleUpload = useCallback(async (
   sessionId: string,
   uploadFiles: FileList,
   onProgress?: (fileName: string, loaded: number, total: number) => void
 ) => {
   const session = sessionsRef.current.find(s => s.id === sessionId)
   if (!session || !session.isConnected) return

   const files = Array.from(uploadFiles)
   let successCount = 0
   let failCount = 0

  for (const file of files) {
     try {
       await uploadFile(
         session.serverId,
         session.currentPath,
         file,
         onProgress
           ? (loaded, total) => {
               onProgress(file.name, loaded, total)
             }
           : undefined,
         true // 启用 WebSocket 进度（与终端文件管理器保持一致）
       )
       successCount++
     } catch (error: unknown) {
       console.error(`Failed to upload ${file.name}:`, error)
       failCount++
   }
  }

  if (successCount > 0) {
    toast.success(tSftp("toastUploadSuccess", { count: successCount }))
     // 刷新文件列表
     await handleRefreshSession(sessionId)
  }

  if (failCount > 0) {
    toast.error(tSftp("toastUploadFailed", { count: failCount }))
  }
 }, [tSftp, uploadFile, handleRefreshSession])

 // 下载文件
 const handleDownload = useCallback((sessionId: string, fileName: string) => {
 const session = sessionsRef.current.find(s => s.id === sessionId)
 if (!session || !session.isConnected) return

 const filePath = `${session.currentPath}/${fileName}`.replace("//", "/")

 // 直接触发浏览器下载，由浏览器自带下载管理器处理
 sftpSessionApi.downloadFile(session.serverId, filePath)
 toast.success(tSftp("toastDownloadStartSingle", { file: fileName }))
 }, [tSftp, sftpSessionApi])

 /**
  * 创建多会话文件列表更新器
  * 用于桥接通用操作函数和多会话状态管理
  */
 const createSessionFilesUpdater = useCallback(
   (sessionId: string): React.Dispatch<React.SetStateAction<ComponentFile[]>> => {
     return (action) => {
       setSessions(prev =>
         prev.map(s => {
           if (s.id !== sessionId) return s
           const newFiles = typeof action === 'function' ? action(s.files) : action
           return { ...s, files: newFiles }
         })
       )
     }
   },
   []
 )

 // 删除文件 (使用通用函数)
 const handleDelete = useCallback(
   (sessionId: string, fileName: string) => {
     const session = sessionsRef.current.find(s => s.id === sessionId)
     if (!session || !session.isConnected) return

     return performDelete({
       serverId: session.serverId,
       currentPath: session.currentPath,
       fileName,
       t: tSftp,
       notifier: toast,
       setFiles: createSessionFilesUpdater(sessionId),
       api: sftpSessionApi,
     })
   },
   [tSftp, createSessionFilesUpdater, sftpSessionApi]
 )

 // 创建文件夹 (使用通用函数)
 const handleCreateFolder = useCallback(
   (sessionId: string, name: string) => {
     const session = sessionsRef.current.find(s => s.id === sessionId)
     if (!session || !session.isConnected) return

     return performCreateFolder({
       serverId: session.serverId,
       currentPath: session.currentPath,
       name,
       t: tSftp,
       notifier: toast,
       setFiles: createSessionFilesUpdater(sessionId),
       convertFileInfo,
       api: sftpSessionApi,
     })
   },
   [tSftp, createSessionFilesUpdater, convertFileInfo, sftpSessionApi]
 )

 // 创建文件 (使用通用函数)
 const handleCreateFile = useCallback(
   (sessionId: string, name: string) => {
     const session = sessionsRef.current.find(s => s.id === sessionId)
     if (!session || !session.isConnected) return

     return performCreateFile({
       serverId: session.serverId,
       currentPath: session.currentPath,
       name,
       t: tSftp,
       notifier: toast,
       setFiles: createSessionFilesUpdater(sessionId),
       convertFileInfo,
       api: sftpSessionApi,
     })
   },
   [tSftp, createSessionFilesUpdater, convertFileInfo, sftpSessionApi]
 )

 // 重命名 (使用通用函数)
 const handleRename = useCallback(
   (sessionId: string, oldName: string, newName: string) => {
     const session = sessionsRef.current.find(s => s.id === sessionId)
     if (!session || !session.isConnected) return

     return performRename({
       serverId: session.serverId,
       currentPath: session.currentPath,
       oldName,
       newName,
       t: tSftp,
       notifier: toast,
       setFiles: createSessionFilesUpdater(sessionId),
       api: sftpSessionApi,
     })
   },
   [tSftp, createSessionFilesUpdater, sftpSessionApi]
 )

 // 读取文件
 const handleReadFile = useCallback(async (sessionId: string, fileName: string): Promise<string> => {
 const session = sessionsRef.current.find(s => s.id === sessionId)
 if (!session || !session.isConnected) {
 throw new Error("SFTP session is not connected")
 }

 const filePath = `${session.currentPath}/${fileName}`.replace("//", "/")

 try {
 const content = await sftpSessionApi.readFile(session.serverId, filePath)
 return content
 } catch (error: unknown) {
 console.error("Failed to read file:", error)
 toast.error(getErrorMessage(error, tSftp("toastReadFileFailed")))
 throw error
 }
 }, [tSftp, sftpSessionApi])

 // 保存文件 (使用通用函数)
 const handleSaveFile = useCallback(
   async (sessionId: string, fileName: string, content: string): Promise<void> => {
     const session = sessionsRef.current.find(s => s.id === sessionId)
     if (!session || !session.isConnected) {
       throw new Error("SFTP session is not connected")
     }

     await performSaveFile({
       serverId: session.serverId,
       currentPath: session.currentPath,
       fileName,
       content,
       t: tSftp,
       notifier: toast,
       setFiles: createSessionFilesUpdater(sessionId),
       convertFileInfo,
       api: sftpSessionApi,
     })
   },
   [tSftp, createSessionFilesUpdater, convertFileInfo, sftpSessionApi]
 )

 // 批量删除文件 (使用通用函数)
 const handleBatchDelete = useCallback(
   (sessionId: string, fileNames: string[]) => {
     const session = sessionsRef.current.find(s => s.id === sessionId)
     if (!session || !session.isConnected) {
       throw new Error("SFTP session is not connected")
     }

     return performBatchDelete({
       serverId: session.serverId,
       currentPath: session.currentPath,
       fileNames,
       t: tSftp,
       notifier: toast,
       setFiles: createSessionFilesUpdater(sessionId),
       api: sftpSessionApi,
     })
   },
   [tSftp, createSessionFilesUpdater, sftpSessionApi]
 )

 // 批量下载文件（文件管理器固定使用推荐的快速下载方案）
 const handleBatchDownload = useCallback(async (
   sessionId: string,
   fileNames: string[],
   excludePatterns?: string[]
 ) => {
   const session = sessionsRef.current.find(s => s.id === sessionId)
   if (!session || !session.isConnected) {
     throw new Error("SFTP session is not connected")
   }

   // 构建完整路径
   const filePaths = fileNames.map(fileName =>
     `${session.currentPath}/${fileName}`.replace("//", "/")
   )

  try {
    await sftpSessionApi.batchDownload(session.serverId, filePaths, "fast", excludePatterns)
    toast.success(tSftp("toastBatchDownloadStart", { count: fileNames.length }))
  } catch (error: unknown) {
    console.error("Failed to batch download:", error)
    toast.error(getErrorMessage(error, tSftp("toastBatchDownloadFailed")))
     throw error
   }
 }, [tSftp, sftpSessionApi])

 // 获取网格布局类名
 const getGridLayout = (count: number) => {
 if (count === 1) return "grid-cols-1"
 if (count === 2) return "grid-cols-2"
 if (count === 3) return "grid-cols-2 lg:grid-cols-3"
 return "grid-cols-2"
 }

const onlineServers = servers.filter(s => s.status === "online")
const offlineServers = servers.filter(s => s.status !== "online")

 // 加载状态 - 直接显示界面，服务器列表异步加载
 // 与快速连接界面保持一致，不使用骨架屏

 return (
 <SshWorkspace
   adapters={workspaceAdapters}
   capabilities={workspaceCapabilities}
   layout="web"
 >
 <PageHeader title={tSftp("title")}>
 {/* 新建连接下拉菜单 - 仅在有会话时显示 */}
 {sessions.length > 0 && (
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button size="sm" className="gap-2">
 <Plus className="h-4 w-4" />
 {tSftp("newConnection")}
 <ChevronDown className="h-3.5 w-3.5 opacity-50" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="w-56">
 {/* 在线服务器 */}
 {onlineServers.length > 0 && (
 <>
 <DropdownMenuLabel className="flex items-center gap-2 text-xs">
 <div className="w-2 h-2 rounded-full bg-status-connected" />
 {tSftp("onlineServers")}
 </DropdownMenuLabel>
 {onlineServers.map(server => (
 <DropdownMenuItem
 key={server.id}
 onClick={() => handleQuickConnect(server.id)}
 className="gap-2 cursor-pointer"
 >
 <Server className="h-4 w-4 text-status-connected" />
 <div className="flex-1 min-w-0">
 <div className="font-medium text-sm truncate">{server.name || server.host}</div>
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
 <div className="w-2 h-2 rounded-full bg-muted-foreground/60" />
 {tSftp("offlineServers")}
 </DropdownMenuLabel>
 {offlineServers.map(server => (
 <DropdownMenuItem
 key={server.id}
 onClick={() => handleQuickConnect(server.id)}
 className="gap-2 opacity-70 hover:opacity-100"
 >
 <Server className="h-4 w-4 text-muted-foreground" />
 <div className="flex-1 min-w-0">
 <div className="font-medium text-sm truncate">{server.name || server.host}</div>
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
 {tSftp("noServers")}
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
 <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl border border-border bg-muted">
 <FolderOpen className="h-8 w-8 text-primary" />
 </div>
 <div className="space-y-2">
 <h1 className="text-2xl font-semibold">{tSftp("title")}</h1>
 <p className="text-sm text-muted-foreground">
 {tSftp("emptyDescription")}
 </p>
 </div>
 </div>

 {/* 服务器列表 */}
 {loading ? (
 // 加载中 - 与快速连接界面一致的加载动画
 <div className="space-y-4">
   <div className="h-px bg-border" />
   <div className="flex flex-col items-center justify-center py-12 gap-4">
     <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
     <p className="text-sm text-muted-foreground">
       {tCommon("loading")}
     </p>
   </div>
 </div>
 ) : (onlineServers.length > 0 || offlineServers.length > 0) ? (
 <div className="flex-1 overflow-auto px-6 pb-6">
 <div className="max-w-4xl mx-auto space-y-6">
 {/* 在线服务器 */}
 {onlineServers.length > 0 && (
 <div className="space-y-3">
 <div className="flex items-center gap-2 px-2">
 <div className="w-2 h-2 rounded-full bg-status-connected" />
 <h2 className="text-sm font-medium text-muted-foreground">
 {tSftp("onlineServers")} ({onlineServers.length})
 </h2>
 </div>
 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
 {onlineServers.map(server => (
 <div
 key={server.id}
 onClick={() => handleQuickConnect(server.id)}
 className="group rounded-lg border border-border bg-card cursor-pointer transition-all duration-200 p-4 flex flex-col items-center text-center space-y-2.5 hover:bg-accent hover:text-accent-foreground hover:border-primary/30"
 >
 <div className="w-12 h-12 rounded-lg flex items-center justify-center transition-all bg-muted">
 <Server className="h-6 w-6 transition-colors text-muted-foreground group-hover:text-status-connected" />
 </div>
 <div className="space-y-0.5 w-full">
 <h3 className="font-medium text-xs truncate transition-colors text-card-foreground group-hover:text-status-connected">
 {server.name || server.host}
 </h3>
 <p className="text-[10px] text-muted-foreground font-mono truncate">
 {server.host}
 </p>
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
 <div className="w-2 h-2 rounded-full bg-muted-foreground/60" />
 <h2 className="text-sm font-medium text-muted-foreground">
 {tSftp("offlineServers")} ({offlineServers.length})
 </h2>
 </div>
 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
 {offlineServers.map(server => (
 <div
 key={server.id}
 onClick={() => handleQuickConnect(server.id)}
 className="group rounded-lg border border-border bg-card p-4 flex flex-col items-center text-center space-y-2.5 opacity-70 hover:opacity-100 cursor-pointer transition-all hover:bg-accent hover:text-accent-foreground hover:border-primary/20"
 >
 <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-muted">
 <Server className="h-6 w-6 text-muted-foreground" />
 </div>
 <div className="space-y-0.5 w-full">
 <h3 className="font-medium text-xs truncate text-muted-foreground group-hover:text-foreground">
 {server.name || server.host}
 </h3>
 <p className="text-[10px] text-muted-foreground font-mono truncate">
 {server.host}
 </p>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>
 ) : null}
 </div>
 ) : fullscreenSessionId ? (
 // 全屏模式 - 只显示一个会话
 <div className="h-full relative">
 {sessions.filter(s => s.id === fullscreenSessionId).map(session => (
 <div key={session.id} className="h-full" data-session-id={session.id}>
 <SftpSessionCard
   session={session}
   isFullscreen={true}
   connectingText={tSftp("connecting")}
   onNavigateSession={handleNavigate}
   onUploadSession={handleUpload}
   onDownloadSession={handleDownload}
   onDeleteSession={handleDelete}
   onBatchDeleteSession={handleBatchDelete}
   onBatchDownloadSession={handleBatchDownload}
   onCreateFolderSession={handleCreateFolder}
   onCreateFileSession={handleCreateFile}
   onRenameSessionFile={handleRename}
   onDisconnectSession={handleDisconnect}
   onRefreshSession={handleRefreshSession}
   onReadFileSession={handleReadFile}
   onSaveFileSession={handleSaveFile}
   onRenameSessionLabel={handleRenameSession}
   onToggleFullscreen={toggleFullscreen}
 />
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
 dropOverlayTexts={{
   title: tSftp("crossSessionDropTitle"),
   description: tSftp("crossSessionDropDescription"),
 }}
 >
 <SftpSessionCard
   session={session}
   isFullscreen={false}
   connectingText={tSftp("connecting")}
   onNavigateSession={handleNavigate}
   onUploadSession={handleUpload}
   onDownloadSession={handleDownload}
   onDeleteSession={handleDelete}
   onBatchDeleteSession={handleBatchDelete}
   onBatchDownloadSession={handleBatchDownload}
   onCreateFolderSession={handleCreateFolder}
   onCreateFileSession={handleCreateFile}
   onRenameSessionFile={handleRename}
   onDisconnectSession={handleDisconnect}
   onRefreshSession={handleRefreshSession}
   onReadFileSession={handleReadFile}
   onSaveFileSession={handleSaveFile}
   onRenameSessionLabel={handleRenameSession}
   onToggleFullscreen={toggleFullscreen}
 />
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
 </SshWorkspace>
 )
}
