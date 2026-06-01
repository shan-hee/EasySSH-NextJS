"use client"

import { MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { FileActionMenu, type FileAction } from "@/components/sftp/file-action-menu"
import { cn } from "@/lib/utils"
import type { SftpFileItem } from "@/lib/sftp-file-utils"

export type SftpFileActionDropdownFile = Pick<SftpFileItem, "name" | "type" | "size" | "modified" | "permissions">

export interface SftpFileActionDropdownProps {
  file: SftpFileActionDropdownFile
  selectedFilesCount: number
  onAction: (action: FileAction) => void
}

export function SftpFileActionDropdown({
  file,
  selectedFilesCount,
  onAction,
}: SftpFileActionDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 w-7 p-0 transition-all text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(
          "min-w-[180px] rounded-lg border-border/60 bg-popover/95 text-popover-foreground backdrop-blur-xl",
        )}
      >
        <FileActionMenu
          file={file}
          mode="dropdown"
          selectedFilesCount={selectedFilesCount}
          onAction={onAction}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
