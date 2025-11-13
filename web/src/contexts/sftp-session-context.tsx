"use client"

import { createContext, useContext } from "react"

interface FileItem {
  name: string
  type: "file" | "directory"
  size: string
  modified: string
  permissions: string
  owner: string
  group: string
}

interface SftpSessionContextValue {
  // 会话信息
  sessionId: string
  sessionLabel: string
  sessionColor?: string
  serverId: string  // 修改为 string 以匹配 SftpManager
  serverName: string
  host: string
  username: string
  isConnected: boolean
  isFullscreen: boolean

  // 文件系统状态
  currentPath: string
  files: FileItem[]

  // 操作回调
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
  onToggleFullscreen?: () => void
}

const SftpSessionContext = createContext<SftpSessionContextValue | null>(null)

export function useSftpSession() {
  const context = useContext(SftpSessionContext)
  if (!context) {
    throw new Error("useSftpSession must be used within SftpSessionProvider")
  }
  return context
}

export const SftpSessionProvider = SftpSessionContext.Provider
