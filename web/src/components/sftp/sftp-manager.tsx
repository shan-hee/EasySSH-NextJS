"use client"

import { useState, useRef, useEffect, useLayoutEffect, DragEvent, useMemo, useCallback, useDeferredValue } from "react"
import { createPortal } from "react-dom"
import { SftpSessionProvider } from "@/contexts/sftp-session-context"
import "@/components/Folder.css"
import "@/components/File.css"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useDownloadExcludePatterns, useDefaultDownloadMode } from "@/hooks/use-system-config"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  FolderOpen,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  Search,
  ArrowLeft,
  Home,
  MoreHorizontal,
  Eye,
  EyeOff,
  Edit,
  FolderPlus,
  ChevronRight,
  Activity,
  XCircle,
  X,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Clock,
  GripVertical,
  LayoutGrid,
  List,
  FileText,
  FileCode,
  FileArchive,
  FileImage,
  FileVideo,
  FileAudio,
  Database,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { parseFileSize } from "@/lib/format-utils"
import Folder from "@/components/Folder"
import FileIcon from "@/components/File"
import { FileEditor } from "@/components/sftp/file-editor"
import { ChmodDialog } from "@/components/sftp/chmod-dialog"
import { LoadingSpinner } from "@/components/ui/loading/loading-spinner"
import type { TransferTask as ImportedTransferTask } from "@/hooks/useFileTransfer"
import { FileActionMenu, type FileAction } from "@/components/sftp/file-action-menu"

interface FileItem {
  name: string
  type: "file" | "directory"
  size: string
  modified: string
  permissions: string
}

type EnhancedFileItem = FileItem & {
  sizeBytes: number
}

// 使用导入的 TransferTask 类型
type TransferTask = ImportedTransferTask

interface SftpManagerProps {
  serverId: string
  serverName: string
  host: string
  username: string
  isConnected: boolean
  currentPath: string
  files: FileItem[]
  sessionId: string
  sessionLabel: string
  sessionColor?: string
  isFullscreen?: boolean
  pageContext?: 'sftp' | 'terminal' // 页面上下文
  isLoading?: boolean // 是否正在加载文件列表
  onNavigate: (path: string) => void
  onUpload: (files: FileList, onProgress?: (fileName: string, loaded: number, total: number) => void) => void
  onDownload: (fileName: string) => void
  onDelete: (fileName: string) => void
  onBatchDelete?: (fileNames: string[]) => Promise<{ success: string[]; failed: any[]; total: number }>
  onBatchDownload?: (fileNames: string[], mode?: "fast" | "compatible", excludePatterns?: string[]) => Promise<void>
  onCreateFolder: (name: string) => void
  onCreateFile?: (name: string) => void
  onRename: (oldName: string, newName: string) => void
  onDisconnect: () => void
  onRefresh: () => void
  onReadFile?: (fileName: string) => Promise<string>
  onSaveFile?: (fileName: string, content: string) => Promise<void>
  onRenameSession?: (newLabel: string) => void
  onToggleFullscreen?: () => void
  dragHandleListeners?: any
  dragHandleAttributes?: any
  // 传输任务管理(从外部传入)
  transferTasks?: TransferTask[]
  onClearCompletedTransfers?: () => void
  onCancelTransfer?: (taskId: string) => void
}

export function SftpManager(props: SftpManagerProps) {
  const {
    host,
    username,
    isConnected,
    currentPath,
    files,
    sessionId,
    sessionLabel,
    sessionColor,
    serverId,
    serverName,
    isFullscreen = false,
    pageContext = 'sftp',
    isLoading = false,
    onNavigate,
    onUpload,
    onDownload,
    onDelete,
    onBatchDelete,
    onBatchDownload,
    onCreateFolder,
    onCreateFile,
    onRename,
    onDisconnect,
    onRefresh,
    onReadFile,
    onSaveFile,
    onRenameSession,
    onToggleFullscreen,
    dragHandleListeners,
    dragHandleAttributes,
    transferTasks,  // 从外部传入; 未传入则不展示传输任务按钮
    onClearCompletedTransfers,
    onCancelTransfer,
  } = props
  const effectiveTransferTasks = transferTasks ?? []
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const deferredSearchTerm = useDeferredValue(searchTerm)
  // 禁用 dnd-kit 的拖拽排序功能，改用原生拖拽实现 Windows 风格交互
  // const fileSensors = useSensors(
  //   useSensor(PointerSensor, {
  //     activationConstraint: {
  //       distance: 8,
  //     },
  //   }),
  //   useSensor(KeyboardSensor, {
  //     coordinateGetter: sortableKeyboardCoordinates,
  //   })
  // )
  const [sortBy, setSortBy] = useState<keyof FileItem>("name")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  // 移除内部 transferTasks 状态管理,改用传入的 props
  // const [transferTasks, setTransferTasks] = useState<TransferTask[]>([])
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [_dragCounter, setDragCounter] = useState(0)
  // 视图模式：根据上下文 + 本地偏好初始化
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window !== 'undefined') {
      try {
        const key = `easyssh:sftp:viewMode:${pageContext}`
        const stored = window.localStorage.getItem(key)
        if (stored === 'grid' || stored === 'list') return stored
      } catch {}
    }
    // 默认：文件管理(sftp)用图标视图；终端(terminal)用列表视图
    return pageContext === 'terminal' ? 'list' : 'grid'
  })
  const [showHidden, setShowHidden] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    fileName?: string
    fileType?: "file" | "directory"
    isBlank?: boolean
    key?: number
  } | null>(null)
  const [editingFile, setEditingFile] = useState<string | null>(null)
  const [editingFileName, setEditingFileName] = useState("")
  const [creatingNew, setCreatingNew] = useState<"file" | "folder" | null>(null)
  const [editingSessionLabel, setEditingSessionLabel] = useState(false)
  const [tempSessionLabel, setTempSessionLabel] = useState(sessionLabel)
  const [draggedFileName, setDraggedFileName] = useState<string | null>(null)
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [editorState, setEditorState] = useState<{
    isOpen: boolean
    fileName: string
    filePath: string
    content: string
  }>({
    isOpen: false,
    fileName: "",
    filePath: "",
    content: "",
  })
  const [chmodDialog, setChmodDialog] = useState<{
    isOpen: boolean
    fileName: string
    filePath: string
    permissions: string
  }>({
    isOpen: false,
    fileName: "",
    filePath: "",
    permissions: "",
  })
  const [pathInputValue, setPathInputValue] = useState(currentPath)
  const [isEditingPath, setIsEditingPath] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const sessionLabelInputRef = useRef<HTMLInputElement>(null)
  const filteredFilesRef = useRef<EnhancedFileItem[]>([])
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 从系统配置获取排除规则
  const excludePatterns = useDownloadExcludePatterns()
  // 从系统配置获取默认下载模式（fast / compatible）
  const defaultDownloadModeConfig = useDefaultDownloadMode()
  const defaultDownloadMode: "fast" | "compatible" =
    defaultDownloadModeConfig === "compatible" ? "compatible" : "fast"

  const enhancedFiles = useMemo<EnhancedFileItem[]>(() => {
    return files.map((file) => ({
      ...file,
      sizeBytes: parseFileSize(file.size),
    }))
  }, [files])

  // 过滤和排序文件 - 使用 useMemo 优化性能
  const filteredFiles = useMemo<EnhancedFileItem[]>(() => {
    const keyword = deferredSearchTerm.trim().toLowerCase()

    const result = enhancedFiles
      .filter((file) => {
        if (!showHidden && file.name.startsWith('.') && file.name !== '..') {
          return false
        }
        if (!keyword) {
          return true
        }
        return file.name.toLowerCase().includes(keyword)
      })
      .sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === "directory" ? -1 : 1
        }

        if (sortBy === "size") {
          const comparison = a.sizeBytes - b.sizeBytes
          return sortOrder === "asc" ? comparison : -comparison
        }

        const aValue = a[sortBy] as string
        const bValue = b[sortBy] as string
        const comparison = aValue.localeCompare(bValue)
        return sortOrder === "asc" ? comparison : -comparison
      })

    // 同时更新 ref 以供 handleFileSelect 使用
    filteredFilesRef.current = result
    return result
  }, [enhancedFiles, showHidden, deferredSearchTerm, sortBy, sortOrder])

  // 文件选择处理 - 使用 useCallback 优化
  const handleFileSelect = useCallback((fileName: string, event: React.MouseEvent) => {
    const isShift = event.shiftKey
    const isModifier = event.ctrlKey || event.metaKey

    setSelectedFiles((prev) => {
      if (isShift && prev.length > 0) {
        const lastIndex = filteredFilesRef.current.findIndex((f) => f.name === prev[prev.length - 1])
        const currentIndex = filteredFilesRef.current.findIndex((f) => f.name === fileName)
        if (lastIndex === -1 || currentIndex === -1) {
          return prev
        }
        const start = Math.min(lastIndex, currentIndex)
        const end = Math.max(lastIndex, currentIndex)
        const range = filteredFilesRef.current.slice(start, end + 1).map((f) => f.name)
        return Array.from(new Set([...prev, ...range]))
      }

      if (isModifier) {
        return prev.includes(fileName)
          ? prev.filter((f) => f !== fileName)
          : [...prev, fileName]
      }

      if (prev.length === 1 && prev[0] === fileName) {
        return []
      }

      return [fileName]
    })
  }, [])

  // 打开文件编辑器 - 使用 useCallback 优化
  const handleOpenEditor = useCallback(async (fileName: string) => {
    if (!onReadFile) {
      console.warn("onReadFile 回调未提供")
      return
    }

    try {
      const content = await onReadFile(fileName)
      const fullPath = `${currentPath}/${fileName}`.replace(/\/+/g, "/")
      setEditorState({
        isOpen: true,
        fileName,
        filePath: fullPath,
        content,
      })
    } catch (error) {
      console.error("读取文件失败:", error)
    }
  }, [currentPath, onReadFile])

  // 处理单击文件 - 选中
  const handleFileClick = useCallback((fileName: string, event: React.MouseEvent) => {
    // 阻止冒泡
    event.stopPropagation()
    handleFileSelect(fileName, event)
  }, [handleFileSelect])

  // 处理双击文件 - 打开
  const handleFileDoubleClick = useCallback((fileName: string, fileType: "file" | "directory") => {
    if (fileType === "directory") {
      const next = (currentPath.endsWith("/") ? currentPath : currentPath + "/") + fileName
      onNavigate(next)
    } else {
      handleOpenEditor(fileName)
    }
  }, [currentPath, onNavigate, handleOpenEditor])

  const handleSelectAll = useCallback(() => {
    setSelectedFiles((prev) => {
      if (prev.length === filteredFiles.length) {
        return []
      }
      return filteredFiles.map((f) => f.name)
    })
  }, [filteredFiles])

  // 右键菜单处理
  const handleContextMenu = (e: React.MouseEvent, fileName: string, fileType: "file" | "directory") => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      fileName,
      fileType,
      isBlank: false,
      key: Date.now(),
    })
    // 如果右键的项目未被选中，则选中它
    if (!selectedFiles.includes(fileName)) {
      setSelectedFiles([fileName])
    }
  }

  const closeContextMenu = () => {
    setContextMenu(null)
  }

  // 点击其他地方关闭右键菜单
  useEffect(() => {
    if (!contextMenu) return

    const handleClickOutside = () => {
      closeContextMenu()
    }

    // 延迟绑定，避免立即触发
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [contextMenu])

  // 原生拖拽事件处理
  const handleNativeDragStart = (e: React.DragEvent, fileName: string) => {
    setDraggedFileName(fileName)
    e.dataTransfer.effectAllowed = 'move'

    // 设置拖拽数据,用于跨会话拖拽
    const file = files.find(f => f.name === fileName)
    const dragData = {
      sessionId,
      fileName,
      filePath: `${currentPath}/${fileName}`.replace(/\/+/g, "/"),
      fileType: file?.type || 'file',
      sourceSessionId: sessionId,
    }
    e.dataTransfer.setData('application/json', JSON.stringify(dragData))
    e.dataTransfer.setData('text/plain', fileName)
  }

  const handleNativeDragEnd = () => {
    setDraggedFileName(null)
    setDragOverFolder(null)
  }

  const handleNativeDragOver = (e: React.DragEvent, targetFileName: string, targetType: "file" | "directory") => {
    e.preventDefault()
    e.stopPropagation()

    // 检查是否是跨会话拖拽
    const isFileFromOtherSession = e.dataTransfer.types.includes('application/json') && !draggedFileName

    // 不能拖到自己身上
    if (targetFileName === draggedFileName && !isFileFromOtherSession) {
      setDragOverFolder(null)
      return
    }

    // 只有文件夹才能作为拖放目标
    if (targetType === "directory") {
      setDragOverFolder(targetFileName)
      e.dataTransfer.dropEffect = 'move'
    } else {
      setDragOverFolder(null)
      e.dataTransfer.dropEffect = 'none'
    }
  }

  const handleNativeDrop = (e: React.DragEvent, targetFileName: string, targetType: "file" | "directory") => {
    e.preventDefault()
    e.stopPropagation()

    // 检查是否是跨会话拖拽
    try {
      const jsonData = e.dataTransfer.getData('application/json')
      if (jsonData) {
        const dragData = JSON.parse(jsonData)
        // 跨会话拖拽到文件夹
        if (dragData.sourceSessionId !== sessionId && targetType === "directory") {
          const targetPath = `${currentPath}/${targetFileName}`.replace(/\/+/g, "/")
          // TODO: 这里需要页面层级实现跨会话上传逻辑
          setDragOverFolder(null)
          return
        }
      }
    } catch {
      // 不是JSON数据,继续处理本会话拖拽
    }

    // 本会话内拖拽
    if (!draggedFileName || draggedFileName === targetFileName) {
      setDragOverFolder(null)
      return
    }

    // 移动文件到文件夹
    if (targetType === "directory") {
      const newPath = `${currentPath}/${targetFileName}/${draggedFileName}`.replace(/\/+/g, "/")
      onRename(draggedFileName, newPath)
    }

    setDragOverFolder(null)
    setDraggedFileName(null)
  }

  // 文件拖拽处理（用于拖入文件夹）- 预留功能
  const _handleFileDragStart = (fileName: string) => {
    setDraggedFileName(fileName)
  }

  const _handleFileDragEnd = () => {
    setDraggedFileName(null)
    setDragOverFolder(null)
  }

  const _handleFileDragOver = (e: React.DragEvent, targetFileName: string, targetType: "file" | "directory", _targetIndex: number) => {
    e.preventDefault()
    e.stopPropagation()

    if (targetFileName === draggedFileName) {
      setDragOverFolder(null)
      setDragOverIndex(null)
      return
    }

    // 如果目标是文件夹，高亮文件夹（用于移入）
    if (targetType === "directory") {
      setDragOverFolder(targetFileName)
      setDragOverIndex(null)
    } else {
      // 如果目标是文件，显示插入位置（用于排序）
      setDragOverFolder(null)
      setDragOverIndex(_targetIndex)
    }
  }

  const _handleFileDragLeave = () => {
    setDragOverFolder(null)
    setDragOverIndex(null)
  }

  const _handleFileDrop = (e: React.DragEvent, targetFileName: string, targetType: "file" | "directory", _targetIndex: number) => {
    e.preventDefault()
    e.stopPropagation()

    if (!draggedFileName || draggedFileName === targetFileName) {
      setDragOverFolder(null)
      setDragOverIndex(null)
      return
    }

    // 移动文件到文件夹
    if (targetType === "directory" && dragOverFolder) {
      // TODO: 调用实际的移动API
      // onRename(draggedFileName, `${targetFileName}/${draggedFileName}`)
    }
    // 文件排序（暂时只是视觉效果，实际不改变服务器顺序）
    else if (dragOverIndex !== null) {
      // 注意：SFTP文件列表顺序通常由服务器决定，客户端排序可能无意义
      // 如果需要持久化排序，需要后端支持
    }

    setDragOverFolder(null)
    setDragOverIndex(null)
    setDraggedFileName(null)
  }

  // 空白区域右键菜单
  const handleBlankContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      isBlank: true,
      key: Date.now(),
    })
  }

  // 文件上传处理 - 移除内部进度管理,由 useFileTransfer Hook 处理
  const handleFileUpload = async (files: FileList) => {
    // 直接调用父组件的上传函数,进度管理由 useFileTransfer 处理
    await onUpload(files)
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      handleFileUpload(files)
    }
  }

  // 拖拽上传处理
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    // 只有外部文件才显示上传提示
    if (!draggedFileName && e.dataTransfer.types.includes('Files')) {
      setDragCounter(prev => prev + 1)
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    setDragCounter(prev => {
      const newCount = prev - 1
      if (newCount === 0) {
        setIsDragging(false)
      }
      return newCount
    })
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    setDragCounter(0) // 重置计数器

    // 检查是否是跨会话拖拽
    try {
      const jsonData = e.dataTransfer.getData('application/json')
      if (jsonData) {
        const dragData = JSON.parse(jsonData)
        if (dragData.sourceSessionId && dragData.sourceSessionId !== sessionId) {
          // TODO: 实现跨会话上传逻辑
          return
        }
      }
    } catch {
      // 不是JSON数据,继续检查其他类型
    }

    // 如果是内部文件拖拽到空白区，取消拖拽
    if (draggedFileName) {
      setDraggedFileName(null)
      setDragOverFolder(null)
      return
    }

    // 处理外部文件上传
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFileUpload(files)
    }
  }

  // 创建文件夹
  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim())
      setNewFolderName("")
      setShowCreateFolder(false)
    }
  }

  // 开始重命名
  const startRename = (fileName: string) => {
    // 清除任何待处理的 blur 定时器
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
      blurTimeoutRef.current = null
    }
    setEditingFile(fileName)
    setEditingFileName(fileName)
  }

  // 完成重命名
  const finishRename = useCallback(() => {
    if (editingFile && editingFileName.trim() && editingFileName !== editingFile) {
      onRename(editingFile, editingFileName.trim())
    }
    setEditingFile(null)
    setEditingFileName("")
  }, [editingFile, editingFileName, onRename])

  // 取消重命名
  const cancelRename = () => {
    setEditingFile(null)
    setEditingFileName("")
  }

  // 延迟处理重命名失焦 - 避免与其他事件冲突
  const handleRenameBlur = useCallback((e: React.FocusEvent) => {
    // 清除之前的定时器
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
    }

    // 检查焦点是否移到了文档外部或者其他非输入元素
    const relatedTarget = e.relatedTarget as HTMLElement

    // 如果焦点移动到了按钮、菜单项等，延迟处理以允许点击事件完成
    if (relatedTarget && (
      relatedTarget.tagName === 'BUTTON' ||
      relatedTarget.closest('[role="menuitem"]') ||
      relatedTarget.closest('[role="menu"]')
    )) {
      blurTimeoutRef.current = setTimeout(() => {
        // 再次检查，确保不是因为点击了其他操作
        if (editInputRef.current && !editInputRef.current.contains(document.activeElement)) {
          finishRename()
        }
      }, 150)
    } else {
      // 其他情况立即完成
      blurTimeoutRef.current = setTimeout(() => finishRename(), 50)
    }
  }, [finishRename])

  // 完成创建
  const finishCreate = useCallback(async () => {
    if (editingFileName.trim()) {
      if (creatingNew === "folder") {
        onCreateFolder(editingFileName.trim())
      } else if (creatingNew === "file") {
        // 创建空文件
        if (onCreateFile) {
          onCreateFile(editingFileName.trim())
        } else if (onSaveFile) {
          // 回退方案:使用saveFile创建空文件
          try {
            await onSaveFile(editingFileName.trim(), "")
          } catch (error) {
            console.error("创建文件失败:", error)
          }
        }
      }
    }
    setCreatingNew(null)
    setEditingFileName("")
  }, [editingFileName, creatingNew, onCreateFolder, onCreateFile, onSaveFile, onRefresh])

  // 延迟处理创建失焦
  const handleCreateBlur = useCallback((e: React.FocusEvent) => {
    // 清除之前的定时器
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
    }

    const relatedTarget = e.relatedTarget as HTMLElement

    if (relatedTarget && (
      relatedTarget.tagName === 'BUTTON' ||
      relatedTarget.closest('[role="menuitem"]') ||
      relatedTarget.closest('[role="menu"]')
    )) {
      blurTimeoutRef.current = setTimeout(() => {
        if (editInputRef.current && !editInputRef.current.contains(document.activeElement)) {
          finishCreate()
        }
      }, 150)
    } else {
      blurTimeoutRef.current = setTimeout(() => finishCreate(), 50)
    }
  }, [finishCreate])

  // 开始创建新文件/文件夹
  const startCreateNew = (type: "file" | "folder") => {
    setCreatingNew(type)
    const newName = type === "folder" ? "新建文件夹" : "新建文件.txt"
    setEditingFileName(newName)
  }

  // 取消创建
  const cancelCreate = () => {
    setCreatingNew(null)
    setEditingFileName("")
  }

  // 开始编辑会话标签
  const startEditSessionLabel = () => {
    setEditingSessionLabel(true)
    setTempSessionLabel(sessionLabel)
    setTimeout(() => {
      sessionLabelInputRef.current?.focus()
      sessionLabelInputRef.current?.select()
    }, 0)
  }

  // 完成编辑会话标签
  const finishEditSessionLabel = () => {
    if (tempSessionLabel?.trim() && onRenameSession) {
      onRenameSession(tempSessionLabel.trim())
    }
    setEditingSessionLabel(false)
  }

  // 取消编辑会话标签
  const cancelEditSessionLabel = () => {
    setEditingSessionLabel(false)
    setTempSessionLabel(sessionLabel)
  }

  // 关闭文件编辑器
  const handleCloseEditor = () => {
    setEditorState({
      isOpen: false,
      fileName: "",
      filePath: "",
      content: "",
    })
  }

  // 保存文件
  const handleSaveFile = async (content: string) => {
    if (!onSaveFile) {
      console.warn("onSaveFile 回调未提供")
      return
    }

    try {
      await onSaveFile(editorState.fileName, content)
      // 更新编辑器状态中的内容
      setEditorState(prev => ({ ...prev, content }))
    } catch (error) {
      console.error("保存文件失败:", error)
      throw error
    }
  }

  // 批量下载
  const handleBatchDownload = useCallback(async (mode: "fast" | "compatible" = defaultDownloadMode) => {
    const paths = selectedFiles.length > 0
      ? selectedFiles
      : contextMenu?.fileName
      ? [contextMenu.fileName]
      : []

    if (paths.length === 0) return

    if (onBatchDownload) {
      try {
        await onBatchDownload(paths, mode, excludePatterns)
        setSelectedFiles([])
      } catch (error) {
        console.error('[SftpManager] 批量下载失败:', error)
        alert(`批量下载失败: ${error instanceof Error ? error.message : '未知错误'}`)
      }
    } else {
      // 降级到循环调用单个下载
      paths.forEach(path => onDownload(path))
      setSelectedFiles([])
    }
  }, [selectedFiles, contextMenu, onDownload, onBatchDownload, excludePatterns, defaultDownloadMode])

  // 批量删除
  const handleBatchDelete = useCallback(async () => {
    if (selectedFiles.length === 0) return

    // 如果提供了批量删除接口，使用批量删除
    if (onBatchDelete) {
      try {
        const result = await onBatchDelete(selectedFiles)

        // 显示结果
        if (result.failed.length > 0) {
          const failedNames = result.failed.map(f => f.path.split('/').pop()).join(', ')
          alert(`删除完成：成功 ${result.success.length} 个，失败 ${result.failed.length} 个\n失败的文件：${failedNames}`)
        }

        setSelectedFiles([])
      } catch (error) {
        console.error('[SftpManager] 批量删除失败:', error)
        alert(`批量删除失败: ${error instanceof Error ? error.message : '未知错误'}`)
      }
    } else {
      // 降级到循环调用单个删除
      selectedFiles.forEach(fileName => onDelete(fileName))
      setSelectedFiles([])
    }
  }, [selectedFiles, onDelete, onBatchDelete])

  // 清除已完成任务 - 使用外部传入的处理函数
  const handleClearCompleted = () => {
    if (onClearCompletedTransfers) {
      onClearCompletedTransfers()
    }
  }

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果正在编辑,不处理快捷键
      if (editingFile || creatingNew || editingSessionLabel || editorState.isOpen) return

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey

      // Ctrl/Cmd + A: 全选
      if (cmdOrCtrl && e.key === 'a') {
        e.preventDefault()
        handleSelectAll()
      }

      // Delete/Backspace: 删除选中文件
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFiles.length > 0) {
        e.preventDefault()
        handleBatchDelete()
      }

      // F2: 重命名 (仅单选时)
      if (e.key === 'F2' && selectedFiles.length === 1) {
        e.preventDefault()
        startRename(selectedFiles[0])
      }

      // Ctrl/Cmd + D: 下载选中文件
      if (cmdOrCtrl && e.key === 'd' && selectedFiles.length > 0) {
        e.preventDefault()
        handleBatchDownload()
      }

      // Ctrl/Cmd + R: 刷新
      if (cmdOrCtrl && e.key === 'r') {
        e.preventDefault()
        onRefresh()
      }

      // Ctrl/Cmd + Shift + N: 新建文件夹
      if (cmdOrCtrl && e.shiftKey && e.key === 'N') {
        e.preventDefault()
        startCreateNew('folder')
      }

      // Ctrl/Cmd + N: 新建文件
      if (cmdOrCtrl && !e.shiftKey && e.key === 'n') {
        e.preventDefault()
        startCreateNew('file')
      }

      // Ctrl/Cmd + U: 上传文件
      if (cmdOrCtrl && e.key === 'u') {
        e.preventDefault()
        fileInputRef.current?.click()
      }

      // ESC: 取消选择 / 关闭编辑器
      if (e.key === 'Escape') {
        if (selectedFiles.length > 0) {
          setSelectedFiles([])
        } else if (editorState.isOpen) {
          handleCloseEditor()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    selectedFiles,
    editingFile,
    creatingNew,
    editingSessionLabel,
    editorState.isOpen,
    onRefresh,
    handleBatchDelete,
    handleBatchDownload,
    handleSelectAll,
  ])

  // 获取文件类型信息（用于 3D File 组件）
  const getFileTypeInfo = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || ''

    // 代码文件
    if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'go', 'rs', 'sh', 'bash'].includes(ext)) {
      return { color: '#A66CFF', label: ext.toUpperCase(), icon: <FileCode className="h-4 w-4" /> }
    }
    // 图片文件
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'].includes(ext)) {
      return { color: '#FF6C9D', label: ext.toUpperCase(), icon: <FileImage className="h-4 w-4" /> }
    }
    // 视频文件
    if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'].includes(ext)) {
      return { color: '#FF5757', label: ext.toUpperCase(), icon: <FileVideo className="h-4 w-4" /> }
    }
    // 音频文件
    if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext)) {
      return { color: '#FFA94D', label: ext.toUpperCase(), icon: <FileAudio className="h-4 w-4" /> }
    }
    // 压缩文件
    if (['zip', 'tar', 'gz', 'rar', '7z', 'bz2', 'xz'].includes(ext)) {
      return { color: '#FFD93D', label: ext.toUpperCase(), icon: <FileArchive className="h-4 w-4" /> }
    }
    // 数据库文件
    if (['sql', 'db', 'sqlite', 'mdb'].includes(ext)) {
      return { color: '#6BCF7F', label: ext.toUpperCase(), icon: <Database className="h-4 w-4" /> }
    }
    // 文本文件
    if (['txt', 'md', 'json', 'xml', 'yaml', 'yml', 'csv', 'log'].includes(ext)) {
      return { color: '#4D96FF', label: ext.toUpperCase(), icon: <FileText className="h-4 w-4" /> }
    }
    // 默认文件
    return { color: '#95A5A6', label: ext.toUpperCase() || 'FILE', icon: <FileText className="h-4 w-4" /> }
  }

  // 文件图标 - Mac 风格（用于列表视图）
  const getFileIcon = (file: FileItem) => {
    if (file.type === "directory") {
      return <FolderOpen className="h-4 w-4 text-blue-500" />
    }

    const ext = file.name.split('.').pop()?.toLowerCase()

    // 代码文件
    if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'go', 'rs', 'sh', 'bash'].includes(ext || '')) {
      return <FileCode className="h-4 w-4 text-purple-500" />
    }

    // 图片文件
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'].includes(ext || '')) {
      return <FileImage className="h-4 w-4 text-pink-500" />
    }

    // 视频文件
    if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'].includes(ext || '')) {
      return <FileVideo className="h-4 w-4 text-red-500" />
    }

    // 音频文件
    if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext || '')) {
      return <FileAudio className="h-4 w-4 text-orange-500" />
    }

    // 压缩文件
    if (['zip', 'tar', 'gz', 'rar', '7z', 'bz2', 'xz'].includes(ext || '')) {
      return <FileArchive className="h-4 w-4 text-yellow-500" />
    }

    // 数据库文件
    if (['sql', 'db', 'sqlite', 'mdb'].includes(ext || '')) {
      return <Database className="h-4 w-4 text-green-500" />
    }

    // 文本文件
    if (['txt', 'md', 'json', 'xml', 'yaml', 'yml', 'csv', 'log'].includes(ext || '')) {
      return <FileText className="h-4 w-4 text-blue-400" />
    }

    // 默认文件
    return <FileText className="h-4 w-4 text-muted-foreground" />
  }

  // 文件大小格式化（预留功能）
  const _formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  // 路径分段 - 根据编辑器状态动态选择路径源
  const displayPath = editorState.isOpen ? editorState.filePath : currentPath
  const pathSegments = useMemo(() => displayPath.split("/").filter(Boolean), [displayPath])

  // 同步路径输入框的值
  useEffect(() => {
    if (!isEditingPath) {
      setPathInputValue(currentPath)
    }
  }, [currentPath, isEditingPath])

  // 当进入编辑/创建状态时,自动聚焦并选中输入框
  useLayoutEffect(() => {
    if (editingFile || creatingNew) {
      // 使用 requestAnimationFrame + setTimeout 确保在所有渲染和动画完成后聚焦
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (editInputRef.current) {
            editInputRef.current.focus()
            editInputRef.current.select()
          }
        }, 100) // 增加延迟,等待 DropdownMenu 完全关闭
      })
    }
  }, [editingFile, creatingNew])

  // 当用户切换视图时持久化偏好（按上下文区分）
  useEffect(() => {
    try {
      const key = `easyssh:sftp:viewMode:${pageContext}`
      window.localStorage.setItem(key, viewMode)
    } catch {}
  }, [viewMode, pageContext])

  // 传输状态图标
  const getStatusIcon = (status: TransferTask["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "cancelled":
        return <XCircle className="h-4 w-4 text-zinc-400" />
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />
    }
  }

  // Context value for nested components
  const sessionContextValue = useMemo(() => ({
    sessionId,
    sessionLabel,
    sessionColor,
    serverId,
    serverName,
    host,
    username,
    isConnected,
    isFullscreen,
    currentPath,
    files,
    onNavigate,
    onUpload,
    onDownload,
    onDelete,
    onCreateFolder,
    onRename,
    onDisconnect,
    onRefresh,
    onReadFile,
    onSaveFile,
    onRenameSession,
    onToggleFullscreen,
  }), [
    currentPath,
    files,
    host,
    isConnected,
    isFullscreen,
    onCreateFolder,
    onDownload,
    onNavigate,
    onRefresh,
    onRename,
    onRenameSession,
    onSaveFile,
    onReadFile,
    onUpload,
    onDelete,
    onDisconnect,
    onToggleFullscreen,
    serverId,
    serverName,
    sessionColor,
    sessionId,
    sessionLabel,
    username,
  ])

  const stickyHeaderCellClass = "sticky top-0 z-20 bg-background supports-[backdrop-filter]:backdrop-blur-sm shadow-sm"

  // 处理修改权限
  const handleChmod = async (mode: string) => {
    try {
      const { sftpApi } = await import("@/lib/api/sftp")
      await sftpApi.chmod(serverId, chmodDialog.filePath, mode)
      // 刷新文件列表
      onRefresh()
    } catch (error) {
      console.error("Failed to chmod:", error)
      alert(`修改权限失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // 主界面内容
  const managerContent = (
    <TooltipProvider delayDuration={300}>
      <SftpSessionProvider value={sessionContextValue}>
      <div
        className={cn(
          "flex flex-col h-full overflow-hidden transition-colors bg-background",
          isFullscreen ? "fixed inset-0 z-[9999] rounded-none border-0" : "rounded-xl border"
        )}
      >
      {/* 工具栏 */}
      <div className="border-b text-sm flex items-center justify-between px-3 py-1.5">
        {/* 左侧: 会话标签 - 带拖拽手柄 */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* 拖拽手柄区域 */}
          <div
            className="flex items-center gap-2 cursor-grab active:cursor-grabbing hover:bg-muted/50 px-1.5 py-0.5 -ml-1.5 rounded transition-colors"
            {...dragHandleListeners}
            {...dragHandleAttributes}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground/40 hover:text-muted-foreground transition-colors" />

            {/* 会话颜色指示器 */}
            {sessionColor && (
              <div
                className="w-1 h-5 rounded-full"
                style={{ backgroundColor: sessionColor }}
              />
            )}
          </div>

          {/* 可编辑的会话标签 */}
          {editingSessionLabel ? (
            <Input
              ref={sessionLabelInputRef}
              value={tempSessionLabel}
              onChange={(e) => setTempSessionLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  finishEditSessionLabel()
                } else if (e.key === "Escape") {
                  cancelEditSessionLabel()
                }
              }}
              onBlur={finishEditSessionLabel}
              className={cn(
                "h-6 text-xs font-semibold px-2 max-w-[150px] bg-white text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200",
              )}
            />
          ) : (
            <button
              onClick={startEditSessionLabel}
              onDoubleClick={startEditSessionLabel}
              className={cn(
                "text-xs font-semibold px-2 py-1 rounded transition-colors hover:bg-zinc-200 text-zinc-800 dark:hover:bg-zinc-800/60 dark:text-zinc-200",
              )}
              title="双击编辑会话名称"
            >
              {sessionLabel}
            </button>
          )}

          <div className={cn(
            "h-4 w-px mx-1 bg-zinc-300 dark:bg-zinc-800/50",
          )} />

          {/* 路径导航/编辑框 - 混合模式 */}
          <div className="flex items-center gap-2 ml-2 flex-1 min-w-0">
            <div className="relative flex-1 min-w-0">
              {isEditingPath ? (
                <>
                  {/* Home图标按钮 - 编辑模式 */}
                  <button
                    onClick={() => onNavigate("/")}
                    className={cn(
                      "absolute left-2 top-1/2 -translate-y-1/2 z-10 p-0.5 rounded-md",
                      "text-zinc-600 dark:text-zinc-400",
                      "hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800/60 dark:hover:text-white",
                      "transition-all duration-200"
                    )}
                    title="根目录"
                  >
                    <Home className="h-3.5 w-3.5" />
                  </button>

                  {/* 路径输入框 - 编辑模式 */}
                  <Input
                    value={pathInputValue}
                    onChange={(e) => setPathInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur()
                        const newPath = e.currentTarget.value.trim()
                        if (newPath && newPath !== currentPath) {
                          onNavigate(newPath)
                        }
                        setIsEditingPath(false)
                      } else if (e.key === "Escape") {
                        setPathInputValue(currentPath)
                        setIsEditingPath(false)
                        e.currentTarget.blur()
                      }
                    }}
                    onBlur={(e) => {
                      setIsEditingPath(false)
                      const newPath = e.target.value.trim()
                      if (newPath && newPath !== currentPath) {
                        onNavigate(newPath)
                      } else {
                        setPathInputValue(currentPath)
                      }
                    }}
                    autoFocus
                    placeholder="输入路径..."
                    className={cn(
                      "h-7 text-xs font-mono pl-8 pr-3 py-1 border-0 bg-zinc-100 dark:bg-zinc-900/50",
                      "placeholder:text-zinc-400 dark:placeholder:text-zinc-600",
                    )}
                  />
                </>
              ) : (
                /* 路径面包屑 - 显示模式 */
                <div
                  onClick={() => setIsEditingPath(true)}
                  className={cn(
                    "h-7 flex items-center gap-1 pl-8 pr-3 py-1 border-0 bg-zinc-100 dark:bg-zinc-900/50",
                    "text-xs font-mono cursor-text rounded-md overflow-x-auto scrollbar-thin",
                    "hover:bg-zinc-200 dark:hover:bg-zinc-800/60 transition-colors"
                  )}
                  title="点击编辑路径"
                >
                  {/* Home图标 - 显示模式 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onNavigate("/")
                    }}
                    className={cn(
                      "absolute left-2 top-1/2 -translate-y-1/2 p-0.5 rounded-md",
                      "text-zinc-600 dark:text-zinc-400",
                      "hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800/60 dark:hover:text-white",
                      "transition-all duration-200"
                    )}
                    title="根目录"
                  >
                    <Home className="h-3.5 w-3.5" />
                  </button>

                  {/* 可点击的路径段 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onNavigate("/")
                    }}
                    className={cn(
                      "px-1.5 py-0.5 rounded-md whitespace-nowrap",
                      "text-zinc-600 dark:text-zinc-400",
                      "hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800/60 dark:hover:text-white",
                      "transition-all duration-200",
                    )}
                  >
                    /
                  </button>
                  {pathSegments.map((segment, index) => {
                    const segmentPath = "/" + pathSegments.slice(0, index + 1).join("/")
                    const isLastSegment = index === pathSegments.length - 1
                    const isFileName = editorState.isOpen && isLastSegment

                    return (
                      <div key={index} className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (isFileName) {
                              // 点击文件名时不做任何操作（文件已打开）
                              return
                            }
                            onNavigate(segmentPath)
                          }}
                          className={cn(
                            "px-1.5 py-0.5 rounded-md whitespace-nowrap transition-all duration-200",
                            isFileName
                              ? "font-semibold text-blue-600 dark:text-blue-400 cursor-default"
                              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800/60 dark:hover:text-white",
                          )}
                        >
                          {segment}
                        </button>
                        {index < pathSegments.length - 1 && <span className="text-zinc-400">/</span>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右侧工具按钮 */}
        <div className="flex items-center gap-1">
          {/* 视图切换 */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 rounded-md transition-all duration-200",
              viewMode === "grid"
                ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800/60 dark:text-white"
                : "hover:bg-zinc-200 hover:text-zinc-900 text-zinc-600 dark:hover:bg-zinc-800/60 dark:hover:text-white dark:text-zinc-400",
            )}
            onClick={() => setViewMode("grid")}
            title="图标视图"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 rounded-md transition-all duration-200",
              viewMode === "list"
                ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800/60 dark:text-white"
                : "hover:bg-zinc-200 hover:text-zinc-900 text-zinc-600 dark:hover:bg-zinc-800/60 dark:hover:text-white dark:text-zinc-400",
            )}
            onClick={() => setViewMode("list")}
            title="列表视图"
          >
            <List className="h-3.5 w-3.5" />
          </Button>

          {/* 上传任务按钮（仅在传入 transferTasks 时展示） */}
          {transferTasks && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-7 w-7 rounded-md transition-all duration-200 hover:bg-zinc-200 hover:text-zinc-900 text-zinc-600 dark:hover:bg-zinc-800/60 dark:hover:text-white dark:text-zinc-400 relative",
                  )}
                  title="传输任务"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {effectiveTransferTasks.filter(t => t.status !== "completed" && t.status !== "failed" && t.status !== "cancelled").length > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-blue-500 text-white text-[10px] font-medium flex items-center justify-center">
                      {effectiveTransferTasks.filter(t => t.status !== "completed" && t.status !== "failed" && t.status !== "cancelled").length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[400px] max-h-[500px] overflow-hidden">
                {/* 头部 */}
                <div className="px-3 py-2 flex items-center justify-between border-b">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">
                      传输任务 ({effectiveTransferTasks.length})
                    </span>
                  </div>
                  {effectiveTransferTasks.some(t => t.status === "completed" || t.status === "failed" || t.status === "cancelled") && onClearCompletedTransfers && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={handleClearCompleted}
                    >
                      清除已完成
                    </Button>
                  )}
                </div>

                {/* 任务列表 */}
                {effectiveTransferTasks.length > 0 ? (
                  <div className="max-h-[400px] overflow-y-auto">
                    {effectiveTransferTasks.map(task => (
                      <div
                        key={task.id}
                        className={cn(
                          "px-3 py-2 border-b last:border-b-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors",
                        )}
                      >
                        {/* 文件名和状态 */}
                        <div className="flex items-center gap-2 mb-1.5">
                          {getStatusIcon(task.status)}
                          <span className="text-sm font-medium truncate flex-1">
                            {task.fileName}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] h-4 px-1 shrink-0"
                          >
                            {task.type === "upload" ? "上传" : "下载"}
                          </Badge>
                        </div>

                        {/* 进度条 */}
                        {task.status !== "completed" && task.status !== "failed" && (
                          <Progress value={task.progress} className="h-1 mb-1.5" />
                        )}

                        {/* 详细信息 + 取消操作 */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          {task.status === "uploading" || task.status === "downloading" ? (
                            <>
                              {task.stage && (
                                <>
                                  <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                    {task.stage === 'http' ? 'HTTP' : 'SFTP'}
                                  </Badge>
                                  <span>•</span>
                                </>
                              )}
                              <span>{task.speed}</span>
                              <span>•</span>
                              <span>{task.timeRemaining}</span>
                            </>
                          ) : task.status === "completed" ? (
                            <span className="text-green-600 dark:text-green-400">已完成</span>
                          ) : task.status === "failed" ? (
                            <span className="text-red-600 dark:text-red-400">失败</span>
                          ) : task.status === "cancelled" ? (
                            <span className="text-zinc-500 dark:text-zinc-400">已取消</span>
                          ) : null}
                        </div>
                          <div className="flex items-center gap-2">
                            <span>{task.progress}%</span>
                            {onCancelTransfer && (task.status === "uploading" || task.status === "downloading") && (
                              <button
                                type="button"
                                onClick={() => onCancelTransfer(task.id)}
                                className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-red-500 transition-colors"
                              >
                                <XCircle className="h-3 w-3" />
                                <span>取消</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                    暂无传输任务
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* 全屏/退出全屏按钮 */}
          {onToggleFullscreen && (
            <Button
              variant="ghost"
              size="icon"
            className={cn(
              "h-7 w-7 rounded-md transition-all duration-200 hover:scale-105 hover:bg-zinc-200 hover:text-zinc-900 text-zinc-600 dark:hover:bg-zinc-800/60 dark:hover:text-white dark:text-zinc-400",
            )}
              onClick={onToggleFullscreen}
              title={isFullscreen ? "退出全屏 (ESC)" : "全屏"}
            >
              {isFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 rounded-md transition-all duration-200 hover:bg-zinc-200 hover:text-zinc-900 text-zinc-600 dark:hover:bg-zinc-800/60 dark:hover:text-white dark:text-zinc-400",
            )}
            onClick={onDisconnect}
            title="关闭"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 如果编辑器打开，只显示编辑器；否则显示搜索栏+文件列表 */}
      {editorState.isOpen ? (
        <FileEditor
          fileName={editorState.fileName}
          filePath={editorState.filePath}
          fileContent={editorState.content}
          isOpen={editorState.isOpen}
          onClose={handleCloseEditor}
          onSave={handleSaveFile}
          onDownload={() => onDownload(editorState.fileName)}
        />
      ) : (
        <>
          {/* 搜索栏 */}
          <div className="px-3 py-2 border-b flex items-center gap-2">
            {/* 返回上级目录按钮 */}
            {pathSegments.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-7 w-7 rounded-md transition-all duration-200 hover:scale-105 hover:bg-zinc-200 hover:text-zinc-900 text-zinc-600 dark:hover:bg-zinc-800/60 dark:hover:text-white dark:text-zinc-400",
                )}
                onClick={() => {
                  const parentPath = pathSegments.slice(0, -1).join("/")
                  onNavigate(parentPath ? `/${parentPath}` : "/")
                }}
                title="返回上级目录"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
            )}

            <div className="relative flex-1 max-w-xs">
              <Search className={cn(
                "absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500",
              )} />
              <Input
                placeholder="搜索文件..."
                className={cn(
                  "h-7 pl-8 pr-2 text-xs border-0 bg-zinc-100 dark:bg-zinc-900/50",
                )}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            {/* 显示/隐藏隐藏文件按钮 */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 rounded-md transition-all duration-200",
                showHidden
                  ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800/60 dark:text-white"
                  : "hover:bg-zinc-200 hover:text-zinc-900 text-zinc-600 dark:hover:bg-zinc-800/60 dark:hover:text-white dark:text-zinc-400",
              )}
              onClick={() => setShowHidden(!showHidden)}
              title={showHidden ? "隐藏隐藏文件" : "显示隐藏文件"}
            >
              {showHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </Button>

            {/* 刷新按钮 */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 rounded-md transition-all duration-200 hover:scale-105 hover:bg-zinc-200 hover:text-zinc-900 text-zinc-600 dark:hover:bg-zinc-800/60 dark:hover:text-white dark:text-zinc-400",
              )}
              onClick={onRefresh}
              title="刷新"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>

            {/* 已选择文件提示 */}
            {selectedFiles.length > 0 && (
              <div className={cn(
                "flex items-center gap-2 text-xs px-2 py-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400",
              )}>
                <span>已选择 {selectedFiles.length} 项</span>
              </div>
            )}
          </div>

          {/* 主内容区域 - 文件列表 */}
          <div
            ref={dropZoneRef}
            className={cn(
              "flex-1 relative min-h-0",
              viewMode === "grid" ? "overflow-auto scrollbar-custom" : "",
              isDragging && "bg-blue-500/10"
            )}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => setSelectedFiles([])}
            onContextMenu={handleBlankContextMenu}
          >
            {/* 拖拽遮罩 */}
            {isDragging && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-500/20 backdrop-blur-sm border-2 border-dashed border-blue-500 m-4 rounded-lg">
                <div className="text-center">
                  <Upload className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                  <p className="text-lg font-semibold text-blue-500">拖放文件到这里上传</p>
                  <p className="text-sm text-muted-foreground mt-2">支持多文件上传</p>
                </div>
              </div>
            )}

        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner size="lg" label="正在加载文件列表..." />
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <FolderOpen className={cn(
                "h-16 w-16 mx-auto mb-4 text-zinc-300 dark:text-zinc-700",
              )} />
              <h3 className={cn(
                "text-lg font-semibold mb-2 text-zinc-600 dark:text-zinc-500",
              )}>
                目录为空
              </h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm ? "没有匹配的文件" : "此目录下没有文件或文件夹"}
              </p>
            </div>
          </div>
        ) : viewMode === "grid" ? (
          <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {/* 新建项 */}
                {creatingNew && (
              <div
                className={cn(
                  "group relative rounded-lg p-3 cursor-pointer select-none transition-all bg-zinc-200/60 dark:bg-zinc-800/60",
                )}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center justify-center h-16 w-16">
                    {creatingNew === "folder" ? (
                      <Folder color="#5BA4FC" size={0.6} isFocused={true} />
                    ) : (
                      <FileIcon
                        color="#4D96FF"
                        size={0.6}
                        fileType="TXT"
                        isFocused={true}
                      />
                    )}
                  </div>
                  <div className="text-center w-full">
                    <Input
                      ref={editInputRef}
                      value={editingFileName}
                      onChange={(e) => setEditingFileName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          finishCreate()
                        } else if (e.key === "Escape") {
                          cancelCreate()
                        }
                      }}
                      onBlur={handleCreateBlur}
                      className={cn(
                        "h-6 text-xs text-center px-1 bg-white text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200",
                      )}
                    />
                    <div className="text-[10px] text-muted-foreground truncate mt-1">
                      {creatingNew === "folder" ? "目录" : "0 B"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {filteredFiles.map((file) => {
              const isSelected = selectedFiles.includes(file.name)
              const isEditing = editingFile === file.name
              const isDraggedOver = dragOverFolder === file.name

              return (
                <div
                  key={file.name}
                  draggable={!isEditing}
                  onDragStart={(e) => handleNativeDragStart(e, file.name)}
                  onDragEnd={handleNativeDragEnd}
                  onDragOver={(e) => handleNativeDragOver(e, file.name, file.type)}
                  onDragLeave={(e) => {
                    e.preventDefault()
                    setDragOverFolder(null)
                  }}
                  onDrop={(e) => handleNativeDrop(e, file.name, file.type)}
                  onClick={(e) => {
                    if (!isEditing) {
                      handleFileClick(file.name, e)
                    }
                  }}
                  onDoubleClick={() => {
                    if (!isEditing) {
                      handleFileDoubleClick(file.name, file.type)
                    }
                  }}
                  onContextMenu={(e) => handleContextMenu(e, file.name, file.type)}
                  className={cn(
                    "group relative rounded-lg p-3 cursor-pointer select-none transition-all",
                    (isSelected || (isDraggedOver && file.type === "directory")) && "bg-zinc-200/60 dark:bg-zinc-800/60",
                    draggedFileName === file.name && "opacity-50"
                  )}
                  title={file.name}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center justify-center h-16 w-16">
                      {file.type === "directory" ? (
                        <Folder color="#5BA4FC" size={0.6} isFocused={isSelected} />
                      ) : (() => {
                        const fileTypeInfo = getFileTypeInfo(file.name)
                        return (
                          <FileIcon
                            color={fileTypeInfo.color}
                            size={0.6}
                            fileType={fileTypeInfo.label}
                            isFocused={isSelected}
                          />
                        )
                      })()}
                    </div>
                    <div className="text-center w-full">
                      {isEditing ? (
                        <Input
                          ref={editInputRef}
                          value={editingFileName}
                          onChange={(e) => setEditingFileName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              finishRename()
                            } else if (e.key === "Escape") {
                              cancelRename()
                            }
                          }}
                          onBlur={handleRenameBlur}
                          className={cn(
                            "h-6 text-xs text-center px-1 bg-white text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200",
                          )}
                        />
                      ) : (
                        <div className={cn(
                          "text-xs font-medium truncate text-zinc-800 dark:text-zinc-200",
                        )}>
                          {file.name}
                        </div>
                      )}
                      <div className="text-[10px] text-muted-foreground truncate">
                        {file.type === "directory" ? "目录" : file.size}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <Table
            wrapperClassName="overflow-auto h-full scrollbar-custom"
            className="sftp-table text-xs [&_th]:h-9 [&_th]:px-3 [&_th]:text-xs [&_td]:px-3 [&_td]:py-1.5 [&_td]:align-middle"
          >
            <TableHeader className="sticky top-0 z-20 bg-background supports-[backdrop-filter]:backdrop-blur-sm shadow-sm">
              <TableRow className={cn(
                "border-b border-zinc-200 dark:border-zinc-800/50 text-xs",
              )}>
                <TableHead
                  className={cn(stickyHeaderCellClass, "cursor-pointer hover:text-foreground")}
                  onClick={() => {
                    setSortBy("name")
                    setSortOrder(prev => prev === "asc" ? "desc" : "asc")
                  }}
                >
                  名称 {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead
                  className={cn(stickyHeaderCellClass, "cursor-pointer hover:text-foreground")}
                  onClick={() => {
                    setSortBy("size")
                    setSortOrder(prev => prev === "asc" ? "desc" : "asc")
                  }}
                >
                  大小 {sortBy === "size" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead
                  className={cn(stickyHeaderCellClass, "cursor-pointer hover:text-foreground")}
                  onClick={() => {
                    setSortBy("modified")
                    setSortOrder(prev => prev === "asc" ? "desc" : "asc")
                  }}
                >
                  修改时间 {sortBy === "modified" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead className={cn(stickyHeaderCellClass)}>
                  权限
                </TableHead>
                <TableHead className={cn(stickyHeaderCellClass, "text-right")}>
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* 新建项 */}
              {creatingNew && (
                <TableRow
                  className={cn(
                    "cursor-pointer transition-colors bg-zinc-100 dark:bg-zinc-800/50 border-b-0",
                  )}
                >
                  <TableCell onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={false}
                      disabled
                      className="rounded"
                    />
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      {creatingNew === "folder" ? (
                        <FolderOpen className="h-4 w-4 text-blue-500" />
                      ) : (
                        <FileText className="h-4 w-4 text-blue-400" />
                      )}
                      <Input
                        ref={editInputRef}
                        value={editingFileName}
                        onChange={(e) => setEditingFileName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            finishCreate()
                          } else if (e.key === "Escape") {
                            cancelCreate()
                          }
                          e.stopPropagation()
                        }}
                        onBlur={handleCreateBlur}
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "h-7 text-sm px-2 flex-1 bg-white text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200",
                        )}
                      />
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">
                      {creatingNew === "folder" ? "-" : "0 B"}
                    </span>
                  </TableCell>

                  <TableCell>
                    <span className="text-xs text-muted-foreground">刚刚</span>
                  </TableCell>

                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">-</span>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="h-7 w-7" />
                  </TableCell>
                </TableRow>
              )}

              {filteredFiles.map((file) => {
                const isDraggedOver = dragOverFolder === file.name
                return (
                  <TableRow
                    key={file.name}
                    draggable={editingFile !== file.name}
                    onDragStart={(e) => handleNativeDragStart(e, file.name)}
                    onDragEnd={handleNativeDragEnd}
                    onDragOver={(e) => handleNativeDragOver(e, file.name, file.type)}
                    onDragLeave={(e) => {
                      e.preventDefault()
                      setDragOverFolder(null)
                    }}
                    onDrop={(e) => handleNativeDrop(e, file.name, file.type)}
                    className={cn(
                      "cursor-pointer transition-colors border-b-0",
                      (selectedFiles.includes(file.name) || (isDraggedOver && file.type === "directory")) && "bg-zinc-100 dark:bg-zinc-800/50",
                      "hover:bg-zinc-50 dark:hover:bg-zinc-800/30",
                      draggedFileName === file.name && "opacity-50"
                    )}
                    onClick={e => {
                      handleFileClick(file.name, e)
                    }}
                    onDoubleClick={() => {
                      handleFileDoubleClick(file.name, file.type)
                    }}
                    onContextMenu={(e) => handleContextMenu(e, file.name, file.type)}
                  >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getFileIcon(file)}
                      {editingFile === file.name ? (
                        <Input
                          ref={editInputRef}
                          value={editingFileName}
                          onChange={(e) => setEditingFileName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              finishRename()
                            } else if (e.key === "Escape") {
                              cancelRename()
                            }
                            e.stopPropagation()
                          }}
                          onBlur={handleRenameBlur}
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            "h-7 text-sm px-2 flex-1 bg-white text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200",
                          )}
                        />
                      ) : (
                        <>
                          <span className="font-medium text-sm">{file.name}</span>
                          {file.type === "directory" && (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">
                      {file.type === "directory" ? "-" : file.size}
                    </span>
                  </TableCell>

                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {file.modified}
                    </span>
                  </TableCell>

                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">
                      {file.permissions}
                    </span>
                  </TableCell>

                  <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-7 w-7 p-0 transition-all hover:bg-zinc-200 dark:hover:bg-zinc-800/60 dark:hover:text-white",
                          )}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className={cn(
                          "min-w-[180px] rounded-lg backdrop-blur-xl bg-white/95 border-zinc-200/50 dark:bg-zinc-900/95 dark:border-zinc-700/50",
                        )}
                      >
                        <FileActionMenu
                          file={file}
                          mode="dropdown"
                          selectedFilesCount={selectedFiles.length}
                          onAction={(action: FileAction) => {
                            switch (action) {
                              case "open":
                                if (file.type === "directory") {
                                  onNavigate(`${currentPath}/${file.name}`.replace(/\/+/g, "/"))
                                } else {
                                  handleOpenEditor(file.name)
                                }
                                break
                              case "download":
                                onDownload(file.name)
                                break
                              case "download-fast":
                                setSelectedFiles([file.name])
                                handleBatchDownload("fast")
                                break
                              case "download-compatible":
                                setSelectedFiles([file.name])
                                handleBatchDownload("compatible")
                                break
                              case "rename":
                                setTimeout(() => {
                                  startRename(file.name)
                                }, 50)
                                break
                              case "chmod":
                                setChmodDialog({
                                  isOpen: true,
                                  fileName: file.name,
                                  filePath: `${currentPath}/${file.name}`.replace(/\/+/g, '/'),
                                  permissions: file.permissions,
                                })
                                break
                              case "delete":
                                onDelete(file.name)
                                break
                            }
                          }}
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                )
              })}
            </TableBody>
          </Table>
            )}

            {/* 隐藏的文件输入 */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              tabIndex={-1}
              onChange={handleInputChange}
            />
          </div>
        </>
      )}

      {/* 权限修改对话框 */}
      <ChmodDialog
        open={chmodDialog.isOpen}
        onOpenChange={(open) => setChmodDialog(prev => ({ ...prev, isOpen: open }))}
        fileName={chmodDialog.fileName}
        currentPermissions={chmodDialog.permissions}
        onConfirm={handleChmod}
      />


      {/* 新建文件夹对话框 */}
      <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建文件夹</DialogTitle>
            <DialogDescription>
              在当前目录 {currentPath || "/"} 下创建一个新的文件夹
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="文件夹名称"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreateFolder()}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCreateFolder(false)}
              >
                取消
              </Button>
              <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                创建
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* macOS 风格右键菜单（使用 Portal 渲染到 body，避免被 transform/overflow 影响） */}
      {contextMenu && typeof document !== 'undefined' && createPortal(
        <div
          key={contextMenu.key}
          className="fixed z-[9999] animate-in fade-in-0 zoom-in-95 duration-200"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
          // 防止菜单内点击被外层终端或其他监听器捕获
          onContextMenu={(e) => {
            e.stopPropagation()
            // 不阻止默认，以便允许在菜单内继续右键（若有需要）
          }}
        >
          <div
            className={cn(
              "min-w-[200px] rounded-lg shadow-md border p-1 bg-popover text-popover-foreground border-border",
            )}
          >
            {/* 标题 - 显示选中数量 */}
            {selectedFiles.length > 1 && (
              <>
                <div className={cn(
                  "px-3 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400",
                )}>
                  已选中 {selectedFiles.length} 项
                </div>
                <div className={cn("h-px mx-2 mb-1 bg-zinc-200 dark:bg-zinc-700/50")} />
              </>
            )}

            {/* 空白区域菜单 */}
            {contextMenu.isBlank ? (
              <>
                {/* 新建文件夹 */}
                <button
                  className="w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-all hover:bg-accent hover:text-accent-foreground rounded-sm"
                  onClick={() => {
                    startCreateNew("folder")
                    closeContextMenu()
                  }}
                >
                  <FolderPlus className="h-4 w-4" />
                  <span className="flex-1">新建文件夹</span>
                  <kbd className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-mono bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
                  )}>
                    ⌘⇧N
                  </kbd>
                </button>

                {/* 新建文件 */}
                <button
                  className="w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-all hover:bg-accent hover:text-accent-foreground rounded-sm"
                  onClick={() => {
                    startCreateNew("file")
                    closeContextMenu()
                  }}
                >
                  <FileText className="h-4 w-4" />
                  <span className="flex-1">新建文件</span>
                  <kbd className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-mono bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
                  )}>
                    ⌘N
                  </kbd>
                </button>

                {/* 上传文件 */}
                <button
                  className="w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-all hover:bg-accent hover:text-accent-foreground rounded-sm"
                  onClick={() => {
                    fileInputRef.current?.click()
                    closeContextMenu()
                  }}
                >
                  <Upload className="h-4 w-4" />
                  <span className="flex-1">上传文件</span>
                  <kbd className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-mono bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
                  )}>
                    ⌘U
                  </kbd>
                </button>

                {/* 刷新 */}
                <button
                  className="w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-all hover:bg-accent hover:text-accent-foreground rounded-sm"
                  onClick={() => {
                    onRefresh()
                    closeContextMenu()
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="flex-1">刷新</span>
                  <kbd className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-mono bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
                  )}>
                    ⌘R
                  </kbd>
                </button>
              </>
            ) : contextMenu.fileName && contextMenu.fileType ? (
              <>
                {/* 使用统一的 FileActionMenu 组件 */}
                <FileActionMenu
                  file={{
                    name: contextMenu.fileName,
                    type: contextMenu.fileType,
                    size: filteredFiles.find(f => f.name === contextMenu.fileName)?.size || "",
                    modified: filteredFiles.find(f => f.name === contextMenu.fileName)?.modified || "",
                    permissions: filteredFiles.find(f => f.name === contextMenu.fileName)?.permissions || "",
                  }}
                  mode="context"
                  selectedFilesCount={selectedFiles.length}
                  onAction={(action: FileAction) => {
                    switch (action) {
                      case "open":
                        if (contextMenu.fileType === "directory" && contextMenu.fileName) {
                          onNavigate(`${currentPath}/${contextMenu.fileName}`.replace(/\/+/g, "/"))
                        } else if (contextMenu.fileName) {
                          handleOpenEditor(contextMenu.fileName)
                        }
                        break
                      case "download":
                        if (contextMenu.fileName) {
                          onDownload(contextMenu.fileName)
                        }
                        break
                      case "download-fast":
                        handleBatchDownload("fast")
                        break
                      case "download-compatible":
                        handleBatchDownload("compatible")
                        break
                      case "rename":
                        if (contextMenu.fileName) {
                          setTimeout(() => {
                            startRename(contextMenu.fileName!)
                          }, 50)
                        }
                        break
                      case "chmod":
                        const file = filteredFiles.find(f => f.name === contextMenu.fileName)
                        if (file) {
                          setChmodDialog({
                            isOpen: true,
                            fileName: file.name,
                            filePath: `${currentPath}/${file.name}`.replace(/\/+/g, '/'),
                            permissions: file.permissions,
                          })
                        }
                        break
                      case "delete":
                        if (selectedFiles.length > 1) {
                          handleBatchDelete()
                        } else if (contextMenu.fileName) {
                          onDelete(contextMenu.fileName)
                        }
                        break
                    }
                    closeContextMenu()
                  }}
                />
              </>
            ) : null}
          </div>
        </div>,
        document.body
      )}
      </div>
    </SftpSessionProvider>
    </TooltipProvider>
  )

  // 全屏模式 - 使用 Portal 渲染到 body
  if (isFullscreen) {
    return typeof window !== 'undefined'
      ? createPortal(managerContent, document.body)
      : null
  }

  // 嵌入模式
  return managerContent
}
