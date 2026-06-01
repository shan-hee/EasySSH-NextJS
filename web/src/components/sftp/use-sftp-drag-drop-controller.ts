"use client"

import { useCallback, useState, type DragEvent, type RefObject } from "react"
import { setDragSourceSessionId } from "@/lib/drag-state"

export interface SftpDragDropFileItem {
  name: string
  type: "file" | "directory"
}

export interface UseSftpDragDropControllerOptions {
  sessionId: string
  currentPath: string
  files: SftpDragDropFileItem[]
  dropZoneRef: RefObject<HTMLDivElement | null>
  onRename: (oldName: string, newName: string) => void
  onUpload: (files: FileList) => void | Promise<void>
}

export function useSftpDragDropController({
  sessionId,
  currentPath,
  files,
  dropZoneRef,
  onRename,
  onUpload,
}: UseSftpDragDropControllerOptions) {
  const [isDragging, setIsDragging] = useState(false)
  const [, setDragCounter] = useState(0)
  const [draggedFileName, setDraggedFileName] = useState<string | null>(null)
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null)

  const handleFileUpload = useCallback(async (uploadFiles: FileList) => {
    await onUpload(uploadFiles)
  }, [onUpload])

  const handleNativeDragStart = useCallback((event: DragEvent, fileName: string) => {
    setDraggedFileName(fileName)
    event.dataTransfer.effectAllowed = "move"

    const file = files.find((item) => item.name === fileName)
    const dragData = {
      sessionId,
      fileName,
      filePath: `${currentPath}/${fileName}`.replace(/\/+/g, "/"),
      fileType: file?.type || "file",
      sourceSessionId: sessionId,
    }
    event.dataTransfer.setData("application/json", JSON.stringify(dragData))
    event.dataTransfer.setData("text/plain", fileName)
    setDragSourceSessionId(sessionId)
  }, [currentPath, files, sessionId])

  const handleNativeDragEnd = useCallback(() => {
    setDraggedFileName(null)
    setDragOverFolder(null)
    setDragSourceSessionId(null)
  }, [])

  const handleNativeDragOver = useCallback((
    event: DragEvent,
    targetFileName: string,
    targetType: "file" | "directory",
  ) => {
    event.preventDefault()

    const isFileFromOtherSession = event.dataTransfer.types.includes("application/json") && !draggedFileName
    if (!isFileFromOtherSession) {
      event.stopPropagation()
    }

    if (targetFileName === draggedFileName && !isFileFromOtherSession) {
      setDragOverFolder(null)
      return
    }

    if (targetType === "directory") {
      setDragOverFolder(targetFileName)
      event.dataTransfer.dropEffect = "move"
    } else {
      setDragOverFolder(null)
      event.dataTransfer.dropEffect = "none"
    }
  }, [draggedFileName])

  const handleNativeDrop = useCallback((
    event: DragEvent,
    targetFileName: string,
    targetType: "file" | "directory",
  ) => {
    event.preventDefault()

    try {
      const jsonData = event.dataTransfer.getData("application/json")
      if (jsonData) {
        const dragData = JSON.parse(jsonData)
        if (dragData.sourceSessionId !== sessionId) {
          setDragOverFolder(null)
          return
        }
      }
    } catch {
      // 不是 JSON 数据，继续处理本会话拖拽。
    }

    event.stopPropagation()

    if (!draggedFileName || draggedFileName === targetFileName) {
      setDragOverFolder(null)
      return
    }

    if (targetType === "directory") {
      const newName = `${targetFileName}/${draggedFileName}`.replace(/\/+/g, "/")
      onRename(draggedFileName, newName)
    }

    setDragOverFolder(null)
    setDraggedFileName(null)
  }, [draggedFileName, onRename, sessionId])

  const handleDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()

    if (event.dataTransfer.types.includes("application/json")) {
      return
    }

    if (draggedFileName) {
      return
    }

    if (event.dataTransfer.types.includes("Files")) {
      setDragCounter((value) => value + 1)
      setIsDragging(true)
    }
  }, [draggedFileName])

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()

    const relatedTarget = event.relatedTarget as Node | null
    if (relatedTarget && dropZoneRef.current?.contains(relatedTarget)) {
      return
    }

    setIsDragging(false)
    setDragCounter(0)
  }, [dropZoneRef])

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()

    try {
      const hasJsonData = event.dataTransfer.types.includes("application/json")
      const isFileFromOtherSession = hasJsonData && !draggedFileName
      if (!isFileFromOtherSession) {
        event.stopPropagation()
      }
    } catch {
      event.stopPropagation()
    }
  }, [draggedFileName])

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    setDragCounter(0)

    try {
      const jsonData = event.dataTransfer.getData("application/json")
      if (jsonData) {
        const dragData = JSON.parse(jsonData)
        if (dragData.sourceSessionId && dragData.sourceSessionId !== sessionId) {
          return
        }
      }
    } catch {
      // 不是 JSON 数据，继续检查本地文件上传。
    }

    event.stopPropagation()

    if (draggedFileName) {
      setDraggedFileName(null)
      setDragOverFolder(null)
      return
    }

    const uploadFiles = event.dataTransfer.files
    if (uploadFiles && uploadFiles.length > 0) {
      void handleFileUpload(uploadFiles)
    }
  }, [draggedFileName, handleFileUpload, sessionId])

  const clearDragOverFolder = useCallback(() => {
    setDragOverFolder(null)
  }, [])

  return {
    isDragging,
    draggedFileName,
    dragOverFolder,
    clearDragOverFolder,
    handleFileUpload,
    handleNativeDragStart,
    handleNativeDragEnd,
    handleNativeDragOver,
    handleNativeDrop,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  }
}
