"use client"

import { FolderOpen, Upload } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading/loading-spinner"
import { useWorkspaceSftpTranslator } from "@/components/ssh-workspace/use-workspace-translator"
import { cn } from "@/lib/utils"

export interface SftpFileBrowserStateProps {
  isDragging: boolean
  isLoading: boolean
  isEmpty: boolean
  searchTerm: string
}

export function SftpFileBrowserState({
  isDragging,
  isLoading,
  isEmpty,
  searchTerm,
}: SftpFileBrowserStateProps) {
  const tSftp = useWorkspaceSftpTranslator()

  const dragOverlay = isDragging ? (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-[2px] border-2 border-dashed border-primary/60 m-1 rounded-lg pointer-events-none animate-in fade-in-0 duration-200">
      <div className="text-center">
        <Upload className="h-10 w-10 text-primary mx-auto mb-3 animate-bounce" />
        <p className="text-base font-semibold text-primary">
          {tSftp("overlayDropTitle")}
        </p>
        <p className="text-xs text-primary/70 mt-1">
          {tSftp("overlayDropDescription")}
        </p>
      </div>
    </div>
  ) : null

  if (isLoading) {
    return (
      <>
        {dragOverlay}
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner size="lg" label={tSftp("loadingFiles")} />
        </div>
      </>
    )
  }

  if (isEmpty) {
    return (
      <>
        {dragOverlay}
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <FolderOpen className={cn(
              "h-16 w-16 mx-auto mb-4 text-muted-foreground/30",
            )} />
            <h3 className={cn(
              "text-lg font-semibold mb-2 text-muted-foreground",
            )}>
              {tSftp("emptyDirTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {searchTerm ? tSftp("emptyDirNoMatch") : tSftp("emptyDirNoFiles")}
            </p>
          </div>
        </div>
      </>
    )
  }

  return dragOverlay
}
