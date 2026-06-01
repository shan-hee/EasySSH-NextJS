"use client"

import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type FocusEvent,
  type MouseEvent,
  type RefObject,
  type SetStateAction,
} from "react"
import type { FileAction } from "@/components/sftp/file-action-menu"
import { getErrorMessage } from "@/lib/error-utils"
import type { BatchDeleteResult } from "@/lib/session/sftp-operations"
import type { SshWorkspaceNotifier } from "@/lib/session/workspace"
import type { SftpFileItem } from "@/lib/sftp-file-utils"

type SftpTranslator = (key: string, params?: Record<string, string | number>) => string

export type SftpFileActionItem = Pick<SftpFileItem, "name" | "type" | "size" | "modified" | "permissions">
export type SftpCreateEntryType = "file" | "folder"

export interface SftpEditorState {
  isOpen: boolean
  fileName: string
  filePath: string
  content: string
}

export interface SftpChmodDialogState {
  isOpen: boolean
  fileName: string
  filePath: string
  permissions: string
}

export interface SftpDeleteConfirmDialogState {
  isOpen: boolean
  fileName: string | null
  fileNames: string[]
  isDirectory: boolean
}

export interface SftpFileContextMenuState {
  x: number
  y: number
  fileName?: string
  fileType?: "file" | "directory"
  isBlank?: boolean
  key?: number
}

export interface UseSftpFileActionControllerOptions {
  serverId: string
  currentPath: string
  filteredFiles: SftpFileActionItem[]
  selectedFiles: string[]
  setSelectedFiles: Dispatch<SetStateAction<string[]>>
  clearSelectedFiles: () => void
  onSelectAll: () => void
  editInputRef: RefObject<HTMLInputElement | null>
  fileInputRef: RefObject<HTMLInputElement | null>
  excludePatterns: string[]
  tSftp: SftpTranslator
  notifier?: SshWorkspaceNotifier
  chmodFile?: (serverId: string, path: string, mode: string) => Promise<unknown>
  editingSessionLabelRef?: { current: boolean }
  onNavigate: (path: string) => void
  onNavigateBack?: () => void | Promise<void>
  canNavigateBack?: boolean
  onInternalBackHandlerChange?: (
    handler: { handle: () => boolean | Promise<boolean> } | null
  ) => void
  onDownload: (fileName: string) => void
  onDelete: (fileName: string) => void
  onBatchDelete?: (fileNames: string[]) => Promise<BatchDeleteResult>
  onBatchDownload?: (fileNames: string[], excludePatterns?: string[]) => Promise<void>
  onCreateFolder: (name: string) => void
  onCreateFile?: (name: string) => void
  onRename: (oldName: string, newName: string) => void
  onRefresh: () => void
  onReadFile?: (fileName: string) => Promise<string>
  onSaveFile?: (fileName: string, content: string) => Promise<void>
  onUploadFiles: (files: FileList) => void | Promise<void>
}

const emptyEditorState: SftpEditorState = {
  isOpen: false,
  fileName: "",
  filePath: "",
  content: "",
}

const emptyChmodDialogState: SftpChmodDialogState = {
  isOpen: false,
  fileName: "",
  filePath: "",
  permissions: "",
}

const emptyDeleteConfirmDialogState: SftpDeleteConfirmDialogState = {
  isOpen: false,
  fileName: null,
  fileNames: [],
  isDirectory: false,
}

const defaultNotifier: SshWorkspaceNotifier = {
  success: () => undefined,
  error: () => undefined,
  promise: <T,>(promise: Promise<T>, messages: {
    loading: string
    success: string | ((data: T) => string)
    error: string | ((error: unknown) => string)
  }) => {
    void messages
    void promise.catch(() => undefined)
    return promise
  },
}

export function useSftpFileActionController({
  serverId,
  currentPath,
  filteredFiles,
  selectedFiles,
  setSelectedFiles,
  clearSelectedFiles,
  onSelectAll,
  editInputRef,
  fileInputRef,
  excludePatterns,
  tSftp,
  notifier = defaultNotifier,
  chmodFile,
  editingSessionLabelRef,
  onNavigate,
  onNavigateBack,
  canNavigateBack,
  onInternalBackHandlerChange,
  onDownload,
  onDelete,
  onBatchDelete,
  onBatchDownload,
  onCreateFolder,
  onCreateFile,
  onRename,
  onRefresh,
  onReadFile,
  onSaveFile,
  onUploadFiles,
}: UseSftpFileActionControllerOptions) {
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [contextMenu, setContextMenu] = useState<SftpFileContextMenuState | null>(null)
  const [editingFile, setEditingFile] = useState<string | null>(null)
  const [editingFileName, setEditingFileName] = useState("")
  const [creatingNew, setCreatingNew] = useState<SftpCreateEntryType | null>(null)
  const [editorState, setEditorState] = useState<SftpEditorState>(emptyEditorState)
  const [chmodDialog, setChmodDialog] = useState<SftpChmodDialogState>(emptyChmodDialogState)
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<SftpDeleteConfirmDialogState>(emptyDeleteConfirmDialogState)

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

  const handleCloseEditor = useCallback(() => {
    setEditorState(emptyEditorState)
  }, [])

  const handleSaveFile = useCallback(async (content: string) => {
    if (!onSaveFile) {
      console.warn("onSaveFile 回调未提供")
      return
    }

    try {
      await onSaveFile(editorState.fileName, content)
      setEditorState((prev) => ({ ...prev, content }))
    } catch (error) {
      console.error("保存文件失败:", error)
      throw error
    }
  }, [editorState.fileName, onSaveFile])

  const handleFileDoubleClick = useCallback((fileName: string, fileType: "file" | "directory") => {
    if (fileType === "directory") {
      const next = (currentPath.endsWith("/") ? currentPath : `${currentPath}/`) + fileName
      startTransition(() => {
        onNavigate(next)
      })
      return
    }

    void handleOpenEditor(fileName)
  }, [currentPath, handleOpenEditor, onNavigate])

  const handleContextMenu = useCallback((event: MouseEvent, fileName: string, fileType: "file" | "directory") => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      fileName,
      fileType,
      isBlank: false,
      key: Date.now(),
    })

    if (!selectedFiles.includes(fileName)) {
      setSelectedFiles([fileName])
    }
  }, [selectedFiles, setSelectedFiles])

  const handleBlankContextMenu = useCallback((event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      isBlank: true,
      key: Date.now(),
    })
  }, [])

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  const handleInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const inputFiles = event.target.files
    if (inputFiles) {
      void onUploadFiles(inputFiles)
    }
    event.target.value = ""
  }, [onUploadFiles])

  const startRename = useCallback((fileName: string) => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
      blurTimeoutRef.current = null
    }

    setEditingFile(fileName)
    setEditingFileName(fileName)
  }, [])

  const finishRename = useCallback(() => {
    if (editingFile && editingFileName.trim() && editingFileName !== editingFile) {
      onRename(editingFile, editingFileName.trim())
    }
    setEditingFile(null)
    setEditingFileName("")
  }, [editingFile, editingFileName, onRename])

  const cancelRename = useCallback(() => {
    setEditingFile(null)
    setEditingFileName("")
  }, [])

  const handleRenameBlur = useCallback((event: FocusEvent) => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
    }

    const relatedTarget = event.relatedTarget as HTMLElement | null
    if (relatedTarget && (
      relatedTarget.tagName === "BUTTON" ||
      relatedTarget.closest('[role="menuitem"]') ||
      relatedTarget.closest('[role="menu"]')
    )) {
      blurTimeoutRef.current = setTimeout(() => {
        if (editInputRef.current && !editInputRef.current.contains(document.activeElement)) {
          finishRename()
        }
      }, 150)
    } else {
      blurTimeoutRef.current = setTimeout(() => finishRename(), 50)
    }
  }, [editInputRef, finishRename])

  const finishCreate = useCallback(async () => {
    const nextName = editingFileName.trim()
    if (nextName) {
      if (creatingNew === "folder") {
        onCreateFolder(nextName)
      } else if (creatingNew === "file") {
        if (onCreateFile) {
          onCreateFile(nextName)
        } else if (onSaveFile) {
          try {
            await onSaveFile(nextName, "")
          } catch (error) {
            console.error("创建文件失败:", error)
          }
        }
      }
    }

    setCreatingNew(null)
    setEditingFileName("")
  }, [creatingNew, editingFileName, onCreateFile, onCreateFolder, onSaveFile])

  const handleCreateBlur = useCallback((event: FocusEvent) => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
    }

    const relatedTarget = event.relatedTarget as HTMLElement | null
    if (relatedTarget && (
      relatedTarget.tagName === "BUTTON" ||
      relatedTarget.closest('[role="menuitem"]') ||
      relatedTarget.closest('[role="menu"]')
    )) {
      blurTimeoutRef.current = setTimeout(() => {
        if (editInputRef.current && !editInputRef.current.contains(document.activeElement)) {
          void finishCreate()
        }
      }, 150)
    } else {
      blurTimeoutRef.current = setTimeout(() => {
        void finishCreate()
      }, 50)
    }
  }, [editInputRef, finishCreate])

  const startCreateNew = useCallback((type: SftpCreateEntryType) => {
    setCreatingNew(type)
    setEditingFileName(type === "folder" ? "New folder" : "New file.txt")
  }, [])

  const cancelCreate = useCallback(() => {
    setCreatingNew(null)
    setEditingFileName("")
  }, [])

  const handleBatchDownload = useCallback(async (fileNames?: string[]) => {
    const paths = fileNames && fileNames.length > 0
      ? fileNames
      : selectedFiles.length > 0
        ? selectedFiles
        : contextMenu?.fileName
          ? [contextMenu.fileName]
          : []

    if (paths.length === 0) return

    if (onBatchDownload) {
      try {
        await onBatchDownload(paths, excludePatterns)
        setSelectedFiles([])
      } catch (error: unknown) {
        console.error("[SftpManager] 批量下载失败:", error)
        notifier.error(getErrorMessage(error, tSftp("toastBatchDownloadFailed")))
      }
    } else {
      paths.forEach((path) => onDownload(path))
      setSelectedFiles([])
    }
  }, [contextMenu, excludePatterns, notifier, onBatchDownload, onDownload, selectedFiles, setSelectedFiles, tSftp])

  const handleBatchDelete = useCallback(async () => {
    if (selectedFiles.length === 0) return

    if (onBatchDelete) {
      try {
        const result = await onBatchDelete(selectedFiles)

        if (result.failed.length > 0) {
          const failedNames = result.failed
            .map((item) => item.path.split("/").pop())
            .filter(Boolean)
            .join(", ")

          notifier.error(
            tSftp("toastBatchDeletePartialFailed", {
              count: result.failed.length,
              names: failedNames || "-",
            })
          )
        }

        setSelectedFiles([])
      } catch (error: unknown) {
        console.error("[SftpManager] 批量删除失败:", error)
        notifier.error(getErrorMessage(error, tSftp("toastBatchDeleteFailed")))
      }
    } else {
      selectedFiles.forEach((fileName) => onDelete(fileName))
      setSelectedFiles([])
    }
  }, [notifier, onBatchDelete, onDelete, selectedFiles, setSelectedFiles, tSftp])

  const requestDelete = useCallback((fileName: string) => {
    const file = filteredFiles.find((item) => item.name === fileName)
    setDeleteConfirmDialog({
      isOpen: true,
      fileName,
      fileNames: [],
      isDirectory: file?.type === "directory",
    })
  }, [filteredFiles])

  const requestBatchDelete = useCallback(() => {
    if (selectedFiles.length === 0) return

    const hasDirectory = selectedFiles.some((name) => (
      filteredFiles.find((item) => item.name === name)?.type === "directory"
    ))
    setDeleteConfirmDialog({
      isOpen: true,
      fileName: null,
      fileNames: [...selectedFiles],
      isDirectory: hasDirectory,
    })
  }, [filteredFiles, selectedFiles])

  const confirmDelete = useCallback(async () => {
    if (deleteConfirmDialog.fileNames.length > 0) {
      await handleBatchDelete()
    } else if (deleteConfirmDialog.fileName) {
      onDelete(deleteConfirmDialog.fileName)
    }

    setDeleteConfirmDialog(emptyDeleteConfirmDialogState)
  }, [deleteConfirmDialog, handleBatchDelete, onDelete])

  const handleFileAction = useCallback((file: SftpFileActionItem, action: FileAction) => {
    switch (action) {
      case "open":
        if (file.type === "directory") {
          onNavigate(`${currentPath}/${file.name}`.replace(/\/+/g, "/"))
        } else {
          void handleOpenEditor(file.name)
        }
        break
      case "download":
        setSelectedFiles([file.name])
        if (file.type === "directory") {
          void handleBatchDownload([file.name])
        } else {
          onDownload(file.name)
        }
        break
      case "rename":
        setTimeout(() => startRename(file.name), 50)
        break
      case "chmod":
        setChmodDialog({
          isOpen: true,
          fileName: file.name,
          filePath: `${currentPath}/${file.name}`.replace(/\/+/g, "/"),
          permissions: file.permissions,
        })
        break
      case "delete":
        requestDelete(file.name)
        break
    }
  }, [currentPath, handleBatchDownload, handleOpenEditor, onDownload, onNavigate, requestDelete, setSelectedFiles, startRename])

  const contextMenuFile = useMemo<SftpFileActionItem | null>(() => {
    if (!contextMenu?.fileName || !contextMenu.fileType) {
      return null
    }

    const file = filteredFiles.find((item) => item.name === contextMenu.fileName)
    return {
      name: contextMenu.fileName,
      type: contextMenu.fileType,
      size: file?.size ?? "",
      modified: file?.modified ?? "",
      permissions: file?.permissions ?? "",
    }
  }, [contextMenu, filteredFiles])

  const handleContextMenuAction = useCallback((action: FileAction) => {
    if (!contextMenuFile) {
      return
    }

    if (action === "delete" && selectedFiles.length > 1) {
      requestBatchDelete()
      return
    }

    handleFileAction(contextMenuFile, action)
  }, [contextMenuFile, handleFileAction, requestBatchDelete, selectedFiles.length])

  const setChmodDialogOpen = useCallback((open: boolean) => {
    setChmodDialog((prev) => ({ ...prev, isOpen: open }))
  }, [])

  const setDeleteConfirmDialogOpen = useCallback((open: boolean) => {
    setDeleteConfirmDialog((prev) => ({ ...prev, isOpen: open }))
  }, [])

  const handleChmod = useCallback(async (mode: string) => {
    const fileName = chmodDialog.fileName
    const filePath = chmodDialog.filePath
    const chmodPromise = (chmodFile
      ? chmodFile(serverId, filePath, mode)
      : Promise.reject(new Error("SFTP chmod adapter is not configured")))
      .then(() => {
        onRefresh()
      })

    notifier.promise(chmodPromise, {
      loading: tSftp("toastChmodLoading", { file: fileName }),
      success: tSftp("toastChmodSuccess", { file: fileName }),
      error: (error) => {
        const message = error instanceof Error ? error.message : String(error)
        return tSftp("toastChmodFailed", { message })
      },
    })

    return chmodPromise
  }, [chmodDialog.fileName, chmodDialog.filePath, chmodFile, notifier, onRefresh, serverId, tSftp])

  const handleInternalBack = useCallback(async () => {
    if (editorState.isOpen) {
      handleCloseEditor()
      return true
    }

    if (canNavigateBack && onNavigateBack) {
      await onNavigateBack()
      return true
    }

    return false
  }, [canNavigateBack, editorState.isOpen, handleCloseEditor, onNavigateBack])

  useEffect(() => {
    const hasInternalBack = editorState.isOpen || !!canNavigateBack
    onInternalBackHandlerChange?.(hasInternalBack ? { handle: handleInternalBack } : null)

    return () => {
      onInternalBackHandlerChange?.(null)
    }
  }, [canNavigateBack, editorState.isOpen, handleInternalBack, onInternalBackHandlerChange])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (editorState.isOpen) {
        if (event.key === "Escape") {
          event.preventDefault()
          handleCloseEditor()
        }
        return
      }

      if (editingFile || creatingNew || editingSessionLabelRef?.current) return

      const isMac = navigator.platform.toUpperCase().includes("MAC")
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey

      if (cmdOrCtrl && event.key === "a") {
        event.preventDefault()
        onSelectAll()
      }

      if ((event.key === "Delete" || event.key === "Backspace") && selectedFiles.length > 0) {
        event.preventDefault()
        requestBatchDelete()
      }

      if (event.key === "F2" && selectedFiles.length === 1) {
        event.preventDefault()
        startRename(selectedFiles[0])
      }

      if (cmdOrCtrl && event.key === "d" && selectedFiles.length > 0) {
        event.preventDefault()
        void handleBatchDownload()
      }

      if (cmdOrCtrl && event.key === "r") {
        event.preventDefault()
        onRefresh()
      }

      if (cmdOrCtrl && event.shiftKey && event.key === "N") {
        event.preventDefault()
        startCreateNew("folder")
      }

      if (cmdOrCtrl && !event.shiftKey && event.key === "n") {
        event.preventDefault()
        startCreateNew("file")
      }

      if (cmdOrCtrl && event.key === "u") {
        event.preventDefault()
        fileInputRef.current?.click()
      }

      if (event.key === "Escape" && selectedFiles.length > 0) {
        clearSelectedFiles()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [
    clearSelectedFiles,
    creatingNew,
    editingFile,
    editorState.isOpen,
    fileInputRef,
    handleBatchDownload,
    handleCloseEditor,
    onSelectAll,
    onRefresh,
    requestBatchDelete,
    selectedFiles,
    setSelectedFiles,
    startCreateNew,
    startRename,
  ])

  useLayoutEffect(() => {
    if (!editingFile && !creatingNew) {
      return
    }

    let focusTimeout: ReturnType<typeof setTimeout> | null = null
    const frame = requestAnimationFrame(() => {
      focusTimeout = setTimeout(() => {
        editInputRef.current?.focus()
        editInputRef.current?.select()
      }, 100)
    })

    return () => {
      cancelAnimationFrame(frame)
      if (focusTimeout) {
        clearTimeout(focusTimeout)
      }
    }
  }, [creatingNew, editInputRef, editingFile])

  useEffect(() => () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
    }
  }, [])

  return {
    contextMenu,
    contextMenuFile,
    editingFile,
    editingFileName,
    creatingNew,
    editorState,
    chmodDialog,
    deleteConfirmDialog,
    setEditingFileName,
    setChmodDialogOpen,
    setDeleteConfirmDialogOpen,
    closeContextMenu,
    handleInputChange,
    handleFileDoubleClick,
    handleContextMenu,
    handleBlankContextMenu,
    finishRename,
    cancelRename,
    handleRenameBlur,
    finishCreate,
    cancelCreate,
    handleCreateBlur,
    startCreateNew,
    handleCloseEditor,
    handleSaveFile,
    handleBatchDownload,
    requestBatchDelete,
    confirmDelete,
    handleFileAction,
    handleContextMenuAction,
    handleChmod,
  }
}
