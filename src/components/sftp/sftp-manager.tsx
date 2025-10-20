"use client"

import { useState, useRef, useEffect, DragEvent } from "react"
import { useTheme } from "next-themes"
import { SftpSessionProvider } from "@/contexts/sftp-session-context"
import "@/components/Folder.css"
import "@/components/File.css"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
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
  Copy,
  FolderPlus,
  ChevronRight,
  HardDrive,
  Globe,
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
} from "lucide-react"
import { cn } from "@/lib/utils"
import Folder from "@/components/Folder"
import FileIcon from "@/components/File"
import { FileEditor } from "@/components/sftp/file-editor"

interface FileItem {
  name: string
  type: "file" | "directory"
  size: string
  modified: string
  permissions: string
  owner: string
  group: string
}

interface TransferTask {
  id: string
  fileName: string
  fileSize: string
  progress: number
  status: "pending" | "uploading" | "downloading" | "completed" | "failed"
  type: "upload" | "download"
  speed?: string
  timeRemaining?: string
}

interface ClipboardFile {
  fileName: string
  sessionId: string
  sessionLabel: string
  filePath: string
  fileType: "file" | "directory"
  operation: "copy" | "cut"
}

interface SftpManagerProps {
  serverId: number
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
  onNavigate: (path: string) => void
  onUpload: (files: FileList) => void
  onDownload: (fileName: string) => void
  onDelete: (fileName: string) => void
  onCreateFolder: (name: string) => void
  onRename: (oldName: string, newName: string) => void
  onDisconnect: () => void
  onRefresh: () => void
  onReadFile?: (fileName: string) => Promise<string>
  onSaveFile?: (fileName: string, content: string) => Promise<void>
  onRenameSession?: (newLabel: string) => void
  onCopyFiles?: (fileNames: string[]) => void
  onCutFiles?: (fileNames: string[]) => void
  onPasteFiles?: () => void
  onToggleFullscreen?: () => void
  clipboard?: ClipboardFile[]
  dragHandleListeners?: any
  dragHandleAttributes?: any
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
    onCopyFiles,
    onPasteFiles,
    onToggleFullscreen,
    clipboard = [],
    dragHandleListeners,
    dragHandleAttributes,
  } = props
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [sortedFiles, setSortedFiles] = useState<FileItem[]>(files)

  // 同步files到sortedFiles
  useEffect(() => {
    setSortedFiles(files)
  }, [files])

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
  const [transferTasks, setTransferTasks] = useState<TransferTask[]>([])
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid") // 默认图标视图
  const [showHidden, setShowHidden] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    fileName?: string
    fileType?: "file" | "directory"
    isBlank?: boolean
  } | null>(null)
  const [editingFile, setEditingFile] = useState<string | null>(null)
  const [editingFileName, setEditingFileName] = useState("")
  const [creatingNew, setCreatingNew] = useState<"file" | "folder" | null>(null)
  const [editingSessionLabel, setEditingSessionLabel] = useState(false)
  const [tempSessionLabel, setTempSessionLabel] = useState(sessionLabel)
  const [draggedFileName, setDraggedFileName] = useState<string | null>(null)
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null)
  const [lastClickTime, setLastClickTime] = useState<number>(0)
  const [lastClickFile, setLastClickFile] = useState<string | null>(null)
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const sessionLabelInputRef = useRef<HTMLInputElement>(null)

  // 处理单击/双击文件
  const handleFileClick = (fileName: string, fileType: "file" | "directory", event: React.MouseEvent) => {
    const now = Date.now()
    const timeSinceLastClick = now - lastClickTime

    // 检测双击 (300ms 内且点击同一文件)
    if (timeSinceLastClick < 300 && lastClickFile === fileName) {
      // 双击 - 打开文件或进入目录
      if (fileType === "directory") {
        const next = (currentPath.endsWith("/") ? currentPath : currentPath + "/") + fileName
        onNavigate(next)
      } else {
        handleOpenEditor(fileName)
      }
      // 重置双击检测
      setLastClickTime(0)
      setLastClickFile(null)
    } else {
      // 单击 - 选中文件
      handleFileSelect(fileName, event)
      setLastClickTime(now)
      setLastClickFile(fileName)
    }
  }

  // 过滤和排序文件
  const filteredFiles = sortedFiles
    .filter(file => {
      // 如果不显示隐藏文件，过滤掉以 . 开头的文件（但保留 .. 父目录）
      if (!showHidden && file.name.startsWith('.') && file.name !== '..') {
        return false
      }
      // 搜索过滤
      return file.name.toLowerCase().includes(searchTerm.toLowerCase())
    })
    .sort((a, b) => {
      const aValue = a[sortBy] as string
      const bValue = b[sortBy] as string
      const comparison = aValue.localeCompare(bValue)
      return sortOrder === "asc" ? comparison : -comparison
    })

  // 文件选择处理
  const handleFileSelect = (fileName: string, event: React.MouseEvent) => {
    if (event.shiftKey && selectedFiles.length > 0) {
      // Shift多选
      const lastIndex = filteredFiles.findIndex(f => f.name === selectedFiles[selectedFiles.length - 1])
      const currentIndex = filteredFiles.findIndex(f => f.name === fileName)
      const start = Math.min(lastIndex, currentIndex)
      const end = Math.max(lastIndex, currentIndex)
      const range = filteredFiles.slice(start, end + 1).map(f => f.name)
      setSelectedFiles(Array.from(new Set([...selectedFiles, ...range])))
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd多选
      setSelectedFiles(prev =>
        prev.includes(fileName) ? prev.filter(f => f !== fileName) : [...prev, fileName]
      )
    } else {
      // 单选 - 如果点击已选中的项目，则取消选择
      if (selectedFiles.length === 1 && selectedFiles[0] === fileName) {
        setSelectedFiles([])
      } else {
        setSelectedFiles([fileName])
      }
    }
  }

  const handleSelectAll = () => {
    if (selectedFiles.length === filteredFiles.length) {
      setSelectedFiles([])
    } else {
      setSelectedFiles(filteredFiles.map(f => f.name))
    }
  }

  // 右键菜单处理
  const handleContextMenu = (e: React.MouseEvent, fileName: string, fileType: "file" | "directory") => {
    e.preventDefault()
    e.stopPropagation() // 阻止事件冒泡
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      fileName,
      fileType,
      isBlank: false,
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
          console.log(`跨会话拖拽 ${dragData.fileName} 到文件夹 ${targetPath}`)
          // TODO: 这里需要页面层级实现跨会话上传逻辑
          setDragOverFolder(null)
          return
        }
      }
    } catch (error) {
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
      console.log(`移动 ${draggedFileName} 到 ${newPath}`)
      onRename(draggedFileName, newPath)
    }

    setDragOverFolder(null)
    setDraggedFileName(null)
  }

  // 文件拖拽处理（用于拖入文件夹）
  const handleFileDragStart = (fileName: string) => {
    setDraggedFileName(fileName)
  }

  const handleFileDragEnd = () => {
    setDraggedFileName(null)
    setDragOverFolder(null)
  }

  const handleFileDragOver = (e: React.DragEvent, targetFileName: string, targetType: "file" | "directory", targetIndex: number) => {
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
      setDragOverIndex(targetIndex)
    }
  }

  const handleFileDragLeave = () => {
    setDragOverFolder(null)
    setDragOverIndex(null)
  }

  const handleFileDrop = (e: React.DragEvent, targetFileName: string, targetType: "file" | "directory", targetIndex: number) => {
    e.preventDefault()
    e.stopPropagation()

    if (!draggedFileName || draggedFileName === targetFileName) {
      setDragOverFolder(null)
      setDragOverIndex(null)
      return
    }

    // 移动文件到文件夹
    if (targetType === "directory" && dragOverFolder) {
      console.log(`移动 ${draggedFileName} 到文件夹 ${targetFileName}`)
      // TODO: 调用实际的移动API
      // onRename(draggedFileName, `${targetFileName}/${draggedFileName}`)
    }
    // 文件排序（暂时只是视觉效果，实际不改变服务器顺序）
    else if (dragOverIndex !== null) {
      console.log(`将 ${draggedFileName} 排序到 ${targetFileName} 附近`)
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
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      isBlank: true,
    })
  }

  // 文件上传处理
  const handleFileUpload = (files: FileList) => {
    onUpload(files)
    // 模拟添加传输任务
    Array.from(files).forEach((file, index) => {
      const task: TransferTask = {
        id: `upload-${Date.now()}-${index}`,
        fileName: file.name,
        fileSize: formatFileSize(file.size),
        progress: 0,
        status: "uploading",
        type: "upload",
        speed: "1.2 MB/s",
        timeRemaining: "00:15",
      }
      setTransferTasks(prev => [...prev, task])
      // 模拟进度更新
      simulateProgress(task.id)
    })
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
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget === dropZoneRef.current) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    // 检查是否是跨会话拖拽
    try {
      const jsonData = e.dataTransfer.getData('application/json')
      if (jsonData) {
        const dragData = JSON.parse(jsonData)
        if (dragData.sourceSessionId && dragData.sourceSessionId !== sessionId) {
          console.log(`跨会话上传: ${dragData.fileName} 到当前目录 ${currentPath}`)
          // TODO: 实现跨会话上传逻辑
          return
        }
      }
    } catch (error) {
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

  // 模拟进度更新
  const simulateProgress = (taskId: string) => {
    const interval = setInterval(() => {
      setTransferTasks(prev =>
        prev.map(task => {
          if (task.id === taskId) {
            const newProgress = Math.min(task.progress + 10, 100)
            return {
              ...task,
              progress: newProgress,
              status: newProgress === 100 ? "completed" : task.status,
            }
          }
          return task
        })
      )
    }, 500)

    setTimeout(() => clearInterval(interval), 5000)
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
    setEditingFile(fileName)
    setEditingFileName(fileName)
    setTimeout(() => {
      editInputRef.current?.focus()
      editInputRef.current?.select()
    }, 0)
  }

  // 完成重命名
  const finishRename = () => {
    if (editingFile && editingFileName.trim() && editingFileName !== editingFile) {
      onRename(editingFile, editingFileName.trim())
    }
    setEditingFile(null)
    setEditingFileName("")
  }

  // 取消重命名
  const cancelRename = () => {
    setEditingFile(null)
    setEditingFileName("")
  }

  // 开始创建新文件/文件夹
  const startCreateNew = (type: "file" | "folder") => {
    setCreatingNew(type)
    const newName = type === "folder" ? "新建文件夹" : "新建文件.txt"
    setEditingFileName(newName)
    setTimeout(() => {
      editInputRef.current?.focus()
      editInputRef.current?.select()
    }, 0)
  }

  // 完成创建
  const finishCreate = () => {
    if (editingFileName.trim()) {
      if (creatingNew === "folder") {
        onCreateFolder(editingFileName.trim())
      } else if (creatingNew === "file") {
        // TODO: 实现创建文件功能
        console.log("创建文件:", editingFileName.trim())
      }
    }
    setCreatingNew(null)
    setEditingFileName("")
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
    if (tempSessionLabel.trim() && onRenameSession) {
      onRenameSession(tempSessionLabel.trim())
    }
    setEditingSessionLabel(false)
  }

  // 取消编辑会话标签
  const cancelEditSessionLabel = () => {
    setEditingSessionLabel(false)
    setTempSessionLabel(sessionLabel)
  }

  // 打开文件编辑器
  const handleOpenEditor = async (fileName: string) => {
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
      // 刷新文件列表
      onRefresh()
    } catch (error) {
      console.error("保存文件失败:", error)
      throw error
    }
  }

  // 批量下载
  const handleBatchDownload = () => {
    selectedFiles.forEach(fileName => {
      onDownload(fileName)
      const file = files.find(f => f.name === fileName)
      if (file && file.type === "file") {
        const task: TransferTask = {
          id: `download-${Date.now()}-${fileName}`,
          fileName: fileName,
          fileSize: file.size,
          progress: 0,
          status: "downloading",
          type: "download",
          speed: "2.5 MB/s",
          timeRemaining: "00:08",
        }
        setTransferTasks(prev => [...prev, task])
        simulateProgress(task.id)
      }
    })
    setSelectedFiles([])
  }

  // 批量删除
  const handleBatchDelete = () => {
    selectedFiles.forEach(fileName => onDelete(fileName))
    setSelectedFiles([])
  }

  // 清除已完成任务
  const handleClearCompleted = () => {
    setTransferTasks(prev => prev.filter(task => task.status !== "completed"))
  }

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

  // 文件大小格式化
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  // 路径分段
  const pathSegments = currentPath.split("/").filter(Boolean)

  // 传输状态图标
  const getStatusIcon = (status: TransferTask["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />
    }
  }

  // Context value for nested components
  const sessionContextValue = {
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
    clipboard,
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
    onCopyFiles,
    onCutFiles: onPasteFiles, // placeholder
    onPasteFiles,
    onToggleFullscreen,
  }

  return (
    <SftpSessionProvider value={sessionContextValue}>
      <div
        className={cn(
          "flex flex-col h-full rounded-xl border overflow-hidden transition-colors bg-card"
        )}
      >
      {/* 工具栏 */}
      <div className="border-b text-sm flex items-center justify-between px-3 py-1.5">
        {/* 左侧: 会话标签 - 带拖拽手柄 */}
        <div className="flex items-center gap-2">
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
                "h-6 text-xs font-semibold px-2 max-w-[150px]",
                isDark ? "bg-zinc-900 text-zinc-200" : "bg-white text-zinc-800"
              )}
            />
          ) : (
            <button
              onClick={startEditSessionLabel}
              onDoubleClick={startEditSessionLabel}
              className={cn(
                "text-xs font-semibold px-2 py-1 rounded transition-colors",
                isDark
                  ? "hover:bg-zinc-800/60 text-zinc-200"
                  : "hover:bg-zinc-200 text-zinc-800"
              )}
              title="双击编辑会话名称"
            >
              {sessionLabel}
            </button>
          )}

          <div className={cn(
            "h-4 w-px mx-1",
            isDark ? "bg-zinc-800/50" : "bg-zinc-300"
          )} />

          {/* 路径导航工具 */}
          {/* 返回上级目录按钮 */}
          {pathSegments.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 rounded-md transition-all duration-200 hover:scale-105",
                isDark
                  ? "hover:bg-zinc-800/60 hover:text-white text-zinc-400"
                  : "hover:bg-zinc-200 hover:text-zinc-900 text-zinc-600"
              )}
              onClick={() =>
                onNavigate(pathSegments.slice(0, -1).join("/") || "/")
              }
              title="返回上级目录"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          )}

          <div className={cn(
            "h-4 w-px mx-1",
            isDark ? "bg-zinc-800/50" : "bg-zinc-300"
          )} />

          {/* 根目录按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 rounded-md transition-all duration-200 hover:scale-105",
              isDark
                ? "hover:bg-zinc-800/60 hover:text-white text-zinc-400"
                : "hover:bg-zinc-200 hover:text-zinc-900 text-zinc-600"
            )}
            onClick={() => onNavigate("/")}
            title="根目录"
          >
            <Home className="h-3.5 w-3.5" />
          </Button>

          {/* 可点击的路径面包屑 */}
          <div className="flex items-center gap-1 ml-2">
            <HardDrive className="h-3.5 w-3.5 text-zinc-500" />
            <button
              onClick={() => onNavigate("/")}
              className={cn(
                "text-xs font-mono cursor-pointer px-1.5 py-0.5 rounded transition-colors",
                isDark
                  ? "text-zinc-400 hover:bg-zinc-800/60 hover:text-white"
                  : "text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
              )}
            >
              /
            </button>
            {pathSegments.map((segment, index) => {
              const segmentPath = "/" + pathSegments.slice(0, index + 1).join("/")
              return (
                <div key={index} className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3 text-zinc-500" />
                  <button
                    onClick={() => onNavigate(segmentPath)}
                    className={cn(
                      "text-xs font-mono cursor-pointer px-1.5 py-0.5 rounded transition-colors",
                      isDark
                        ? "text-zinc-400 hover:bg-zinc-800/60 hover:text-white"
                        : "text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
                    )}
                  >
                    {segment}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* 中间:会话信息 */}
        <div className={cn(
          "flex items-center gap-2 text-xs",
          isDark ? "text-zinc-500" : "text-zinc-600"
        )}>
          <Globe className="h-3.5 w-3.5 text-green-400" />
          <span className="font-mono">
            {username}@{host}
          </span>
          <span className={isDark ? "text-zinc-700" : "text-zinc-400"}>|</span>
          <span className={isConnected ? "text-green-400" : "text-red-400"}>
            {isConnected ? "已连接" : "已断开"}
          </span>
          {selectedFiles.length > 0 && (
            <>
              <span className={isDark ? "text-zinc-700" : "text-zinc-400"}>|</span>
              <span>已选择 {selectedFiles.length} 项</span>
            </>
          )}
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
                ? isDark
                  ? "bg-zinc-800/60 text-white"
                  : "bg-zinc-200 text-zinc-900"
                : isDark
                ? "hover:bg-zinc-800/60 hover:text-white text-zinc-400"
                : "hover:bg-zinc-200 hover:text-zinc-900 text-zinc-600"
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
                ? isDark
                  ? "bg-zinc-800/60 text-white"
                  : "bg-zinc-200 text-zinc-900"
                : isDark
                ? "hover:bg-zinc-800/60 hover:text-white text-zinc-400"
                : "hover:bg-zinc-200 hover:text-zinc-900 text-zinc-600"
            )}
            onClick={() => setViewMode("list")}
            title="列表视图"
          >
            <List className="h-3.5 w-3.5" />
          </Button>

          {/* 全屏/退出全屏按钮 */}
          {onToggleFullscreen && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 rounded-md transition-all duration-200 hover:scale-105",
                isDark
                  ? "hover:bg-zinc-800/60 hover:text-white text-zinc-400"
                  : "hover:bg-zinc-200 hover:text-zinc-900 text-zinc-600"
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
              "h-7 w-7 rounded-md transition-all duration-200",
              isDark
                ? "hover:bg-zinc-800/60 hover:text-white text-zinc-400"
                : "hover:bg-zinc-200 hover:text-zinc-900 text-zinc-600"
            )}
            onClick={onDisconnect}
            title="关闭"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="px-3 py-2 border-b flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className={cn(
            "absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5",
            isDark ? "text-zinc-500" : "text-zinc-400"
          )} />
          <Input
            placeholder="搜索文件..."
            className={cn(
              "h-7 pl-8 pr-2 text-xs border-0",
              isDark ? "bg-zinc-900/50" : "bg-zinc-100"
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
              ? (isDark ? "bg-zinc-800/60 text-white" : "bg-zinc-200 text-zinc-900")
              : (isDark ? "hover:bg-zinc-800/60 hover:text-white text-zinc-400" : "hover:bg-zinc-200 hover:text-zinc-900 text-zinc-600")
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
            "h-7 w-7 rounded-md transition-all duration-200 hover:scale-105",
            isDark
              ? "hover:bg-zinc-800/60 hover:text-white text-zinc-400"
              : "hover:bg-zinc-200 hover:text-zinc-900 text-zinc-600"
          )}
          onClick={onRefresh}
          title="刷新"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* 主内容区域 - 文件列表 */}
      <div
        ref={dropZoneRef}
        className={cn(
          "flex-1 overflow-auto relative",
          isDragging && "bg-blue-500/10"
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => setSelectedFiles([])}
        onContextMenu={handleBlankContextMenu}
      >
        {/* 如果编辑器打开，显示编辑器；否则显示文件列表 */}
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

        {filteredFiles.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <FolderOpen className={cn(
                "h-16 w-16 mx-auto mb-4",
                isDark ? "text-zinc-700" : "text-zinc-300"
              )} />
              <h3 className={cn(
                "text-lg font-semibold mb-2",
                isDark ? "text-zinc-500" : "text-zinc-600"
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
                  "group relative rounded-lg p-3 cursor-pointer select-none transition-all",
                  isDark ? "bg-zinc-800/60" : "bg-zinc-200/60"
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
                      onBlur={finishCreate}
                      className={cn(
                        "h-6 text-xs text-center px-1",
                        isDark ? "bg-zinc-900 text-zinc-200" : "bg-white text-zinc-800"
                      )}
                    />
                    <div className="text-[10px] text-muted-foreground truncate mt-1">
                      {creatingNew === "folder" ? "目录" : "0 B"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {filteredFiles.map((file, index) => {
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
                    e.stopPropagation()
                    if (!isEditing) {
                      handleFileClick(file.name, file.type, e)
                    }
                  }}
                  onContextMenu={(e) => handleContextMenu(e, file.name, file.type)}
                  className={cn(
                    "group relative rounded-lg p-3 cursor-pointer select-none transition-all",
                    (isSelected || (isDraggedOver && file.type === "directory")) && (isDark ? "bg-zinc-800/60" : "bg-zinc-200/60"),
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
                          onBlur={finishRename}
                          className={cn(
                            "h-6 text-xs text-center px-1",
                            isDark ? "bg-zinc-900 text-zinc-200" : "bg-white text-zinc-800"
                          )}
                        />
                      ) : (
                        <div className={cn(
                          "text-xs font-medium truncate",
                          isDark ? "text-zinc-200" : "text-zinc-800"
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
          <Table>
            <TableHeader className="sticky top-0 z-10 backdrop-blur-sm bg-background/95">
              <TableRow className={cn(
                isDark ? "border-zinc-800/50" : "border-zinc-200"
              )}>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={
                      selectedFiles.length === filteredFiles.length &&
                      filteredFiles.length > 0
                    }
                    onChange={handleSelectAll}
                    className="rounded"
                  />
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => {
                    setSortBy("name")
                    setSortOrder(prev => prev === "asc" ? "desc" : "asc")
                  }}
                >
                  名称 {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => {
                    setSortBy("size")
                    setSortOrder(prev => prev === "asc" ? "desc" : "asc")
                  }}
                >
                  大小 {sortBy === "size" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => {
                    setSortBy("modified")
                    setSortOrder(prev => prev === "asc" ? "desc" : "asc")
                  }}
                >
                  修改时间 {sortBy === "modified" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead>权限</TableHead>
                <TableHead>所有者</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* 新建项 */}
              {creatingNew && (
                <TableRow
                  className={cn(
                    "cursor-pointer transition-colors",
                    isDark ? "bg-zinc-800/50" : "bg-zinc-100"
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
                        onBlur={finishCreate}
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "h-7 text-sm px-2 flex-1",
                          isDark ? "bg-zinc-900 text-zinc-200" : "bg-white text-zinc-800"
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

                  <TableCell>
                    <span className="text-xs text-muted-foreground">-</span>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="h-7 w-7" />
                  </TableCell>
                </TableRow>
              )}

              {filteredFiles.map((file, index) => {
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
                      "cursor-pointer transition-colors",
                      (selectedFiles.includes(file.name) || (isDraggedOver && file.type === "directory")) && (
                        isDark ? "bg-zinc-800/50" : "bg-zinc-100"
                      ),
                      isDark ? "hover:bg-zinc-800/30" : "hover:bg-zinc-50",
                      draggedFileName === file.name && "opacity-50"
                    )}
                    onClick={e => {
                      e.stopPropagation()
                      handleFileClick(file.name, file.type, e)
                    }}
                    onContextMenu={(e) => handleContextMenu(e, file.name, file.type)}
                  >
                  <TableCell onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedFiles.includes(file.name)}
                      onChange={() => {}}
                      className="rounded"
                    />
                  </TableCell>

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
                          onBlur={finishRename}
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            "h-7 text-sm px-2 flex-1",
                            isDark ? "bg-zinc-900 text-zinc-200" : "bg-white text-zinc-800"
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

                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {file.owner}:{file.group}
                    </span>
                  </TableCell>

                  <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-7 w-7 p-0 transition-all",
                            isDark
                              ? "hover:bg-zinc-800/60 hover:text-white"
                              : "hover:bg-zinc-200"
                          )}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className={cn(
                          "min-w-[180px] rounded-lg backdrop-blur-xl",
                          isDark
                            ? "bg-zinc-900/95 border-zinc-700/50"
                            : "bg-white/95 border-zinc-200/50"
                        )}
                      >
                        {/* 打开/进入 */}
                        <DropdownMenuItem
                          onClick={() => {
                            if (file.type === "directory") {
                              onNavigate(`${currentPath}/${file.name}`.replace(/\/+/g, "/"))
                            } else {
                              // 打开编辑器
                              handleOpenEditor(file.name)
                            }
                          }}
                          className={cn(
                            isDark
                              ? "focus:bg-blue-600 focus:text-white"
                              : "focus:bg-blue-500 focus:text-white"
                          )}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          {file.type === "directory" ? "打开" : "编辑"}
                        </DropdownMenuItem>

                        {/* 下载 - 仅文件 */}
                        {file.type === "file" && (
                          <DropdownMenuItem
                            onClick={() => onDownload(file.name)}
                            className={cn(
                              isDark
                                ? "focus:bg-blue-600 focus:text-white"
                                : "focus:bg-blue-500 focus:text-white"
                            )}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            下载
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator className={cn(
                          isDark ? "bg-zinc-700/50" : "bg-zinc-200"
                        )} />

                        {/* 重命名 */}
                        <DropdownMenuItem
                          onClick={() => {
                            startRename(file.name)
                          }}
                          className={cn(
                            isDark
                              ? "focus:bg-blue-600 focus:text-white"
                              : "focus:bg-blue-500 focus:text-white"
                          )}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          重命名
                        </DropdownMenuItem>

                        {/* 复制 */}
                        <DropdownMenuItem
                          onClick={() => {
                            // TODO: 实现复制功能
                            console.log("复制:", file.name)
                          }}
                          className={cn(
                            isDark
                              ? "focus:bg-blue-600 focus:text-white"
                              : "focus:bg-blue-500 focus:text-white"
                          )}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          复制
                        </DropdownMenuItem>

                        {/* 粘贴 */}
                        <DropdownMenuItem
                          onClick={() => {
                            // TODO: 实现粘贴功能
                            console.log("粘贴到当前目录:", currentPath)
                          }}
                          className={cn(
                            isDark
                              ? "focus:bg-blue-600 focus:text-white"
                              : "focus:bg-blue-500 focus:text-white"
                          )}
                        >
                          <FileText className="h-4 w-4 mr-2 rotate-180" />
                          粘贴
                        </DropdownMenuItem>

                        <DropdownMenuSeparator className={cn(
                          isDark ? "bg-zinc-700/50" : "bg-zinc-200"
                        )} />

                        {/* 删除 */}
                        <DropdownMenuItem
                          onClick={() => onDelete(file.name)}
                          className={cn(
                            "focus:bg-red-500 focus:text-white",
                            isDark ? "text-red-400" : "text-red-600"
                          )}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          删除
                        </DropdownMenuItem>
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
              onChange={handleInputChange}
            />
          </>
        )}
      </div>

      {/* 传输任务面板 */}
      {transferTasks.length > 0 && (
        <div className="border-t max-h-48 overflow-auto">
          <div className="px-3 py-2 flex items-center justify-between border-b border-zinc-800/30">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium">
                传输任务 ({transferTasks.filter(t => t.status !== "completed").length})
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={handleClearCompleted}
            >
              清除已完成
            </Button>
          </div>
          <div className="p-2 space-y-2">
            {transferTasks.map(task => (
              <div
                key={task.id}
                className={cn(
                  "p-2 rounded-lg border",
                  isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-white border-zinc-200"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getStatusIcon(task.status)}
                    <span className="text-xs font-medium truncate">
                      {task.fileName}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] h-4 px-1"
                    >
                      {task.type === "upload" ? "上传" : "下载"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {task.status === "uploading" || task.status === "downloading" ? (
                      <>
                        <span>{task.speed}</span>
                        <span>•</span>
                        <span>{task.timeRemaining}</span>
                      </>
                    ) : null}
                    <span>{task.progress}%</span>
                  </div>
                </div>
                {task.status !== "completed" && (
                  <Progress value={task.progress} className="h-1" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* macOS 风格右键菜单 */}
      {contextMenu && (
        <div
          className="fixed z-[100]"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className={cn(
              "min-w-[200px] rounded-lg shadow-2xl border backdrop-blur-xl py-1.5",
              isDark
                ? "bg-zinc-900/95 border-zinc-700/50"
                : "bg-white/95 border-zinc-200/50"
            )}
            style={{
              boxShadow: isDark
                ? "0 10px 40px rgba(0, 0, 0, 0.5), 0 0 0 0.5px rgba(255, 255, 255, 0.1)"
                : "0 10px 40px rgba(0, 0, 0, 0.15), 0 0 0 0.5px rgba(0, 0, 0, 0.05)",
            }}
          >
            {/* 标题 - 显示选中数量 */}
            {selectedFiles.length > 1 && (
              <>
                <div className={cn(
                  "px-3 py-1.5 text-xs font-medium",
                  isDark ? "text-zinc-400" : "text-zinc-500"
                )}>
                  已选中 {selectedFiles.length} 项
                </div>
                <div className={cn("h-px mx-2 mb-1", isDark ? "bg-zinc-700/50" : "bg-zinc-200")} />
              </>
            )}

            {/* 空白区域菜单 */}
            {contextMenu.isBlank ? (
              <>
                {/* 新建文件夹 */}
                <button
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-all",
                    isDark
                      ? "hover:bg-blue-600 hover:text-white text-zinc-200"
                      : "hover:bg-blue-500 hover:text-white text-zinc-800"
                  )}
                  onClick={() => {
                    startCreateNew("folder")
                    closeContextMenu()
                  }}
                >
                  <FolderPlus className="h-4 w-4" />
                  <span className="flex-1">新建文件夹</span>
                  <kbd className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-mono",
                    isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-600"
                  )}>
                    ⌘⇧N
                  </kbd>
                </button>

                {/* 新建文件 */}
                <button
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-all",
                    isDark
                      ? "hover:bg-blue-600 hover:text-white text-zinc-200"
                      : "hover:bg-blue-500 hover:text-white text-zinc-800"
                  )}
                  onClick={() => {
                    startCreateNew("file")
                    closeContextMenu()
                  }}
                >
                  <FileText className="h-4 w-4" />
                  <span className="flex-1">新建文件</span>
                  <kbd className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-mono",
                    isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-600"
                  )}>
                    ⌘N
                  </kbd>
                </button>

                {/* 上传文件 */}
                <button
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-all",
                    isDark
                      ? "hover:bg-blue-600 hover:text-white text-zinc-200"
                      : "hover:bg-blue-500 hover:text-white text-zinc-800"
                  )}
                  onClick={() => {
                    fileInputRef.current?.click()
                    closeContextMenu()
                  }}
                >
                  <Upload className="h-4 w-4" />
                  <span className="flex-1">上传文件</span>
                  <kbd className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-mono",
                    isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-600"
                  )}>
                    ⌘U
                  </kbd>
                </button>

                {/* 粘贴 */}
                <button
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-all",
                    clipboard.length === 0 && "opacity-50 cursor-not-allowed",
                    isDark
                      ? "hover:bg-blue-600 hover:text-white text-zinc-200"
                      : "hover:bg-blue-500 hover:text-white text-zinc-800"
                  )}
                  onClick={() => {
                    if (onPasteFiles && clipboard.length > 0) {
                      onPasteFiles()
                    }
                    closeContextMenu()
                  }}
                  disabled={clipboard.length === 0}
                >
                  <FileText className="h-4 w-4 rotate-180" />
                  <span className="flex-1">
                    粘贴{clipboard.length > 0 ? ` (${clipboard.length} 项)` : ''}
                  </span>
                  <kbd className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-mono",
                    isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-600"
                  )}>
                    ⌘V
                  </kbd>
                </button>

                <div className={cn("h-px mx-2 my-1", isDark ? "bg-zinc-700/50" : "bg-zinc-200")} />

                {/* 刷新 */}
                <button
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-all",
                    isDark
                      ? "hover:bg-blue-600 hover:text-white text-zinc-200"
                      : "hover:bg-blue-500 hover:text-white text-zinc-800"
                  )}
                  onClick={() => {
                    onRefresh()
                    closeContextMenu()
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="flex-1">刷新</span>
                  <kbd className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-mono",
                    isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-600"
                  )}>
                    ⌘R
                  </kbd>
                </button>
              </>
            ) : (
              <>
                {/* 打开/查看 */}
                <button
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-all",
                    isDark
                      ? "hover:bg-blue-600 hover:text-white text-zinc-200"
                      : "hover:bg-blue-500 hover:text-white text-zinc-800"
                  )}
                  onClick={() => {
                    if (contextMenu.fileType === "directory" && contextMenu.fileName) {
                      onNavigate(`${currentPath}/${contextMenu.fileName}`.replace(/\/+/g, "/"))
                    } else if (contextMenu.fileName) {
                      // 打开编辑器
                      handleOpenEditor(contextMenu.fileName)
                    }
                    closeContextMenu()
                  }}
                >
                  <Eye className="h-4 w-4" />
                  <span className="flex-1">{contextMenu.fileType === "directory" ? "打开" : "编辑"}</span>
                  <kbd className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-mono",
                    isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-600"
                  )}>
                    ⏎
                  </kbd>
                </button>

                {/* 下载 - 仅文件或多选 */}
                {(contextMenu.fileType === "file" || selectedFiles.length > 1) && (
                  <button
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-all",
                      isDark
                        ? "hover:bg-blue-600 hover:text-white text-zinc-200"
                        : "hover:bg-blue-500 hover:text-white text-zinc-800"
                    )}
                    onClick={() => {
                      if (selectedFiles.length > 1) {
                        handleBatchDownload()
                      } else if (contextMenu.fileName) {
                        onDownload(contextMenu.fileName)
                      }
                      closeContextMenu()
                    }}
                  >
                    <Download className="h-4 w-4" />
                    <span className="flex-1">
                      {selectedFiles.length > 1 ? `下载 ${selectedFiles.length} 项` : "下载"}
                    </span>
                    <kbd className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-mono",
                      isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-600"
                    )}>
                      ⌘D
                    </kbd>
                  </button>
                )}

                <div className={cn("h-px mx-2 my-1", isDark ? "bg-zinc-700/50" : "bg-zinc-200")} />

                {/* 重命名 - 仅单选 */}
                {selectedFiles.length === 1 && (
                  <button
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-all",
                      isDark
                        ? "hover:bg-blue-600 hover:text-white text-zinc-200"
                        : "hover:bg-blue-500 hover:text-white text-zinc-800"
                    )}
                    onClick={() => {
                      if (contextMenu.fileName) {
                        startRename(contextMenu.fileName)
                      }
                      closeContextMenu()
                    }}
                  >
                    <Edit className="h-4 w-4" />
                    <span className="flex-1">重命名</span>
                    <kbd className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-mono",
                      isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-600"
                    )}>
                      F2
                    </kbd>
                  </button>
                )}

                {/* 复制 */}
                <button
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-all",
                    isDark
                      ? "hover:bg-blue-600 hover:text-white text-zinc-200"
                      : "hover:bg-blue-500 hover:text-white text-zinc-800"
                  )}
                  onClick={() => {
                    const filesToCopy = selectedFiles.length > 1 ? selectedFiles : (contextMenu.fileName ? [contextMenu.fileName] : [])
                    if (onCopyFiles && filesToCopy.length > 0) {
                      onCopyFiles(filesToCopy)
                    }
                    closeContextMenu()
                  }}
                >
                  <Copy className="h-4 w-4" />
                  <span className="flex-1">
                    {selectedFiles.length > 1 ? `复制 ${selectedFiles.length} 项` : "复制"}
                  </span>
                  <kbd className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-mono",
                    isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-600"
                  )}>
                    ⌘C
                  </kbd>
                </button>

                {/* 粘贴 */}
                <button
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-all",
                    clipboard.length === 0 && "opacity-50 cursor-not-allowed",
                    isDark
                      ? "hover:bg-blue-600 hover:text-white text-zinc-200"
                      : "hover:bg-blue-500 hover:text-white text-zinc-800"
                  )}
                  onClick={() => {
                    if (onPasteFiles && clipboard.length > 0) {
                      onPasteFiles()
                    }
                    closeContextMenu()
                  }}
                  disabled={clipboard.length === 0}
                >
                  <FileText className="h-4 w-4 rotate-180" />
                  <span className="flex-1">
                    粘贴{clipboard.length > 0 ? ` (${clipboard.length} 项)` : ''}
                  </span>
                  <kbd className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-mono",
                    isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-600"
                  )}>
                    ⌘V
                  </kbd>
                </button>

                {/* 信息 - 仅单选 */}
                {selectedFiles.length === 1 && (
                  <button
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-all",
                      isDark
                        ? "hover:bg-blue-600 hover:text-white text-zinc-200"
                        : "hover:bg-blue-500 hover:text-white text-zinc-800"
                    )}
                    onClick={() => {
                      // TODO: 显示文件详细信息
                      console.log("显示信息:", contextMenu.fileName)
                      closeContextMenu()
                    }}
                  >
                    <FileText className="h-4 w-4" />
                    <span className="flex-1">属性</span>
                    <kbd className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-mono",
                      isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-600"
                    )}>
                      ⌘I
                    </kbd>
                  </button>
                )}

                <div className={cn("h-px mx-2 my-1", isDark ? "bg-zinc-700/50" : "bg-zinc-200")} />

                {/* 删除 */}
                <button
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-all",
                    isDark
                      ? "hover:bg-red-600 hover:text-white text-red-400"
                      : "hover:bg-red-500 hover:text-white text-red-600"
                  )}
                  onClick={() => {
                    if (selectedFiles.length > 1) {
                      handleBatchDelete()
                    } else if (contextMenu.fileName) {
                      onDelete(contextMenu.fileName)
                    }
                    closeContextMenu()
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="flex-1">
                    {selectedFiles.length > 1 ? `删除 ${selectedFiles.length} 项` : "删除"}
                  </span>
                  <kbd className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-mono",
                    isDark ? "bg-zinc-800/80 text-zinc-400" : "bg-zinc-100 text-zinc-600"
                  )}>
                    ⌫
                  </kbd>
                </button>
              </>
            )}
          </div>
        </div>
      )}
      </div>
    </SftpSessionProvider>
  )
}
