"use client"

import { createPortal } from "react-dom"
import { useEffect, useRef } from "react"
import { FolderPlus, FileText, RefreshCw, Upload } from "lucide-react"
import { FileActionMenu, type FileAction } from "@/components/sftp/file-action-menu"
import { useWorkspaceSftpTranslator } from "@/components/ssh-workspace/use-workspace-translator"
import { cn } from "@/lib/utils"
import { computeFloatingPosition } from "@/lib/overlay-position"
import type { SftpFileItem } from "@/lib/sftp-file-utils"

export interface SftpContextMenuState {
  x: number
  y: number
  fileName?: string
  fileType?: "file" | "directory"
  isBlank?: boolean
  key?: number
}

export type SftpContextMenuFile = Pick<SftpFileItem, "name" | "type" | "size" | "modified" | "permissions">

export interface SftpContextMenuProps {
  contextMenu: SftpContextMenuState | null
  file: SftpContextMenuFile | null
  selectedFilesCount: number
  onAction: (action: FileAction) => void
  onCreateFolder: () => void
  onCreateFile: () => void
  onUpload: () => void
  onRefresh: () => void
  onClose: () => void
}

export function SftpContextMenu({
  contextMenu,
  file,
  selectedFilesCount,
  onAction,
  onCreateFolder,
  onCreateFile,
  onUpload,
  onRefresh,
  onClose,
}: SftpContextMenuProps) {
  const tSftp = useWorkspaceSftpTranslator()
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!contextMenu) return

    const handleClickOutside = () => {
      onClose()
    }

    const timer = window.setTimeout(() => {
      document.addEventListener("click", handleClickOutside)
    }, 0)

    return () => {
      window.clearTimeout(timer)
      document.removeEventListener("click", handleClickOutside)
    }
  }, [contextMenu, onClose])

  useEffect(() => {
    if (!contextMenu || !menuRef.current) return

    const menu = menuRef.current
    const rect = menu.getBoundingClientRect()
    const coords = computeFloatingPosition({
      anchor: { x: contextMenu.x, y: contextMenu.y },
      rect,
      preferredPlacements: ["bottom", "top", "right", "left"],
      margin: 8,
    })

    if (!coords) {
      onClose()
      return
    }

    menu.style.left = `${coords.left}px`
    menu.style.top = `${coords.top}px`
  }, [contextMenu, onClose])

  if (!contextMenu) {
    return null
  }

  return createPortal(
    <div
      ref={menuRef}
      key={contextMenu.key}
      className="fixed z-[9999] animate-in fade-in-0 zoom-in-95 duration-200"
      style={{
        left: `${contextMenu.x}px`,
        top: `${contextMenu.y}px`,
      }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.stopPropagation()
      }}
    >
      <div
        className={cn(
          "min-w-[200px] rounded-lg shadow-md border p-1 bg-popover text-popover-foreground border-border",
        )}
      >
        {selectedFilesCount > 1 && (
          <>
            <div
              className={cn(
                "px-3 py-1.5 text-xs font-medium text-muted-foreground",
              )}
            >
              {tSftp("contextSelectedTitle", { count: selectedFilesCount })}
            </div>
            <div className={cn("h-px mx-2 mb-1 bg-border")} />
          </>
        )}

        {contextMenu.isBlank ? (
          <>
            <button
              className="w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-all hover:bg-accent hover:text-accent-foreground rounded-sm"
              onClick={() => {
                onCreateFolder()
                onClose()
              }}
            >
              <FolderPlus className="h-4 w-4" />
              <span className="flex-1">{tSftp("contextNewFolder")}</span>
              <kbd className={cn(
                "text-[10px] px-1.5 py-0.5 rounded font-mono bg-muted text-muted-foreground",
              )}>
                ⌘⇧N
              </kbd>
            </button>

            <button
              className="w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-all hover:bg-accent hover:text-accent-foreground rounded-sm"
              onClick={() => {
                onCreateFile()
                onClose()
              }}
            >
              <FileText className="h-4 w-4" />
              <span className="flex-1">{tSftp("contextNewFile")}</span>
              <kbd className={cn(
                "text-[10px] px-1.5 py-0.5 rounded font-mono bg-muted text-muted-foreground",
              )}>
                ⌘N
              </kbd>
            </button>

            <button
              className="w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-all hover:bg-accent hover:text-accent-foreground rounded-sm"
              onClick={() => {
                onUpload()
                onClose()
              }}
            >
              <Upload className="h-4 w-4" />
              <span className="flex-1">{tSftp("contextUploadFile")}</span>
              <kbd className={cn(
                "text-[10px] px-1.5 py-0.5 rounded font-mono bg-muted text-muted-foreground",
              )}>
                ⌘U
              </kbd>
            </button>

            <button
              className="w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-all hover:bg-accent hover:text-accent-foreground rounded-sm"
              onClick={() => {
                onRefresh()
                onClose()
              }}
            >
              <RefreshCw className="h-4 w-4" />
              <span className="flex-1">{tSftp("contextRefresh")}</span>
              <kbd className={cn(
                "text-[10px] px-1.5 py-0.5 rounded font-mono bg-muted text-muted-foreground",
              )}>
                ⌘R
              </kbd>
            </button>
          </>
        ) : file ? (
          <FileActionMenu
            file={file}
            mode="context"
            selectedFilesCount={selectedFilesCount}
            onAction={(action) => {
              onAction(action)
              onClose()
            }}
          />
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
