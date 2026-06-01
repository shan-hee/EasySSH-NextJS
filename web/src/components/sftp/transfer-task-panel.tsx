"use client"

import { Activity, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useWorkspaceSftpTranslator } from "@/components/ssh-workspace/use-workspace-translator"
import { UploadProgressItem } from "@/components/sftp/upload-progress-item"
import type { WorkspaceTransferTask } from "@/lib/session/workspace"

export interface TransferTaskPanelProps {
  transferTasks: WorkspaceTransferTask[]
  onClearCompletedTransfers?: () => void
  onCancelTransfer?: (taskId: string) => void
}

export function TransferTaskPanel({
  transferTasks,
  onClearCompletedTransfers,
  onCancelTransfer,
}: TransferTaskPanelProps) {
  const tSftp = useWorkspaceSftpTranslator()
  const effectiveTransferTasks = transferTasks
  const pendingCount = effectiveTransferTasks.filter((task) => task.status !== "completed" && task.status !== "failed" && task.status !== "cancelled").length
  const hasCompletedTasks = effectiveTransferTasks.some((task) => task.status === "completed" || task.status === "failed" || task.status === "cancelled")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 rounded-md transition-all duration-200 text-muted-foreground hover:bg-accent hover:text-accent-foreground relative",
          )}
          title={tSftp("transferPanelButtonTitle")}
        >
          <Upload className="h-3.5 w-3.5" />
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-medium flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[400px] max-h-[500px] overflow-hidden">
        <div className="px-3 py-2 flex items-center justify-between border-b">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              {tSftp("transferPanelTitle", { count: effectiveTransferTasks.length })}
            </span>
          </div>
          {hasCompletedTasks && onClearCompletedTransfers && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={onClearCompletedTransfers}
            >
              {tSftp("transferPanelClearCompleted")}
            </Button>
          )}
        </div>

        {effectiveTransferTasks.length > 0 ? (
          <div className="max-h-[400px] overflow-y-auto">
            {effectiveTransferTasks.map((task) => (
              <UploadProgressItem
                key={task.id}
                task={task}
                onCancel={onCancelTransfer}
              />
            ))}
          </div>
        ) : (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            {tSftp("transferPanelEmpty")}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
