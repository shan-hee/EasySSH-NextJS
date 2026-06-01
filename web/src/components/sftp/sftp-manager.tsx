"use client"

import { useRef, useMemo, useCallback, type HTMLAttributes } from "react"
import { createPortal } from "react-dom"
import { SftpSessionProvider } from "@/contexts/sftp-session-context"
import "@/components/Folder.css"
import "@/components/File.css"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { ChmodDialog } from "@/components/sftp/chmod-dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import type { BatchDeleteResult } from "@/lib/session/sftp-operations"
import { DEFAULT_SFTP_DOWNLOAD_EXCLUDE_PATTERNS } from "@/lib/session/workspace-settings"
import type { SshWorkspacePreferenceAdapter, WorkspaceTransferTask } from "@/lib/session/workspace"
import { useWorkspaceSftpTranslator } from "@/components/ssh-workspace/use-workspace-translator"
import { SftpWorkspaceToolbar } from "@/components/sftp/sftp-workspace-toolbar"
import { SftpFileToolbar } from "@/components/sftp/sftp-file-toolbar"
import { SftpFileBrowserPane } from "@/components/sftp/sftp-file-browser-pane"
import { SftpFileEditorPane } from "@/components/sftp/sftp-file-editor-pane"
import { SftpContextMenu } from "@/components/sftp/sftp-context-menu"
import { useOptionalSshWorkspace } from "@/components/ssh-workspace/ssh-workspace"
import { useSftpFileBrowserController, type SftpFileBrowserItem } from "@/components/sftp/use-sftp-file-browser-controller"
import { useSftpDragDropController } from "@/components/sftp/use-sftp-drag-drop-controller"
import { useSftpFileActionController } from "@/components/sftp/use-sftp-file-action-controller"
import { useSftpWorkspaceHeaderController } from "@/components/sftp/use-sftp-workspace-header-controller"

export type SftpManagerFileItem = SftpFileBrowserItem

export interface SftpManagerProps {
  serverId: string
  serverName: string
  host: string
  username: string
  isConnected: boolean
  currentPath: string
  files: SftpManagerFileItem[]
  sessionId: string
  sessionLabel: string
  sessionColor?: string
  isFullscreen?: boolean
  viewModeStorageKey?: string
  defaultViewMode?: "grid" | "list"
  isLoading?: boolean // 是否正在加载文件列表
  onNavigate: (path: string) => void
  onNavigateBack?: () => void | Promise<void>
  canNavigateBack?: boolean
  onInternalBackHandlerChange?: (
    handler: { handle: () => boolean | Promise<boolean> } | null
  ) => void
  onUpload: (files: FileList, onProgress?: (fileName: string, loaded: number, total: number) => void) => void
  onDownload: (fileName: string) => void
  onDelete: (fileName: string) => void
  onBatchDelete?: (fileNames: string[]) => Promise<BatchDeleteResult>
  onBatchDownload?: (fileNames: string[], excludePatterns?: string[]) => Promise<void>
  onCreateFolder: (name: string) => void
  onCreateFile?: (name: string) => void
  onRename: (oldName: string, newName: string) => void
  onDisconnect: () => void
  onRefresh: () => void
  onReadFile?: (fileName: string) => Promise<string>
  onSaveFile?: (fileName: string, content: string) => Promise<void>
  onRenameSession?: (newLabel: string) => void
  onToggleFullscreen?: () => void
  dragHandleListeners?: HTMLAttributes<HTMLDivElement>
  dragHandleAttributes?: HTMLAttributes<HTMLDivElement>
  // 传输任务管理(从外部传入)
  transferTasks?: WorkspaceTransferTask[]
  onClearCompletedTransfers?: () => void
  onCancelTransfer?: (taskId: string) => void
  preferences?: SshWorkspacePreferenceAdapter
}

export function SftpManager(props: SftpManagerProps) {
  const tSftp = useWorkspaceSftpTranslator()
  const workspace = useOptionalSshWorkspace()

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
    viewModeStorageKey = "easyssh:sftp:viewMode:sftp",
    defaultViewMode = "grid",
    isLoading = false,
    onNavigate,
    onNavigateBack,
    canNavigateBack,
    onInternalBackHandlerChange,
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
    transferTasks,
    onClearCompletedTransfers,
    onCancelTransfer,
    preferences,
  } = props
  const workspaceTransferManager = workspace?.adapters.transferManager
  const effectiveTransferTasks = transferTasks ?? workspaceTransferManager?.tasks ?? []
  const effectiveClearCompletedTransfers = onClearCompletedTransfers ?? workspaceTransferManager?.clearCompleted
  const effectiveCancelTransfer = onCancelTransfer ?? workspaceTransferManager?.cancelTask
  const showTransferTasks = transferTasks !== undefined || !!workspaceTransferManager
  const {
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
  } = useSftpFileBrowserController({
    files,
    viewModeStorageKey,
    defaultViewMode,
    preferences: preferences ?? workspace?.adapters.preferences,
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const editingSessionLabelRef = useRef(false)

  const {
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
  } = useSftpDragDropController({
    sessionId,
    currentPath,
    files,
    dropZoneRef,
    onRename,
    onUpload,
  })

  const excludePatterns = workspace?.adapters.settings?.sftp?.downloadExcludePatterns
    ?? DEFAULT_SFTP_DOWNLOAD_EXCLUDE_PATTERNS

  const {
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
    handleFileAction,
    handleContextMenuAction,
    confirmDelete,
    handleChmod,
  } = useSftpFileActionController({
    serverId,
    currentPath,
    filteredFiles,
    selectedFiles,
    setSelectedFiles,
    clearSelectedFiles,
    onSelectAll: handleSelectAll,
    editInputRef,
    fileInputRef,
    excludePatterns,
    tSftp,
    notifier: workspace?.adapters.notifier,
    chmodFile: workspace?.adapters.apiClient?.sftp?.chmod,
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
    onUploadFiles: handleFileUpload,
  })

  const {
    editingSessionLabel,
    tempSessionLabel,
    setTempSessionLabel,
    sessionLabelInputRef,
    pathInputValue,
    setPathInputValue,
    isEditingPath,
    setIsEditingPath,
    displayPath,
    pathSegments,
    startEditSessionLabel,
    finishEditSessionLabel,
    cancelEditSessionLabel,
  } = useSftpWorkspaceHeaderController({
    sessionLabel,
    currentPath,
    isEditorOpen: editorState.isOpen,
    editorPath: editorState.filePath,
    onRenameSession,
    editingSessionLabelRef,
  })

  // 清除已完成任务 - 使用外部传入的处理函数
  const handleClearCompleted = useCallback(() => {
    effectiveClearCompletedTransfers?.()
  }, [effectiveClearCompletedTransfers])

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

  // 主界面内容
  const managerContent = (
    <TooltipProvider delayDuration={300}>
      <SftpSessionProvider value={sessionContextValue}>
        <div
          className={cn(
            "flex h-full min-w-0 flex-col overflow-hidden transition-colors bg-background",
            isFullscreen ? "fixed inset-0 z-[9999] rounded-none border-0" : "rounded-xl border"
          )}
        >
      <SftpWorkspaceToolbar
        sessionLabel={sessionLabel}
        sessionColor={sessionColor}
        editingSessionLabel={editingSessionLabel}
        tempSessionLabel={tempSessionLabel}
        sessionLabelInputRef={sessionLabelInputRef}
        dragHandleListeners={dragHandleListeners}
        dragHandleAttributes={dragHandleAttributes}
        onTempSessionLabelChange={setTempSessionLabel}
        onStartEditSessionLabel={startEditSessionLabel}
        onFinishEditSessionLabel={finishEditSessionLabel}
        onCancelEditSessionLabel={cancelEditSessionLabel}
        displayPath={displayPath}
        pathInputValue={pathInputValue}
        pathSegments={pathSegments}
        isEditingPath={isEditingPath}
        isEditorOpen={editorState.isOpen}
        onPathInputValueChange={setPathInputValue}
        onEditingPathChange={setIsEditingPath}
        onNavigate={onNavigate}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showTransferTasks={showTransferTasks}
        transferTasks={effectiveTransferTasks}
        onClearCompletedTransfers={handleClearCompleted}
        onCancelTransfer={effectiveCancelTransfer}
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
        onDisconnect={onDisconnect}
      />

      {/* 如果编辑器打开，只显示编辑器；否则显示搜索栏+文件列表 */}
      {editorState.isOpen ? (
        <SftpFileEditorPane
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
          <SftpFileToolbar
            showBackButton={!!canNavigateBack || pathSegments.length > 0}
            onBack={() => {
              if (canNavigateBack && onNavigateBack) {
                return onNavigateBack()
              }

              const parentPath = pathSegments.slice(0, -1).join("/")
              onNavigate(parentPath ? `/${parentPath}` : "/")
            }}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            showHidden={showHidden}
            onToggleHidden={toggleHidden}
            selectedCount={selectedFiles.length}
            onRefresh={onRefresh}
          />

          <SftpFileBrowserPane
            viewMode={viewMode}
            filteredFiles={filteredFiles}
            selectedFiles={selectedFiles}
            sortBy={sortBy}
            sortOrder={sortOrder}
            isDragging={isDragging}
            isLoading={isLoading}
            searchTerm={searchTerm}
            creatingNew={creatingNew}
            editingFile={editingFile}
            editingFileName={editingFileName}
            draggedFileName={draggedFileName}
            dragOverFolder={dragOverFolder}
            dropZoneRef={dropZoneRef}
            fileInputRef={fileInputRef}
            editInputRef={editInputRef}
            folderLabel={tSftp("itemTypeFolder")}
            onClearSelectedFiles={clearSelectedFiles}
            onBlankContextMenu={handleBlankContextMenu}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onEditingFileNameChange={setEditingFileName}
            onFinishCreate={finishCreate}
            onCancelCreate={cancelCreate}
            onCreateBlur={handleCreateBlur}
            onFinishRename={finishRename}
            onCancelRename={cancelRename}
            onRenameBlur={handleRenameBlur}
            onNativeDragStart={handleNativeDragStart}
            onNativeDragEnd={handleNativeDragEnd}
            onNativeDragOver={handleNativeDragOver}
            onNativeDragLeave={clearDragOverFolder}
            onNativeDrop={handleNativeDrop}
            onFileClick={handleFileClick}
            onFileDoubleClick={handleFileDoubleClick}
            onContextMenu={handleContextMenu}
            onSort={handleSort}
            onAction={handleFileAction}
            onInputChange={handleInputChange}
          />
        </>
      )}

      {/* 权限修改对话框 */}
      <ChmodDialog
        open={chmodDialog.isOpen}
        onOpenChange={setChmodDialogOpen}
        fileName={chmodDialog.fileName}
        currentPermissions={chmodDialog.permissions}
        onConfirm={handleChmod}
      />

      {/* 删除确认对话框 */}
      <ConfirmDialog
        open={deleteConfirmDialog.isOpen}
        onOpenChange={setDeleteConfirmDialogOpen}
        title={deleteConfirmDialog.fileNames.length > 0
          ? tSftp("deleteConfirmTitleBatch", { count: deleteConfirmDialog.fileNames.length })
          : tSftp("deleteConfirmTitle")}
        description={deleteConfirmDialog.isDirectory
          ? tSftp("deleteConfirmDescriptionDirectory")
          : tSftp("deleteConfirmDescription")}
        confirmText={tSftp("deleteConfirmButton")}
        variant="destructive"
        onConfirm={confirmDelete}
      />


      <SftpContextMenu
        contextMenu={contextMenu}
        file={contextMenuFile}
        selectedFilesCount={selectedFiles.length}
        onAction={handleContextMenuAction}
        onCreateFolder={() => startCreateNew("folder")}
        onCreateFile={() => startCreateNew("file")}
        onUpload={() => fileInputRef.current?.click()}
        onRefresh={onRefresh}
        onClose={closeContextMenu}
      />
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
