"use client"

import React from "react"
import { Server } from "lucide-react"
import { SftpManager } from "@/components/sftp/sftp-manager"
import type { WorkspaceTransferTask } from "@/lib/session/workspace"
import type { BatchDeleteResult } from "@/lib/session/sftp-operations"
import type { SftpWorkspaceSession } from "@/lib/session/workspace"

export interface SftpSessionCardProps {
  session: SftpWorkspaceSession
  isFullscreen: boolean
  connectingText: string
  transferTasks?: WorkspaceTransferTask[]
  onClearCompletedTransfers?: () => void
  onCancelTransfer?: (taskId: string) => void
  onNavigateSession: (sessionId: string, path: string) => void
  onUploadSession: (sessionId: string, files: FileList, onProgress?: (fileName: string, loaded: number, total: number) => void) => void
  onDownloadSession: (sessionId: string, fileName: string) => void
  onDeleteSession: (sessionId: string, fileName: string) => void
  onBatchDeleteSession: (sessionId: string, fileNames: string[]) => Promise<BatchDeleteResult>
  onBatchDownloadSession: (sessionId: string, fileNames: string[], excludePatterns?: string[]) => Promise<void>
  onCreateFolderSession: (sessionId: string, name: string) => void
  onCreateFileSession: (sessionId: string, name: string) => void
  onRenameSessionFile: (sessionId: string, oldName: string, newName: string) => void
  onDisconnectSession: (sessionId: string) => void
  onRefreshSession: (sessionId: string) => void
  onReadFileSession: (sessionId: string, fileName: string) => Promise<string>
  onSaveFileSession: (sessionId: string, fileName: string, content: string) => Promise<void>
  onRenameSessionLabel: (sessionId: string, newLabel: string) => void
  onToggleFullscreen: (sessionId: string) => void
  dragHandleListeners?: React.HTMLAttributes<HTMLDivElement>
  dragHandleAttributes?: React.HTMLAttributes<HTMLDivElement>
}

export const SftpSessionCard = React.memo(function SftpSessionCard({
  session,
  isFullscreen,
  connectingText,
  transferTasks,
  onClearCompletedTransfers,
  onCancelTransfer,
  onNavigateSession,
  onUploadSession,
  onDownloadSession,
  onDeleteSession,
  onBatchDeleteSession,
  onBatchDownloadSession,
  onCreateFolderSession,
  onCreateFileSession,
  onRenameSessionFile,
  onDisconnectSession,
  onRefreshSession,
  onReadFileSession,
  onSaveFileSession,
  onRenameSessionLabel,
  onToggleFullscreen,
  dragHandleListeners,
  dragHandleAttributes,
}: SftpSessionCardProps) {
  const onNavigate = React.useCallback((path: string) => onNavigateSession(session.id, path), [onNavigateSession, session.id])
  const onUpload = React.useCallback(
    (files: FileList, onProgress?: (fileName: string, loaded: number, total: number) => void) =>
      onUploadSession(session.id, files, onProgress),
    [onUploadSession, session.id],
  )
  const onDownload = React.useCallback((fileName: string) => onDownloadSession(session.id, fileName), [onDownloadSession, session.id])
  const onDelete = React.useCallback((fileName: string) => onDeleteSession(session.id, fileName), [onDeleteSession, session.id])
  const onBatchDelete = React.useCallback((fileNames: string[]) => onBatchDeleteSession(session.id, fileNames), [onBatchDeleteSession, session.id])
  const onBatchDownload = React.useCallback(
    (fileNames: string[], excludePatterns?: string[]) =>
      onBatchDownloadSession(session.id, fileNames, excludePatterns),
    [onBatchDownloadSession, session.id],
  )
  const onCreateFolder = React.useCallback((name: string) => onCreateFolderSession(session.id, name), [onCreateFolderSession, session.id])
  const onCreateFile = React.useCallback((name: string) => onCreateFileSession(session.id, name), [onCreateFileSession, session.id])
  const onRename = React.useCallback((oldName: string, newName: string) => onRenameSessionFile(session.id, oldName, newName), [onRenameSessionFile, session.id])
  const onDisconnect = React.useCallback(() => onDisconnectSession(session.id), [onDisconnectSession, session.id])
  const onRefresh = React.useCallback(() => onRefreshSession(session.id), [onRefreshSession, session.id])
  const onReadFile = React.useCallback((fileName: string) => onReadFileSession(session.id, fileName), [onReadFileSession, session.id])
  const onSaveFile = React.useCallback(
    (fileName: string, content: string) => onSaveFileSession(session.id, fileName, content),
    [onSaveFileSession, session.id],
  )
  const onRenameLabel = React.useCallback((newLabel: string) => onRenameSessionLabel(session.id, newLabel), [onRenameSessionLabel, session.id])
  const onToggleFullscreenBound = React.useCallback(() => onToggleFullscreen(session.id), [onToggleFullscreen, session.id])

  if (!session.isConnected) {
    return (
      <div className="h-full flex flex-col rounded-xl border bg-card overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3 py-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg border border-border bg-muted/60">
              <Server className="h-6 w-6 text-primary animate-pulse" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">{connectingText}</p>
              <p className="text-xs text-muted-foreground font-mono">{session.serverName || session.host}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <SftpManager
      serverId={session.serverId}
      serverName={session.serverName}
      host={session.host}
      username={session.username}
      isConnected={session.isConnected}
      currentPath={session.currentPath}
      files={session.files}
      sessionId={session.id}
      sessionLabel={session.label}
      sessionColor={session.color}
      isFullscreen={isFullscreen}
      viewModeStorageKey="easyssh:sftp:viewMode:sftp"
      defaultViewMode="grid"
      isLoading={session.isLoading}
      onNavigate={onNavigate}
      onUpload={onUpload}
      onDownload={onDownload}
      onDelete={onDelete}
      onBatchDelete={onBatchDelete}
      onBatchDownload={onBatchDownload}
      onCreateFolder={onCreateFolder}
      onCreateFile={onCreateFile}
      onRename={onRename}
      onDisconnect={onDisconnect}
      onRefresh={onRefresh}
      onReadFile={onReadFile}
      onSaveFile={onSaveFile}
      onRenameSession={onRenameLabel}
      onToggleFullscreen={onToggleFullscreenBound}
      dragHandleListeners={dragHandleListeners}
      dragHandleAttributes={dragHandleAttributes}
      transferTasks={transferTasks}
      onClearCompletedTransfers={onClearCompletedTransfers}
      onCancelTransfer={onCancelTransfer}
    />
  )
})
