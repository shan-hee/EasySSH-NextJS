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
import type { TransferTask } from "@/hooks/useFileTransfer"
import { useTranslations } from "next-intl"

interface UploadProgressItemProps {
  task: TransferTask
  onCancel?: (taskId: string) => void
}

/**
 * 两阶段上传进度组件
 * 阶段一：本地 → 服务器 (HTTP)
 * 阶段二：服务器 → 远端 (SFTP)
 */
export function UploadProgressItem({ task, onCancel }: UploadProgressItemProps) {
  const tSftp = useTranslations("sftp")
  const tCommon = useTranslations("common")

  // 判断当前阶段
  const isHttpStage = task.stage === 'http' || (!task.stage && task.status === 'uploading')
  const isSftpStage = task.stage === 'sftp'
  const isCompleted = task.status === 'completed'
  const isFailed = task.status === 'failed'
  const isCancelled = task.status === 'cancelled'
  const isPending = task.status === 'pending'
  const isActive = task.status === 'uploading' || task.status === 'downloading'

  // 计算各阶段的进度
  // HTTP 阶段完成���，进度条显示 SFTP 阶段的进度
  const httpProgress = isHttpStage ? task.progress : (isSftpStage || isCompleted ? 100 : 0)
  const sftpProgress = isSftpStage ? task.progress : (isCompleted ? 100 : 0)

  // 状态图标
  const getStageIcon = (stage: 'http' | 'sftp', isCurrentStage: boolean, isStageCompleted: boolean) => {
    if (isFailed || isCancelled) {
      return <XCircle className="h-3.5 w-3.5 text-red-500" />
    }
    if (isStageCompleted) {
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
    }
    if (isCurrentStage) {
      return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
    }
    return <Clock className="h-3.5 w-3.5 text-zinc-400" />
  }

  // 主状态图标
  const getMainStatusIcon = () => {
    if (isCompleted) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    }
    if (isFailed) {
      return <XCircle className="h-4 w-4 text-red-500" />
    }
    if (isCancelled) {
      return <XCircle className="h-4 w-4 text-zinc-400" />
    }
    if (isPending) {
      return <Clock className="h-4 w-4 text-yellow-500" />
    }
    return <Upload className="h-4 w-4 text-blue-500 animate-pulse" />
  }

  return (
    <div className="px-3 py-2.5 border-b last:border-b-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
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

      {/* 两阶段进度指示器 - 仅在上传进行中或已完成时显示 */}
      {task.type === 'upload' && (isActive || isCompleted || isFailed || isCancelled) && (
        <div className="mb-2">
          {/* 阶段步骤指示器 */}
          <div className="flex items-center gap-1 mb-1.5">
            {/* 阶段一：HTTP */}
            <div className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all",
              isHttpStage && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
              httpProgress === 100 && !isHttpStage && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
              !isHttpStage && httpProgress < 100 && "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500"
            )}>
              {getStageIcon('http', isHttpStage, httpProgress === 100 && !isHttpStage)}
              <Upload className="h-3 w-3" />
              <span>{tSftp("uploadStageHttp")}</span>
            </div>

            {/* 箭头 */}
            <ArrowRight className={cn(
              "h-3 w-3 transition-colors",
              isSftpStage || isCompleted ? "text-blue-500" : "text-zinc-300 dark:text-zinc-600"
            )} />

            {/* 阶段二：SFTP */}
            <div className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all",
              isSftpStage && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
              isCompleted && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
              !isSftpStage && !isCompleted && "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500"
            )}>
              {getStageIcon('sftp', isSftpStage, isCompleted)}
              <Server className="h-3 w-3" />
              <span>{tSftp("uploadStageSftp")}</span>
            </div>
          </div>

          {/* 组合进度条 */}
          <div className="flex gap-0.5">
            {/* HTTP 阶段进度 */}
            <div className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-l-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300 ease-out",
                  httpProgress === 100 ? "bg-green-500" : "bg-blue-500"
                )}
                style={{ width: `${httpProgress}%` }}
              />
            </div>
            {/* SFTP 阶段进度 */}
            <div className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-r-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300 ease-out",
                  isCompleted ? "bg-green-500" : "bg-blue-500"
                )}
                style={{ width: `${sftpProgress}%` }}
              />
            </div>
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
              task.status === 'transferring' && task.progress < 100 && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
              (isCompleted || task.progress === 100) && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
              isFailed && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
              isCancelled && "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500"
            )}>
              {isFailed || isCancelled ? (
                <XCircle className="h-3.5 w-3.5 text-red-500" />
              ) : isCompleted ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
              )}
              <Server className="h-3 w-3" />
              <span>{tSftp("transferStageRead")}</span>
            </div>

            {/* 箭头 */}
            <ArrowRight className={cn(
              "h-3 w-3 transition-colors",
              task.status === 'transferring' || isCompleted ? "text-blue-500" : "text-zinc-300 dark:text-zinc-600"
            )} />

            {/* 阶段二：写入目标服务器 */}
            <div className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all",
              task.status === 'transferring' && task.progress < 100 && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
              isCompleted && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
              isFailed && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
              isCancelled && "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500"
            )}>
              {isFailed || isCancelled ? (
                <XCircle className="h-3.5 w-3.5 text-red-500" />
              ) : isCompleted ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
              )}
              <Server className="h-3 w-3" />
              <span>{tSftp("transferStageWrite")}</span>
            </div>
          </div>

          {/* 组合进度条 - 两边同步显示相同进度 */}
          <div className="flex gap-0.5">
            {/* 读取进度 */}
            <div className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-l-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300 ease-out",
                  isCompleted ? "bg-green-500" : "bg-blue-500"
                )}
                style={{ width: `${task.progress}%` }}
              />
            </div>
            {/* 写入进度 */}
            <div className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-r-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300 ease-out",
                  isCompleted ? "bg-green-500" : "bg-blue-500"
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
              {task.stage && (
                <span className={cn(
                  "font-medium",
                  task.stage === 'http' ? "text-blue-600 dark:text-blue-400" : "text-purple-600 dark:text-purple-400"
                )}>
                  {task.stage === 'http' ? tSftp("uploadStageHttpShort") : tSftp("uploadStageSftpShort")}
                </span>
              )}
              {task.speed && (
                <>
                  <span className="text-zinc-400">•</span>
                  <span>{task.speed}</span>
                </>
              )}
              {task.timeRemaining && (
                <>
                  <span className="text-zinc-400">•</span>
                  <span>{task.timeRemaining}</span>
                </>
              )}
            </>
          ) : task.status === "transferring" ? (
            <>
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                {tSftp("transferStatusTransferring")}
              </span>
              {task.speed && (
                <>
                  <span className="text-zinc-400">•</span>
                  <span>{task.speed}</span>
                </>
              )}
              {task.timeRemaining && (
                <>
                  <span className="text-zinc-400">•</span>
                  <span>{task.timeRemaining}</span>
                </>
              )}
            </>
          ) : isCompleted ? (
            <span className="text-green-600 dark:text-green-400">
              {tSftp("transferStatusCompleted")} {task.fileSize !== '-' && `• ${task.fileSize}`}
            </span>
          ) : isFailed ? (
            <span className="text-red-600 dark:text-red-400" title={task.error}>
              {tSftp("transferStatusFailed")}: {task.error}
            </span>
          ) : isCancelled ? (
            <span className="text-zinc-500 dark:text-zinc-400">
              {tSftp("transferStatusCancelled")}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {/* 总进度百分比 */}
          {isActive && task.type === 'upload' && (
            <span className="font-mono text-[10px]">
              {Math.round((httpProgress + sftpProgress) / 2)}%
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
              className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-red-500 transition-colors"
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
