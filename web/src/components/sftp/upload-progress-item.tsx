"use client"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle2,
  XCircle,
  Clock,
  Upload,
  Server,
  ArrowRight,
  Loader2,
} from "lucide-react"
import type { WorkspaceTransferTask } from "@/lib/session/workspace"
import {
  useWorkspaceCommonTranslator,
  useWorkspaceSftpTranslator,
} from "@/components/ssh-workspace/use-workspace-translator"

export interface UploadProgressItemProps {
  task: WorkspaceTransferTask
  onCancel?: (taskId: string) => void
}

/**
 * 传输进度组件
 * 上传入口统一展示为流式上传，旧链路的阶段细节只保留在专属传输任务页。
 */
export function UploadProgressItem({ task, onCancel }: UploadProgressItemProps) {
  const tSftp = useWorkspaceSftpTranslator()
  const tCommon = useWorkspaceCommonTranslator()

  // 判断当前阶段
  const isCompleted = task.status === 'completed'
  const isFailed = task.status === 'failed'
  const isCancelled = task.status === 'cancelled'
  const isPending = task.status === 'pending'
  const isActive = task.status === 'uploading' || task.status === 'downloading'
  const uploadProgress = Math.min(100, Math.max(0, Math.round(task.progress || 0)))

  // 主状态图标
  const getMainStatusIcon = () => {
    if (isCompleted) {
      return <CheckCircle2 className="h-4 w-4 text-status-connected" />
    }
    if (isFailed) {
      return <XCircle className="h-4 w-4 text-destructive" />
    }
    if (isCancelled) {
      return <XCircle className="h-4 w-4 text-muted-foreground" />
    }
    if (isPending) {
      return <Clock className="h-4 w-4 text-status-warning" />
    }
    return <Upload className="h-4 w-4 text-primary animate-pulse" />
  }

  return (
    <div className="px-3 py-2.5 border-b last:border-b-0 hover:bg-table-row-hover transition-colors">
      {/* 文件名和状态 */}
      <div className="flex items-center gap-2 mb-2">
        {getMainStatusIcon()}
        <span className="text-sm font-medium truncate flex-1">
          {task.fileName}
        </span>
        <Badge
          variant="outline"
          className="text-[10px] h-4 px-1 shrink-0"
        >
          {task.type === "upload"
            ? tSftp("transferTypeUpload")
            : task.type === "transfer"
            ? tSftp("transferTypeTransfer")
            : tSftp("transferTypeDownload")}
        </Badge>
      </div>

      {/* 上传进度指示器 */}
      {task.type === 'upload' && (isActive || isCompleted || isFailed || isCancelled) && (
        <div className="mb-2">
          <div className="flex items-center gap-1 mb-1.5">
            <div className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all",
              isActive && "bg-primary/10 text-primary",
              isCompleted && "bg-status-connected/10 text-status-connected",
              isFailed && "bg-destructive/10 text-destructive",
              isCancelled && "bg-muted text-muted-foreground"
            )}>
              {isFailed || isCancelled ? (
                <XCircle className={cn("h-3.5 w-3.5", isCancelled ? "text-muted-foreground" : "text-destructive")} />
              ) : isCompleted ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-status-connected" />
              ) : (
                <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
              )}
              <Upload className="h-3 w-3" />
              <span>{tSftp("uploadStageStream")}</span>
            </div>
          </div>

          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-300 ease-out",
                isCompleted ? "bg-status-connected" : "bg-primary"
              )}
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* 跨服务器传输两阶段进度指示器 */}
      {task.type === 'transfer' && (task.status === 'transferring' || isCompleted || isFailed || isCancelled) && (
        <div className="mb-2">
          {/* 阶段步骤指示器 */}
          <div className="flex items-center gap-1 mb-1.5">
            {/* 阶段一：读取源服务器 */}
            <div className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all",
              task.status === 'transferring' && task.progress < 100 && "bg-primary/10 text-primary",
              (isCompleted || task.progress === 100) && "bg-status-connected/10 text-status-connected",
              isFailed && "bg-destructive/10 text-destructive",
              isCancelled && "bg-muted text-muted-foreground"
            )}>
              {isFailed || isCancelled ? (
                <XCircle className={cn("h-3.5 w-3.5", isCancelled ? "text-muted-foreground" : "text-destructive")} />
              ) : isCompleted ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-status-connected" />
              ) : (
                <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
              )}
              <Server className="h-3 w-3" />
              <span>{tSftp("transferStageRead")}</span>
            </div>

            {/* 箭头 */}
            <ArrowRight className={cn(
              "h-3 w-3 transition-colors",
              isCompleted ? "text-status-connected" : task.status === 'transferring' ? "text-primary" : "text-muted-foreground/40"
            )} />

            {/* 阶段二：写入目标服务器 */}
            <div className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all",
              task.status === 'transferring' && task.progress < 100 && "bg-primary/10 text-primary",
              isCompleted && "bg-status-connected/10 text-status-connected",
              isFailed && "bg-destructive/10 text-destructive",
              isCancelled && "bg-muted text-muted-foreground"
            )}>
              {isFailed || isCancelled ? (
                <XCircle className={cn("h-3.5 w-3.5", isCancelled ? "text-muted-foreground" : "text-destructive")} />
              ) : isCompleted ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-status-connected" />
              ) : (
                <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
              )}
              <Server className="h-3 w-3" />
              <span>{tSftp("transferStageWrite")}</span>
            </div>
          </div>

          {/* 组合进度条 - 两边同步显示相同进度 */}
          <div className="flex gap-0.5">
            {/* 读取进度 */}
            <div className="flex-1 h-1.5 bg-muted rounded-l-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300 ease-out",
                  isCompleted ? "bg-status-connected" : "bg-primary"
                )}
                style={{ width: `${task.progress}%` }}
              />
            </div>
            {/* 写入进度 */}
            <div className="flex-1 h-1.5 bg-muted rounded-r-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300 ease-out",
                  isCompleted ? "bg-status-connected" : "bg-primary"
                )}
                style={{ width: `${task.progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 详细信息 + 取消操作 */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          {isActive ? (
            <>
              {task.type === 'upload' && (
                <span className={cn(
                  "font-medium",
                  "text-primary"
                )}>
                  {tSftp("uploadStageStreamShort")}
                </span>
              )}
              {task.speed && (
                <>
                  <span className="text-muted-foreground/60">•</span>
                  <span>{task.speed}</span>
                </>
              )}
              {task.timeRemaining && (
                <>
                  <span className="text-muted-foreground/60">•</span>
                  <span>{task.timeRemaining}</span>
                </>
              )}
            </>
          ) : task.status === "transferring" ? (
            <>
              <span className="text-primary font-medium">
                {tSftp("transferStatusTransferring")}
              </span>
              {task.speed && (
                <>
                  <span className="text-muted-foreground/60">•</span>
                  <span>{task.speed}</span>
                </>
              )}
              {task.timeRemaining && (
                <>
                  <span className="text-muted-foreground/60">•</span>
                  <span>{task.timeRemaining}</span>
                </>
              )}
            </>
          ) : isCompleted ? (
            <span className="text-status-connected">
              {tSftp("transferStatusCompleted")} {task.fileSize !== '-' && `• ${task.fileSize}`}
            </span>
          ) : isFailed ? (
            <span className="text-destructive" title={task.error}>
              {tSftp("transferStatusFailed")}: {task.error}
            </span>
          ) : isCancelled ? (
            <span className="text-muted-foreground">
              {tSftp("transferStatusCancelled")}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {/* 总进度百分比 */}
          {isActive && task.type === 'upload' && (
            <span className="font-mono text-[10px]">
              {uploadProgress}%
            </span>
          )}
          {isActive && task.type !== 'upload' && (
            <span className="font-mono text-[10px]">{task.progress}%</span>
          )}
          {/* 跨服务器传输进度百分比 */}
          {task.status === "transferring" && (
            <span className="font-mono text-[10px]">{Math.round(task.progress)}%</span>
          )}

          {/* 取消按钮 */}
          {onCancel && (isActive || task.status === "transferring") && (
            <button
              type="button"
              onClick={() => onCancel(task.id)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <XCircle className="h-3 w-3" />
              <span>{tCommon("cancel")}</span>
            </button>
          )}
        </div>
      </div>

      {/* 跨服务器传输信息 */}
      {task.type === "transfer" && task.sourceServer && task.targetServer && (
        <div className="text-xs text-muted-foreground mt-1 truncate flex items-center gap-1">
          <Server className="h-3 w-3" />
          <span>{task.sourceServer}</span>
          <ArrowRight className="h-3 w-3" />
          <span>{task.targetServer}</span>
        </div>
      )}
    </div>
  )
}
