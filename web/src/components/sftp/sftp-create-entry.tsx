"use client"

import type { FocusEvent, KeyboardEvent, RefObject } from "react"
import { FileText, FolderOpen } from "lucide-react"
import { TableCell, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { useWorkspaceSftpTranslator } from "@/components/ssh-workspace/use-workspace-translator"
import { cn } from "@/lib/utils"
import Folder from "@/components/Folder"
import FileIcon from "@/components/File"

export interface SftpCreateEntryProps {
  variant: "grid" | "list"
  type: "file" | "folder"
  name: string
  inputRef: RefObject<HTMLInputElement | null>
  onNameChange: (value: string) => void
  onConfirm: () => void
  onCancel: () => void
  onBlur: (event: FocusEvent<HTMLInputElement>) => void
}

export function SftpCreateEntry({
  variant,
  type,
  name,
  inputRef,
  onNameChange,
  onConfirm,
  onCancel,
  onBlur,
}: SftpCreateEntryProps) {
  const tSftp = useWorkspaceSftpTranslator()

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      onConfirm()
    } else if (event.key === "Escape") {
      onCancel()
    }

    if (variant === "list") {
      event.stopPropagation()
    }
  }

  if (variant === "grid") {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-3">
        <div
          className={cn(
            "group relative rounded-lg p-3 cursor-pointer select-none transition-all bg-table-row-selected",
          )}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center justify-center h-16 w-16">
              {type === "folder" ? (
                <Folder color="var(--chart-1)" size={0.6} isFocused={true} />
              ) : (
                <FileIcon
                  color="var(--chart-1)"
                  size={0.6}
                  fileType="TXT"
                  isFocused={true}
                />
              )}
            </div>
            <div className="text-center w-full">
              <Input
                ref={inputRef}
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={onBlur}
                className={cn(
                  "h-6 text-xs text-center px-1 bg-background text-foreground",
                )}
              />
              <div className="text-[10px] text-muted-foreground truncate mt-1">
                {type === "folder" ? tSftp("itemTypeFolder") : "0 B"}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <TableRow
      className={cn(
        "cursor-pointer transition-colors bg-table-row-selected border-b-0",
      )}
    >
      <TableCell>
        <div className="flex items-center gap-2">
          {type === "folder" ? (
            <FolderOpen className="h-4 w-4 text-chart-1" />
          ) : (
            <FileText className="h-4 w-4 text-chart-1" />
          )}
          <Input
            ref={inputRef}
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={onBlur}
            onClick={(event) => event.stopPropagation()}
            className={cn(
              "h-7 text-sm px-2 flex-1 bg-background text-foreground",
            )}
          />
        </div>
      </TableCell>

      <TableCell>
        <span className="font-mono text-xs text-muted-foreground">
          {type === "folder" ? "-" : "0 B"}
        </span>
      </TableCell>

      <TableCell>
        <span className="text-xs text-muted-foreground">
          {tSftp("justNow")}
        </span>
      </TableCell>

      <TableCell>
        <span className="font-mono text-xs text-muted-foreground">-</span>
      </TableCell>

      <TableCell className="text-right">
        <div className="h-7 w-7" />
      </TableCell>
    </TableRow>
  )
}
