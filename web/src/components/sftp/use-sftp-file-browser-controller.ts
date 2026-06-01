"use client"

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent,
  type SetStateAction,
} from "react"
import { parseFileSize } from "@/lib/format-utils"
import type { SftpFileItem } from "@/lib/sftp-file-utils"
import type { SshWorkspacePreferenceAdapter } from "@/lib/session/workspace"

export type SftpFileBrowserItem = Pick<SftpFileItem, "name" | "type" | "size" | "modified" | "permissions"> & {
  sizeBytes?: number
}

export type EnhancedSftpFileBrowserItem = SftpFileBrowserItem & {
  sizeBytes: number
}

export type SftpFileSortKey = "name" | "size" | "modified"
export type SftpFileSortOrder = "asc" | "desc"
export type SftpFileViewMode = "grid" | "list"

export interface UseSftpFileBrowserControllerOptions {
  files: SftpFileBrowserItem[]
  viewModeStorageKey?: string
  defaultViewMode: SftpFileViewMode
  preferences?: SshWorkspacePreferenceAdapter
}

export interface UseSftpFileBrowserControllerResult {
  selectedFiles: string[]
  setSelectedFiles: Dispatch<SetStateAction<string[]>>
  clearSelectedFiles: () => void
  searchTerm: string
  setSearchTerm: Dispatch<SetStateAction<string>>
  showHidden: boolean
  toggleHidden: () => void
  viewMode: SftpFileViewMode
  setViewMode: Dispatch<SetStateAction<SftpFileViewMode>>
  sortBy: SftpFileSortKey
  sortOrder: SftpFileSortOrder
  filteredFiles: EnhancedSftpFileBrowserItem[]
  handleSort: (key: SftpFileSortKey) => void
  handleFileClick: (fileName: string, event: MouseEvent<HTMLElement>) => void
  handleSelectAll: () => void
}

export function useSftpFileBrowserController({
  files,
  viewModeStorageKey,
  defaultViewMode,
  preferences,
}: UseSftpFileBrowserControllerOptions): UseSftpFileBrowserControllerResult {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const deferredSearchTerm = useDeferredValue(searchTerm)
  const [sortBy, setSortBy] = useState<SftpFileSortKey>("name")
  const [sortOrder, setSortOrder] = useState<SftpFileSortOrder>("asc")
  const [showHidden, setShowHidden] = useState(false)
  const filteredFilesRef = useRef<EnhancedSftpFileBrowserItem[]>([])
  const [viewMode, setViewMode] = useState<SftpFileViewMode>(() => {
    if (viewModeStorageKey && preferences) {
      const stored = preferences.getString(viewModeStorageKey)
      if (stored === "grid" || stored === "list") {
        return stored
      }
    }

    return defaultViewMode
  })

  const enhancedFiles = useMemo<EnhancedSftpFileBrowserItem[]>(() => {
    return files.map((file) => ({
      ...file,
      sizeBytes: file.sizeBytes ?? parseFileSize(file.size),
    }))
  }, [files])

  const filteredFiles = useMemo<EnhancedSftpFileBrowserItem[]>(() => {
    const keyword = deferredSearchTerm.trim().toLowerCase()

    const result = enhancedFiles
      .filter((file) => {
        if (!showHidden && file.name.startsWith(".") && file.name !== "..") {
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

    filteredFilesRef.current = result
    return result
  }, [enhancedFiles, showHidden, deferredSearchTerm, sortBy, sortOrder])

  const handleFileSelect = useCallback((fileName: string, event: MouseEvent<HTMLElement>) => {
    const isShift = event.shiftKey
    const isModifier = event.ctrlKey || event.metaKey

    setSelectedFiles((prev) => {
      if (isShift && prev.length > 0) {
        const lastIndex = filteredFilesRef.current.findIndex((file) => file.name === prev[prev.length - 1])
        const currentIndex = filteredFilesRef.current.findIndex((file) => file.name === fileName)
        if (lastIndex === -1 || currentIndex === -1) {
          return prev
        }

        const start = Math.min(lastIndex, currentIndex)
        const end = Math.max(lastIndex, currentIndex)
        const range = filteredFilesRef.current.slice(start, end + 1).map((file) => file.name)
        return Array.from(new Set([...prev, ...range]))
      }

      if (isModifier) {
        return prev.includes(fileName)
          ? prev.filter((file) => file !== fileName)
          : [...prev, fileName]
      }

      if (prev.length === 1 && prev[0] === fileName) {
        return []
      }

      return [fileName]
    })
  }, [])

  const handleFileClick = useCallback((fileName: string, event: MouseEvent<HTMLElement>) => {
    event.stopPropagation()
    handleFileSelect(fileName, event)
  }, [handleFileSelect])

  const handleSelectAll = useCallback(() => {
    setSelectedFiles((prev) => {
      if (prev.length === filteredFiles.length) {
        return []
      }
      return filteredFiles.map((file) => file.name)
    })
  }, [filteredFiles])

  const handleSort = useCallback((key: SftpFileSortKey) => {
    setSortBy((previousKey) => {
      setSortOrder((previousOrder) => (
        previousKey === key && previousOrder === "asc" ? "desc" : "asc"
      ))
      return key
    })
  }, [])

  const clearSelectedFiles = useCallback(() => {
    setSelectedFiles([])
  }, [])

  const toggleHidden = useCallback(() => {
    setShowHidden((value) => !value)
  }, [])

  useEffect(() => {
    if (!viewModeStorageKey || !preferences) {
      return
    }

    void preferences.setString(viewModeStorageKey, viewMode)
  }, [preferences, viewMode, viewModeStorageKey])

  return {
    selectedFiles,
    setSelectedFiles,
    clearSelectedFiles,
    searchTerm,
    setSearchTerm,
    showHidden,
    toggleHidden,
    viewMode,
    setViewMode,
    sortBy,
    sortOrder,
    filteredFiles,
    handleSort,
    handleFileClick,
    handleSelectAll,
  }
}
