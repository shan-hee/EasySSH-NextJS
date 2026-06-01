"use client"

import type { DragEvent, FocusEvent, KeyboardEvent, MouseEvent, Ref, RefObject } from "react"
import { ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { TableCell, TableRow } from "@/components/ui/table"
import { SftpFileActionDropdown } from "@/components/sftp/sftp-file-action-dropdown"
import { renderSftpFileListIcon } from "@/components/sftp/sftp-file-icons"
import type { FileAction } from "@/components/sftp/file-action-menu"
import { cn } from "@/lib/utils"
import type { SftpFileItem } from "@/lib/sftp-file-utils"

export type SftpFileTableRowItem = Pick<SftpFileItem, "name" | "type" | "size" | "modified" | "permissions">

export interface SftpFileTableRowProps {
  file: SftpFileTableRowItem
  dataIndex?: number
  measureElement?: Ref<HTMLTableRowElement>
  isSelected: boolean
  isEditing: boolean
  isDraggedOver: boolean
  isDragged: boolean
  editingFileName: string
  editInputRef: RefObject<HTMLInputElement | null>
  selectedFilesCount: number
  onEditingFileNameChange: (value: string) => void
  onFinishRename: () => void
  onCancelRename: () => void
  onRenameBlur: (event: FocusEvent<HTMLInputElement>) => void
  onDragStart: (event: DragEvent<HTMLTableRowElement>, fileName: string) => void
  onDragEnd: () => void
  onDragOver: (event: DragEvent<HTMLTableRowElement>, fileName: string, fileType: "file" | "directory") => void
  onDragLeave: () => void
  onDrop: (event: DragEvent<HTMLTableRowElement>, fileName: string, fileType: "file" | "directory") => void
  onClick: (fileName: string, event: MouseEvent<HTMLTableRowElement>) => void
  onDoubleClick: (fileName: string, fileType: "file" | "directory") => void
  onContextMenu: (event: MouseEvent<HTMLTableRowElement>, fileName: string, fileType: "file" | "directory") => void
  onAction: (file: SftpFileTableRowItem, action: FileAction) => void
}

export function SftpFileTableRow({
  file,
  dataIndex,
  measureElement,
  isSelected,
  isEditing,
  isDraggedOver,
  isDragged,
  editingFileName,
  editInputRef,
  selectedFilesCount,
  onEditingFileNameChange,
  onFinishRename,
  onCancelRename,
  onRenameBlur,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
  onDoubleClick,
  onContextMenu,
  onAction,
}: SftpFileTableRowProps) {
  const handleRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      onFinishRename()
    } else if (event.key === "Escape") {
      onCancelRename()
    }
    event.stopPropagation()
  }

  return (
    <TableRow
      key={file.name}
      data-index={dataIndex}
      ref={measureElement}
      draggable={!isEditing}
      onDragStart={(event) => onDragStart(event, file.name)}
      onDragEnd={onDragEnd}
      onDragOver={(event) => onDragOver(event, file.name, file.type)}
      onDragLeave={(event) => {
        event.preventDefault()
        onDragLeave()
      }}
      onDrop={(event) => onDrop(event, file.name, file.type)}
      className={cn(
        "cursor-pointer transition-colors border-b-0",
        (isSelected || (isDraggedOver && file.type === "directory")) && "bg-table-row-selected hover:bg-table-row-selected",
        "hover:bg-table-row-hover",
        isDragged && "opacity-50",
      )}
      onClick={(event) => onClick(file.name, event)}
      onDoubleClick={() => onDoubleClick(file.name, file.type)}
      onContextMenu={(event) => onContextMenu(event, file.name, file.type)}
    >
      <TableCell>
        <div className="flex items-center gap-2">
          {renderSftpFileListIcon(file)}
          {isEditing ? (
            <Input
              ref={editInputRef}
              value={editingFileName}
              onChange={(event) => onEditingFileNameChange(event.target.value)}
              onKeyDown={handleRenameKeyDown}
              onBlur={onRenameBlur}
              onClick={(event) => event.stopPropagation()}
              className={cn(
                "h-7 text-sm px-2 flex-1 bg-background text-foreground",
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

      <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
        <SftpFileActionDropdown
          file={file}
          selectedFilesCount={selectedFilesCount}
          onAction={(action) => onAction(file, action)}
        />
      </TableCell>
    </TableRow>
  )
}
