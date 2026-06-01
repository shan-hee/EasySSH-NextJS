"use client"

import { useRef, type ChangeEvent, type DragEvent, type FocusEvent, type MouseEvent, type RefObject } from "react"
import { Table, TableBody } from "@/components/ui/table"
import { useFileListVirtualizer } from "@/hooks/use-file-list-virtualizer"
import { cn } from "@/lib/utils"
import { SftpCreateEntry } from "@/components/sftp/sftp-create-entry"
import { SftpFileBrowserState } from "@/components/sftp/sftp-file-browser-state"
import { SftpFileGridItem } from "@/components/sftp/sftp-file-grid-item"
import { SftpFileTableHeader } from "@/components/sftp/sftp-file-table-header"
import { SftpFileTableRow } from "@/components/sftp/sftp-file-table-row"
import type { FileAction } from "@/components/sftp/file-action-menu"
import type {
  EnhancedSftpFileBrowserItem,
  SftpFileSortKey,
  SftpFileSortOrder,
  SftpFileViewMode,
} from "@/components/sftp/use-sftp-file-browser-controller"
import type { SftpCreateEntryType } from "@/components/sftp/use-sftp-file-action-controller"

export interface SftpFileBrowserPaneProps {
  viewMode: SftpFileViewMode
  filteredFiles: EnhancedSftpFileBrowserItem[]
  selectedFiles: string[]
  sortBy: SftpFileSortKey
  sortOrder: SftpFileSortOrder
  isDragging: boolean
  isLoading: boolean
  searchTerm: string
  creatingNew: SftpCreateEntryType | null
  editingFile: string | null
  editingFileName: string
  draggedFileName: string | null
  dragOverFolder: string | null
  dropZoneRef: RefObject<HTMLDivElement | null>
  fileInputRef: RefObject<HTMLInputElement | null>
  editInputRef: RefObject<HTMLInputElement | null>
  folderLabel: string
  onClearSelectedFiles: () => void
  onBlankContextMenu: (event: MouseEvent<HTMLDivElement>) => void
  onDragEnter: (event: DragEvent<HTMLDivElement>) => void
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void
  onDragOver: (event: DragEvent<HTMLDivElement>) => void
  onDrop: (event: DragEvent<HTMLDivElement>) => void
  onEditingFileNameChange: (value: string) => void
  onFinishCreate: () => void | Promise<void>
  onCancelCreate: () => void
  onCreateBlur: (event: FocusEvent<HTMLInputElement>) => void
  onFinishRename: () => void
  onCancelRename: () => void
  onRenameBlur: (event: FocusEvent<HTMLInputElement>) => void
  onNativeDragStart: (event: DragEvent, fileName: string) => void
  onNativeDragEnd: () => void
  onNativeDragOver: (event: DragEvent, fileName: string, fileType: "file" | "directory") => void
  onNativeDragLeave: () => void
  onNativeDrop: (event: DragEvent, fileName: string, fileType: "file" | "directory") => void
  onFileClick: (fileName: string, event: MouseEvent<HTMLElement>) => void
  onFileDoubleClick: (fileName: string, fileType: "file" | "directory") => void
  onContextMenu: (event: MouseEvent<HTMLElement>, fileName: string, fileType: "file" | "directory") => void
  onSort: (key: SftpFileSortKey) => void
  onAction: (file: EnhancedSftpFileBrowserItem, action: FileAction) => void
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void
}

export function SftpFileBrowserPane({
  viewMode,
  filteredFiles,
  selectedFiles,
  sortBy,
  sortOrder,
  isDragging,
  isLoading,
  searchTerm,
  creatingNew,
  editingFile,
  editingFileName,
  draggedFileName,
  dragOverFolder,
  dropZoneRef,
  fileInputRef,
  editInputRef,
  folderLabel,
  onClearSelectedFiles,
  onBlankContextMenu,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onEditingFileNameChange,
  onFinishCreate,
  onCancelCreate,
  onCreateBlur,
  onFinishRename,
  onCancelRename,
  onRenameBlur,
  onNativeDragStart,
  onNativeDragEnd,
  onNativeDragOver,
  onNativeDragLeave,
  onNativeDrop,
  onFileClick,
  onFileDoubleClick,
  onContextMenu,
  onSort,
  onAction,
  onInputChange,
}: SftpFileBrowserPaneProps) {
  const listScrollRef = useRef<HTMLDivElement>(null)
  const gridScrollRef = useRef<HTMLDivElement>(null)
  const shouldVirtualize = filteredFiles.length > 100
  const gridColumns = 6

  const listVirtualizer = useFileListVirtualizer({
    scrollElementRef: listScrollRef,
    count: filteredFiles.length,
    viewMode: "list",
    enabled: shouldVirtualize && viewMode === "list",
  })
  const gridVirtualizer = useFileListVirtualizer({
    scrollElementRef: gridScrollRef,
    count: filteredFiles.length,
    viewMode: "grid",
    gridColumns,
    enabled: shouldVirtualize && viewMode === "grid",
  })

  const renderGridItem = (file: EnhancedSftpFileBrowserItem) => (
    <SftpFileGridItem
      key={file.name}
      file={file}
      isSelected={selectedFiles.includes(file.name)}
      isEditing={editingFile === file.name}
      isDraggedOver={dragOverFolder === file.name}
      isDragged={draggedFileName === file.name}
      editingFileName={editingFileName}
      editInputRef={editInputRef}
      folderLabel={folderLabel}
      onEditingFileNameChange={onEditingFileNameChange}
      onFinishRename={onFinishRename}
      onCancelRename={onCancelRename}
      onRenameBlur={onRenameBlur}
      onDragStart={(event, fileName) => onNativeDragStart(event, fileName)}
      onDragEnd={onNativeDragEnd}
      onDragOver={(event, fileName, fileType) => onNativeDragOver(event, fileName, fileType)}
      onDragLeave={onNativeDragLeave}
      onDrop={(event, fileName, fileType) => onNativeDrop(event, fileName, fileType)}
      onClick={(fileName, event) => onFileClick(fileName, event)}
      onDoubleClick={onFileDoubleClick}
      onContextMenu={(event, fileName, fileType) => onContextMenu(event, fileName, fileType)}
    />
  )

  const renderTableRow = (file: EnhancedSftpFileBrowserItem, dataIndex?: number) => (
    <SftpFileTableRow
      key={file.name}
      file={file}
      dataIndex={dataIndex}
      measureElement={dataIndex !== undefined ? listVirtualizer.virtualizer.measureElement : undefined}
      isSelected={selectedFiles.includes(file.name)}
      isEditing={editingFile === file.name}
      isDraggedOver={dragOverFolder === file.name}
      isDragged={draggedFileName === file.name}
      editingFileName={editingFileName}
      editInputRef={editInputRef}
      selectedFilesCount={selectedFiles.length}
      onEditingFileNameChange={onEditingFileNameChange}
      onFinishRename={onFinishRename}
      onCancelRename={onCancelRename}
      onRenameBlur={onRenameBlur}
      onDragStart={(event, fileName) => onNativeDragStart(event, fileName)}
      onDragEnd={onNativeDragEnd}
      onDragOver={(event, fileName, fileType) => onNativeDragOver(event, fileName, fileType)}
      onDragLeave={onNativeDragLeave}
      onDrop={(event, fileName, fileType) => onNativeDrop(event, fileName, fileType)}
      onClick={(fileName, event) => onFileClick(fileName, event)}
      onDoubleClick={onFileDoubleClick}
      onContextMenu={(event, fileName, fileType) => onContextMenu(event, fileName, fileType)}
      onAction={(_, action) => onAction(file, action)}
    />
  )

  const hasVisibleContent = !isLoading && (filteredFiles.length > 0 || creatingNew)

  return (
    <div
      ref={dropZoneRef}
      className={cn(
        "flex-1 relative min-h-0",
        viewMode === "grid" ? "overflow-auto scrollbar-custom" : "",
        isDragging && "bg-primary/10",
      )}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onClearSelectedFiles}
      onContextMenu={onBlankContextMenu}
    >
      <SftpFileBrowserState
        isDragging={isDragging}
        isLoading={isLoading}
        isEmpty={filteredFiles.length === 0 && !creatingNew}
        searchTerm={searchTerm}
      />

      {hasVisibleContent && (
        viewMode === "grid" ? (
          <div ref={gridScrollRef} className="overflow-auto h-full scrollbar-custom">
            <div
              className="p-3"
              style={{
                height: shouldVirtualize ? `${gridVirtualizer.virtualizer.getTotalSize()}px` : "auto",
                position: "relative",
              }}
            >
              {creatingNew && (
                <SftpCreateEntry
                  variant="grid"
                  type={creatingNew}
                  name={editingFileName}
                  inputRef={editInputRef}
                  onNameChange={onEditingFileNameChange}
                  onConfirm={() => { void onFinishCreate() }}
                  onCancel={onCancelCreate}
                  onBlur={onCreateBlur}
                />
              )}

              {shouldVirtualize ? (
                gridVirtualizer.virtualizer.getVirtualItems().map((virtualRow) => {
                  const { start, end } = gridVirtualizer.getFileIndicesForRow(virtualRow.index)
                  const rowFiles = filteredFiles.slice(start, end)

                  return (
                    <div
                      key={virtualRow.index}
                      data-index={virtualRow.index}
                      ref={gridVirtualizer.virtualizer.measureElement}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {rowFiles.map(renderGridItem)}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {filteredFiles.map(renderGridItem)}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div ref={listScrollRef} className="overflow-auto h-full scrollbar-custom">
            <Table className="sftp-table text-xs [&_th]:h-9 [&_th]:px-3 [&_th]:text-xs [&_td]:px-3 [&_td]:py-1.5 [&_td]:align-middle">
              <SftpFileTableHeader
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
              <TableBody>
                {creatingNew && (
                  <SftpCreateEntry
                    variant="list"
                    type={creatingNew}
                    name={editingFileName}
                    inputRef={editInputRef}
                    onNameChange={onEditingFileNameChange}
                    onConfirm={() => { void onFinishCreate() }}
                    onCancel={onCancelCreate}
                    onBlur={onCreateBlur}
                  />
                )}

                {shouldVirtualize && listVirtualizer.virtualizer.getVirtualItems().length > 0 && (
                  <tr style={{ height: `${listVirtualizer.virtualizer.getVirtualItems()[0]?.start ?? 0}px` }} />
                )}

                {shouldVirtualize ? (
                  <>
                    {listVirtualizer.virtualizer.getVirtualItems().map((virtualRow) => {
                      const file = filteredFiles[virtualRow.index]
                      if (!file) return null
                      return renderTableRow(file, virtualRow.index)
                    })}
                    {listVirtualizer.virtualizer.getVirtualItems().length > 0 && (
                      <tr
                        style={{
                          height: `${
                            listVirtualizer.virtualizer.getTotalSize() -
                            (listVirtualizer.virtualizer.getVirtualItems()[listVirtualizer.virtualizer.getVirtualItems().length - 1]?.end ?? 0)
                          }px`,
                        }}
                      />
                    )}
                  </>
                ) : (
                  filteredFiles.map((file) => renderTableRow(file))
                )}
              </TableBody>
            </Table>
          </div>
        )
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        tabIndex={-1}
        onChange={onInputChange}
      />
    </div>
  )
}
